import { z } from 'zod'
export const LOCALES = ['zh-CN', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const localeSchema = z.enum(LOCALES)
export const localizedTextSchema = z.object({ 'zh-CN': z.string().max(2000).optional(), en: z.string().max(2000).optional() }).strict()
export function normalizeLocale(value: unknown): Locale | undefined {
  if (typeof value !== 'string') return undefined
  const s = value.trim().toLowerCase().replaceAll('_', '-')
  if (['中文', '简体中文', 'chinese'].includes(s) || /^zh(?:-|$)/.test(s)) return 'zh-CN'
  if (['英文', '英语', 'english'].includes(s) || /^en(?:-|$)/.test(s)) return 'en'
  return undefined
}
export function localeOrDefault(value: unknown): Locale { return normalizeLocale(value) ?? 'zh-CN' }
export const LANGUAGE_POLICY_VERSION = 1
export function outputLanguageInstruction(locale: Locale) {
  return locale === 'en'
    ? 'Output human-readable narrative, dialogue, segment text and explanations in English. Preserve proper names and quoted player speech where appropriate. Follow the target language rather than the language used in prompt examples; localize stock refusals and connective narration. Never translate JSON keys, enum values, IDs, references, dice formulas or numeric values. Language does not change facts, knowledge, audiences or permissions. This output-language requirement overrides lower-priority style preferences; obey all structural and rule constraints.'
    : '自然语言旁白、对白、分段文本和解释使用简体中文。专名及引用玩家原话可保留原文。不得翻译JSON字段名、枚举、ID、引用、骰式或数值；语言不改变事实、知识、受众和权限。此输出语言要求优先于低优先级风格偏好，结构和规则约束仍须遵守。'
}
