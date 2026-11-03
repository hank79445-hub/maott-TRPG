import { createHash } from 'node:crypto'
import type { Room, RoomMember, RoomCommand, RoomView } from '../online/protocol'
import type { FogView } from '../persistence/fog-schema'
import { fogCommandSchema } from '../persistence/fog-schema'
import { decodeFog, encodeFog, fogLayers, fogObserverId, fogSpace, recordFog } from '../core/fog'
import { adventure, RoomError } from './room-engine'
import { tokenPerception, m3PerceptionCache } from '../core/m3-map-perception'
import { validFogObserver, fogVisualSource } from '../core/fog'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { distance } from '../core/map'
import type { MapToken } from '../core/map-types'
import { visibleDoorSurface, doorSurfaces } from '../core/door-surface'
import { enclosedMode, publishedCells, explorationShading, setAreaRevealed, validateExploration } from '../core/enclosed-exploration'
import { tokenM3State } from '../core/m3-map-perception'
import { anchoredGeometry } from '../core/scene-effects'
import { sceneCenter } from '../core/scene-effect-geometry'
export function fogIds(
  room: Room,
  member: Pick<RoomMember, 'characterIds' | 'actorIds'>,
  sceneId: string,
) {
  const a = adventure(room),
    s = a.scenes.find((s) => s.id === sceneId)
  if (!s || (!member.characterIds.length && !member.actorIds.length)) return []
  return [
    ...new Set(
      s.tokens
        .filter(
          (t) =>
            member.characterIds.includes(t.characterId ?? '') ||
            member.actorIds.includes(t.actorId ?? '') ||
            (s.fog?.shared &&
              !!t.characterId &&
              a.party.includes(t.characterId) &&
              !room.world.characters.find((c) => c.id === t.characterId)?.npcOwnerId),
        )
        .map(fogObserverId),
    ),
  ]
}
export function fogProjection(
  room: Room,
  member: Pick<RoomMember, 'characterIds' | 'actorIds'>,
  sceneId: string,
  preview = false,
  includeShading = true,
): FogView | undefined {
  const a = adventure(room),
    s = a.scenes.find((s) => s.id === sceneId)
  if (!s?.fog?.enabled && !(s&&enclosedMode(s))) return
  const ids = fogIds(room, member, sceneId),
    layers = fogLayers(room.world, a, s, ids),
    visible = encodeFog(layers.visible, s.grid.columns, s.grid.rows),
    explored = encodeFog(layers.explored, s.grid.columns, s.grid.rows),
    shadingViews=enclosedMode(s)&&includeShading?s.tokens.filter(t=>member.characterIds.includes(t.characterId??'')||member.actorIds.includes(t.actorId??'')).map(t=>({observerId:t.id,...explorationShading(room.world,a,s,validFogObserver(room.world,a,t,catalogue([srd,...room.world.packs]))?[t]:[],layers.explored)})):undefined,
    version = createHash('sha256')
      .update(
        JSON.stringify([
          a.broadcastLog?.branchId,
          s.id,
          s.grid,
          s.background,
          visible,
          explored,
          ids,
          shadingViews,
        ]),
      )
      .digest('hex')
      .slice(0, 24)
  return {
    enabled: true,
    ...(enclosedMode(s)?{mode:'enclosed' as const,shading:shadingViews?.[0],shadingViews}:{}),
    sceneId: s.id,
    columns: s.grid.columns,
    rows: s.grid.rows,
    visible,
    explored,
    shared: s.fog?.shared??false,
    version,
    assetId: 'fog-' + s.id + '-' + createHash('sha256').update(JSON.stringify([a.broadcastLog?.branchId,s.id,s.grid,s.background,explored,ids,s.fog?.mode,s.fog?.shared])).digest('hex').slice(0,24),
    ...(preview ? { preview: true } : {}),
  }
}
export function captureFog(room: Room) {
  const a = adventure(room),
    ids = room.members.filter((m) => !m.revoked).flatMap((m) => [...m.characterIds, ...m.actorIds])
  const playerIds=room.members.filter(m=>!m.revoked&&m.role==='player').flatMap(m=>[...m.characterIds,...m.actorIds])
  for (const s of a.scenes) recordFog(room.world, a, s, enclosedMode(s)?playerIds:ids,{entry:false})
}
export function createFogAccess(room: Room, member: Pick<RoomMember,'characterIds'|'actorIds'>, sceneId: string, projection = true) {
  const a = adventure(room), s = a.scenes.find(s => s.id === sceneId)
  if (!s?.fog?.enabled && !(s&&enclosedMode(s))) return
  const ids=fogIds(room,member,sceneId), cat=catalogue([srd,...room.world.packs]), cache=m3PerceptionCache()
  const observers=s.tokens.filter(t=>ids.includes(fogObserverId(t))&&validFogObserver(room.world,a,t,cat))
  const spaces=new Set(observers.map(t=>fogSpace(fogVisualSource(room.world,a,s,t,cat))))
  const concealed=new Set<string>()
  if(!enclosedMode(s))for(const r of a.fogState?.manual??[])if(r.sceneId===s.id&&(r.observerId==='*'||ids.includes(r.observerId))&&spaces.has(r.space))for(const c of decodeFog(r.concealed,r.columns,r.rows))concealed.add(c)
  const fog=projection?fogProjection(room,member,sceneId):undefined
  return {ids,cat,cache,observers,concealed,fog,visible:fog?decodeFog(fog.visible,fog.columns,fog.rows):enclosedMode(s)?publishedCells(a,s,ids):undefined}
}
type FogAccess = ReturnType<typeof createFogAccess>
/** Map publication permission, never an action or knowledge permission. */
export function fogMapAllowed(room:Room,member:Pick<RoomMember,'characterIds'|'actorIds'>,sceneId:string,target:MapToken|{x:number;y:number;hidden?:boolean},context?:FogAccess){
  const a=adventure(room),s=a.scenes.find(s=>s.id===sceneId);if(!s||target.hidden)return false
  if(!enclosedMode(s))return true
  const ids=context?.ids??fogIds(room,member,sceneId),known=context?.visible??publishedCells(a,s,ids)
  if(!known.has(Math.floor(target.x)+','+Math.floor(target.y)))return false
  if('span'in target){
    if(member.characterIds.includes(target.characterId??'')||member.actorIds.includes(target.actorId??''))return true
    const npc=a.ai?.npcs.find(n=>n.id===target.npcId||!!target.characterId&&n.characterId===target.characterId)
    if(npc&&(npc.hidden||!npc.enabled||npc.initiallyAbsent&&!npc.appeared||npc.sceneId!==s.id))return false
    const state=tokenM3State(room.world,a,target,context?.cat??catalogue([srd,...room.world.packs]))
    if(state.invisible||target.spatial&&target.spatial.layer!=='material'){
      const access=context??createFogAccess(room,member,sceneId,false)
      return !!access?.observers.some(from=>tokenPerception(room.world,a,s,from,target,access.cat,undefined,access.cache).canPerceive)
    }
  }
  return true
}
export function fogDoorAccess(room: Room, member: Pick<RoomMember, 'characterIds' | 'actorIds'>, sceneId: string, pointId: string, projected?: FogView, context?: FogAccess) {
  const a = adventure(room), s = a.scenes.find(s => s.id === sceneId), p = s?.points.find(p => p.id === pointId)
  if (!s || !p || !s.fog?.enabled) return
  const fog = projected ?? context?.fog ?? (!context?.visible?fogProjection(room, member, sceneId,false,false):undefined)
  if (!fog&&!context?.visible) return
  const visible = context?.visible ?? decodeFog(fog!.visible, fog!.columns, fog!.rows), ids = context?.ids ?? fogIds(room, member, sceneId), cat = context?.cat ?? catalogue([srd, ...room.world.packs])
  for (const observer of context?.observers ?? s.tokens.filter(t => ids.includes(fogObserverId(t)) && validFogObserver(room.world, a, t, cat))) {
    const from = fogVisualSource(room.world, a, s, observer, cat)
    const found = visibleDoorSurface(room.world, a, s, p, from, cat, cell => visible.has(cell.x + ',' + cell.y)||(cell.x>=from.x&&cell.x<from.x+from.span&&cell.y>=from.y&&cell.y<from.y+from.span), context?.cache)
    if (found && (enclosedMode(s)||s.fog.rangeFeet == null || distance(s, from, found.display) <= s.fog.rangeFeet)) return found.display
  }
}
export function fogEntityAllowed(
  room: Room,
  member: Pick<RoomMember, 'characterIds' | 'actorIds'>,
  sceneId: string,
  target: MapToken,
  context?: FogAccess,
) {
  const a = adventure(room),
    s = a.scenes.find((s) => s.id === sceneId)
  if (!s?.fog?.enabled) return true
  if (
    member.characterIds.includes(target.characterId ?? '') ||
    member.actorIds.includes(target.actorId ?? '')
  )
    return true
  const ctx = context ?? createFogAccess(room,member,sceneId,false)!
  const {cat,cache,observers}=ctx
  if(enclosedMode(s)&&!ctx.visible?.has(Math.floor(target.x)+','+Math.floor(target.y)))return false
  if(ctx.concealed.has(target.x+','+target.y))return false
  return observers.some(
    (from) =>
      (enclosedMode(s)||s.fog?.rangeFeet == null ||
        distance(s, fogVisualSource(room.world, a, s, from, cat), target) <= s.fog.rangeFeet) &&
      tokenPerception(room.world, a, s, from, target, cat, undefined, cache).canPerceive,
  )
}
export function applyFogProjection(room: Room, member: RoomMember, view: RoomView, context?: FogAccess) {
  const a = adventure(room)
  if (member.role === 'gm') {
    const p = a.fogState?.preview
    if (p)
      view.fogPreview = fogProjection(
        room,
        { characterIds: [p.observerId], actorIds: [p.observerId] },
        p.sceneId,
        true,
      )
    return view
  }
  const s = a.scenes.find((s) => s.id === view.scene?.id),
    fog = context?.fog ?? (s && fogProjection(room, member, s.id))
  if (!s || !fog || !view.scene) return view
  const visible = context?.visible ?? decodeFog(fog.visible, fog.columns, fog.rows),
    owns = fogIds(room, member, s.id),
    at = (p: { x: number; y: number }) => visible.has(Math.floor(p.x) + ',' + Math.floor(p.y))
  view.scene.fog = fog
  view.scene.tokens = view.scene.tokens.filter((t) => enclosedMode(s)?fogMapAllowed(room,member,s.id,t,context):fogEntityAllowed(room, member, s.id, t, context))
  const tokens = new Set(view.scene.tokens.map((t) => t.id)),
    npcIds = new Set(view.scene.tokens.map((t) => t.npcId))
  view.ai.npcs = view.ai.npcs.filter(
    (n) =>
      npcIds.has(n.id) ||
      view.scene!.tokens.some((t) => !!n.characterId && t.characterId === n.characterId),
  )
  view.scene.points = view.scene.points.flatMap(p => {
    const from=context?.observers[0]??s.tokens.find(t=>member.characterIds.includes(t.characterId??'')||member.actorIds.includes(t.actorId??''))
    const actual=s.points.find(point=>point.id===p.id)
    const displayPosition = p.kind === 'door' ? fogDoorAccess(room, member, s.id, p.id, fog, context)??(enclosedMode(s)&&at(p)&&from&&actual?doorSurfaces(s,actual,from)[0]?.display:undefined) : undefined
    return displayPosition ? [{ ...p, displayPosition }] : at(p) ? [p] : []
  })
  view.scene.groundItems = view.scene.groundItems?.filter(at)
  view.scene.annotations = view.scene.annotations?.filter(at)
  view.scene.lastKnownTokens = view.scene.lastKnownTokens?.filter((t) =>
    decodeFog(fog.explored, fog.columns, fog.rows).has(t.x + ',' + t.y),
  )
  view.scene.regions = view.scene.regions
    .map((r) => ({ ...r, name: '', cells: r.cells.filter((c) => visible.has(c)) }))
    .filter((r) => r.cells.length)
  view.scene.spatialObjects = view.scene.spatialObjects?.filter(at)
  view.scene.areaCandidates = view.scene.areaCandidates?.filter((r) => tokens.has(r.tokenId))
  view.scene.sightLines = view.scene.sightLines
    ?.filter((r) => tokens.has(r.fromId) && tokens.has(r.toId))
    .map((r) => ({ ...r, sightRay: undefined, targetRay: undefined }))
  const effects = view.scene.sceneEffects
  if (effects) {
    const undisclosedEffects=new Set(enclosedMode(s)?(a.sceneEffects?.regions??[]).filter(e=>{const g=anchoredGeometry(room.world,a,e);return g?.scene.id===s.id&&!at(sceneCenter(g.geometry))}).map(e=>e.id):[])
    effects.regions = effects.regions
      .map((r) => ({
        ...r,
        name:undisclosedEffects.has(r.id)&&!r.anchorOwned?'场景效果':r.name,
        geometry: undefined,
        labelPosition: r.labelPosition && visible.has(Math.floor(r.labelPosition.x) + ',' + Math.floor(r.labelPosition.y)) ? r.labelPosition : undefined,
        sourceId: undefined,
        strokes: undefined,
        strokesByObserver: undefined,
        cellsByObserver: undefined,
        cells: r.cells.filter((c) => visible.has(c)),
      }))
      .filter((r) => r.cells.length > 0)
    effects.lighting = effects.lighting.map((l) => ({
      ...l,
      runs: l.runs.flatMap((run) => {
        const cells = []
        for (let x = run.x; x < run.x + run.length; x++)
          if (visible.has(x + ',' + run.y)) cells.push({ ...run, x, length: 1 })
        return cells
      }),
    }))
    if(enclosedMode(s))effects.lighting=[]
    // Preserve private, explicitly known tracking/capabilities; omit unobserved public supplies.
    if (effects.supplies) {
      const knownContainers = new Set(
        (a.sceneEffects?.supplies?.containers ?? [])
          .filter(
            (c) =>
              member.characterIds.includes(c.ownerId ?? '') ||
              view.scene!.groundItems?.some((g) => g.id === c.groundItemId) ||
              view.scene!.spatialObjects?.some((o) => o.id === c.objectId),
          )
          .map((c) => c.id),
      )
      effects.supplies.containers = effects.supplies.containers.filter((c) =>
        knownContainers.has(c.id),
      )
      effects.supplies.batches = effects.supplies.batches.filter((b) =>
        b.containerId ? knownContainers.has(b.containerId) : !!b.point && at(b.point),
      )
    }
  }
  view.summons = view.summons?.filter(
    (v) => v.controlled || s.tokens.some((t) => t.id === v.id && tokens.has(t.id)),
  )
  view.summonCorpses = view.summonCorpses?.filter((v) => at(v))
  view.scene.walls = view.scene.walls?.flatMap((w) => {
    const pieces = []
    const count = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(w.a.x - w.b.x), Math.abs(w.a.y - w.b.y)) * 2),
    )
    for (let i = 0; i < count; i++) {
      const p = {
        x: w.a.x + ((w.b.x - w.a.x) * (i + 0.5)) / count,
        y: w.a.y + ((w.b.y - w.a.y) * (i + 0.5)) / count,
      }
      const hiddenDoor = s.points.some((p) => p.id === w.pointId && p.hidden)
      const knownDoor=w.kind==='door'&&!hiddenDoor&&view.scene!.points.some(p=>p.id===w.pointId)
      if (!at(p)&&!(enclosedMode(s)&&knownDoor)) continue
      pieces.push({
        ...w,
        id: w.id + ':' + i,
        name: '',
        pointId: knownDoor?w.pointId:null,
        kind: hiddenDoor ? ('wall' as const) : w.kind,
        a: { x: w.a.x + ((w.b.x - w.a.x) * i) / count, y: w.a.y + ((w.b.y - w.a.y) * i) / count },
        b: {
          x: w.a.x + ((w.b.x - w.a.x) * (i + 1)) / count,
          y: w.a.y + ((w.b.y - w.a.y) * (i + 1)) / count,
        },
      })
    }
    return pieces
  })
  if (view.encounter) {
    view.encounter.actors = view.encounter.actors.filter((actor) =>
      view.scene!.tokens.some(
        (t) =>
          t.actorId === actor.id || (!!actor.characterId && t.characterId === actor.characterId),
      ),
    )
    if (!view.encounter.actors.some((t) => t.id === view.encounter!.currentId))
      view.encounter.currentId = ''
  }
  view.assets = []
  if (s.background) {
    const width = s.grid.columns * Math.max(64, s.grid.cellPixels ?? 64),
      height = s.grid.rows * Math.max(64, s.grid.cellPixels ?? 64)
    view.scene.background = {
      assetId: fog.assetId,
      x: s.grid.originX,
      y: s.grid.originY,
      width: width / 64,
      height: height / 64,
      rotation: 0,
      locked: true,
      clip: true,
    }
    view.assets.push({
      id: fog.assetId,
      name: '授权探索地图',
      mime: 'image/png',
      width: Math.max(1, Math.round(width * Math.min(1, 2048 / Math.max(width, height)))),
      height: Math.max(1, Math.round(height * Math.min(1, 2048 / Math.max(width, height)))),
    })
  }
  return view
}
export function executeFog(room: Room, member: RoomMember, c: RoomCommand) {
  if (c.kind !== 'fog') return false
  if (member.role !== 'gm' || member.revoked) throw new RoomError('迷雾配置需要GM', 403)
  const op = fogCommandSchema.parse(c).command,
    a = adventure(room),
    s = a.scenes.find((s) => s.id === op.sceneId)
  if (!s) throw new RoomError('场景不存在')
  const state = (a.fogState ??= { records: [], manual: [] })
  if (op.operation === 'configure') {
    const migrating=!enclosedMode(s)&&op.policy.mode==='enclosed'
    if(op.policy.mode==='enclosed'&&!enclosedMode(s)&&!op.confirmMigration)throw new RoomError('切换会公开未划为封闭区域的地形及普通标记，请预览并确认迁移')
    for (const cell of op.policy.initial) {
      const [x, y] = cell.split(',').map(Number)
      if (x! >= s.grid.columns || y! >= s.grid.rows) throw new RoomError('初始揭示格超出场景')
    }
    validateExploration({...s,fog:op.policy})
    s.fog = op.policy
    if(migrating)recordFog(room.world,a,s)
  } else if(op.operation==='area'){
    if(!enclosedMode(s))throw new RoomError('当前不是封闭区域探索模式')
    if(op.observerId!=='*'&&!s.tokens.some(t=>fogObserverId(t)===op.observerId))throw new RoomError('观察者不在当前场景')
    setAreaRevealed(a,s,op.areaId,op.observerId,op.revealed,'manual')
  } else if (op.operation === 'preview') {
    if (op.observerId) {
      if (!s.tokens.some((t) => fogObserverId(t) === op.observerId))
        throw new RoomError('观察角色不在该场景')
      state.preview = { sceneId: s.id, observerId: op.observerId }
    } else delete state.preview
  } else {
    if(enclosedMode(s)&&op.operation!=='reset')throw new RoomError('封闭探索模式请按区域揭示或重新遮蔽，不能提交旧逐格操作')
    const token = s.tokens.find((t) => fogObserverId(t) === op.observerId)
    if (op.observerId !== '*' && !token) throw new RoomError('观察角色不存在')
    const space = fogSpace(token)
    for (const cell of op.cells) {
      const [x, y] = cell.split(',').map(Number)
      if (x! >= s.grid.columns || y! >= s.grid.rows) throw new RoomError('网格超出场景')
    }
    if (op.operation === 'reset') {
      state.areaRecords=state.areaRecords?.filter(r=>r.sceneId!==s.id||(op.observerId!=='*'&&r.observerId!==op.observerId))
      state.records = state.records.filter(
        (r) => r.sceneId !== s.id || (op.observerId !== '*' && r.observerId !== op.observerId),
      )
      state.manual = state.manual.filter(
        (r) => r.sceneId !== s.id || (op.observerId !== '*' && r.observerId !== op.observerId),
      )
    } else {
      let row = state.manual.find(
        (r) => r.sceneId === s.id && r.observerId === op.observerId && r.space === space,
      )
      if (!row) {
        if (state.manual.length >= 1000) throw new RoomError('手动迷雾记录达到上限')
        row = {
          sceneId: s.id,
          observerId: op.observerId,
          space,
          columns: s.grid.columns,
          rows: s.grid.rows,
          revealed: '',
          concealed: '',
        }
        state.manual.push(row)
      }
      const reveal = decodeFog(row.revealed, row.columns, row.rows),
        hide = decodeFog(row.concealed, row.columns, row.rows)
      for (const cell of op.cells) {
        if (op.operation === 'reveal') {
          reveal.add(cell)
          hide.delete(cell)
        } else {
          hide.add(cell)
          reveal.delete(cell)
        }
      }
      row.revealed = encodeFog(reveal, s.grid.columns, s.grid.rows)
      row.concealed = encodeFog(hide, s.grid.columns, s.grid.rows)
      row.columns = s.grid.columns
      row.rows = s.grid.rows
    }
  }
  room.worldRevision++
  return true
}
