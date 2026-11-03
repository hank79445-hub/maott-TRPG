import {openingPresentationSchema} from './opening-reading-schema'
import {localeSchema} from '../shared/localization/locale'
import { authoringNotebookSchema } from './authoring-stage-schema'
import {summonStateSchema} from './summon-schema'
import { fogPolicySchema, fogStateSchema } from './fog-schema'
import { tradeStateSchema } from './trade-schema'
import {validateSummonState} from '../core/summon-validation'
import {gmSpellFactSchema} from './gm-spell-choice-schema'
import {validateSceneEffects} from '../core/scene-effect-validation'
import {sceneEffectsSchema} from './scene-effects-schema'
import {sceneInitialSchema} from './scene-initial-schema'
import {initialSpatialSchema} from './m3-initial-schema'
import {m3WorldSchema} from './m3-world-schema'
import { pointItemsSchema } from './point-items-schema'
import { spatialStateSchema } from './m3-schema'
import { growthGuideSchema } from './script-design-schema'
import { gmSpellRequestSchema } from './spell-workflow-schema'
import { artBriefSchema, pointAppearanceSchema, calibrationPendingSchema } from './scene-art-schema'
import { arrivalGroupSchema, groundItemSchema } from './scene-tools-schema'
import { gmControlSchema } from './gm-control-schema'
import { adventureAiSchema, aiJournalSchema } from './ai-schema'
import { battleStateSchema } from './battle-schema'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { isBuiltinPack } from '../content/builtin-ids'
import { broadcastSettingsSchema, broadcastJournalSchema } from './broadcast-schema'
import { environmentSchema, boundaryWallsSchema } from './scene-art-schema'
import { pointReviewSchema } from './gm-review-schema'
import { z } from 'zod'
import {m1UtilitySchema} from './m1-utility-schema'
import { pointLinkSchema, pointLinkRunSchema } from './point-link-schema'
import {
  pointDiscoverySchema,
  discoveryAttemptSchema,
  pausedRouteSchema,
} from './point-discovery-schema'
import { explorationSchema } from './exploration-schema'
import type { Adventure, AdventureState, MapAsset, MapWorld } from '../core/map-types'
import { TERRAIN } from '../core/map-types'
import { characterSchema, packSchema, inventorySchema } from './schema'
import { encounterSchema, npcSchema } from './combat-schema'
import { validateAdventure } from '../core/map'
import { catalogue, validate } from '../core/engine'
import { validateInventory, validateRuntimeArchive } from '../core/runtime'
import { srd } from '../content/srd'
import {
  MAP_IMAGE_BYTES,
  MAP_SOURCE_BYTES,
  MAP_PREVIEW_BYTES,
  MAP_TOTAL_IMAGE_BYTES,
  MAP_IMAGE_PIXELS,
  MAP_IMAGE_EDGE,
  MAP_IMAGE_MIMES,
  base64Limit,
} from '../core/map-limits'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s))
const text = z.string().max(2000),
  int = z.number().finite().int(),
  num = z.number().finite()
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const xy = { x: int.min(0).max(79), y: int.min(0).max(79) }
const pos = z.object(xy).strict()
const wallPos = z.object({ x: num.min(0).max(80), y: num.min(0).max(80) }).strict()
export const wallSchema = z
  .object({
    gapFeet:z.number().finite().min(0).max(5).optional(),
    heightFeet:z.number().finite().min(0).max(10000).optional(),
    id,
    name: text.min(1),
    a: wallPos,
    b: wallPos,
    kind: z.enum(['wall', 'door']),
    state: z.enum(['closed', 'open', 'locked']),
    pointId: id.nullable(),
    blocksMovement: z.boolean(),
    blocksSight: z.boolean(),
    blocksLight:z.boolean().optional(),
    blocksSound:z.boolean().optional(),
    blocksTargeting: z.boolean(),
    cover: z.enum(['none', 'half', 'three-quarters', 'total']).optional(),
    hidden: z.boolean(),
    color,
  })
  .strict()
