import { newPipeline } from './authoring-stages'
import { stageDocumentSchema } from '../persistence/authoring-stage-schema'

export function recoverAuthoringPipeline(value: unknown) {
  const pipeline = newPipeline(), issues: string[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { pipeline, issues: ['阶段状态：须为对象'] }
  const raw = value as Record<string, unknown>
  if (raw.version !== 1) return { pipeline, issues: ['阶段状态.version：不支持的版本'] }
  if (raw.active === 1 || raw.active === 2 || raw.active === 3) pipeline.active = raw.active
  pipeline.affected = Array.isArray(raw.affected) ? raw.affected.filter((v): v is string => typeof v === 'string') : []
  for (const name of ['story', 'specification'] as const) {
    if (raw[name] == null) continue
    const result = stageDocumentSchema.safeParse(raw[name])
    if (result.success && result.data.stage === name) pipeline[name] = result.data
    else if (result.success) issues.push(name + '.stage：阶段类型不对应')
    else issues.push(...result.error.issues.map(i => name + '.' + i.path.join('.') + '：' + i.message))
  }
  if (Array.isArray(raw.history)) {
    pipeline.history = []
    raw.history.forEach((value, index) => {
      const result = stageDocumentSchema.safeParse(value)
      if (result.success) pipeline.history!.push(result.data)
      else issues.push('history.' + index + '：历史资料格式无效，已保留原文')
    })
    pipeline.history = pipeline.history.slice(-5)
  }
  return { pipeline, issues }
}
