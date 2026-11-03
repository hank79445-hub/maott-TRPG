import {systemMessage} from '../shared/localization/system-messages'
import type { MapWorld, Adventure, MapScene, MapToken, MapPoint, Position } from './map-types'
import type { Catalogue } from './engine'
import { distance } from './map'
import {sceneVision} from './scene-lighting'
import {tokenM3State} from './m3-map-perception'
import {tokenPoint} from './scene-effects'
import { sightLine } from './map-spatial'
import { runtimeState, applyRuntime, effectiveConditions } from './runtime'
import { appendBroadcast, publicAudience } from './broadcast'
function discoveryVision(world:MapWorld,a:Adventure,s:MapScene,t:MapToken,p:MapPoint,cat:Catalogue){
  if(!a.sceneEffects?.regions.some(e=>e.status==='active'&&e.sceneId===s.id))return undefined
  return sceneVision(world,a,s,tokenPoint(t),{x:p.x+.5,y:p.y+.5,height:t.spatial?.height??0,layer:t.spatial?.layer??'material',anchorId:t.spatial?.anchorId},tokenM3State(world,a,t,cat))
}
function capable(world: MapWorld, t: MapToken, cat: Catalogue) {
  const c = world.characters.find((c) => c.id === t.characterId && !c.npcOwnerId)
  if (!c || t.hidden) return false
  const r = runtimeState(c, cat)
  return (
    r.hp > 0 &&
    !r.death.dead &&
    !effectiveConditions(r).some((k) =>
      ['unconscious', 'incapacitated', 'paralyzed', 'stunned'].includes(k),
    )
  )
}
export function discoveryEligible(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  p: MapPoint,
  cat: Catalogue,
) {
  return (
    capable(world, t, cat) &&
    p.hidden &&
    p.enabled &&
    p.discovery?.method === 'proximity' &&
    !s.discoveryAttempts?.some(
      (x) =>
        x.pointId === p.id &&
        x.characterId === t.characterId &&
        x.branchId === a.broadcastLog?.branchId,
    ) &&
    distance(s, t, p) <= p.discovery.range &&
    sightLine(s, t, p).clear &&
    (!discoveryVision(world,a,s,t,p,cat) || (discoveryVision(world,a,s,t,p,cat)!.ray.clear && discoveryVision(world,a,s,t,p,cat)!.illuminated))
  )
}
export function firstDiscoveryOnRoute(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  path: Position[],
  cat: Catalogue,
) {
  for (const [index, pos] of [t, ...path].entries()) {
    const point = s.points
      .filter((p) => discoveryEligible(world, a, s, { ...t, ...pos }, p, cat))
      .sort((p, q) => p.id.localeCompare(q.id))[0]
    if (point) return { index, point }
  }
  return undefined
}
export function queueCurrentDiscoveries(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  cat: Catalogue,
) {
  for (const t of [...s.tokens].sort((p, q) => p.id.localeCompare(q.id)))
    for (const p of [...s.points].sort((p, q) => p.id.localeCompare(q.id))) {
      if (!discoveryEligible(world, a, s, t, p, cat)) continue
      s.discoveryAttempts ??= []
      if (s.discoveryAttempts.length >= 5000) throw Error('发现记录已达容量，请由GM整理存档')
      s.discoveryAttempts.push({
        id: crypto.randomUUID(),
        tokenId: t.id,
        characterId: t.characterId!,
        pointId: p.id,
        branchId: a.broadcastLog?.branchId ?? 'legacy',
        at: new Date().toISOString(),
        status: 'pending',
      })
    }
}
export function resolveDiscovery(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  id: string,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const attempt = s.discoveryAttempts?.find(
    (x) => x.id === id && x.status === 'pending' && x.branchId === a.broadcastLog?.branchId,
  )
  if (!attempt) throw Error('发现检定已完成或属于旧分支')
  const p = s.points.find((p) => p.id === attempt.pointId),
    t = s.tokens.find((t) => t.id === attempt.tokenId && t.characterId === attempt.characterId)
  if (
    !p?.discovery ||
    !t ||
    !capable(world, t, cat) ||
    !p.enabled ||
    p.discovery.method !== 'proximity' ||
    distance(s, t, p) > p.discovery.range ||
    !sightLine(s, t, p).clear ||
    !!discoveryVision(world,a,s,t,p,cat) && (!discoveryVision(world,a,s,t,p,cat)!.ray.clear || !discoveryVision(world,a,s,t,p,cat)!.illuminated)
  ) {
    attempt.status = 'canceled'
    return
  }
  // Another character may already have revealed it. Do not waste a second roll.
  if (!p.hidden) {
    attempt.status = 'canceled'
    return
  }
  const index = world.characters.findIndex((c) => c.id === attempt.characterId)
  let total = 0,
    success = false
  world.characters[index] = applyRuntime(
    world.characters[index]!,
    cat,
    { type: 'check', kind: 'skill', id: p.discovery.skill,context:{disadvantage:discoveryVision(world,a,s,t,p,cat)?.lightlyObscured??false} },
    dice,
    (r) => {
      total = r.total
      success = !r.autoFail && r.total >= p.discovery!.dc
    },
  )
  attempt.total = total
  attempt.status = success ? 'success' : 'failure'
  if (success) p.hidden = false
  appendBroadcast(a, attempt.id, {
    message: success?systemMessage('point.discovery.success',{actor:t.name,object:p.name}):systemMessage('point.discovery.failure'),
    category: 'interaction',
    type: 'point.discovery',
    narration: 'direct',
    title: success ? '发现线索' : '观察结果',
    text: success ? `${t.name}发现了${p.name}。` : '未发现额外线索。',
    audience: success
      ? publicAudience()
      : { kind: 'personal', characterIds: [attempt.characterId] },
    facts: success
      ? { characterId: attempt.characterId, pointId: p.id, success: true }
      : { characterId: attempt.characterId, success: false },
  })
}
