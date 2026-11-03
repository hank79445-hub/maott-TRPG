import type { MapCommand, MapWorld } from '../core/map-types'
export type ResolutionGuard = NonNullable<
  Extract<MapCommand, { type: 'combat' }>['resolutionGuard']
>

/** The same identity invalidates local form state and protects the authoritative command. */
export function resolutionIdentity(
  world: Pick<MapWorld, 'adventures' | 'encounters'>,
  id: string,
  scope?: string,
) {
  const e = world.encounters.find((e) => e.id === id)
  if (!e) return null
  const adventure = world.adventures.find((a) => a.scenes.some((s) => s.encounterId === id))
  const guard: ResolutionGuard = {
    encounterId: id,
    pendingId: e.pending?.id ?? '',
    branch: scope ?? adventure?.broadcastLog?.branchId ?? '',
    tick: e.tick,
  }
  return {
    guard,
    key: [guard.branch, guard.encounterId, guard.tick, guard.pendingId, e.pending?.startedAt].join(
      ':',
    ),
  }
}
