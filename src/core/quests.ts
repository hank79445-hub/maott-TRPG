import type { Adventure } from './map-types'
import type { Quest } from '../persistence/quest-schema'
export function visibleQuests(
  a: Pick<Adventure, 'quests'>,
  characters: string[],
  gm = false,
): Quest[] {
  return (a.quests ?? [])
    .filter(
      (q) =>
        gm ||
        q.visibility === 'public' ||
        (q.visibility === 'personal' && q.characterIds.some((id) => characters.includes(id))),
    )
    .map((q) => {
      const { gmDesign: _private, stepSuggestions: _suggestions, ...publicQuest } = q
      return {
        ...(gm ? q : publicQuest),
        ...(!gm && q.steps
          ? {
              steps: q.steps
                .filter((s) => s.visibility === 'public')
                .map((s) => ({
                  id: s.id,
                  title: s.title,
                  description: s.description,
                  visibility: s.visibility,
                  initialStatus: s.initialStatus,
                  status: s.status,
                  afterIds: [],
                })),
              pinnedStepId: q.steps.some(
                (s) => s.id === q.pinnedStepId && s.visibility === 'public',
              )
                ? q.pinnedStepId
                : undefined,
            }
          : {}),
        characterIds: gm ? q.characterIds : q.characterIds.filter((id) => characters.includes(id)),
      }
    })
}
export function validateQuests(
  a: Pick<Adventure, 'quests' | 'scenes'>,
  allowedCharacters?: string[],
  npcIds?: string[],
) {
  const quests = a.quests ?? []
  if (new Set(quests.map((q) => q.id)).size !== quests.length) throw Error('任务ID重复')
  if (quests.filter((q) => q.main).length > 1 || quests.filter((q) => q.current).length > 1)
    throw Error('全队主要目标和当前目标分别只能选择一个')
  for (const q of quests) {
    const steps = q.steps ?? []
    const done = new Set<string>()
    if (new Set(steps.map((s) => s.id)).size !== steps.length) throw Error('小目标ID重复')
    if (q.pinnedStepId && !steps.some((s) => s.id === q.pinnedStepId))
      throw Error('置顶小目标不存在')
    for (const step of steps) {
      if (step.afterIds.some((id) => id === step.id || !steps.some((s) => s.id === id)))
        throw Error('小目标前置引用无效')
      const visited = new Set<string>()
      const visit = (id: string) => {
        if (done.has(id)) return
        if (visited.has(id)) throw Error('小目标前置条件循环')
        visited.add(id)
        for (const next of steps.find((s) => s.id === id)?.afterIds ?? []) visit(next)
        visited.delete(id)
        done.add(id)
      }
      visit(step.id)
      const scene = a.scenes.find((s) => s.id === step.sceneId)
      if (step.sceneId && !scene) throw Error('小目标场景不存在')
      if (step.pointId && !scene?.points.some((p) => p.id === step.pointId))
        throw Error('小目标互动点不存在')
      if (step.arrivalGroupId && !scene?.arrivalGroups?.some((g) => g.id === step.arrivalGroupId))
        throw Error('小目标出场组不存在')
      if (
        (step.trigger && !step.sceneId) ||
        (step.trigger === 'point-success' && !step.pointId) ||
        (step.trigger === 'arrival' && !step.arrivalGroupId)
      )
        throw Error('小目标建议触发条件不完整')
    }
    if (npcIds && q.gmDesign?.npcIds.some((id) => !npcIds.includes(id)))
      throw Error('任务关联NPC不存在')
    const scene = a.scenes.find((s) => s.id === q.sceneId)
    if ((q.sceneId && !scene) || (q.pointId && !scene?.points.some((p) => p.id === q.pointId)))
      throw Error('任务场景或互动点引用缺失')
    if (q.visibility === 'personal' && !q.characterIds.length) throw Error('私人任务须指定角色')
    if (allowedCharacters && q.characterIds.some((id) => !allowedCharacters.includes(id)))
      throw Error('任务接收角色不存在')
  }
}
