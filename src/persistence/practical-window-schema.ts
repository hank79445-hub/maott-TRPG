import { z } from 'zod'
const id=z.string().min(1).max(200)
export const practicalWindowSchema=z.object({
 id,key:z.string().min(1).max(500),branchId:id,encounterId:id,pendingId:id,tick:z.number().int().nonnegative(),
 phase:z.enum(['d20','defense','damage','after-damage']),status:z.enum(['open','closed','stale','needs-gm']),
 responses:z.array(z.object({actorId:id,memberId:id,optionIds:z.array(id).max(40),selectedIds:z.array(id).max(40),done:z.boolean(),remainingMs:z.number().nonnegative(),lastSeen:z.number().optional(),deadlineAt:z.number().optional(),dicePendingId:id.optional()}).strict()).max(100),
 reason:z.string().max(1500),createdAt:z.number(),
}).strict()
export type PracticalWindow=z.infer<typeof practicalWindowSchema>
