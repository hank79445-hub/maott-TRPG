export function mayWakeMovement(s: {
  controlled: boolean
  ownTurn: boolean
  busy: boolean
  incapacitated: boolean
  details: boolean
  mode: string
  action: boolean
}) {
  return (
    s.controlled &&
    s.ownTurn &&
    !s.busy &&
    !s.incapacitated &&
    !(s.details && (s.mode !== 'move' || s.action))
  )
}
