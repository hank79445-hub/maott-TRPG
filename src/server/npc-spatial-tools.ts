import { z } from 'zod'
import type { Room, RoomCommand } from '../online/protocol'
import { RoomError, adventure } from './room-engine'
import { npcSpatialObservation } from './npc-spatial-observation'
import { spatialProfile, spatialRoute } from './npc-spatial'
import { spatialToolSchemas, type SpatialToolName } from '../persistence/npc-spatial-tool-schema'
export {
  spatialToolSchemas,
  spatialToolRequestSchema,
  type SpatialToolName,
} from '../persistence/npc-spatial-tool-schema'
import { npcCapabilities } from '../core/npc-strategy'
import { runtimeSpells } from '../core/runtime'
import { rulePowers } from '../core/phb-powers'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'

export interface NpcToolBinding {
  roomId: string
  adventureId: string
  npcId: string
  branchId: string
}
export interface NpcToolHost {
  getRoom: () => Room
  send: (command: RoomCommand) => Promise<unknown>
}
export async function runNpcSpatialTool(
  binding: Readonly<NpcToolBinding>,
  host: NpcToolHost,
  name: SpatialToolName,
  raw: unknown,
) {
  const room = host.getRoom(),
    a = adventure(room)
  if (
    room.id !== binding.roomId ||
    a.id !== binding.adventureId ||
    a.broadcastLog?.branchId !== binding.branchId
  )
    throw new RoomError('工具绑定已失效，请由GM重新连接', 409)
  const n = spatialProfile(room, binding.npcId),
    input = spatialToolSchemas[name].parse(raw)
  if (name === 'observe') return npcSpatialObservation(room, n)
  if (name === 'capabilities') {
    const capabilities = npcCapabilities(room.world, n).filter((a) => a.enabled)
    const { abilityId } = input as z.infer<typeof spatialToolSchemas.capabilities>
    if (!abilityId)
      return {
        abilities: capabilities.map(({ id, name, kind, mode }) => ({ id, name, kind, mode })),
        rule: '工具不授予施法或行动资源；实际消耗仍由规则入口校验',
      }
    const cap = capabilities.find((c) => c.id === abilityId)
    if (!cap) throw new RoomError('能力不属于本NPC当前启用能力')
    const character = room.world.characters.find((c) => c.id === n.characterId),
      cat = catalogue([srd, ...room.world.packs])
    const monster = (
      room.world.encounters.flatMap((e) => e.actors).find((a) => a.id === n.actorId)?.npc ?? n.body
    )?.abilities?.find((a) => 'monster:' + a.id === cap.key)
    return {
      ability: cap,
      rule:
        monster ??
        (character
          ? (runtimeSpells(character, cat).find((g) => g.key === cap.key)?.spell ??
            rulePowers(character).find((p) => p.id === cap.key))
          : undefined),
    }
  }
  if (name === 'route')
    return spatialRoute(room, n, (input as z.infer<typeof spatialToolSchemas.route>).destination)
  if (name === 'propose') {
    const p = input as z.infer<typeof spatialToolSchemas.propose>
    await host.send({ kind: 'npc-spatial', command: { operation: 'propose', npcId: n.id, ...p } })
    const t = adventure(host.getRoom()).ai?.spatialState?.tasks.find(
      (t) => t.npcId === n.id && t.receipt === p.receipt && t.branchId === binding.branchId,
    )
    return { task: t ? { id: t.id, status: t.status, reason: t.reason } : null }
  }
  if (name === 'task') {
    const p = input as z.infer<typeof spatialToolSchemas.task>,
      rows =
        a.ai?.spatialState?.tasks.filter(
          (t) => t.npcId === n.id && t.branchId === binding.branchId,
        ) ?? []
    const t = p.taskId ? rows.find((t) => t.id === p.taskId) : undefined
    if (p.operation !== 'read') {
      if (!t) throw new RoomError('只能暂停或取消本NPC自己的任务')
      await host.send({ kind: 'npc-spatial', command: { operation: p.operation, taskId: t.id } })
    }
    const current =
      adventure(host.getRoom()).ai?.spatialState?.tasks.filter(
        (t) => t.npcId === n.id && t.branchId === binding.branchId,
      ) ?? []
    return {
      note: '流程结束不等于检定成功；以outcome或新的观察为准',
      tasks: current
        .filter((t) => !p.taskId || t.id === p.taskId)
        .map(({ id, status, steps, spentFeet, maxFeet, outcome }) => ({
          id,
          status,
          steps,
          spentFeet,
          maxFeet,
          outcome,
          reason:
            status === 'paused'
              ? '任务暂停，请等待GM核对'
              : status === 'review'
                ? '等待GM批准'
                : status === 'completed'
                  ? '已完成'
                  : status === 'canceled'
                    ? '已取消'
                    : '待推进',
        })),
    }
  }
  const after = (input as z.infer<typeof spatialToolSchemas.events>).after,
    state = a.ai?.spatialState?.branchId === binding.branchId ? a.ai.spatialState : undefined
  const events = state?.events.filter((e) => e.npcId === n.id && e.sequence > after) ?? []
  const resetRequired =
    !state ||
    after >= state.nextSequence ||
    (!!state.events.length && after > 0 && after < state.events[0]!.sequence)
  return {
    events,
    cursor: resetRequired ? (state?.nextSequence ?? 1) - 1 : (events.at(-1)?.sequence ?? after),
    resetRequired,
    ...(resetRequired ? { observation: npcSpatialObservation(room, n) } : {}),
  }
}
