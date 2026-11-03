import { remapComplexReferences } from './combat-references'
import { clone } from '../core/engine'
import { adventureSnapshot } from '../core/map'
import type { Adventure, AdventureSnapshot, MapAsset, MapWorld, MapImage } from '../core/map-types'
import { MAP_ARCHIVE_BYTES, MAP_TOTAL_IMAGE_BYTES } from '../core/map-limits'
import { mapArchiveSchema, validateAsset, validateMapWorld } from './map-schema'

export function assetReferences(adventure: Adventure): Set<string> {
  const states = [
    adventure,
    ...adventure.checkpoints.map((c) => c.snapshot.adventure),
    ...adventure.log.flatMap((e) => (e.before ? [e.before.adventure] : [])),
    ...(adventure.testBattle ? [adventure.testBattle.snapshot.adventure] : []),
    ...(adventure.testBattle?.checkpoints?.map((cp) => cp.snapshot.adventure) ?? []),
  ]
  return new Set(
    states.flatMap((a) => a.scenes.flatMap((s) => (s.background ? [s.background.assetId] : []))),
  )
}
export interface EncodedImage {
  mime: MapImage['mime']
  width: number
  height: number
  data: string
}
export interface EncodedAsset extends EncodedImage {
  id: string
  name: string
  preview?: EncodedImage
  importInfo?: MapAsset['importInfo']
}
async function encodeImage(image: MapImage): Promise<EncodedImage> {
  const bytes = new Uint8Array(await image.blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
  return {
    mime: image.mime,
    width: image.width,
    height: image.height,
    data: 'data:' + image.mime + ';base64,' + btoa(binary),
  }
}
export async function encodeAsset(asset: MapAsset): Promise<EncodedAsset> {
  return {
    ...(await encodeImage(asset)),
    id: asset.id,
    name: asset.name,
    ...(asset.importInfo ? { importInfo: asset.importInfo } : {}),
    ...(asset.preview ? { preview: await encodeImage(asset.preview) } : {}),
  }
}
function decodeImage(input: EncodedImage): MapImage {
  const prefix = 'data:' + input.mime + ';base64,'
  if (!input.data.startsWith(prefix)) throw new Error('图片资源类型与数据不一致')
  let binary: string
  try {
    binary = atob(input.data.slice(prefix.length))
  } catch {
    throw new Error('图片资源不是有效的 base64')
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return {
    mime: input.mime,
    width: input.width,
    height: input.height,
    blob: new Blob([bytes], { type: input.mime }),
  }
}
export async function decodeAsset(input: EncodedAsset): Promise<MapAsset> {
  const asset = {
    ...decodeImage(input),
    id: input.id,
    name: input.name,
    ...(input.importInfo ? { importInfo: input.importInfo } : {}),
    ...(input.preview ? { preview: decodeImage(input.preview) } : {}),
  }
  await validateImageData(asset)
  return asset
}
export async function validateImageData(asset: MapAsset, decode = true) {
  validateAsset(asset)
  for (const image of [asset, ...(asset.preview ? [asset.preview] : [])]) {
    const bytes = new Uint8Array(await image.blob.slice(0, 12).arrayBuffer()),
      ascii = String.fromCharCode(...bytes)
    const matches =
      image.mime === 'image/png'
        ? Array.from(bytes.slice(0, 8)).join(',') === '137,80,78,71,13,10,26,10'
        : image.mime === 'image/jpeg'
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
    if (!matches) throw new Error('图片内容与 PNG/JPEG/WebP 类型不一致')
    if (decode && typeof createImageBitmap === 'function') {
      let bitmap: ImageBitmap
      try {
        bitmap = await createImageBitmap(image.blob)
      } catch {
        throw new Error('图片无法解码，请重新导入有效背景')
      }
      try {
        if (bitmap.width !== image.width || bitmap.height !== image.height)
          throw new Error('图片实际尺寸与资源记录不一致')
      } finally {
        bitmap.close()
      }
    }
  }
}
export async function exportMap(world: MapWorld, assets: MapAsset[], id: string) {
  const a = world.adventures.find((a) => a.id === id)
  if (!a) throw new Error('冒险不存在')
  const adventure = clone(a)
  adventure.log.forEach((e) => (e.before = null))
  const snapshot = adventureSnapshot(adventure, world),
    refs = assetReferences(adventure)
  const text = JSON.stringify({
    format: 'trpg-adventure',
    version: 1,
    adventure,
    characters: snapshot.characters,
    encounters: snapshot.encounters,
    packs: snapshot.packs,
    assets: await Promise.all(assets.filter((a) => refs.has(a.id)).map(encodeAsset)),
  })
  if (new Blob([text]).size > MAP_ARCHIVE_BYTES)
    throw new Error('冒险归档超过 400 MB，请精简存档或背景后重试')
  return text
}
export async function importMap(
  input: unknown,
  current: MapWorld,
  currentAssets: MapAsset[],
): Promise<{ world: MapWorld; assets: MapAsset[]; id: string }> {
  const parsed = mapArchiveSchema.parse(input)
  // Reject the combined byte budget before allocating decoded images. Decode in
  // sequence so large maps do not allocate several full-size bitmaps at once.
  const bytes = (data: string) => {
    const base64 = data.slice(data.indexOf(',') + 1)
    return (
      Math.floor((base64.length * 3) / 4) -
      (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
    )
  }
  if (
    parsed.assets.reduce(
      (sum, a) => sum + bytes(a.data) + (a.preview ? bytes(a.preview.data) : 0),
      0,
    ) > MAP_TOTAL_IMAGE_BYTES
  )
    throw new Error('归档的原图与预览总量超过 200 MB')
  const importedAssets: MapAsset[] = []
  for (const asset of parsed.assets) importedAssets.push(await decodeAsset(asset))
  const incoming: MapWorld = {
    adventures: [parsed.adventure as Adventure],
    characters: parsed.characters as MapWorld['characters'],
    encounters: parsed.encounters as MapWorld['encounters'],
    packs: parsed.packs as MapWorld['packs'],
  }
  validateMapWorld(incoming, importedAssets)
  if (new Set(incoming.characters.map((c) => c.id)).size !== incoming.characters.length)
    throw new Error('冒险归档包含重复角色')
  if (
    current.adventures.length >= 10 ||
    current.encounters.filter((e) => e.phase !== 'ended').length +
      incoming.encounters.filter((e) => e.phase !== 'ended').length >
      20 ||
    current.encounters.length + incoming.encounters.length > 1020
  )
    throw new Error('本地冒险或遭遇数量达到上限，请导出后移除旧记录')
  if (
    current.encounters.some((e) => e.phase === 'active') &&
    incoming.encounters.some((e) => e.phase === 'active')
  )
    throw new Error('请先结束当前遭遇再导入运行中的冒险')
  const mapping = new Map<string, string>(),
    assign = (id: string) => {
      if (!mapping.has(id)) mapping.set(id, crypto.randomUUID())
      return mapping.get(id)!
    }
  const snapshots: AdventureSnapshot[] = [
    adventureSnapshot(incoming.adventures[0]!, incoming),
    ...incoming.adventures[0]!.checkpoints.map((c) => c.snapshot),
    ...(incoming.adventures[0]!.testBattle ? [incoming.adventures[0]!.testBattle!.snapshot] : []),
    ...(incoming.adventures[0]!.testBattle?.checkpoints?.map((cp) => cp.snapshot) ?? []),
  ]
  // Room archives can contain reserve characters outside the current party.
  incoming.characters.forEach((c) => assign(c.id))
  for (const snapshot of snapshots) for (const c of snapshot.characters) assign(c.id)
  for (const snapshot of snapshots) {
    assign(snapshot.adventure.id)
    for(const row of [...snapshot.adventure.sceneEffects?.m5?.outcomes??[],...snapshot.adventure.sceneEffects?.m5?.resolutions??[]]){assign(row.id);assign('attackId'in row?row.attackId:row.pendingId);if('frame'in row&&row.frame){assign(row.frame.id);for(const actor of row.frame.actors)assign(actor.id);if(row.frame.pending?.id)assign(row.frame.pending.id)}}
    for(const e of snapshot.adventure.sceneEffects?.regions??[])if(e.anchor.kind==='inventory'&&e.anchor.id)assign(e.anchor.id)
    for(const c of snapshot.adventure.sceneEffects?.supplies?.containers??[]){assign(c.id);if(c.instanceId)assign(c.instanceId)}
    for(const b of snapshot.adventure.sceneEffects?.supplies?.batches??[]){assign(b.id);assign(b.castId)}
    for(const r of snapshot.adventure.sceneEffects?.supplies?.receipts??[])assign(r.id)
    for(const m of snapshot.adventure.sceneEffects?.materials??[])assign(m.instanceId)
    for(const row of [...snapshot.adventure.sceneEffects?.regions??[],...snapshot.adventure.sceneEffects?.casts??[],...snapshot.adventure.sceneEffects?.events??[],...snapshot.adventure.sceneEffects?.objectAttacks??[],...snapshot.adventure.sceneEffects?.hazards??[],...snapshot.adventure.sceneEffects?.routes??[]]){assign(row.id);if('castId'in row)assign(row.castId)}
    for(const item of [...snapshot.adventure.m3?.entities??[],...snapshot.adventure.m3?.events??[],...snapshot.adventure.m3?.casts??[]])assign(item.id)
    for(const cast of snapshot.adventure.m3?.casts??[])assign(cast.castId)
    if (snapshot.adventure.exploration) {
      assign(snapshot.adventure.exploration.id)
      assign(snapshot.adventure.exploration.roundId)
      snapshot.adventure.exploration.triggers.forEach((t) => assign(t.id))
    }
    for (const record of snapshot.adventure.battles?.history ?? []) {
      assign(record.id)
      record.characters.forEach((c) => assign(c.id))
      for (const actor of record.encounter.actors) {
        if (actor.characterId) mapping.set(actor.id, assign(actor.characterId))
        else assign(actor.id)
      }
    }
    snapshot.adventure.battles?.presets.forEach((p) => assign(p.id))
    snapshot.adventure.battles?.requests.forEach((r) => assign(r.id))
    snapshot.adventure.quests?.forEach((q) => {
      assign(q.id)
      q.steps?.forEach((s) => assign(s.id))
      q.stepSuggestions?.forEach((s) => assign(s.id))
    })
    snapshot.adventure.broadcast?.templates.forEach((t) => assign(t.id))
    snapshot.adventure.trades?.sessions.forEach(t=>assign(t.id))
    snapshot.adventure.ai?.npcs.forEach((n) => {
      assign(n.id)
      n.stock.forEach(row=>{if(row.id)assign(row.id);if(row.inventoryState)assign(row.inventoryState.instanceId)})
      n.secrets.forEach((s) => assign(s.id))
      n.memory.forEach((m) => assign(m.id))
      n.dialogue.forEach((d) => assign(d.id))
    })
    const knowledge=snapshot.adventure.ai
    knowledge?.spatialState?.tasks.forEach(t=>assign(t.id))
    knowledge?.knowledgeDesign?.factions.forEach(f=>{assign(f.id);f.policies?.forEach(p=>assign(p.id))})
    knowledge?.knowledgeDesign?.templates.forEach(t=>assign(t.id))
    if(knowledge?.knowledgeState){const k=knowledge.knowledgeState;assign(k.epoch);k.ancestors.forEach(a=>assign(a.epoch));k.requests.forEach(r=>{assign(r.id);assign(r.eventGroupId);r.sourceIds.forEach(assign)});[...k.outbox,...(k.archiveSegments??[]).flat()].forEach(r=>{assign(r.id);assign(r.sourceId);r.dependencies.forEach(assign)})}
    for (const s of snapshot.adventure.scenes) {
      assign(s.id)
      s.fog?.areas?.forEach(area=>assign(area.id))
      s.spatialSetup?.objects.forEach(o=>assign(o.id))
      for(const row of [...s.effectSetup?.regions??[],...s.effectSetup?.containers??[],...s.effectSetup?.materials??[]])assign(row.id)
      ;[
        ...s.tokens,
        ...(s.defeatedTokens ?? []),
        ...s.regions,
        ...(s.arrivalGroups ?? []),
        ...(s.groundItems ?? []),
        ...(s.pointLinks ?? []),
        ...(s.linkRuns ?? []),
        ...(s.discoveryAttempts ?? []),
        ...(s.pausedRoutes ?? []),
        ...s.points,
        ...(s.annotations ?? []),
        ...(s.walls ?? []),
      ].forEach((x) => assign(x.id))
    }
    for (const e of snapshot.encounters) {
      assign(e.id)
      if (e.pending?.id) assign(e.pending.id)
      for(const parent of e.reactionParents??[]){if(parent.id)assign(parent.id);if(parent.castingId)assign(parent.castingId)}
      for (const zone of e.zones ?? []) assign(zone.id)
      for (const actor of e.actors) {
        if (actor.characterId) mapping.set(actor.id, assign(actor.characterId))
        else assign(actor.id)
      }
    }
  }
  importedAssets.forEach((a) => assign(a.id))
  incoming.adventures[0]!.checkpoints.forEach((c) => assign(c.id))
  for (const r of incoming.adventures[0]!.gmSpellRequests ?? []) {
    assign(r.id); assign(r.castId)
  }
  incoming.adventures[0]!.testBattle?.checkpoints?.forEach((c) => assign(c.id))
  if (incoming.adventures[0]!.testBattle) assign(incoming.adventures[0]!.testBattle!.id)
  const registerSpellInstances=(value:unknown):void=>{
    if(!value||typeof value!=='object')return
    if(Array.isArray(value)){value.forEach(registerSpellInstances);return}
    const row=value as Record<string,unknown>
    if(typeof row.id==='string'&&typeof row.sourceId==='string'&&typeof row.key==='string'&&'concentration'in row){assign(row.id);if(typeof row.castId==='string')assign(row.castId)}
    if(typeof row.id==='string'&&typeof row.actorId==='string'&&Array.isArray(row.targets)&&'startedAt'in row){assign(row.id);if(typeof row.castingId==='string')assign(row.castingId)}
    if(row.concentration&&typeof row.concentration==='object'&&typeof (row.concentration as Record<string,unknown>).castId==='string')assign((row.concentration as {castId:string}).castId)
    if(typeof row.id==='string'&&typeof row.attackId==='string'&&typeof row.spellId==='string')assign(row.id)
    if(typeof row.id==='string'&&typeof row.objectId==='string'&&Array.isArray(row.attackIds))assign(row.id)
    if(typeof row.id==='string'&&typeof row.sourceEntityId==='string'&&typeof row.castId==='string'){assign(row.id);assign(row.castId);if(typeof row.receipt==='string')assign(row.receipt);for(const receipt of row.receipts as {id:string}[]??[])assign(receipt.id)}
    if(typeof row.id==='string'&&typeof row.instanceId==='string'&&typeof row.status==='string')assign(row.id)
    if(typeof row.id==='string'&&typeof row.entityId==='string'&&'bodyViable'in row)assign(row.id)
    Object.values(row).forEach(registerSpellInstances)
  }
  registerSpellInstances(incoming)
  const compositeIds=[...mapping.keys()].sort((a,b)=>b.length-a.length).map(id=>id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
  const compositePattern=new RegExp(compositeIds.join('|'),'g')
  const remap = (value: unknown, field = ''): unknown => {
    if(typeof value==='string'&&['fallUsedAt','round','createdTurn','startedTurn','receipt','turnKey','uses','commandTurn','darknessTurn','turn'].includes(field))return value.replace(compositePattern,id=>mapping.get(id)??id)
    if(typeof value==='string'&&['turnKey','maintenanceKey','lastTurn','fallUsedAt'].includes(field)){
      const split=value.lastIndexOf(':')
      if(split>=0)return (mapping.get(value.slice(0,split))??value.slice(0,split))+value.slice(split)
    }
    if(typeof value==='string'&&field==='space'){const first=value.indexOf(':'),last=value.lastIndexOf(':');if(last>first)return value.slice(0,first+1)+(mapping.get(value.slice(first+1,last))??value.slice(first+1,last))+value.slice(last)}
    if(typeof value==='string'&&field==='resolutionDraft'){const a=value.indexOf(':'),b=value.lastIndexOf(':');if(a>=0&&b>a)return value.slice(0,a+1)+(mapping.get(value.slice(a+1,b))??value.slice(a+1,b))+value.slice(b)}

    if (typeof value === 'string' && field === 'companionKey')
      return value
        .split(':')
        .map((part) => mapping.get(part) ?? part)
        .join(':')
    if (
      typeof value === 'string' &&
      [
        'id','tradeId','stockId','aliases','witnesses','areaId','doorId','doorIds',
        'epoch','factionId','eventGroupId','sourceIds','dependencies','removedIds','templateIds',
        'characterId',
        'tokenId',
        'turnTokenId',
        'roundId',
        'actorId',
        'npcSourceActorId',
        'adventureId',
        'battleId',
        'presetId',
        'battlePresetId',
        'sourceId',
        'sourcePointId',
        'socialTargetId',
        'entityId',
        'inventoryInstanceId','instanceId','containerId','boundWeaponId',
        'boundCharacterId',
        'utilityId',
        'initialised','sourceNpcId','consumableId','containerId','batchId','groundItemId','pileId','liquidId','protectedSourceIds','excludedIds','allowedIds','inside','objectIds','initialMembers','ammunitionIds','materialIds','fixtureRolls','supportIds','plantIds','routeId','observerId','ownerId','portalId','diskId','m3WorldId','spaceAnchorId','sceneEffectCastId','receipt','effectId','anchorId','supportId','initialSupportId','loadIds','castIds','knownTo','casterId','objectId',
        'sourceTokenId','riderTokenId','priorCastIds','summonDraftId','corpseId','riderId','designatedRiderId','maintainIds','corpseIds','frameId','sourceEntityId','controllerId','concentrationCastId','carriedItemIds','generatedItemIds','subjectId','materialId','heldObjectId','inventoryOwnerId','equipmentId','dispelZoneId','zoneId','m5EffectId','attackWindowId','attackId','blockedByAttackId','contactIds','cannotDropIds','attackIds',
        'contextId','wakerTokenId',
        'castingId',
        'controlTargets','sanctuaryFailures','sanctuaryPassed',
          'clockSourceId',
        'afterIds',
        'pinnedStepId',
        'stepId',
        'arrivalGroupId',
        'groupId',
        'perceivedBy',
        'entityIds',
        'craftedBy',
        'encounterId',
        'sceneId',
        'startSceneId',
        'pointId',
        'templateId',
        'targetId',
        'targetIds',
        'castId',
        'pendingId',
        'eventId',
        'targets',
        'tokenIds',
        'characterIds',
        'npcIds',
        'arrivalGroupIds',
        'failureArrivalGroupIds',
        'requestId',
        'sourceEventId',
        'npcId',
        'reportNpcId',
        'npcOwnerId',
        'protectCharacterId',
        'revealIds',
        'revealedIds',
        'factId',
        'conversationId',
        'targetSceneId',
        'targetPointId',
        'activeSceneId',
        'assetId',
        'party',
        'slotSpent',
        'charmSources',
      ].includes(field)
    )
      return mapping.get(value) ?? value
    if (Array.isArray(value)) return value.map((v) => remap(v, field))
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          field === 'revisions' || field === 'clocks'||field==='controlChoices'||field==='consumablesUsed'||field==='samples'||field==='reputations' ? (mapping.get(k) ?? k) : k,
          k==='note'&&(value as Record<string,unknown>).key==='shillelagh'&&typeof v==='string'?(mapping.get(v)??v):remap(v, k),
        ]),
      )
    return value
  }
  const next = remap(incoming) as MapWorld
  for (const a of next.adventures) {
    for(const r of a.gmSpellRequests??[]){delete r.contextKey;if(r.restKey)r.restKey=r.restKey.replace(compositePattern,id=>mapping.get(id)??id)}
    a.name += ' · 导入副本'
    // Model credentials live on Room, never in this archive. Historical jobs cannot be rerun in a copied adventure.
    if (a.aiLog) {
      a.aiLog.buffered = []
      a.aiLog.activations = []
      a.aiLog.turns = []
      a.aiLog.jobs.forEach((j) => {
        if (!['published', 'skipped', 'rejected', 'canceled'].includes(j.status))
          j.status = 'canceled'
        j.attempt = null
      })
      a.aiLog.usage = []
    }
    a.broadcastLog?.events.forEach((e) => {
      e.roomId = null
    })
    a.log.forEach((e) => {
      e.before = null
      e.stamp = ''
    })
  }
  for (const snap of [
    next,
    ...next.adventures.flatMap((a) => a.checkpoints.map((c) => c.snapshot)),
    ...next.adventures.flatMap((a) => (a.testBattle ? [a.testBattle.snapshot] : [])),
    ...next.adventures.flatMap((a) => a.testBattle?.checkpoints?.map((cp) => cp.snapshot) ?? []),
  ]) {
    snap.characters.forEach((c) => c.journal?.forEach((e) => (e.before = null)))
    snap.encounters.forEach((e) => remapComplexReferences(e, mapping))
    for (const a of 'adventures' in snap ? snap.adventures : [snap.adventure])
      for (const h of a.battles?.history ?? []) remapComplexReferences(h.encounter, mapping)
    snap.encounters.forEach((e) =>
      e.log.forEach((event) => {
        event.before = null
        event.revisions = {}
      }),
    )
  }
  const packs = clone(current.packs)
  for (const pack of next.packs) {
    const installed = packs.find((p) => p.id === pack.id)
    if (installed && JSON.stringify(installed) !== JSON.stringify(pack))
      throw new Error('规则包冲突：' + pack.id)
    if (!installed) packs.push(pack)
  }
  const world = {
      adventures: [...clone(current.adventures), ...next.adventures],
      characters: [...clone(current.characters), ...next.characters],
      encounters: [...clone(current.encounters), ...next.encounters],
      packs,
    },
    assets = [...currentAssets, ...importedAssets.map((a) => ({ ...a, id: mapping.get(a.id)! }))]
  validateMapWorld(world, assets)
  return { world, assets, id: next.adventures[0]!.id }
}