const mapTokenSchema = z
  .object({
    baseSpan:int.min(1).max(4).optional(),effectiveSize:z.enum(['tiny','small','medium','large','huge','gargantuan']).optional(),
    initialSpatialHeight:z.number().finite().min(-10000).max(10000).optional(),
    initialSupportId:id.optional(),
    spatial: spatialStateSchema.optional(),
    id,
    characterId: id.nullable(),
    npcId: id.optional(),
    npcBody: npcSchema.optional(),
    npcSourceActorId: id.optional(),
    riderTokenId:id.optional(),
    companionKey: text.optional(),
    groundTrail: z.array(z.object(xy).strict()).max(200).optional(),
    actorId: id.nullable(),
    ...xy,
    name: text.min(1),
    span: int.min(1).max(4),
    hidden: z.boolean(),
    color,
    facing: num.min(-360).max(360),
  })
  .strict()
export const sceneSchema = z
  .object({
    fog: fogPolicySchema.optional(),
    pointLinks: z.array(pointLinkSchema).max(100).optional(),
    linkRuns: z.array(pointLinkRunSchema).max(500).optional(),
    discoveryAttempts: z.array(discoveryAttemptSchema).max(5000).optional(),
    pausedRoutes: z.array(pausedRouteSchema).max(100).optional(),
    effectSetup:sceneInitialSchema.optional(),
    spatialSetup:initialSpatialSchema.optional(),
    environment: environmentSchema.optional(),
    boundaryWalls: boundaryWallsSchema.optional(),
    art: artBriefSchema.optional(),
    artCalibration: calibrationPendingSchema.optional(),
    arrivalGroups: z.array(arrivalGroupSchema).max(50).optional(),
    groundItems: z.array(groundItemSchema).max(100).optional(),
    id,
    name: text.min(1),
    note: text,
    grid: z
      .object({
        columns: int.min(2).max(80),
        rows: int.min(2).max(80),
        feet: int.min(1).max(100),
        cellPixels: num.min(32).max(256).default(64),
        originX: num.min(-5000).max(5000),
        originY: num.min(-5000).max(5000),
        offsetX: num.min(-5000).max(5000).default(0),
        offsetY: num.min(-5000).max(5000).default(0),
        strokeWidth: num.min(0.5).max(6).default(1),
        locked: z.boolean().default(false),
        color,
        opacity: num.min(0).max(1),
        show: z.boolean(),
      })
      .strict(),
    background: z
      .object({
        assetId: id,
        x: num.min(-5000).max(5000),
        y: num.min(-5000).max(5000),
        width: num.positive().max(10000),
        height: num.positive().max(10000),
        rotation: num.min(-360).max(360),
        locked: z.boolean(),
        clip: z.boolean(),
      })
      .strict()
      .nullable(),
    regions: z
      .array(
        z
          .object({
            id,
            name: text.min(1),
            cells: z.array(z.string().regex(/^\d+,\d+$/)).max(6400),
            tags: z.array(z.enum(TERRAIN)).max(5),
            color,
            height: num.min(-10000).max(10000).nullable(),
            jumpable: z.boolean().optional(),
            hidden: z.boolean(),
            note: text,
          })
          .strict(),
      )
      .max(100),
    tokens: z.array(mapTokenSchema).max(100),
    defeatedTokens: z.array(mapTokenSchema).max(1000).optional(),
    points: z
      .array(
        z
          .object({
            assistedReview: pointReviewSchema.optional(),
            storyResults: z
              .array(
                z
                  .object({
                    id,
                    type: z.enum(['rescued', 'aided', 'danger', 'goal']),
                    npcId: id,
                    outcome: z.enum(['success', 'failure']),
                    text: z.string().min(1).max(2000),
                    requiresGM: z.boolean(),
                  })
                  .strict(),
              )
              .max(10)
              .optional(),
            arrivalGroupIds: z.array(id).max(50).optional(),
            failureArrivalGroupIds: z.array(id).max(50).optional(),
            battlePresetId: id.nullable().optional(),
            id,
            ...xy,
            kind: z.enum(['door', 'chest', 'trap', 'clue', 'exit']),
            appearance: pointAppearanceSchema.optional(),
            editorColor: color.default('#ad6243'),
            name: text.min(1),
            note: text,
            revealed: text,
            hidden: z.boolean(),
            enabled: z.boolean(),
            state: z.enum(['ready', 'locked', 'open', 'closed', 'resolved', 'disarmed']),
            range: int.min(0).max(1000),
            check: z
              .object({ kind: z.enum(['skill', 'save']), id, dc: int.min(1).max(100) })
              .strict()
              .nullable(),
            containerDesign: z
              .object({
                emptyReason: z.string().max(2000).optional(),
                gmNote: z.string().max(2000).optional(),
              })
              .strict()
              .optional(),
            discovery: pointDiscoverySchema.optional(),
            loot: z
              .array(z.object({ itemId: id, quantity: int.min(1).max(10000) }).strict())
              .max(100),
            containerInventory: z.array(inventorySchema).max(100).optional(),
            repeatAccess: z.boolean().optional(),
            coins: num
              .min(0)
              .max(1000000)
              .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8),
            itemUse: pointItemsSchema.optional(),
            consume: z
              .object({ itemId: id, quantity: int.min(1).max(10000) })
              .strict()
              .nullable(),
            resource: z
              .object({ id, amount: int.min(1).max(10000) })
              .strict()
              .nullable(),
            portal: z
              .object({
                targetPointId: id.nullable(),
                bidirectional: z.boolean(),
                arrival: z
                  .object({
                    anchor: pos,
                    cells: z
                      .array(z.string().regex(/^\d+,\d+$/))
                      .min(1)
                      .max(225)
                      .refine((a) => new Set(a).size === a.length),
                    relative: z.boolean(),
                    facing: z.number().finite().optional(),
                  })
                  .strict()
                  .optional(),
              })
              .strict()
              .optional(),
            targetSceneId: id.nullable(),
            landing: pos,
            cost: z.enum(['free', 'action', 'bonus']),
          })
          .strict(),
      )
      .max(100),
    encounterId: id.nullable(),
    walls: z.array(wallSchema).max(400).default([]),
    annotations: z
      .array(
        z
          .object({
            id,
            ...xy,
            name: z.string().min(1).max(120),
            note: text,
            color,
            fontSize: int.min(12).max(28),
            offsetX: num.min(-200).max(200),
            offsetY: num.min(-200).max(200),
            hidden: z.boolean(),
          })
          .strict(),
      )
      .max(200)
      .default([]),
    template: z
      .object({
        ...xy,
        shape: z.enum([
          'circle',
          'cone',
          'line',
          'square',
          'sphere',
          'cube',
          'cylinder',
          'emanation',
        ]),
        size: num.min(1).max(1000),
        angle: num.min(-360).max(360),
        width: num.min(1).max(1000),
        origin: wallPos.optional(),
        originSpan: int.min(1).max(4).optional(),
        includeOrigin: z.boolean().optional(),
        originRule: z.enum(['face', 'center']).optional(),
        propagation: z.enum(['straight', 'manual']).optional(),
        note: text.optional(),
      })
      .strict()
      .nullable(),
    highGround: z
      .object({
        enabled: z.boolean(),
        weapon: z.boolean(),
        thrown: z.boolean(),
        spell: z.boolean(),
      })
      .strict(),
  })
  .strict()
