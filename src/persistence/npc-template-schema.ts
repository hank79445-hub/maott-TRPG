import { z } from 'zod'
const text = z.string().max(2000)
export const npcTemplateMetadataSchema = z
  .object({
    sourceKind: z.enum(['official', 'custom', 'summon']).optional(),
    classIds: z
      .array(
        z
          .string()
          .refine((id) =>
            [
              'barbarian',
              'bard',
              'cleric',
              'druid',
              'fighter',
              'monk',
              'paladin',
              'ranger',
              'rogue',
              'sorcerer',
              'warlock',
              'wizard',
            ].includes(id),
          ),
      )
      .max(12)
      .optional(),
    englishName: text.min(1),
    category: z.enum(['goblinoid', 'civilian', 'undead', 'beast', 'giant', 'fiend']),
    tags: z
      .array(z.enum(['elite', 'caster', 'special']))
      .max(3)
      .optional(),
    sourceVersion: text.min(1),
    templateVersion: text.min(1),
    pages: z.array(z.number().int().min(1).max(10000)).min(1).max(5).optional(),
    cr: z
      .enum(['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))] as [
        string,
        ...string[],
      ])
      .optional(),
    xp: z.number().int().nonnegative().max(1000000).optional(),
    proficiencyBonus: z.number().int().min(2).max(10),
    alignment: text,
    hitDice: text,
    skills: z.record(z.string().max(120), z.number().int().min(-20).max(50)),
    senses: z.array(text).max(10),
    passivePerception: z.number().int().min(0).max(50),
    languages: z.array(text).max(10),
    movement: z
      .array(
        z
          .object({
            kind: z.enum(['climb', 'swim', 'fly', 'burrow']),
            feet: z.number().int().min(0).max(300),
          })
          .strict(),
      )
      .max(4),
    gear: z.array(text).max(20),
    requiresManualTurn: z.boolean().optional(),
    abilities: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            name: text.min(1),
            support: z.enum(['automatic', 'gm', 'unsupported']),
            detail: text,
            cost: z.enum(['action', 'bonus', 'reaction', 'none']).optional(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.sourceKind !== 'custom' && m.sourceKind !== 'summon' && (!m.pages?.length || m.cr === undefined || m.xp === undefined))
      ctx.addIssue({ code: 'custom', message: '规则数据块必须保留页码、CR与XP' })
  })
