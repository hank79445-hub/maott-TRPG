import {
  narrationSkillSchema,
  narrationSkillPackageSchema,
  type NarrationSkill,
} from '../persistence/narration-skill-schema'
import type { AiSettings } from './ai-types'
export type { NarrationSkill }
export function narrationSkillPresets(): NarrationSkill[] {
  const common = {
    version: 1,
    author: '内置叙事规范',
    description: '只描述已确认事实',
    language: '中文',
    perspective: 'third' as const,
    targetCharacters: 400,
    paragraphs: 2,
    detail: 'standard' as const,
    includeNumbers: false,
    examples: '',
  }
  return [
    {
      ...common,
      id: 'concise',
      name: '简洁跑团',
      tone: '清晰、节制',
      instructions: '简洁串联已确认行动与结果；省略重复规则数字，不替玩家决定或补充未发生后果。',
    },
    {
      ...common,
      id: 'cinematic',
      name: '电影式战斗',
      tone: '动作连贯',
      detail: 'vivid',
      instructions:
        '将同批移动、攻击和反应串成连贯场面；描写姿态、节奏、声音，但命中、伤害和生死严格依据事实。',
    },
    {
      ...common,
      id: 'suspense',
      name: '探索悬疑',
      tone: '克制、悬疑',
      instructions:
        '围绕已触发的场景结果描写可观察细节；不暗示未公开机关、NPC秘密或编造新线索，不复述普通走格。',
    },
  ]
}
export function resolveNarrationSkill(
  settings: AiSettings,
  sceneId: string | null,
): NarrationSkill | null {
  const id =
    (sceneId ? settings.sceneNarrationSkills?.[sceneId] : undefined) ??
    settings.defaultNarrationSkill
  if (!id) return null
  const skill = settings.narrationSkills?.find((s) => s.id === id)
  if (!skill) throw Error('旁白Skill引用缺失，请GM重新选择')
  return narrationSkillSchema.parse(skill)
}
export function parseNarrationSkill(text: string, format: 'json' | 'md'): NarrationSkill {
  if (new TextEncoder().encode(text).length > 128000) throw Error('Skill文件超过128KB')
  if (format === 'json') return narrationSkillPackageSchema.parse(JSON.parse(text)).skill
  return narrationSkillSchema.parse({
    ...narrationSkillPresets()[0]!,
    id: crypto.randomUUID(),
    name: '导入叙事规范',
    author: 'GM导入',
    instructions: text,
  })
}
export function validateNarrationSkills(settings: AiSettings, sceneIds: string[]) {
  const ids = new Set(settings.narrationSkills?.map((s) => s.id) ?? [])
  if (settings.defaultNarrationSkill && !ids.has(settings.defaultNarrationSkill))
    throw Error('默认旁白Skill引用缺失')
  for (const [scene, id] of Object.entries(settings.sceneNarrationSkills ?? {}))
    if (!sceneIds.includes(scene) || !ids.has(id)) throw Error('场景旁白Skill引用缺失')
}