const stateSchema = z
  .object({
    trades: tradeStateSchema.optional(),
    fogState: fogStateSchema.optional(),
    gmControls: z.array(gmControlSchema).max(100).optional(),
    summons:summonStateSchema.optional(),
    gmSpellClock:z.object({hours:z.number().finite().nonnegative(),samples:z.record(z.string(),z.number().finite().nonnegative())}).strict().optional(),
    gmSpellFacts:z.array(gmSpellFactSchema).max(1000).optional(),
    gmSpellRequests: z.array(gmSpellRequestSchema).max(500).optional(),
    m1Utility: m1UtilitySchema.optional(),
    m3:m3WorldSchema.optional(),
    sceneEffects:sceneEffectsSchema.optional(),
    growthGuide: growthGuideSchema.optional(),
    quests: z.array(questSchema).max(QUEST_LIMIT).optional(),
    exploration: explorationSchema.optional(),
    sourceScript: z
      .object({
        scriptId: id,
        versionId: id,
        authorVersion: z.string().min(1).max(80),
        startSceneId: id.optional(),
        landing: z.object({ x: int.nonnegative(), y: int.nonnegative() }).strict().optional(),
      })
      .strict()
      .optional(),
    battles: battleStateSchema.optional(),
    ai: adventureAiSchema.optional(),
    openingPresentation: openingPresentationSchema.optional(),
    broadcast: broadcastSettingsSchema.optional(),
    broadcastCursor: int.nonnegative().optional(),
    id,
    version: z.literal(1),
    name: text.min(1),
    revision: int.nonnegative(),
    party: z.array(id).max(100),
    activeSceneId: id.nullable(),
    scenes: z.array(sceneSchema).min(1).max(30),
  })
  .strict()
