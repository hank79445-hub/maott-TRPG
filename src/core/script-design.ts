import type { GrowthGuide } from '../persistence/script-design-schema'
export function validateGrowthGuide(
  guide: GrowthGuide | undefined,
  scenes: string[],
  quests: string[],
) {
  for (const step of guide?.steps ?? []) {
    if (step.sceneId && !scenes.includes(step.sceneId)) throw Error('成长参考场景引用缺失')
    if (step.questId && !quests.includes(step.questId)) throw Error('成长参考任务引用缺失')
  }
}
