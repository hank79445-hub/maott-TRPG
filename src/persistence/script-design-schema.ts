import { z } from 'zod'
const text = z.string().max(2000)
const ref = z.string().min(1).max(120)
export const npcDesignSchema = z
  .object({
    role: text.default(''),
    motivation: text.default(''),
    joinConditions: text.default(''),
    leaveConditions: text.default(''),
    personalGoal: text.default(''),
    alternatives: text.default(''),
  })
  .strict()
export const questDesignSchema = z
  .object({
    completion: text.default(''),
    alternatives: text.default(''),
    notes: text.default(''),
    npcIds: z.array(ref).max(100).default([]),
  })
  .strict()
export const growthStepSchema = z
  .object({
    title: z.string().min(1).max(120),
    chapter: z.string().max(120).default(''),
    sceneId: ref.optional(),
    questId: ref.optional(),
    kind: z.enum(['combat', 'exploration', 'social', 'quest', 'milestone']),
    suggestedLevel: z.number().int().min(1).max(20).optional(),
    xp: z.number().int().min(0).max(1000000).optional(),
    allocation: z.enum(['team-total', 'per-person']).optional(),
    sourceKind: z.enum(['rule', 'gm']).default('gm'),
    source: text.min(1),
    reason: text.min(1),
    challengeKey: z.string().min(1).max(120),
  })
  .strict()
export const growthGuideSchema = z
  .object({
    mode: z.enum(['xp', 'milestone']),
    players: z.number().int().min(1).max(10),
    startLevel: z.number().int().min(1).max(20),
    endLevel: z.number().int().min(1).max(20),
    hours: z.number().positive().max(1000),
    steps: z.array(growthStepSchema).min(1).max(100),
  })
  .strict()
  .superRefine((g, ctx) => {
    const problem = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (g.endLevel < g.startLevel) problem('目标等级不能低于起始等级')
    if (new Set(g.steps.map((s) => s.challengeKey)).size !== g.steps.length)
      problem('同一挑战不能重复列入成长奖励')
    for (const s of g.steps) {
      if (g.mode === 'milestone' && s.xp !== undefined) problem('里程碑不能混入经验值')
      if (g.mode === 'xp' && s.xp !== undefined && !s.allocation)
        problem('经验值必须说明全队或每人分配')
      if (
        s.suggestedLevel !== undefined &&
        (s.suggestedLevel < g.startLevel || s.suggestedLevel > g.endLevel)
      )
        problem('建议等级超出成长区间')
    }
  })
export type GrowthGuide = z.infer<typeof growthGuideSchema>
