import {z} from 'zod'
const id=z.string().min(1).max(200)
export const practicalInitiativeSchema=z.object({
 id,branchId:id,encounterId:id,status:z.enum(['open','closed','stale','needs-gm']),
 responses:z.array(z.object({actorId:id,memberId:id,done:z.boolean(),remainingMs:z.number().nonnegative(),lastSeen:z.number().optional(),deadlineAt:z.number().optional(),dicePendingId:id.optional()}).strict()).max(100),
 swaps:z.array(z.object({from:id,to:id,status:z.enum(['offered','accepted','declined','expired'])}).strict()).max(100),
}).strict()
export type PracticalInitiative=z.infer<typeof practicalInitiativeSchema>
