import { z } from 'zod'
import type { BroadcastEvent } from '../core/broadcast-types'
export const botKeySchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s))
export const qqRouteSchema = z
  .object({
    revision: z.number().int().nonnegative().default(0),
    system: botKeySchema.default('default'),
    narration: botKeySchema.default('default'),
    compatibility: botKeySchema.default('default'),
    npcBots: z.record(z.string().min(1).max(120), botKeySchema).default({}),
    sharedBots: z
      .record(botKeySchema, z.array(z.string().min(1).max(120)).min(1).max(100))
      .optional(),
    fallbackToCompatibility: z.boolean().default(false),
  })
  .strict()
  .refine((r) => {
    const ids = Object.values(r.sharedBots ?? {}).flat()
    return (
      new Set(ids).size === ids.length &&
      !ids.some((id) => r.npcBots[id]) &&
      !Object.keys(r.sharedBots ?? {}).some(
        (k) =>
          Object.values(r.npcBots).includes(k) ||
          [r.system, r.narration, r.compatibility].includes(k),
      )
    )
  }, '共享NPC不能重复分组，且共享Bot不能兼任专用／系统／旁白Bot')
  .refine(
    (r) => new Set(Object.values(r.npcBots)).size === Object.values(r.npcBots).length,
    '每个专用Bot在同房间只能绑定一个NPC',
  )
  .refine(
    (r) =>
      !Object.values(r.npcBots).some((k) => [r.system, r.narration, r.compatibility].includes(k)),
    'NPC专用Bot不能同时承担系统／旁白／兼容身份',
  )
export type QqRoutes = z.infer<typeof qqRouteSchema>
export type QqOutputRole = 'system' | 'narration' | 'npc'
export type QqRoutingEvent = Pick<
  BroadcastEvent,
  'id' | 'branchId' | 'sequence' | 'type' | 'causeId' | 'actionId' | 'facts'
>
export function outputIdentity(e?: Pick<BroadcastEvent, 'type' | 'facts'>): {
  role: QqOutputRole
  npcId?: string
} {
  if (e?.type === 'ai.narration') return { role: 'narration' }
  if (e?.type === 'npc.reply')
    return { role: 'npc', npcId: typeof e.facts.npcId === 'string' ? e.facts.npcId : undefined }
  return { role: 'system' }
}
export function targetBot(r: QqRoutes, e?: Pick<BroadcastEvent, 'type' | 'facts'>) {
  const who = outputIdentity(e)
  return who.role === 'system'
    ? r.system
    : who.role === 'narration'
      ? r.narration
      : ((who.npcId ? r.npcBots[who.npcId] : undefined) ??
        Object.entries(r.sharedBots ?? {}).find(([, ids]) => ids.includes(who.npcId ?? ''))?.[0] ??
        (e?.facts.fixedNpc === true ? r.system : r.compatibility))
}
export interface QqTaskRoute {
  role: QqOutputRole
  group?: string
  routeRevision?: number
  eventSequence?: number
  branch?: string
}
export interface QqBridgeOptions {
  additional?: boolean
  route?: (
    roomId: string,
    event?: QqRoutingEvent,
  ) => { accept: boolean; revision: number; group: string }
  maySend?: (roomId: string, task: QqTaskRoute) => boolean
  input?: (
    roomId: string,
    message: string,
    source: { identity: string; bindingId: string },
  ) => string | { reply: string }
}
