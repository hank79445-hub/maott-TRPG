import { z } from 'zod'
export const narrationSkillSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(120)
      .refine((v) => !['__proto__', 'constructor', 'prototype'].includes(v)),
    name: z.string().min(1).max(100),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    description: z.string().max(2000),
    author: z.string().max(200),
    instructions: z.string().min(1).max(16000),
    language: z.string().min(1).max(80),
    languageMode: z.enum(['follow','override']).optional(),
    perspective: z.enum(['second', 'third']),
    tone: z.string().max(500),
    targetCharacters: z.number().int().min(80).max(2000),
    paragraphs: z.number().int().min(1).max(10),
    detail: z.enum(['restrained', 'standard', 'vivid']),
    includeNumbers: z.boolean(),
    examples: z.string().max(6000),
  })
  .strict()
export type NarrationSkill = z.infer<typeof narrationSkillSchema>
export const narrationSkillPackageSchema = z
  .object({ format: z.literal('trpg.narration-skill.v1'), skill: narrationSkillSchema })
  .strict()
