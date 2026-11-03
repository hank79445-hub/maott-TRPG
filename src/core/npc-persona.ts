import { npcPersonaSchema, type NpcPersona } from '../persistence/npc-persona-schema'
export function personaBasis(p: NpcPersona) {
  let n = 2166136261
  for (const c of JSON.stringify({
    traits: p.public,
    relations: p.relations.filter((r) => r.visibility === 'public'),
  })) {
    n ^= c.charCodeAt(0)
    n = Math.imul(n, 16777619)
  }
  return (n >>> 0).toString(16)
}
export function newPersona() {
  return npcPersonaSchema.parse({ version: 1, public: {} })
}
export function publicPersona(p?: NpcPersona) {
  if (!p) return undefined
  return p.summary.trim() && p.summaryBasis === personaBasis(p)
    ? { summary: p.summary }
    : {
        traits: p.public,
        relations: p.relations.filter((r) => r.visibility === 'public'),
        summaryState: '未同步，使用公开原文',
      }
}
export function selfPersona(p?: NpcPersona) {
  if (!p) return undefined
  return {
    public: publicPersona(p),
    cognition: p.self,
    relations: p.relations.filter((r) => r.visibility !== 'director'),
  }
}
export const PERSONA_LABELS: Record<keyof NpcPersona['public'], string> = {
  situation: '当前处境',
  desire: '近期诉求',
  attachment: '长期牵挂',
  contradiction: '性格矛盾',
  relationships: '人物关系',
  boundaries: '底线与改变条件',
  voice: '表达习惯',
  pressure: '压力反应',
}
