import type { AiJob, AiSettings } from './ai-types'
import type { NarrationSkill } from '../persistence/narration-skill-schema'
import { localeOrDefault, normalizeLocale, outputLanguageInstruction, LANGUAGE_POLICY_VERSION } from '../shared/localization/locale'
export function languageSnapshot(settings: AiSettings, skill?: NarrationSkill | null) {
  return { outputLocale: normalizeLocale(effectiveOutputLanguage(settings,skill)), languagePolicyVersion: LANGUAGE_POLICY_VERSION,
 }
}
export function effectiveOutputLanguage(settings:AiSettings,skill?:NarrationSkill|null){
  const useSkill=!!skill&&(skill.languageMode==='override'||settings.contentLocale===undefined&&skill.languageMode===undefined)
  return useSkill?skill!.language:settings.contentLocale??settings.language
}
export function taskLocale(job: AiJob) {
  // Old queued tasks use their saved context, never today's room setting.
  return job.outputLocale ?? localeOrDefault(job.kind === 'narration' ? job.context.language : undefined)
}
export function localizeModelRequest<T extends { system: string; input: Record<string, unknown> }>(request: T, job: AiJob): T {
  if (job.kind === 'narration' && (job.modelProbe || (!job.outputLocale && typeof job.context.language === 'string' && !normalizeLocale(job.context.language)))) return request
  const outputLocale = taskLocale(job)
  return { ...request, system: request.system + '\n' + outputLanguageInstruction(outputLocale), input: { ...request.input, outputLocale, languagePolicyVersion: job.languagePolicyVersion ?? LANGUAGE_POLICY_VERSION } }
}
/** Conservative guard for clear whole-paragraph mismatches. Mixed names/quotes are allowed. */
export function assertOutputLanguage(text:string,job:AiJob){
  if(!job.outputLocale||!job.languagePolicyVersion)return
  const prose=text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"\n]*"/g,' ')
  const han=(prose.match(/\p{Script=Han}/gu)??[]).length
  const latin=(prose.match(/[A-Za-z]/g)??[]).length
  const words=(prose.match(/[A-Za-z]{2,}/g)??[]).length
  if(job.outputLocale==='en'&&han>=60&&han/(han+latin)>0.8&&words<5)
    throw Error('Output language mismatch: the task requires English. Regenerate only natural-language values; preserve IDs, facts and permissions.')
  if(job.outputLocale==='zh-CN'&&han===0&&latin>=500&&words>=100)
    throw Error('输出语言不匹配：本任务要求简体中文；仅重生成自然语言正文，保留ID、事实、受众与权限。')
}
