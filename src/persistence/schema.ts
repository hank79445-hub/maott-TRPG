import {itemSpellSchema,itemCastReceiptSchema,spellKeySchema} from './item-spell-schema'
import { z } from 'zod'
import { m3EffectSchema } from './m3-schema'
import {areaTemplateSchema} from './area-schema'
import { specialWeaponSchema } from './special-weapon-schema'
import { isBuiltinPack } from '../content/builtin-ids'
import { CONDITIONS } from '../content/conditions'
import type { Character, Pack } from '../core/types'
import {
  EQUIPMENT_SLOTS,
  INVENTORY_TAGS,
  WEAR_SLOTS,
  PORTRAIT_MAX_LENGTH,
  PORTRAIT_PATTERN,
} from '../core/types'
const text = z.string().max(20000)
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s), '非法 ID')
const integer = z.number().int().finite()
const ability = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const scores = z
  .object({ str: integer, dex: integer, con: integer, int: integer, wis: integer, cha: integer })
  .strict()
const choiceMap = z.record(id, z.array(id).max(100))
const source = z
  .object({
    pack: id,
    version: id,
    page: integer.min(0),
    url: z.string().url().optional(),
    edition: z.enum(['2024', 'custom']).optional(),
    chapter: text.optional(),
    errata: text.optional(),
  })
  .strict()
const entry = {
  id,
  name: text,
  english: text,
  summary: text,
  source,
  aliases: z.array(text).max(30).optional(),
}
const item = z
  .object({
    spellUse: itemSpellSchema.optional(),
    ...entry,
    kind: z.enum(['weapon', 'armor', 'shield', 'gear', 'tool', 'pack']),
    cost: z.number().finite().nonnegative(),
    weight: z.number().finite().nonnegative(),
    category: text.optional(),
    damage: text.optional(),
    damageType: text.optional(),
    properties: z.array(text).max(30).optional(),
    mastery: text.optional(),
    ac: integer.optional(),
    dexCap: integer.optional(),
    strength: integer.optional(),
    stealthDisadvantage: z.boolean().optional(),
    contents: z
      .array(z.object({ itemId: id, quantity: integer.positive().max(1000) }).strict())
      .max(100)
      .optional(),
    wearSlot: z.enum(WEAR_SLOTS).optional(),
    holdable: z.boolean().optional(),
    inventoryTag: z.enum(INVENTORY_TAGS).optional(),
  })
  .strict()
const adjustment = z
  .object({
    id,
    field: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha', 'hp', 'ac']),
    amount: integer.min(-100).max(100),
    reason: text.min(1),
  })
  .strict()
const inventory = z
  .object({
    specialWeapon: specialWeaponSchema.optional(),
    spellEnchantments:z.array(z.lazy(():z.ZodType<import('../core/types').ActiveEffect>=>effectSchema as unknown as z.ZodType<import('../core/types').ActiveEffect>)).max(10).optional(),
    instanceId: id,
    itemId: id,
    quantity: integer.positive().max(10000),
    source: text,
    equipped: z.boolean(),
    note: text,
    containerId: id.nullable().optional(),
    equipmentSlot: z.enum(EQUIPMENT_SLOTS).nullable().optional(),
    grip: z.enum(['one-handed', 'two-handed']).nullable().optional(),
    uses: integer.min(0).max(1000).optional(),
    craftedBy: id.optional(),
    craftedAt: z.number().finite().nonnegative().optional(),
    consumable: z
      .object({
        kind: z.enum(['chef-treat', 'poisoner-dose','goodberry']),
        clockSourceId:id.optional(),castId:id.optional(),
        value: integer.min(1).max(3),
        expiresAt: z.number().finite().nonnegative().optional(),
        dc: integer.min(1).max(40).optional(),
      })
      .strict()
      .refine(c=>c.kind==='goodberry'?c.value===1&&c.expiresAt!==undefined&&!!c.clockSourceId&&!!c.castId:c.value>=2,'消耗品强度／来源不合法')
      .optional(),
  })
  .strict()