const snapshotSchema = z
  .object({
    adventure: stateSchema,
    characters: z.array(characterSchema).max(100),
    encounters: z.array(encounterSchema).max(1020),
    packs: z.array(packSchema).max(20),
  })
  .strict()
const checkpointSchema = z
  .object({
    id,
    at: z.string().datetime(),
    name: text.min(1),
    sceneId: id,
    pinned: z.boolean(),
    snapshot: snapshotSchema,
  })
  .strict()
export const adventureSchema = stateSchema
  .extend({
    contentLocale:localeSchema.optional(),
    designNotebook: authoringNotebookSchema.optional(),
    testBattle: z
      .object({
        id,
        battleId: id,
        sceneId: id,
        name: text.min(1),
        at: z.string().datetime(),
        snapshot: snapshotSchema,
        checkpoints: z.array(checkpointSchema).max(15).optional(),
      })
      .strict()
      .optional(),
    aiLog: aiJournalSchema.optional(),
    broadcastLog: broadcastJournalSchema.optional(),
    log: z
      .array(
        z
          .object({
            id,
            at: z.string().datetime(),
            detail: z.string().max(20000),
            before: snapshotSchema.nullable(),
            stamp: z.string().max(250000),
            undone: z.boolean(),
          })
          .strict(),
      )
      .max(50),
    checkpoints: z.array(checkpointSchema).max(15),
  })
  .strict()
