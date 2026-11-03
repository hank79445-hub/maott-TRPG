import type { Authoring } from '../persistence/script-authoring-schema'
import {
  NPC_LIMIT,
  BROADCAST_LIMIT,
  AUTHORING_LIMITS,
  AUTHORING_BYTES,
  SCENE_CAPACITY,
  assertCapacity,
} from './configuration-limits'
export interface CapacityMetric {
  path: string
  label: string
  current: number
  maximum: number
  bytes?: boolean
}
export interface AuthoringBudget {
  metrics: CapacityMetric[]
  warnings: string[]
  broadcasts: { opening: number; scenes: number; success: number; failure: number; manual: number }
}
export function authoringBudget(
  source: Authoring,
  inputBytes = new TextEncoder().encode(JSON.stringify(source)).length,
): AuthoringBudget {
  const broadcasts = {
    opening: source.opening ? 1 : 0,
    scenes: source.scenes.filter((s) => s.intro).length,
    success: source.scenes.reduce((n, s) => n + s.points.filter((p) => p.success).length, 0),
    failure: source.scenes.reduce((n, s) => n + s.points.filter((p) => p.failure).length, 0),
    manual: source.broadcasts.length,
  }
  const metrics: CapacityMetric[] = [
    { path: 'npcs', label: 'NPC总数', current: source.npcs.length, maximum: NPC_LIMIT },
    {
      path: 'characters',
      label: '完整职业NPC卡与玩家预留席位',
      current: source.npcs.filter((n) => n.cardType === 'character').length + source.players,
      maximum: 100,
    },
    {
      path: 'scenes',
      label: '场景',
      current: source.scenes.length,
      maximum: AUTHORING_LIMITS.scenes,
    },
    {
      path: 'broadcasts',
      label: '广播（含自动生成）',
      current: Object.values(broadcasts).reduce((a, b) => a + b, 0),
      maximum: BROADCAST_LIMIT,
    },
    {
      path: 'input',
      label: '创作JSON',
      current: inputBytes,
      maximum: AUTHORING_BYTES,
      bytes: true,
    },
  ]
  metrics.push(
    {
      path: 'arrivals',
      label: '出场组',
      current: source.arrivals.length,
      maximum: AUTHORING_LIMITS.arrivals,
    },
    {
      path: 'battles',
      label: '战斗预设',
      current: source.battles.length,
      maximum: AUTHORING_LIMITS.battles,
    },
    {
      path: 'manualBroadcasts',
      label: '手工广播',
      current: source.broadcasts.length,
      maximum: AUTHORING_LIMITS.manualBroadcasts,
    },
  )
  for (const b of source.battles)
    metrics.push({
      path: `battles.${b.key}.members`,
      label: `${b.name}·预设成员`,
      current: b.npcs.length,
      maximum: AUTHORING_LIMITS.battleMembers,
    })
  const warnings: string[] = []
  if (source.npcs.length > 50)
    warnings.push('NPC超过50名，请按场景筛选管理；总量不代表同场战斗人数。')
  for (const s of source.scenes) {
    const count = source.npcs.filter((n) => n.scene === s.key).length
    metrics.push({
      path: `scenes.${s.key}.tokens`,
      label: `${s.name}·预设NPC`,
      current: count,
      maximum: SCENE_CAPACITY.tokens,
    })
    if (count > 30) warnings.push(`${s.name}配置${count}名NPC，请检查当前场景显示和运行负担。`)
    if (count + source.players > SCENE_CAPACITY.tokens)
      warnings.push(`${s.name}需为${source.players}名玩家预留棋子位置；不要让全部预设NPC同时在场。`)
    for (const [key, label] of [
      ['points', '互动点'],
      ['ground', '地面物品'],
      ['floors', '楼层矩形'],
      ['walls', '显式墙门'],
    ] as const) {
      metrics.push({
        path: `scenes.${s.key}.${key}`,
        label: `${s.name}·${label}`,
        current: s[key]?.length ?? 0,
        maximum: AUTHORING_LIMITS[key],
      })
    }
  }
  for (const m of metrics) {
    assertCapacity(`${m.label} [${m.path}]`, m.current, m.maximum)
    if (m.current >= m.maximum * 0.8)
      warnings.push(`${m.label} [${m.path}]：${m.current}／${m.maximum}，已达80%预算。`)
  }
  return { metrics, warnings, broadcasts }
}
