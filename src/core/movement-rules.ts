import type { Position } from './map-types'
/** Only a continuous trail ending at the current position can count as run-up. */
export function runUpDistance(trail: Position[], end: Position, feet: number) {
  if (!trail.length || trail.at(-1)!.x !== end.x || trail.at(-1)!.y !== end.y) return 0
  let distance = 0
  for (let i = trail.length - 1; i > 0; i--) {
    const step = Math.max(
      Math.abs(trail[i]!.x - trail[i - 1]!.x),
      Math.abs(trail[i]!.y - trail[i - 1]!.y),
    )
    if (step !== 1) break
    distance += feet
  }
  return distance
}
export function jumpCapacity(strength: number, running: boolean, bonus = 0, doubled = false) {
  const multiplier = doubled ? 2 : 1
  return {
    long: (strength * (running ? 1 : 0.5) + bonus) * multiplier,
    high:
      (Math.max(0, 3 + Math.floor((strength - 10) / 2)) * (running ? 1 : 0.5) + bonus) * multiplier,
  }
}
