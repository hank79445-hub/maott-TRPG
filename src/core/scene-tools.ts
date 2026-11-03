import { NPC_LIMIT } from './configuration-limits'
import { triggerArrivals } from './scene-arrivals'
import { pickupGround, dropGround } from './ground-items'
import { applyCombat } from './combat'
import { removeGrappleCopies } from './grapples'
import { clone, type Catalogue } from './engine'
import { newNpcProfile, defaultAdventureAi } from './ai'
import { npcTemplate } from '../content/npc-templates'
import { syncNpcTokens } from './npc-map'
import { inside, occupied, blocked } from './map'
import type { MapWorld, Adventure, MapScene, MapToken } from './map-types'
import type { SceneToolCommand } from './scene-tools-types'
export const isSceneToolCommand = (c: { type: string }): c is SceneToolCommand =>
  [
    'gm-place-npcs',
    'gm-relocate',
    'arrival-trigger',
    'ground-pickup',
    'ground-drop',
    'grapple-release',
  ].includes(c.type)
export function assertPlacement(
  s: MapScene,
  p: { x: number; y: number },
  span = 1,
  ignoreId?: string,
) {
  if (!occupied({ ...p, span } as MapToken).every((p) => inside(s, p)))
    throw Error('点位超出场景边界')
  if (
    occupied({ ...p, span } as MapToken).some(
      (p) =>
        blocked(s, p) ||
        s.tokens.some(
          (t) => t.id !== ignoreId && occupied(t).some((o) => o.x === p.x && o.y === p.y),
        ),
    )
  )
    throw Error('点位被阻挡或占用')
}
export const npcSpan = (size?: string) =>
  size === 'large' ? 2 : size === 'huge' ? 3 : size === 'gargantuan' ? 4 : 1
export function applySceneTools(
  world: MapWorld,
  a: Adventure,
  c: SceneToolCommand,
  cat: Catalogue,
  dice: (n: number) => number,
  actionId: string,
): string {
  const s = a.scenes.find((s) => s.id === c.sceneId)
  if (!s) throw Error('场景不存在')
  if (c.type === 'grapple-release') {
    const character = world.characters.find((p) => p.id === c.characterId),
      index = world.encounters.findIndex((e) => e.id === c.encounterId),
      e = world.encounters[index],
      source = e?.actors.find((a) => a.characterId === c.characterId),
      target = e?.actors.find((a) => a.id === c.targetId)
    if (
      !character?.runtime?.grapples?.some(
        (g) => g.encounterId === c.encounterId && g.targetId === c.targetId,
      ) ||
      !source ||
      !target ||
      !s.tokens.some((t) => t.characterId === character.id)
    )
      throw Error('没有此角色可释放的擒抱来源')
    const body = world.characters.find((p) => p.id === target.characterId)?.runtime ?? target.npc
    const ids = new Set(
      (body?.effects ?? []).filter((f) => f.grapple && f.sourceId === source.id).map((f) => f.id),
    )
    const next = applyCombat(
      e!,
      world.characters,
      cat,
      { type: 'grapple-release', actorId: source.id, targetId: target.id },
      dice,
    )
    world.encounters[index] = next.encounter
    world.characters = next.characters
    removeGrappleCopies(world, ids)
    return `${character.build.name}释放此前擒抱，无需动作`
  }
  if (c.type === 'ground-drop') return dropGround(world, a, s, c, cat, dice, actionId)
  if (c.type === 'gm-relocate') {
    const t = s.tokens.find((t) => t.id === c.tokenId)
    if (!t) throw Error('棋子不存在')
    if (!c.reason.trim()) throw Error('请填写GM调整原因')
    if (!occupied({ ...t, ...c.position }).every((p) => inside(s, p)))
      throw Error('点位超出场景边界')
    Object.assign(t, c.position)
    t.groundTrail = []
    const n = a.ai?.npcs.find((n) => n.id === t.npcId)
    if (n) {
      n.position = { ...c.position }
      n.revision++
    }
    const m = a.exploration?.members.find((m) => m.tokenId === t.id)
    if (m) m.trail = []
    const actor = world.encounters.flatMap((e) => e.actors).find((actor) => actor.id === t.actorId)
    if (actor) actor.turn.groundTrail = []
    return `GM强制移位 ${t.name}：${c.reason}；沿途不触发，终点陷阱／进入伤害／剧情请GM另行检查结算`
  }
  if (c.type === 'gm-place-npcs') {
    a.ai ??= defaultAdventureAi()
    if (!!c.templateId === !!c.sourceNpcId) throw Error('请选择一个模板或普通NPC配置来源')
    const source = a.ai.npcs.find((n) => n.id === c.sourceNpcId),
      template = c.templateId ? npcTemplate(c.templateId, a.ai.templates) : null
    if (source && (source.npcType !== 'ordinary' || !source.body || source.characterId))
      throw Error('只能复制普通NPC配置')
    if (!source && !template) throw Error('模板或来源不存在')
    if (a.ai.npcs.length + c.positions.length > NPC_LIMIT)
      throw Error(`最多${NPC_LIMIT}名NPC，请先清理不用的配置`)
    for (const p of c.positions) {
      const n = source ? clone(source) : newNpcProfile(s.id, 'ordinary')
      if (template) {
        n.name = template.name
        n.body = clone(template.body)
        n.strategy = template.strategy
        n.combatPolicy.strategy = template.strategy
        n.templateId = template.id
        if (template.metadata?.requiresManualTurn) n.turnMode = 'manual'
      }
      n.id = crypto.randomUUID()
      n.sceneId = s.id
      n.position = { ...p }
      n.actorId = null
      n.guardOrigin = { sceneId: s.id, ...p }
      if (n.body)
        Object.assign(n.body, {
          hp: n.body.maxHp,
          temporaryHp: 0,
          conditions: [],
          effects: [],
          dead: false,
        })
      n.preauthorization.remaining = 0
      n.preauthorization.expiresAt = null
      delete n.arrivalOrigin
      n.memory = []
      n.experiences = []
      n.relations = []
      n.urgingCooldowns = []
      n.revealedIds = []
      n.initiallyAbsent = false
      delete n.appeared
      delete n.turnHold
      n.behaviorState = 'none'
      n.revision = 0
      assertPlacement(s, p, npcSpan(n.body?.size))
      a.ai.npcs.push(n)
      syncNpcTokens(a, world)
    }
    return `GM放置${c.positions.length}名独立普通NPC（未自动参战）`
  }
  if (c.type === 'arrival-trigger') {
    if (a.activeSceneId !== s.id) throw Error('请先正式进入该场景，再处理出场组')
    triggerArrivals(world, a, s, [c.groupId], cat, actionId)
    return 'GM处理出场组：' + (s.arrivalGroups?.find((g) => g.id === c.groupId)?.reason || '已完成')
  }
  if (c.type === 'ground-pickup') return pickupGround(world, a, s, c, cat, dice, actionId)
  throw Error('场景工具尚未支持此操作')
}
