import { excludesAutomaticOpening, EXPLORATION_OPENING_HELP } from './opening-spell-policy'
import {controlSelectionForActors,validateControlSelection} from './m2-social-controls'
import type { BattleRequest, BattleOpening } from './battle-types'
import type { Character } from './types'
import type { MapWorld, MapScene } from './map-types'
import type { CombatCommand, Combatant, Encounter, Environment } from './combat-types'
import type { Catalogue } from './engine'
import { attackOptions, freshTurn } from './combat-rules'
import { runtimeSpells, runtimeState, findItem } from './runtime'
import { spellSummonForms } from './phb-companions'
import { validateSupportSpell } from './support-spells'
import { HIT_TRIGGER_SPELLS } from './phb-spell-rules'
export function combatOpeningModes(g: ReturnType<typeof runtimeSpells>[number]) {
  if (excludesAutomaticOpening(g.spell.id)) return []
  if (/minute|hour|reaction/i.test(g.spell.castingTime) || HIT_TRIGGER_SPELLS.includes(g.spell.id))
    return []
  return g.modes.filter((mode) => mode !== 'ritual')
}

export function explorationAttacks(c: Character, cat: Catalogue) {
  const actor: Combatant = {
    id: c.id,
    characterId: c.id,
    npc: null,
    side: 'party',
    initiative: null,
    surprised: false,
    turn: freshTurn(),
  }
  return attackOptions(actor, [c], cat)
}
export function validateOpening(
  world: MapWorld,
  scene: MapScene,
  characterId: string | null,
  opening: BattleOpening,
  cat: Catalogue,
) {
  const c = world.characters.find((c) => c.id === characterId)
  if (!c || !scene.tokens.some((t) => t.characterId === c.id && !t.hidden))
    throw Error('行动者不在当前公开场景')
  if (
    !opening.tokenIds.length ||
    opening.tokenIds.some((id) => !scene.tokens.some((t) => t.id === id && !t.hidden))
  )
    throw Error('请选择当前公开场景中的有效目标')
  if (
    opening.kind === 'attack' &&
    !explorationAttacks(c, cat).some((a) => a.id === opening.attackId)
  )
    throw Error('武器已不可用，请重新选择当前装备')
  if (opening.kind === 'cast') {
    const g = runtimeSpells(c, cat).find((g) => g.key === opening.key)
    if (g && excludesAutomaticOpening(g.spell.id)) throw Error(EXPLORATION_OPENING_HELP)
    if (g) {validateSupportSpell(g.spell.id, opening);validateControlSelection(g.spell.id,opening,opening.tokenIds)}
    if(opening.controlTargets?.some(id=>!scene.tokens.some(t=>t.id===id&&!t.hidden)))throw Error('交涉关系对象必须来自当前公开场景')
    if (!g || !g.modes.includes(opening.mode)) throw Error('法术或施放来源已不可用')
    if (!combatOpeningModes(g).includes(opening.mode))
      throw Error('此法术不适合作为直接开场主动行动；请使用探索施法或满足触发时机后的反应入口')
    if (['shillelagh', 'true-strike'].includes(g.spell.id)) {
      const w = explorationAttacks(c, cat).find((w) => w.id === opening.weaponId && !!w.weaponId)
      if (!w || (g.spell.id === 'shillelagh' && !['club', 'quarterstaff'].includes(w.weaponId!)))
        throw Error('请先选择有效的当前手持武器')
    }
    if (['magic-weapon', 'elemental-weapon'].includes(g.spell.id)) {
      const targetToken = scene.tokens.find((t) => t.id === opening.tokenIds[0]),
        target = world.characters.find((c) => c.id === targetToken?.characterId)
      const row = target?.inventory.find(
        (r) => r.instanceId === opening.weaponId && r.quantity === 1,
      )
      if (!target || !row || findItem(target, cat, row.itemId)?.kind !== 'weapon')
        throw Error('请选择目标的一件真实武器')
    }
    if (g.spell.id === 'cordon-of-arrows') {
      const ammo = opening.ammunition,
        row = c.inventory.find((r) => r.instanceId === ammo?.instanceId)
      if (!ammo || !row || !['arrow', 'bolt'].includes(row.itemId) || row.quantity < ammo.count)
        throw Error('请先配置背包中的足够弹药')
    }
    if (
      g.spell.id.startsWith('summon-') &&
      !spellSummonForms(g.spell.id).includes(opening.summonForm ?? '')
    )
      throw Error('请先配置与法术相容的灵魄形态')
  }
  if (opening.kind === 'item') {
    const row = c.inventory.find((r) => r.instanceId === opening.instanceId && r.quantity > 0)
    if (!row || !findItem(c, cat, row.itemId)) throw Error('背包物品已不可用')
  }
  if (runtimeState(c, cat).death.dead) throw Error('死亡角色不能提交主动行动')
}
export function openingCommand(
  r: Pick<BattleRequest, 'opening' | 'status' | 'openingStatus' | 'encounterId' | 'characterId'>,
  scene: { tokens: Pick<MapScene['tokens'][number], 'id' | 'actorId' | 'hidden'>[] },
  encounter: { id: string; actors: Pick<Combatant, 'id' | 'characterId'>[] },
  env: Environment,
): CombatCommand {
  if (!r.opening || r.status !== 'accepted') throw Error('主动行动尚未由 GM 确认')
  if (r.openingStatus !== 'waiting') throw Error('主动行动已执行或已取消')
  if (r.encounterId !== encounter.id) throw Error('主动行动所属战斗已变化，请重新提交')
  const actor = encounter.actors.find((a) => a.characterId === r.characterId)
  const targets = r.opening.tokenIds.map((id) => {
    const t = scene.tokens.find((t) => t.id === id && !t.hidden)
    if (!t?.actorId || !encounter.actors.some((a) => a.id === t.actorId))
      throw Error('主动行动目标未参战或已不可用，请重新确认')
    return t.actorId
  })
  if (!actor) throw Error('主动行动角色未加入本次名单')
  const o = r.opening
  if (o.kind === 'attack')
    return {
      type: 'attack',
      actorId: actor.id,
      targetId: targets[0]!,
      attackId: o.attackId,
      env,
      cost: 'action',
      sneak: o.sneak,
      mastery: o.mastery,
    }
  if (o.kind === 'cast')
    return {
      type: 'cast',
      actorId: actor.id,
      key: o.key,
      mode: o.mode,
      targets,
      env,
      requirementsConfirmed: false,
      damageType: o.damageType,
      supportChoice: o.supportChoice,...controlSelectionForActors(o,id=>{const token=scene.tokens.find(t=>t.id===id);return token?.actorId??id}),
      willing: o.willing,
      weaponId: o.weaponId,
      hitDice: o.hitDice,
      summonForm: o.summonForm,
      ammunition: o.ammunition,
    }
  return {
    type: 'item-use',
    actorId: actor.id,
    targetId: targets[0]!,
    instanceId: o.instanceId,
    env,
    note: o.note,
  }
}
export function assertOpeningCommand(
  r: BattleRequest,
  scene: MapScene,
  e: Encounter,
  c: CombatCommand,
) {
  if (e.phase !== 'active') throw Error('请先完成先攻并开始战斗，再执行主动行动')
  const expected = openingCommand(r, scene, e, 'env' in c && c.env ? c.env : ({} as Environment))
  for (const [k, value] of Object.entries(expected)) {
    if (['env', 'requirementsConfirmed'].includes(k) || value === undefined) continue
    if (JSON.stringify(value) !== JSON.stringify((c as unknown as Record<string, unknown>)[k]))
      throw Error('主动行动参数或目标已改变，请重新提交并确认')
  }
  if (e.actors[e.current]?.characterId !== r.characterId)
    throw Error('请等待主动行动角色自己的回合')
}
