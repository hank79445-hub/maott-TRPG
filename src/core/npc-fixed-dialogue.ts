import type { NpcProfile } from './ai-types'
import type { Locale } from '../shared/localization/locale'
export function fixedReplyUsesOriginal(n:NpcProfile,locale:Locale,sourceLocale:Locale='zh-CN'){
  const lines=n.fixedReplies?.filter(r=>r.text.trim())??[],cursor=n.fixedReplyCursor??0
  if(!lines.length)return locale!=='zh-CN'
  if(locale===sourceLocale)return false
  if(cursor>=lines.length&&n.fixedReplyMode!=='loop')return !n.fixedReplyEndLocales?.[locale]?.trim()&&!!n.fixedReplyEnd
  return !lines[cursor%lines.length]?.localized?.[locale]?.trim()
}
/** Preview is pure. Only a confirmed publication advances this NPC's shared cursor. */
export function nextFixedReply(n: NpcProfile, commit = false, locale: Locale = 'zh-CN') {
  const lines = n.fixedReplies?.filter((r) => r.text.trim()) ?? []
  if (!lines.length) return n.fallbackReply || '此事请主持人确认。'
  const cursor = n.fixedReplyCursor ?? 0
  if (cursor >= lines.length && n.fixedReplyMode !== 'loop')
    return n.fixedReplyEndLocales?.[locale]?.trim() || n.fixedReplyEnd || (locale === 'en' ? 'I have said all I can.' : '该说的我都说完了。')
  const index = cursor % lines.length
  if (commit) n.fixedReplyCursor = index + 1
  return lines[index]!.localized?.[locale]?.trim() || lines[index]!.text
}
