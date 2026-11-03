import {localeSchema} from '../shared/localization/locale'
import { z } from 'zod'
import { npcPersonaSchema } from './npc-persona-schema'
const key = z.string().min(1).max(120),
  text = z.string().max(30000).default('')
export const stageNodeSchema = z
  .object({
    key,
    title: z.string().min(1).max(200),
    section: z.enum([
      'conflict',
      'background',
      'faction',
      'character',
      'scene',
      'clue',
      'event',
      'choice',
      'specification',
      'quest',
      'encounter',
      'economy',
    ]),
    body: text,
    refs: z.array(key).max(100).default([]),
    locked: z.boolean().default(false),
    persona: npcPersonaSchema.optional(),
  })
  .strict()
export const stageDocumentSchema = z
  .object({
    format: z.literal('trpg-design-stage'),
    version: z.literal(1),
    contentLocale: localeSchema.optional(),
    stage: z.enum(['story', 'specification']),
    title: z.string().min(1).max(200),
    revision: z.number().int().nonnegative(),
    sourceRevision: z.number().int().nonnegative().nullable().default(null),
    nodes: z.array(stageNodeSchema).max(500),
    notes: text,
  })
  .strict()
export type StageDocument = z.infer<typeof stageDocumentSchema>
export const authoringNotebookSchema = z
  .object({
    version: z.literal(1),
    story: stageDocumentSchema.optional(),
    specification: stageDocumentSchema.optional(),
  })
  .strict()