const assetMeta = z
  .object({
    id,
    name: text,
    mime: z.enum(MAP_IMAGE_MIMES),
    width: int.min(1).max(MAP_IMAGE_EDGE),
    height: int.min(1).max(MAP_IMAGE_EDGE),
    importInfo: z
      .object({
        sourceName: text,
        width: int.min(1).max(MAP_IMAGE_EDGE),
        height: int.min(1).max(MAP_IMAGE_EDGE),
        bytes: int.min(1).max(MAP_SOURCE_BYTES),
        optimized: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
export const mapArchiveSchema = z
  .object({
    format: z.literal('trpg-adventure'),
    version: z.literal(1),
    adventure: adventureSchema,
    characters: z.array(characterSchema).max(100),
    encounters: z.array(encounterSchema).max(1020),
    packs: z.array(packSchema).max(20),
    assets: z
      .array(
        assetMeta
          .extend({
            data: z.string().max(base64Limit(MAP_IMAGE_BYTES)),
            preview: z
              .object({
                mime: z.enum(MAP_IMAGE_MIMES),
                width: int.min(1).max(4096),
                height: int.min(1).max(4096),
                data: z.string().max(base64Limit(MAP_PREVIEW_BYTES)),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
export const parseAdventure = (value: unknown) => {
  const a = adventureSchema.parse(value) as Adventure
  for (const n of a.ai?.npcs ?? []) {
    const tokens = a.scenes.flatMap((s) => s.tokens).filter((t) => t.npcId === n.id)
    n.hidden = n.hidden || tokens.some((t) => t.hidden)
    tokens.forEach((t) => {
      t.hidden = n.hidden
    })
  }
  return a
}
export function validateAsset(asset: MapAsset) {
  const { blob, preview, ...meta } = asset
  assetMeta.parse(meta)
  if (
    !(blob instanceof Blob) ||
    blob.type !== asset.mime ||
    blob.size > MAP_IMAGE_BYTES ||
    !blob.size ||
    asset.width * asset.height > MAP_IMAGE_PIXELS
  )
    throw new Error('地图图片需为 PNG/JPEG/WebP，单张最多 50 MB、6400 万像素')
  if (
    preview &&
    (!(preview.blob instanceof Blob) ||
      preview.blob.type !== preview.mime ||
      !MAP_IMAGE_MIMES.includes(preview.mime) ||
      !preview.blob.size ||
      preview.blob.size > MAP_PREVIEW_BYTES ||
      !Number.isInteger(preview.width) ||
      !Number.isInteger(preview.height) ||
      preview.width < 1 ||
      preview.height < 1 ||
      preview.width > 4096 ||
      preview.height > 4096 ||
      preview.width > asset.width ||
      preview.height > asset.height ||
      Math.abs(preview.width * asset.height - preview.height * asset.width) >
        Math.max(asset.width, asset.height))
  )
    throw new Error('浏览预览需为有效图片，最多 5 MB、长边 4096 像素，且与原图等比')
}
export function validateMapWorld(world: MapWorld, assets: MapAsset[]) {
  if (world.encounters.filter((e) => e.phase === 'active').length > 1)
    throw new Error('本地同时只能运行一个遭遇')
  if (
    new Set(world.adventures.map((a) => a.id)).size !== world.adventures.length ||
    new Set(assets.map((a) => a.id)).size !== assets.length
  )
    throw new Error('冒险或图片资源 ID 重复')
  if (
    world.adventures.length > 10 ||
    assets.length > 100 ||
    assets.reduce((sum, a) => sum + a.blob.size + (a.preview?.blob.size ?? 0), 0) >
      MAP_TOTAL_IMAGE_BYTES
  )
    throw new Error('本地最多 10 份冒险、100 张图片，原图与预览总量最多 200 MB')
  assets.forEach(validateAsset)
  const cat = catalogue([srd, ...world.packs]),
    assetIds = new Set(assets.map((a) => a.id)),
    bound = new Set<string>()
  const check = (
    a: AdventureState,
    chars: MapWorld['characters'],
    encounters: MapWorld['encounters'],
    packs: MapWorld['packs'],
  ) => {
    validateSummonState(a,chars,encounters)
    const sub = { ...world, characters: chars, encounters, packs },
      cat = catalogue([...BUILTIN_PACKS, ...packs])
    if (encounters.filter((e) => e.phase === 'active').length > 1)
      throw new Error('快照包含多个运行中的遭遇')
    if (
      new Set(chars.map((c) => c.id)).size !== chars.length ||
      new Set(encounters.map((e) => e.id)).size !== encounters.length ||
      new Set(packs.map((p) => p.id)).size !== packs.length
    )
      throw new Error('冒险快照包含重复引用')
    validateAdventure(a, sub, cat)
    validateSceneEffects(a,sub)
    for (const c of chars) {
      for (const p of c.packs)
        if (![...BUILTIN_PACKS, ...packs].some((x) => x.id === p.id && x.version === p.version))
          throw new Error('冒险缺少角色规则包：' + p.id)
      if (c.status !== 'complete' || validate(c.build, cat, { existingCharacter: true }).length)
        throw new Error('冒险角色未通过一级建角校验')
      validateInventory(c, cat)
      validateRuntimeArchive(c, cat)
    }
    for (const s of a.scenes)
      if (s.background && !assetIds.has(s.background.assetId)) throw new Error('缺少背景图片资源')
  }
  for (const a of world.adventures) {
    adventureSchema.parse(a)
    if (
      a.checkpoints.filter((c) => c.pinned).length > 10 ||
      a.checkpoints.filter((c) => !c.pinned).length > 5
    )
      throw new Error('每份冒险最多 5 个自动入场点和 10 个手动保留点')
    if (JSON.stringify(a.checkpoints).length > 24 * 1024 * 1024)
      throw new Error('存档点总量超过 24 MB，请精简归档中的存档点')
    validateAdventure(a, world, cat)
    validateSceneEffects(a,world)
    for (const s of a.scenes) {
      if (s.encounterId) {
        if (bound.has(s.encounterId)) throw new Error('同一遭遇被多个场景引用')
        bound.add(s.encounterId)
      }
      if (s.background && !assetIds.has(s.background.assetId)) throw new Error('缺少背景图片资源')
    }
    for (const cp of a.checkpoints) {
      if (
        cp.snapshot.adventure.id !== a.id ||
        !cp.snapshot.adventure.scenes.some((s) => s.id === cp.sceneId)
      )
        throw new Error('入场存档引用不一致')
      check(
        cp.snapshot.adventure,
        cp.snapshot.characters,
        cp.snapshot.encounters,
        cp.snapshot.packs,
      )
    }
    for (const event of a.log)
      if (event.before) {
        if (event.before.adventure.id !== a.id) throw new Error('撤销快照所属冒险不一致')
        check(
          event.before.adventure,
          event.before.characters,
          event.before.encounters,
          event.before.packs,
        )
      }
  }
}
import { questSchema, QUEST_LIMIT } from './quest-schema'
