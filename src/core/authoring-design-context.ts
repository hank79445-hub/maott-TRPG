import { authoringNotebookSchema } from '../persistence/authoring-stage-schema'
export type DesignNotebook = import('zod').infer<typeof authoringNotebookSchema>
export function designContextFiles(value?: DesignNotebook): Record<string, string> {
  if (!value) return {}
  const checked = authoringNotebookSchema.parse(value),
    files: Record<string, string> = {}
  for (const [name, doc] of [
    ['story-design.json', checked.story],
    ['specification-design.json', checked.specification],
  ] as const)
    if (doc) {
      const text = JSON.stringify(doc, null, 2)
      if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
        throw Error(name + '超过2MiB，请分阶段精简；不占创作需求字符额度')
      files[name] = text
    }
  return files
}
export function designContextText(value?: DesignNotebook) {
  const files = designContextFiles(value)
  return Object.keys(files).length
    ? '\n附带设计资料（独立于创作需求字符额度）：保持人物、场景、任务稳定key；仅生成对应作品配置。GM与本人资料不得进入公开知识或美术，不复制成NPC公开描述。若有既有JSON先核对作品与引用，不沿用不相关示例剧情。\n' +
        Object.entries(files)
          .map(([name, text]) => name + '\n' + text)
          .join('\n')
    : ''
}
