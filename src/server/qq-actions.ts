import { excludesAutomaticOpening, EXPLORATION_OPENING_HELP } from '../core/opening-spell-policy'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { explorationAttacks, combatOpeningModes } from '../core/battle-opening'
import { spellEffect } from '../core/combat-rules'
import { directPath } from '../core/map'
import { runtimeSpells, castSlotLevel, findItem } from '../core/runtime'
import { spellTargets, spellDamageOptions } from '../online/combat-controls'
import type { Room, RoomMember, RoomAction } from '../online/protocol'
import type { BattleOpening } from '../core/battle-types'
import { activeScene, adventure, RoomError, projectRoom } from './room-engine'

export function choose<T extends { id: string; name: string }>(
  rows: T[],
  value: string,
  label: string,
): T {
  const matches = rows.filter((r) => r.id === value || r.name === value)
  if (matches.length !== 1)
    throw new RoomError(
      `${label}不明确，请使用完整编号：\n${
        rows
          .slice(0, 10)
          .map((r) => `${r.name} [${r.id}]`)
          .join('\n') || '无可用选项'
      }`,
    )
  return matches[0]!
}

/** Deterministic grammar, actual equipped sources, no model parsing or hidden-target search. */
export function qqAction(
  room: Room,
  member: RoomMember,
  characterId: string,
  text: string,
): RoomAction {
  const scene = activeScene(room)
  if (!scene) throw new RoomError('尚未进入场景')
  const character = room.world.characters.find((c) => c.id === characterId)
  if (!character || !member.characterIds.includes(characterId))
    throw new RoomError('角色权限已失效', 403)
  const publicScene = projectRoom(room, member, []).scene,
    ownTokens = (publicScene?.tokens ?? []).filter((t) => t.characterId === characterId),
    token = ownTokens.length === 1 ? ownTokens[0]! : choose(ownTokens, '', '操控角色'),
    cat = catalogue([srd, ...room.world.packs]),
    encounter = room.world.encounters.find(
      (e) => e.id === scene.encounterId && e.phase === 'active',
    ),
    actor = encounter?.actors.find((a) => a.characterId === characterId)
  if (encounter && (!actor || encounter.actors[encounter.current]?.id !== actor.id))
    throw new RoomError('尚未轮到该角色行动')
  if (encounter?.pending) throw new RoomError('请先完成当前行动与反应结算')
  const combat = (command: Extract<RoomAction, { kind: 'map' }>['command']): RoomAction => ({
    kind: 'map',
    command,
  })
  const target = (value: string) => choose(publicScene?.tokens ?? [], value, '目标')
  const opening = (value: BattleOpening): RoomAction =>
    combat({
      type: 'battle-request',
      sceneId: scene.id,
      name: 'QQ 主动行动',
      reason: text,
      source: 'player',
      sourceId: member.id,
      characterId,
      opening: value,
    })
  const attack = text.match(/^攻击\s+(.+?)\s+使用\s+(.+)$/)
  if (attack) {
    const t = target(attack[1]!),
      a = choose(
        explorationAttacks(character, cat).filter((a) => a.weaponId || a.id === 'unarmed'),
        attack[2]!,
        '武器攻击',
      )
    if (!encounter)
      return opening({
        kind: 'attack',
        attackId: a.id,
        tokenIds: [t.id],
        sneak: false,
        mastery: true,
      })
    if (!t.actorId || !encounter.actors.some((a) => a.id === t.actorId))
      throw new RoomError('目标未参战')
    return combat({
      type: 'combat',
      sceneId: scene.id,
      command: {
        type: 'attack',
        actorId: actor!.id,
        targetId: t.actorId,
        attackId: a.id,
        cost: 'action',
        sneak: false,
        mastery: true,
        env: { ...room.environment, note: text },
      },
    })
  }
  const move = text.match(/^移动\s+(\d{1,2})\s*[,， ]\s*(\d{1,2})$/)
  if (move) {
    const to = { x: Number(move[1]), y: Number(move[2]) }
    if (to.x >= scene.grid.columns || to.y >= scene.grid.rows)
      throw new RoomError('坐标超出当前网格（坐标从 0 开始）')
    return combat({
      type: 'move',
      sceneId: scene.id,
      tokenId: token.id,
      path: directPath(token, to),
      gm: false,
      reason: text,
      reactionsConfirmed: false,
    })
  }
  if (text === '结束回合') {
    if (encounter)
      return combat({
        type: 'combat',
        sceneId: scene.id,
        command: {
          type: 'end-turn',
          actorId: actor!.id,
          encounterId: encounter.id,
          expectedTick: encounter.tick,
        },
      })
    const explore = adventure(room).exploration
    if (explore?.status !== 'active') throw new RoomError('当前未启用探索回合制')
    return combat({
      type: 'explore',
      sceneId: scene.id,
      command: { operation: 'end', tokenId: token.id, roundId: explore.roundId },
    })
  }
  const spell = text.match(/^施法\s+(.+?)\s+模式\s+(\S+)\s+目标\s+(.+?)(\s+敌对)?$/)
  if (spell) {
    const grants = runtimeSpells(character, cat).map((g) => ({
        ...g,
        id: g.key,
        name: g.spell.name,
      })),
      g = choose(grants, spell[1]!, '法术及施放来源'),
      mode = spell[2]!,
      t = target(spell[3]!)
    if (!g.modes.includes(mode) || mode === 'ritual' || /minute|hour|reaction/i.test(g.spell.castingTime) || (!excludesAutomaticOpening(g.spell.id) && !combatOpeningModes(g).includes(mode)))
      throw new RoomError(
        `请选择可用主动施放模式：${combatOpeningModes(g).join('、') || '此法术请在 Web 操作'}`,
      )
    const p = spellTargets(
      g.spell,
      g.key,
      character.level,
      castSlotLevel(mode) || g.spell.level || 1,
    )
    if (
      p.area ||
      p.darts ||
      p.manual ||
      p.max !== 1 ||
      spellDamageOptions(g.spell.id).length ||
      [
        'jump',
        'shillelagh',
        'true-strike',
        'magic-weapon',
        'elemental-weapon',
        'arcane-vigor',
        'cordon-of-arrows',
      ].includes(g.spell.id) ||
      g.spell.id.startsWith('summon-')
    )
      throw new RoomError('此法术包含范围、多目标或特殊参数，请在 Web 操作')
    if (p.self && t.id !== token.id) throw new RoomError('此法术只能以自身为目标')
    const effect = spellEffect(
      g.spell.id,
      character.level,
      castSlotLevel(mode) || g.spell.level || 1,
    )
    if (!encounter && spell[4] && excludesAutomaticOpening(g.spell.id)) throw new RoomError(EXPLORATION_OPENING_HELP)
    if (!encounter && (spell[4] || (effect.dice && ['attack', 'save'].includes(effect.kind))))
      return opening({ kind: 'cast', key: g.key, mode, tokenIds: [t.id], damageType: 'fire' })
    if (!encounter)
      return combat({
        type: 'explore',
        sceneId: scene.id,
        command: {
          operation: 'spell-cast',
          tokenId: token.id,
          key: g.key,
          mode,
          targets: [t.id],
          confirmed: false,
          note: text,
        },
      })
    if (!t.actorId || !encounter.actors.some((a) => a.id === t.actorId))
      throw new RoomError('目标未参战')
    return combat({
      type: 'combat',
      sceneId: scene.id,
      command: {
        type: 'cast',
        actorId: actor!.id,
        key: g.key,
        mode,
        targets: [t.actorId],
        env: { ...room.environment, note: text },
        damageType: 'fire',
        requirementsConfirmed: false,
      },
    })
  }
  const item = text.match(/^使用\s+(.+)$/)
  if (item) {
    const rows = character.inventory
        .filter((r) => r.quantity > 0)
        .map((r) => ({
          ...r,
          id: r.instanceId,
          name: findItem(character, cat, r.itemId)?.name ?? r.itemId,
        })),
      r = choose(rows, item[1]!, '自身消耗品')
    // Only the existing self-use healing potion automation; other consumables need Web parameters.
    if (!['healing-potion'].includes(r.itemId))
      throw new RoomError('此物品的用途或目标需要在 Web 明确；QQ 首包支持自身使用治疗药水')
    if (encounter)
      return combat({
        type: 'combat',
        sceneId: scene.id,
        command: {
          type: 'inventory',
          actorId: actor!.id,
          command: {
            type: 'item-remove',
            instanceId: r.instanceId,
            quantity: 1,
            consume: true,
            note: text,
          },
          cost: 'bonus',
          requirementsConfirmed: false,
          note: text,
        },
      })
    return {
      kind: 'runtime',
      characterId,
      command: {
        type: 'item-remove',
        instanceId: r.instanceId,
        quantity: 1,
        consume: true,
        note: text,
      },
    }
  }
  throw new RoomError(
    '行动语法：移动 x,y；攻击 <目标编号/名称> 使用 <攻击编号/名称>；施法 <来源编号> 模式 <模式> 目标 <目标编号> [敌对]；使用 <药水编号/名称>；结束回合。复杂行动请用 Web。',
  )
}
