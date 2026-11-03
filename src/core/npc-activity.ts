import type { NpcProfile, NpcActivityTemplate, NpcResponseType } from './ai-types'
import type { BroadcastEvent } from './broadcast-types'

export const responseNames: Record<NpcResponseType, string> = {
  rescued: '被解救后感谢',
  aided: '受到援助',
  critical: '同伴遭受暴击',
  wounded: '同伴进入重伤',
  downed: '同伴倒地',
  recovered: '同伴恢复意识',
  danger: '发现危险',
  goal: '完成个人目标',
  scene: '进入指定地点',
  interaction: '互动成功／失败',
}
export function newActivityTemplate(type: NpcResponseType): NpcActivityTemplate {
  return {
    id: crypto.randomUUID(),
    type,
    enabled: true,
    pointId: null,
    sceneId: null,
    outcome: 'any',
    thresholdPercent: 25,
    tendency: '根据性格回应已确认事实，不添加行动结果或透露秘密。',
    priority: type === 'downed' ? 100 : type === 'rescued' ? 90 : type === 'wounded' ? 80 : 50,
    cooldownSeconds: ['scene', 'interaction'].includes(type) ? 300 : 60,
  }
}
export function activityMatch(n: NpcProfile, ev: BroadcastEvent) {
  if (ev.phase !== 'confirmed' || ev.audience.kind !== 'public') return null
  const f = ev.facts
  const templates = (n.activity.templates ?? [])
    .filter((t) => t.enabled)
    .sort((a, b) => b.priority - a.priority)
  for (const t of templates) {
    if ((t.pointId && t.pointId !== f.pointId) || (t.sceneId && t.sceneId !== ev.sceneId)) continue
    if (t.outcome !== 'any' && f.success !== (t.outcome === 'success')) continue
    let hit = false
    if (['rescued', 'aided', 'danger', 'goal'].includes(t.type))
      hit = ev.type === 'point.story' && f.storyType === t.type && f.npcId === n.id
    else if (t.type === 'scene') hit = ev.type === 'scene.enter'
    else if (t.type === 'interaction')
      hit = ev.type === 'point.result' && typeof f.success === 'boolean'
    else if (typeof f.hpBefore === 'number' && typeof f.hpAfter === 'number') {
      if (t.type === 'critical') hit = f.critical === true && Number(f.damage) > 0
      if (t.type === 'downed') hit = f.hpBefore > 0 && f.hpAfter === 0 && f.dead !== true
      if (t.type === 'recovered') hit = f.hpBefore === 0 && f.hpAfter > 0
      if (t.type === 'wounded')
        hit =
          Number(f.maxHp) > 0 &&
          f.hpBefore > (Number(f.maxHp) * t.thresholdPercent) / 100 &&
          f.hpAfter > 0 &&
          f.hpAfter <= (Number(f.maxHp) * t.thresholdPercent) / 100
    }
    if (hit)
      return {
        key: t.id,
        tendency: t.tendency,
        priority: t.priority,
        cooldownSeconds: t.cooldownSeconds,
        critical: !['scene', 'interaction'].includes(t.type),
      }
  }
  if (n.activity.events.includes(ev.type as (typeof n.activity.events)[number]))
    return {
      key: 'legacy',
      tendency: '',
      priority: 0,
      cooldownSeconds: n.activity.cooldownSeconds,
      critical: false,
    }
  return null
}