export const inventorySchema=inventory
export const effectSchema = z
  .object({
    m3: m3EffectSchema.optional(),
    wardingBond: z.object({ targetId: id }).strict().optional(),
    sourceCreatureType: z.string().max(80).optional(),
    protectedTypes: z.array(z.string().max(40)).max(14).optional(),
    protectedSourceIds: z.array(id).max(1000).optional(),
    castId: id.optional(), spellId: id.optional(), spellLevel: integer.min(0).max(9).optional(),
    hpBonus: integer.min(0).max(100).optional(), acFloor: integer.min(0).max(40).optional(),
    damageImmunities: z.array(z.enum(['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'])).max(13).optional(),
    damageResistances: z.array(z.enum(['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'])).max(13).optional(),
    conditionImmunities: z.array(z.string().max(40)).max(20).optional(),
    flatSaveBonus: integer.min(-10).max(10).optional(),
    saveAdvantage: z.array(z.enum(['str','dex','con','int','wis','cha'])).max(6).optional(),
    savePurposeAdvantage: z.array(z.string().max(40)).max(6).optional(),
    checkAdvantage: z.enum(['str','dex','con','int','wis','cha']).optional(),
    maximizeHealing: z.boolean().optional(), deathSaveAdvantage: z.boolean().optional(), curse:z.boolean().optional(),
    supportChoice: id.optional(),
    m5AppliedTick:integer.nonnegative().optional(),
    m5AppliedHour:z.number().finite().nonnegative().optional(),
    spellDc:integer.min(0).max(100).optional(),
    resistanceUsedTurn: z.string().max(300).optional(),
    clockSourceId: id.optional(),
    sleepStage: z.enum(['drowsy', 'asleep']).optional(),
    speedZero: z.boolean().optional(),
    repeatAfterTick: integer.nonnegative().optional(),
    conditions: z
      .array(z.string().refine((id) => CONDITIONS.some((c) => c.id === id), '未知状态'))
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length, '状态不可重复')
      .optional(),
    socialTargetId: id.optional(),
    visibility: z.enum(['public', 'owner', 'gm']).optional(),
    grapple: z
      .object({
        hand: z.enum(['main-hand', 'off-hand']),
        dc: integer.min(1).max(40),
        range: integer.min(5).max(30),
      })
      .strict()
      .optional(),
    charmSources: z.array(id).max(4).optional(),
    weapon: z
      .object({
        instanceId: id,
        bonus: integer.min(1).max(3),
        dice: z.enum(['1d4', '2d4', '3d4']).optional(),
        damageType: z.enum(['acid', 'cold', 'fire', 'lightning', 'thunder']).optional(),
      })
      .strict()
      .optional(),
    repeatSave: z
      .object({ ability, dc: integer.min(1).max(100) })
      .strict()
      .optional(),
    maintainedTick: integer.nonnegative().optional(),
    fearContext:z.object({contextId:id.optional(),tick:integer.nonnegative(),noSafeRoute:z.boolean(),sourceVisible:z.boolean(),movementResolved:z.boolean()}).strict().optional(),
    directiveComplete:z.boolean().optional(),
    control:z.object({region:z.object({sceneId:id,template:areaTemplateSchema}).strict().optional(),dc:z.number().int().min(0).max(100),targets:z.array(id).max(100),text:z.string().max(2000),lastTick:z.number().int().optional(),turnKey:z.string().max(200).optional(),maintenanceKey:z.string().max(200).optional(),trials:z.array(z.object({targetId:id,success:z.boolean()}).strict()).max(100).optional(),result:z.boolean().optional(),inside:z.boolean().optional()}).strict().optional(),
    endDamage:z.object({dice:z.string().regex(/^\d{1,2}d[468]$/),damageType:z.literal('acid')}).strict().optional(),
    startDamage: z
      .object({
        dice: z.enum(['1d6', '2d6', '3d6']),
        damageType: z.enum(['fire','piercing']),
        dc: integer.min(1).max(100),
      })
      .strict()
      .optional(),
    variant: z.literal('valor').optional(),
    rollOverride: integer.min(1).max(20).optional(),
    rollFloor: integer.min(1).max(20).optional(),
    id,
    key: id,
    name: text,
    sourceId: id,
    page: integer.nonnegative(),
    concentration: z.boolean(),
    expiresAt: integer.nonnegative().nullable(),
    encounterId: id,
    phase: z.enum(['start', 'end']),
    condition: text.optional(),
    ability: ability.optional(),
    endsAt: z.number().finite().nonnegative().optional(),
    acBonus: integer.min(-100).max(100).optional(),
    acBase: integer.min(0).max(100).optional(),
    speedPenalty: integer.min(0).max(300).optional(),
    speedBonus: integer.min(0).max(300).optional(),
    attackAdvantage: z.boolean().optional(),
    attackDisadvantage: z.boolean().optional(),
    attackDie: integer
      .min(-20)
      .max(20)
      .refine((n) => n !== 0)
      .optional(),
    saveDie: integer
      .min(-20)
      .max(20)
      .refine((n) => n !== 0)
      .optional(),
    blocksHealing: z.boolean().optional(),
    noReaction: z.boolean().optional(),
    note: text,
  })
  .strict()
