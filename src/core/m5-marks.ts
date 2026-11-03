import type { MapWorld, Adventure, MapScene } from './map-types'
import type { Catalogue } from './engine'
import type { SceneEffectAction } from '../persistence/scene-effects-schema'
import type { ActiveEffect } from './types'
import { m1Entity } from './m1-utility'
import { m3Caster } from './m3-world-cast'
import { m3ActionCost } from './m3-world-actions'
import { tokenPerception } from './m3-map-perception'
import { tokenPoint } from './scene-effects'
import { magicDistance } from './scene-magic'
import { concentrationMatches } from './spell-source-state'
import { applyWorldRuntime } from './world-runtime'
import { d20 } from './combat-rules'
export function worldMarks(w: MapWorld, a: Adventure, sourceId: string) {
  const source = m1Entity(w, a, sourceId)
  if (!source) return []
  const ids = new Set([
    ...w.characters.map((c) => c.id),
    ...(a.ai?.npcs.map((n) => n.id) ?? []),
    ...a.scenes.flatMap((s) =>
      [...s.tokens, ...(s.defeatedTokens ?? [])].map(
        (t) => t.characterId ?? t.npcId ?? t.actorId ?? t.id,
      ),
    ),
  ])
  return [...ids]
    .flatMap((id) => {
      const target = m1Entity(w, a, id)
      return target
        ? (target.state.effects ?? [])
            .filter(
              (f) =>
                ['hex', 'hunter-s-mark'].includes(f.key) &&
                [source.id, source.actor?.id].includes(f.sourceId) &&
                concentrationMatches(
                  f,
                  source.c?.runtime?.concentration ?? source.body?.concentration,
                ),
            )
            .map((effect) => ({ target, effect }))
        : []
    })
    .filter((r, i, rows) => rows.findIndex((t) => t.effect.id === r.effect.id) === i)
}
export function applyWorldMark(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  op: Extract<SceneEffectAction, { operation: 'm5-mark' | 'm5-search' }>,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const source = m3Caster(w, a, op.actorId, cat),
    entry = worldMarks(w, a, source.id).find((r) => r.effect.id === op.effectId)
  if (!entry) throw Error('实际印记及原专注已失效')
  if (op.operation === 'm5-search') {
    if (entry.effect.key !== 'hunter-s-mark')
      throw Error('只有猎人印记提供寻找特定目标的察觉／求生优势')
    if (source.c) {
      applyWorldRuntime(
        w,
        source.c.id,
        cat,
        { type: 'check', kind: 'skill', id: op.skill, context: { advantage: true } },
        dice,
      )
      return '已用猎人印记优势检定寻找原目标；骰值不自动公开其位置，由GM依据真实线索裁定'
    }
    const mod =
        source.body?.templateMetadata?.skills[op.skill] ??
        Math.floor(((source.body?.scores.wis ?? 10) - 10) / 2),
      dis = (source.state.effects ?? []).some(
        (f) =>
          (f.key === 'hex' && f.supportChoice === 'wis') ||
          f.key === 'heat-metal-disadvantage' ||
          f.condition === 'poisoned',
      )
        ? ['当前状态导致属性检定劣势']
        : [],
      roll = d20(mod, ['猎人印记：寻找实际原目标'], dis, dice)
    return (
      'NPC寻找已印记目标检定：' +
      roll.total +
      '；仅提供规则优势，GM按实际感知条件裁定，不获得全场定位'
    )
  }
  if (entry.target.state.hp !== 0) throw Error('原印记目标须生命已归零')
  const target = m1Entity(w, a, op.targetId),
    now =
      w.characters.find((c) => c.id === entry.effect.clockSourceId)?.runtime?.hours ??
      source.c?.runtime?.hours ??
      0
  if (
    !target?.token ||
    target.dead ||
    target.state.hp <= 0 ||
    !s.tokens.includes(target.token) ||
    !tokenPerception(w, a, s, source.token!, target.token, cat).canSee ||
    magicDistance(tokenPoint(source.token!), tokenPoint(target.token), s.grid.feet) > 90
  )
    throw Error('新印记目标须实际可见、存活且在90尺内')
  if (
    entry.effect.key === 'hex' &&
    entry.effect.m5AppliedHour !== undefined &&
    now <= entry.effect.m5AppliedHour + 1e-8
  )
    throw Error('脆弱诅咒须后续实际回合转移，切换场景／遭遇不刷新时点')
  m3ActionCost(w, a, source.id, 'bonus', cat)
  // Combat cost execution replaces actor/card objects; mutate the resulting world only.
  const currentOld = m1Entity(w, a, entry.target.id)!,
    currentNew = m1Entity(w, a, target.id)!
  currentOld.state.effects = currentOld.state.effects!.filter((f) => f.id !== entry.effect.id)
  ;(currentNew.state.effects ??= []).push({
    ...structuredClone(entry.effect),
    id: crypto.randomUUID(),
    m5AppliedHour: now,
  })
  return '原印记已转移；保留期限、施法来源、选定属性及专注，未重扣法术位'
}
