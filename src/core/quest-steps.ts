import type { Adventure } from './map-types'
import type { BroadcastEvent } from './broadcast-types'
import type { Quest } from '../persistence/quest-schema'
const status = (s: NonNullable<Quest['steps']>[number]) => s.status ?? s.initialStatus
export function questStepEventMatches(step: NonNullable<Quest['steps']>[number], e: BroadcastEvent) {
  if (!step.trigger || e.phase !== 'confirmed' || e.sceneId !== step.sceneId) return false
  return step.trigger === 'point-success'
    ? e.type === 'point.result' && e.facts.pointId === step.pointId && e.facts.success === true
    : step.trigger === 'scene-enter' ? e.type === 'scene.enter'
      : step.trigger === 'arrival' ? e.type === 'npc.arrived' && e.facts.groupId === step.arrivalGroupId
        : e.type === 'encounter.ended'
}
export function collectQuestSuggestions(a: Adventure, events: BroadcastEvent[]) {
  for (const q of a.quests ?? []) {
    if ((q.status ?? q.initialStatus) !== 'active') continue
    for (const step of q.steps ?? []) {
      if (
        status(step) !== 'active' ||
        !step.trigger ||
        step.afterIds.some((id) => !q.steps?.some((s) => s.id === id && status(s) === 'completed'))
      )
        continue
      for (const e of events) {
        if (
          e.phase !== 'confirmed' ||
          e.branchId !== a.broadcastLog?.branchId ||
          e.sceneId !== step.sceneId
        )
          continue
        const matches = questStepEventMatches(step, e)
        if (
          !matches ||
          q.stepSuggestions?.some(
            (x) =>
              x.stepId === step.id &&
              (x.status === 'pending' || x.eventId === e.id) &&
              x.branchId === e.branchId,
          )
        )
          continue
        q.stepSuggestions ??= []
        if (q.stepSuggestions.length >= 500) continue
        q.stepSuggestions.push({
          id: crypto.randomUUID(),
          stepId: step.id,
          eventId: e.id,
          branchId: e.branchId,
          status: 'pending',
        })
      }
    }
  }
}
export function reviewQuestStep(
  a: Adventure,
  questId: string,
  suggestionId: string,
  approve: boolean,
) {
  const q = a.quests?.find((q) => q.id === questId),
    suggestion = q?.stepSuggestions?.find(
      (s) =>
        s.id === suggestionId && s.branchId === a.broadcastLog?.branchId && s.status === 'pending',
    ),
    step = q?.steps?.find((s) => s.id === suggestion?.stepId)
  if (!q || !suggestion || !step) throw Error('小目标建议已处理或属于旧分支')
  if (approve) {
    if ((q.status ?? q.initialStatus) !== 'active') throw Error('所属任务未处于进行中，请先由GM明确调整任务状态')
    if (
      status(step) !== 'active' ||
      step.afterIds.some((id) => !q.steps?.some((s) => s.id === id && status(s) === 'completed'))
    )
      throw Error('小目标状态或前置条件已变化')
    step.status = 'completed'
    if (step.activateNext)
      for (const next of q.steps ?? [])
        if (status(next) === 'inactive' && next.afterIds.includes(step.id) && next.afterIds.every(id => q.steps?.some(s => s.id === id && status(s) === 'completed')))
          next.status = 'active'
  }
  suggestion.status = approve ? 'approved' : 'dismissed'
}
