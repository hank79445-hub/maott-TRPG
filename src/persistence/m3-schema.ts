import { z } from 'zod'
const ref = z.string().min(1).max(120)
export const spaceLayerSchema = z.enum(['material', 'ethereal', 'pocket', 'stone'])
export const spatialStateSchema = z.object({
  fallUsedAt:z.string().max(240).optional(),liftKind:z.enum(['levitate','fly']).optional(),
  returnOrigin:z.object({x:z.number().finite(),y:z.number().finite(),height:z.number().finite(),layer:spaceLayerSchema}).strict().optional(),
  height: z.number().finite().min(-10000).max(10000), layer: spaceLayerSchema,
  anchorId: ref.optional(), supportId: ref.optional(),
}).strict().refine(s => !['pocket', 'stone'].includes(s.layer) || !!s.anchorId, '特殊空间须关联锚点')
export const m3EffectSchema = z.object({
  withinAura:z.boolean().optional(),
  naturalDamageType:z.enum(['bludgeoning','piercing','slashing']).optional(),
  option: z.enum(['aquatic', 'appearance', 'weapons', 'enlarge', 'reduce', 'mask', 'false-aura']).optional(),
  description: z.string().max(2000).optional(), creatureType: z.enum(['aberration','beast','celestial','construct','dragon','elemental','fey','fiend','giant','humanoid','monstrosity','ooze','plant','undead']).optional(),
  school: z.string().max(80).optional(), magical: z.boolean().optional(), images: z.number().int().min(0).max(3).optional(),
  lastTurn: z.string().max(240).optional(),
  origin: z.object({ x: z.number().finite(), y: z.number().finite(), height: z.number().finite(), layer: spaceLayerSchema }).strict().optional(),
  sourceSize: z.enum(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']).optional(),
}).strict()
export const m3CastChoiceSchema = m3EffectSchema.pick({ option:true,description:true,creatureType:true,school:true,magical:true,naturalDamageType:true })
