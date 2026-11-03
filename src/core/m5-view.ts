import type { MapWorld, Adventure, MapScene, MapToken } from './map-types'
import { anchoredGeometry } from './scene-effects'
import { m1Entity } from './m1-utility'
import { worldMarks } from './m5-marks'
import {mindSpikeKnows} from './spell-knowledge'
export interface M5View {
  abilities: {
    effectId: string
    spellId: string
    name: string
    actorId: string
    held: boolean
    targetId?: string
    point?: { x: number; y: number; height: number }
  }[]
  waiting: { id: string; name: string; actorId: string }[]
  knownPositions: { targetId: string; x: number; y: number; height: number; note: string }[]
  marks: {
    effectId: string
    name: string
    spellId: string
    actorId: string
    canTransfer: boolean
  }[]
}
/** Capability projection only: no GM metal contacts, raw saved encounters,
 * attack/DC values, receipts, private notes or other observers' tracking. */
export function projectM5(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  gm: boolean,
  observers: MapToken[],
): M5View {
  const owns = (id: string) =>
      gm || observers.some((t) => [t.id, t.characterId, t.npcId, t.actorId].includes(id)),
    active = (a.sceneEffects?.regions ?? []).filter((e) => e.status === 'active' && e.m5)
  return {
    marks: [
      ...new Set(
        (gm ? s.tokens : observers).map((t) => t.characterId ?? t.npcId ?? t.actorId ?? t.id),
      ),
    ].flatMap((id) =>
      worldMarks(w, a, id).map(({ effect, target }) => ({
        effectId: effect.id,
        name: effect.name,
        spellId: effect.key,
        actorId: m1Entity(w, a, id)!.id,
        canTransfer: target.state.hp === 0,
      })),
    ),
    abilities: active.flatMap((e) => {
      const actorId = e.spellId === 'dragon-s-breath' ? e.m5!.targetId! : e.sourceId,
        entity = m1Entity(w, a, actorId),
        g = anchoredGeometry(w, a, e)
      return owns(actorId) &&
        entity?.token &&
        s.tokens.includes(entity.token) &&
        e.spellId !== 'mind-spike'
        ? [
            {
              effectId: e.id,
              spellId: e.spellId,
              name: e.name,
              actorId,
              held: e.m5!.held,
              ...(e.m5!.targetId ? { targetId: e.m5!.targetId } : {}),
              ...(e.spellId === 'spiritual-weapon' && g
                ? { point: { x: g.geometry.x, y: g.geometry.y, height: g.geometry.height } }
                : {}),
            },
          ]
        : []
    }),
    waiting: (a.sceneEffects?.m5?.resolutions ?? [])
      .filter((r) => r.sceneId === s.id && r.status === 'pending' && owns(r.actorId))
      .map((r) => ({
        id: r.id,
        name: a.sceneEffects?.regions.find((e) => e.id === r.effectId)?.name ?? '法术后续',
        actorId: r.actorId,
      })),
    knownPositions: active
      .filter((e) => e.spellId === 'mind-spike' && e.m5!.held && owns(e.sourceId))
      .flatMap((e) => {
        const source = m1Entity(w, a, e.sourceId),
          target = m1Entity(w, a, e.m5!.targetId ?? '')
        return source?.token &&
          target?.token &&
          s.tokens.includes(target.token) &&
          mindSpikeKnows(a,source.token,target.token)
          ? [
              {
                targetId: target.id,
                x: target.token.x,
                y: target.token.y,
                height: target.token.spatial?.height ?? 0,
                note: '本人已确认的心灵尖刺定位；知道位置不等于看见或可以穿墙选中',
              },
            ]
          : []
      }),
  }
}