export const runtimeSchema = z
  .object({
    lastCastKey: z.string().max(300).optional(),
    itemCasts: z.array(itemCastReceiptSchema).max(60).optional(),
    resistanceUsedTurn: z.string().max(300).nullable().optional(),
    grapples: z
      .array(
        z
          .object({ targetId: id, encounterId: id, hand: z.enum(['main-hand', 'off-hand']) })
          .strict(),
      )
      .max(2)
      .optional(),
    mounted: z.boolean().optional(),
    advanced: z
      .object({
        surges: z
          .array(
            z
              .object({
                id,
                roll: integer.min(1).max(100),
                subRolls: z.array(integer.min(1).max(10)).max(10),
                detail: text,
                startedAt: z.number().finite().nonnegative(),
                endsAt: z.number().finite().nonnegative(),
                settled: z.boolean(),
              })
              .strict(),
          )
          .max(20)
          .optional(),
        ward: integer.min(0).max(100).nullable(),
        portents: z.array(integer.min(1).max(20)).max(2),
        lastCheck: z
          .object({
            id,
            kind: z.enum(['skill', 'save', 'initiative', 'ability']),
            key: id,
            total: integer.min(-200).max(200),
            dc: integer.min(1).max(100).nullable(),
            proficient: z.boolean(),
            attempted: z.boolean(),
            autoFail: z.boolean(),
          })
          .strict()
          .nullable(),
      })
      .strict()
      .optional(),
    revelation: z
      .object({
        mode: z.enum(['wings', 'radiance', 'shroud']),
        endsAt: z.number().finite().nonnegative(),
      })
      .strict()
      .nullable()
      .optional(),
    lastRest: z
      .object({
        kind: z.enum(['short', 'long']),
        endedAt: z.number().finite().nonnegative(),
        crafted: z.boolean(),
        sang: z.boolean(),
        usedHitDice: z.boolean().optional(),
        fed: z.boolean().optional(),
        led: z.boolean().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    knownBeasts: z.array(id).max(6).optional(),
    wildShape: z
      .object({
        formId: id,
        endsAt: z.number().finite().nonnegative(),
        equipment: z.literal('merge'),
      })
      .strict()
      .nullable()
      .optional(),
    hp: integer,
    temporaryHp: integer.nonnegative(),
    resources: z.record(id, integer.nonnegative()),
    createdSlots: z.record(id, integer.min(0).max(20)).optional(),
    conditions: z.array(text).max(50),
    version: z.literal(2).optional(),
    exhaustion: integer.min(0).max(6).optional(),
    hitDice: integer.min(0).max(5).optional(),
    death: z
      .object({
        successes: integer.min(0).max(3),
        failures: integer.min(0).max(3),
        stable: z.boolean(),
        dead: z.boolean(),
      })
      .strict()
      .optional(),
    concentration: z
      .object({
        castId: id.optional(),
        spellId: id,
        source: text,
        castingKey:spellKeySchema.optional(),
        castingMode:id.optional(),
        extended: z.boolean().optional(),
        pendingDC: integer.min(10).max(30).nullable(),
        endsAt: z.number().finite().nonnegative().nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    rage: z.boolean().optional(),
    innateSorcery: z.boolean().optional(),
    heroicInspiration: z.boolean().optional(),
    restSpellChoices: z.partialRecord(z.enum(['class-cantrips','tome-cantrips','tome-rituals']), z.array(id).max(20)).optional(),
    preparedSpells: z.array(id).max(100).nullable().optional(),
    hours: z.number().finite().nonnegative().optional(),
    prayerHealingSinceLongRest:z.boolean().optional(),
    nourishedUntil:z.number().finite().nonnegative().optional(),
    lastLongRestEnd: z.number().finite().nonnegative().nullable().optional(),
    effects: z.array(effectSchema).max(100).optional(),
    effectEnds: z
      .object({
        rage: z.number().finite().nullable(),
        innateSorcery: z.number().finite().nullable(),
      })
      .strict()
      .optional(),
  })
  .strict()
export const growthRecordSchema = z
  .object({
    level: integer.min(2).max(5),
    hpMethod: z.enum(['fixed', 'roll']),
    hp: integer.min(1).max(12),
    choices: choiceMap,
    beforeChoices: choiceMap,
    selectionVersion: z.literal(2).optional(),
    beforeSpellChoices: choiceMap.optional(),
    abilityIncreases: z.partialRecord(ability, integer.min(0).max(2)),
    at: z.string().datetime(),
    reason: text,
  })
  .strict()
export const growthRequestSchema = z
  .object({
    expectedRevision: integer.nonnegative(),
    targetLevel: integer.min(2).max(5),
    hpMethod: z.enum(['fixed', 'roll']),
    choices: choiceMap,
    abilityIncreases: z.partialRecord(ability, integer.min(0).max(2)),
    confirmed: z.boolean(),
    reason: text,
  })
  .strict()
export const snapshotSchema = z
  .object({
    growth: z.array(growthRecordSchema).max(4).optional(),
    choices: choiceMap.optional(),
    level: integer.min(1).max(5).optional(),
    runtime: runtimeSchema.nullable(),
    inventory: z.array(inventory).max(5000),
    coins: z.number().finite(),
  })
  .strict()
const eventSchema = z
  .object({
    id,
    at: z.string().datetime(),
    revision: integer.nonnegative(),
    kind: id,
    detail: text,
    before: snapshotSchema.nullable(),
    undone: z.boolean(),
  })
  .strict()
export const characterSchema = z
  .object({
    npcOwnerId: z.string().min(1).max(120).optional(),
    purpose: z.enum(['player', 'npc', 'shared']).optional(),
    schemaVersion: z.literal(1),
    level: integer.min(1).max(5).default(1),
    id,
    revision: integer.nonnegative(),
    status: z.enum(['draft', 'complete']),
    packs: z
      .array(z.object({ id, version: id }).strict())
      .min(1)
      .max(30),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    inventory: z.array(inventory).max(5000),
    coins: z.number().finite(),
    runtime: runtimeSchema.nullable(),
    journal: z.array(eventSchema).max(60).optional(),
    portrait: z.string().max(PORTRAIT_MAX_LENGTH).regex(PORTRAIT_PATTERN).nullable().optional(),
    build: z
      .object({
        growth: z.array(growthRecordSchema).max(4).optional(),
        classId: text,
        backgroundId: text,
        speciesId: text,
        method: z.enum(['array', 'point', 'roll']),
        scores,
        boosts: scores,
        rolls: z
          .object({
            dice: z.array(z.array(integer.min(1).max(6)).length(4)).length(6),
            totals: z.array(integer.min(3).max(18)).length(6),
            at: z.string().datetime(),
          })
          .strict()
          .nullable(),
        choices: choiceMap,
        classEquipment: integer.nonnegative(),
        backgroundEquipment: integer.nonnegative(),
        equipmentChoices: choiceMap,
        purchases: z
          .array(z.object({ itemId: id, quantity: integer.positive().max(1000) }).strict())
          .max(500),
        equipped: z.array(id).max(100),
        name: text,
        alignment: text,
        appearance: text,
        npcPresentation: z
          .object({
            publicClass: z.boolean(),
            publicSpecies: z.boolean(),
            apparentSpecies: z.string().max(200).optional(),
          })
          .strict()
          .optional(),
        story: text,
        adjustments: z.array(adjustment).max(100),
        customItems: z.array(item).max(100),
      })
      .strict(),
  })
  .strict()
const spell = z
  .object({
    ...entry,
    level: integer.min(0).max(9),
    school: text,
    lists: z.array(id).max(30),
    ritual: z.boolean(),
    concentration: z.boolean(),
    castingTime: text,
    range: text,
    components: text,
    duration: text,
    description: text,
  })
  .strict()
const equipment = z
  .object({
    label: text,
    gp: z.number().nonnegative(),
    items: z.array(z.object({ itemId: id, quantity: integer.positive().max(1000) }).strict()),
    choices: z
      .array(
        z
          .object({ id, label: text, count: integer.positive().max(20), options: z.array(id) })
          .strict(),
      )
      .optional(),
  })
  .strict()
const background = z
  .object({
    ...entry,
    abilities: z
      .array(ability)
      .length(3)
      .refine((x) => new Set(x).size === 3),
    skills: z
      .array(id)
      .length(2)
      .refine((x) => new Set(x).size === 2),
    tool: id,
    feat: id,
    equipment: z.array(equipment).min(1).max(10),
  })
  .strict()
const species = z
  .object({
    ...entry,
    speed: integer.min(0).max(120),
    sizes: z
      .array(z.enum(['small', 'medium']))
      .min(1)
      .max(2),
    features: z.array(text).max(30),
  })
  .strict()
export const featSchema = z
  .object({
    ...entry,
    category: z.enum(['origin', 'style', 'general', 'epic']),
    minLevel: integer.min(1).max(20),
    repeatable: z.boolean().optional(),
    abilityIncrease: z
      .object({
        abilities: z
          .array(ability)
          .min(1)
          .max(6)
          .refine((a) => new Set(a).size === a.length),
        points: z.union([z.literal(1), z.literal(2)]),
        maximum: z.literal(20),
      })
      .strict()
      .optional(),
    mechanic: z
      .enum([
        'alert',
        'savage-attacker',
        'skilled',
        'magic-initiate',
        'crafter',
        'healer',
        'lucky',
        'musician',
        'tavern-brawler',
        'tough',
        'archery',
        'defense',
        'great-weapon-fighting',
        'two-weapon-fighting',
        'blind-fighting',
        'dueling',
        'interception',
        'protection',
        'thrown-weapon-fighting',
        'unarmed-fighting',
      ])
      .optional(),
    prerequisite: z
      .object({
        abilities: z.partialRecord(ability, integer.min(1).max(30)).optional(),
        anyAbility: z
          .object({ abilities: z.array(ability).min(1).max(6), minimum: integer.min(1).max(30) })
          .strict()
          .optional(),
        armor: z
          .array(z.enum(['light', 'medium', 'heavy', 'shield']))
          .max(4)
          .optional(),
        feature: z.enum(['fighting-style', 'spellcasting']).optional(),
        classes: z.array(id).max(12).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (!f.mechanic) return
    const style = [
      'archery',
      'defense',
      'great-weapon-fighting',
      'two-weapon-fighting',
      'blind-fighting',
      'dueling',
      'interception',
      'protection',
      'thrown-weapon-fighting',
      'unarmed-fighting',
    ].includes(f.mechanic)
    if ((f.category === 'origin' && style) || (f.category === 'style' && !style))
      ctx.addIssue({ code: 'custom', message: '起源／战斗风格分类须与复用机制一致' })
  })
export const subclassSchema = z
  .object({
    ...entry,
    classId: z.enum([
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
    ]),
    minLevel: z.literal(3),
    features: z
      .array(z.object({ level: integer.min(3).max(5), name: text, summary: text }).strict())
      .max(30),
    spellGrants: z
      .array(
        z
          .object({
            level: integer.min(3).max(5),
            ids: z.array(id).max(20),
            ability: z.enum(['int', 'wis', 'cha']),
          })
          .strict(),
      )
      .max(10)
      .optional(),
  })
  .strict()
// V2 adds declarative feat prerequisites and subclasses. No executable handler is imported.
export const packSchema = z
  .object({
    formatVersion: z.literal(2).optional(),
    id,
    version: id,
    name: text,
    attribution: text.min(1),
    classes: z.array(z.never()).length(0),
    backgrounds: z.array(background).max(100),
    species: z.array(species).max(100),
    feats: z.array(featSchema).max(100),
    spells: z.array(spell).max(1000),
    items: z.array(item).max(1000),
    subclasses: z.array(subclassSchema).max(100).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (isBuiltinPack(p.id) || ['custom', 'local-custom'].includes(p.id))
      ctx.addIssue({ code: 'custom', message: '不能替换内置或保留规则包' })
    if (p.formatVersion !== 2 && (p.feats.length || (p.subclasses?.length ?? 0)))
      ctx.addIssue({ code: 'custom', message: '新增专长或子职业须使用规则包 formatVersion 2' })
    const entries = [
      ...p.backgrounds,
      ...p.species,
      ...p.feats,
      ...p.spells,
      ...p.items,
      ...(p.subclasses ?? []),
    ]
    if (new Set(entries.map((e) => e.id)).size !== entries.length)
      ctx.addIssue({ code: 'custom', message: '规则包条目 ID 重复' })
    if (
      entries.some(
        (e) =>
          !e.id.startsWith(p.id + '/') || e.source.pack !== p.id || e.source.version !== p.version,
      )
    )
      ctx.addIssue({ code: 'custom', message: '扩展条目的命名空间与来源版本须匹配规则包' })
  })
export const archiveSchema = z
  .object({
    format: z.literal('trpg-character'),
    version: z.literal(1),
    character: characterSchema,
    packs: z.array(packSchema).max(20),
  })
  .strict()
export function parseCharacter(value: unknown): Character {
  return characterSchema.parse(value) as Character
}
export function parsePack(value: unknown): Pack {
  return packSchema.parse(value) as Pack
}
