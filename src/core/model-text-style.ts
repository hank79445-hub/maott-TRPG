import type {Locale} from '../shared/localization/locale'
export interface TextStyleSettings {
  version: 1
  revision: number
  enabled: boolean
  npc: boolean
  narration: boolean
  actionDensity: 'sparse' | 'none'
  selfCheck: boolean
  customRules: string
}
export interface TextStyleSnapshot {
  version: 1
  revision: number
  enabled: boolean
  purpose: 'dialogue' | 'proactive' | 'narration' | 'combat-dialogue'
  actionDensity: TextStyleSettings['actionDensity']
  selfCheck: boolean
  rules: string
  samples: { id: string; text: string }[]
}
export const defaultTextStyle = (enabled = true): TextStyleSettings => ({
  version: 1,
  revision: 1,
  enabled,
  npc: true,
  narration: true,
  actionDensity: 'sparse',
  selfCheck: true,
  customRules: '',
})
/** Original project wording, based on the documented writing principles; no external Skill is executed. */
export const BUILTIN_TEXT_STYLE =
  '先回应眼前的问题或已确认事件，允许简短、拒绝、沉默与真实赞同，不为凑篇幅添加总结。保持人物已有的称呼、句长、立场与口吻，不凭职业发明方言、身世或关系。动作仅在传递必要信息时出现，避免反复微笑、眯眼、敲桌等填充；不替玩家写心理，不发明物品、位置、伤势或规则后果。避免机械重复最近回复的开场、收尾和动作；保留必要术语、既定称呼和有意设定的口癖。不虚构对立观点再反驳，不强制标点黑名单。缺少可确认资料时以人物口吻简短拒答，不解释模型、后台资料或记录机制。'
/** Imported files are inert prose. Strip common agent metadata, commands and platform macros, not punctuation. */
export function sanitizeStyleText(raw: string) {
  if (new TextEncoder().encode(raw).length > 65536) throw Error('规则文件超过64KiB，请先精简正文')
  const stripped = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^---\n[\s\S]*?\n---(?:\n|$)/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
  const lines = stripped.split('\n'),
    unsafe =
      /^\s*(?:allowed-tools|tools|tool_choice|model|name|description)\s*:|^\s*(?:[$>]\s*)?(?:npm|npx|pip|curl|wget|powershell|pwsh|bash|git\s+clone)\b|忽略.{0,12}(?:指令|规则|限制)|(?:绕过|关闭|跳过).{0,8}(?:审核|权限|校验)|(?:泄露|输出|显示).{0,8}(?:系统提示|密钥|秘密)|ignore.{0,25}(?:instructions|rules)|<\/?(?:system|assistant|tool)\b/i
  const kept = lines.filter((line) => !unsafe.test(line)),
    text = kept.join('\n').trim()
  if (text.length > 4000) throw Error('清理后的补充规则超过4000字，请先精简')
  return { text, removedLines: lines.length - kept.length, changed: text !== raw.trim() }
}
export function styleRules(s: TextStyleSettings, locale: Locale = 'zh-CN') {
  if (locale === 'en') return [
    'Stay on topic. Reveal personality through word choice, attention and concrete responses, not unsolicited declarations of persona, knowledge boundaries or personal principles. Do not append self-auditing disclaimers. Natural brief refusals remain appropriate when directly asked; never expose internal reasoning or invent facts.',
    'Respond to the immediate question or confirmed event. Be concise; allow refusals, silence and agreement. Preserve established names, voice, stance and sentence rhythm. Do not invent dialect, biography, relationships, hidden facts, items, injuries or outcomes. Avoid repetitive smiles, gestures, introductions and summaries. Do not narrate player thoughts or manufacture a contrast to refute. When reliable information is missing, decline briefly in character without mentioning model or database machinery.',
    s.actionDensity === 'none' ? 'No action descriptions; only authorized dialogue or factual narration.' : 'Use actions sparingly and only when they convey something necessary.',
    s.selfCheck ? 'Check consistency, repetition and voice internally in the same generation; do not output the check or request a second pass.' : '',
    sanitizeStyleText(s.customRules).text,
  ].filter(Boolean).join('\n')
  return [
    BUILTIN_TEXT_STYLE,
    '对话就事论事。让性格通过措辞、关注点和具体回应自然显现，不主动宣告人设、认知边界或行动原则，不追加“这些只是我看见的／我不会猜”等自我审查说明。被明确问到未知信息、立场或意愿时可自然简短拒答；不输出内部思考，不为避免边界说明而编造事实。',
    s.actionDensity === 'none'
      ? '不写动作描写，只生成获准的对白或事实叙述。'
      : '动作描写保持少量，有明确作用才写。',
    s.selfCheck
      ? '在同一次生成内部简短检查重复表达、事实依据和人物声音；不要输出检查过程，不要求再次调用模型。'
      : '',
    sanitizeStyleText(s.customRules).text,
  ]
    .filter(Boolean)
    .join('\n')
}
export function repetitionHints(text: string, samples: TextStyleSnapshot['samples']) {
  const clean = (s: string) => s.replace(/[\s“”"'，。！？、：；—…]/g, ''),
    head = clean(text).slice(0, 10),
    tail = clean(text).slice(-10)
  return [
    head.length >= 6 && samples.some((s) => clean(s.text).startsWith(head))
      ? '开场与近期已发布回复重复'
      : '',
    tail.length >= 6 && samples.some((s) => clean(s.text).endsWith(tail))
      ? '收尾与近期已发布回复重复'
      : '',
  ].filter(Boolean)
}
