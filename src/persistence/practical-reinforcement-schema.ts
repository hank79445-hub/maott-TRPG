import {z} from 'zod'
import {encounterSchema} from './combat-schema'
import {battleParticipantSchema} from './battle-schema'
import type {Encounter} from '../core/combat-types'
const id=z.string().min(1).max(200)
export const practicalReinforcementSchema=z.object({requestId:id,branchId:id,encounterId:id,sceneId:id,participants:z.array(battleParticipantSchema).min(1).max(100),staging:encounterSchema as z.ZodType<Encounter>,status:z.enum(['rolling','choices','committed','needs-gm']),rollRequested:z.boolean()}).strict()
