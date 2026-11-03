import {itemSpellBusy} from '../core/item-spells'
import {executeOpeningReading,openingReadingView} from './opening-reading'
import { executeContainer, pointContainerView } from './point-container'
import { projectCorpses, lootCorpse } from './room-corpses'
import { expiredReviews, archiveExpiredReviews } from './review-archive'
import { withEvaluation } from '../core/evaluation'
import {executeSummonCommand,executeSummonAction,authorizeSummonAction,projectSummons,assertSummonControl,summonChoices,summonObservers,summonTouchChoices,summonCorpses} from './room-summons'
import { npcSpatialObservation } from './npc-spatial-observation'
import { applyFogProjection, fogIds, fogEntityAllowed, fogMapAllowed, fogProjection, fogDoorAccess, createFogAccess } from './fog'
import { enclosedMode } from '../core/enclosed-exploration'
import { decodeFog } from '../core/fog'
import { projectTrades } from './trade-engine'
import {authorizeGChoice} from './gm-spell-permissions'
import {transferHutInventory} from '../core/scene-magic-inventory'
import {sceneRayView} from '../core/scene-ray-view'
import {tokenPoint,M4_LIGHT_SPELLS} from '../core/scene-effects'
import {tokenM3State} from '../core/m3-map-perception'
import {projectSceneEffects,scenePointVisible} from '../core/scene-effect-view'
import {executeSceneEffects,executeSceneEffectAction} from './room-scene-effects'
import {executeM3,executeM3Action} from './room-m3'
import { m3PerceptionCache,publicCameraToken,tokenPerception } from '../core/m3-map-perception'
import { changeStoryItem } from './story-items'
import { visibleQuests, validateQuests } from '../core/quests'
import { assertGmActionControl, changeGmControl } from './gm-control'
import { executeGmSpellCommand, projectGmSpells } from './room-spells'
import {executeM1Utility,authorizeM1,practicalM1Choices} from './room-m1'
import {assertSupplyInventoryChange} from '../core/scene-supplies'
import {M1_UTILITY_SPELLS,assertM1InventoryChange} from '../core/m1-utility'
import {tokenStatuses} from './token-status'
import { reviewQuestStep } from '../core/quest-steps'
import { QUEST_LIMIT } from '../persistence/quest-schema'
import { reviewManagement, projectReview } from './gm-review'
import { projectPractical,practicalTakeover } from './practical-review-state'
import { executePracticalResponse,practicalCombatView,executePracticalFrameAction } from './practical-combat'
import {executePracticalEffectInput,practicalEffectInputView} from './practical-effect-inputs'
import { queuePracticalIntent,recheckPracticalIntent } from './practical-intents'
import {executePracticalSpellInput,practicalSpellInputView,assertPracticalCastingFocus,applyPracticalConsent} from './practical-spell-inputs'
import {executePracticalInitiative,practicalInitiativeView,executePracticalStagingRoll} from './practical-initiative'
import { liveWorld } from './live-world'
import { qqRequestLive } from './qq-room'
import { broadcastFeed } from './room-broadcast'
import {projectMapFeedback} from './map-feedback'
import {
  explorationRuntime,
  explorationMember,
  assertExplorationReady,
  explorationSpend,
} from '../core/exploration'
import { reconcileWorld } from '../core/combat-lifecycle'
import {steedRecoveredHP} from '../core/summon-steed'
import { applyWorldRuntime } from '../core/world-runtime'
import { sameDefenseWindow, isHitReaction } from '../online/reaction-window'
import { randomUUID, createHash } from 'node:crypto'
import { catalogue, clone } from '../core/engine'
import { srd } from '../content/srd'
import { applyMap, distance } from '../core/map'
import { wallState, sightLine, coverBetween } from '../core/map-spatial'
import { areaTargets } from '../core/map-area'
import {
  applyRuntime,
  runtimeState,
  runtimeSpells,
  resources,
  validateInventory,
  validateRuntimeArchive,
} from '../core/runtime'
import { attackOptions, combatStats, defenseOptions } from '../core/combat-rules'
import type { Room, RoomAction, RoomCommand, RoomMember, RoomView } from '../online/protocol'
import { executeCharacterRequest, projectCharacterRequests } from './room-character-requests'
import type { MapAsset, MapWorld, MapCombatOptions } from '../core/map-types'
import { runtimeNeedsReview } from '../online/permissions'
import { applyOriginParty, hasOrigin } from '../core/origins'
import { assetReferences } from '../persistence/map-archive'
import { importRoomCharacters } from './room-characters'
import { authorizeNpcAction, executeNpcAction, executeAiCommand, projectAi } from './room-ai'
import { isNpcCharacter } from '../core/npc-map'
import { actorPortrait, safePortrait, tokenPortrait } from '../core/portraits'
import { projectDice } from './room-dice'
import { rollDie } from '../core/runtime'
import { manualDiceActive } from '../core/dice-source'
import { shortRoomCode } from './room-invitations'

export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const adventure = (room: Room) => room.world.adventures[0]!
export const activeScene = (room: Room) =>
  adventure(room).scenes.find((s) => s.id === adventure(room).activeSceneId)
const catOf = (room: Room) => catalogue([srd, ...room.world.packs])
function requireGM(member: RoomMember) {
  if (member.role !== 'gm') throw new RoomError('此操作需要 GM 身份', 403)
}
function control(member: RoomMember, characterId: string | null, actorId = '') {
  if (member.role === 'gm') return
  if (!(
    (characterId && member.characterIds.includes(characterId)) ||
    member.actorIds.includes(actorId)
  ))
    throw new RoomError('未获该角色的操控权', 403)
}
function visibleActor(room: Room, actorId: string) {
  const scene = activeScene(room),
    e = room.world.encounters.find((e) => e.id === scene?.encounterId)
  const actor = e?.actors.find((a) => a.id === actorId)
  if (
    !actor ||
    !scene?.tokens.some(
      (t) =>
        !t.hidden &&
        (t.actorId === actorId || (actor.characterId && t.characterId === actor.characterId)),
    )
  )
    throw new RoomError('目标不在公开场景中', 403)
  return actor
}
function result(room: Room, member: RoomMember, characterId: string, detail: string) {
  room.events.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    sessionId: member.id,
    characterId,
    detail,
  })
}
export function forgetUndo(world: MapWorld) {
  for (const c of world.characters) for (const event of c.journal ?? []) event.before = null
  for (const e of world.encounters) for (const event of e.log) event.before = null
  for (const a of world.adventures) for (const event of a.log) event.before = null
}
/** Authorization happens against the complete server world, before rule evaluation. */
export function authorizeAction(room: Room, member: RoomMember, action: RoomAction) {
  if (member.revoked) throw new RoomError('操控权限已撤销', 403)
  assertGmActionControl(room, member, action)
  assertPracticalCastingFocus(room,member,action)
  if (action.kind === 'container') {
    pointContainerView(room, member, action.sceneId, action.pointId, action.characterId)
    return
  }
  if(action.kind==='m1'){authorizeM1(room,member,action.action);return}
  if (action.kind === 'npc') {
    authorizeNpcAction(room, member, action)
    return
  }
  if (member.role === 'gm') return
  if(action.kind==='summon'){authorizeSummonAction(room,member,action.action);return}
  if(action.kind==='scene-effect'){
    if(action.action.operation==='m5-close')throw new RoomError('关闭法术后续仅限GM',403)
    const op=action.action
    if(['m5-equipment-drop','m5-search','m5-response','m5-move','m5-equipment','m5-metal','m5-resolve','supply-container','supply-seed','material','disperse','legacy-geometry','fixture-light','object-durability','hazard','hazard-order','burn-web','clear-growth','environment-round','magic-push','magic-decision','magic-trigger','mental-alarm','mundane-locks','magic-cross','adopt-zone','wind-flames','weather'].includes(op.operation)||op.operation==='cover'&&!op.actorId)throw new RoomError('该环境事实／材料登记仅限GM',403)
    const id='casterId'in op?op.casterId:'actorId'in op?op.actorId:''
    const scene=activeScene(room),a=adventure(room),token=scene?.tokens.find(t=>[t.characterId,t.npcId,t.actorId,t.id].includes(id??''))
    if(!token||token.hidden)throw new RoomError('操作人物不在当前公开场景',403)
    control(member,token.characterId,token.actorId??'')
    if('effectId'in op&&op.operation!=='m5-mark'){const effect=a.sceneEffects?.regions.find(e=>e.id===op.effectId&&e.status==='active'&&(!e.hidden||member.characterIds.includes(e.sourceId)||e.anchor.kind==='inventory'&&member.characterIds.includes(e.anchor.ownerId??''))&&e.sceneId===scene?.id);if(!effect||effect.spellId==='spike-growth'&&!effect.terrain?.knownTo.includes(id!))throw new RoomError('只能操作当前已公开的有效场景效果',403)}
        if((op.operation==='cast'&&op.m5)||op.operation==='m5-use'||op.operation==='m5-mark'){const ids=op.operation==='cast'?op.m5!.targetIds:op.operation==='m5-mark'?[op.targetId]:op.targetIds;for(const targetId of ids){const target=scene?.tokens.find(t=>[t.characterId,t.npcId,t.actorId,t.id].includes(targetId));if(!target||target.hidden||!tokenPerception(room.world,a,scene!,token,target,catOf(room)).canPerceive)throw new RoomError('只能指定当前已知且可感知的NPC／人物',403)}}
        if(op.operation==='cast'&&op.terrain){for(const ref of [...op.terrain.plantIds,...op.terrain.supportIds])if(!a.m3?.entities.some(o=>o.id===ref&&o.enabled&&!o.hidden&&o.sceneId===scene?.id))throw new RoomError('只能引用当前已公开的环境事实',403)}
  const containers=a.sceneEffects?.supplies?.containers??[]
  if(op.operation==='supply-transfer'||op.operation==='supply-consume'){const b=a.sceneEffects?.supplies?.batches.find(b=>b.id===op.batchId),c=containers.find(c=>c.id===b?.containerId);if(!b||b.hidden||a.m3?.entities.some(o=>o.id===(b.liquidId??b.pileId)&&o.hidden)||c?.hidden||c?.instanceId&&!c.groundItemId&&!room.world.characters.some(ch=>member.characterIds.includes(ch.id)&&(!c.ownerId||c.ownerId===ch.id)&&ch.inventory.some(row=>row.instanceId===c.instanceId)))throw new RoomError('不能引用隐藏或其他人物的私人补给',403)}
  const refs=op.operation==='cast'&&op.supply?[op.supply.containerId,op.supply.foodContainerId]:op.operation==='supply-transfer'?[op.containerId,a.sceneEffects?.supplies?.batches.find(b=>b.id===op.batchId)?.containerId]:op.operation==='supply-consume'?[a.sceneEffects?.supplies?.batches.find(b=>b.id===op.batchId)?.containerId]:[]
  for(const ref of refs.filter(Boolean)){const c=containers.find(c=>c.id===ref);if(!c||c.hidden||c.groundItemId&&!scene?.groundItems?.some(g=>g.id===c.groundItemId&&!g.hidden&&g.enabled)||c.objectId&&!a.m3?.entities.some(o=>o.id===c.objectId&&!o.hidden&&o.enabled)||c.instanceId&&!c.groundItemId&&!room.world.characters.some(ch=>member.characterIds.includes(ch.id)&&(!c.ownerId||c.ownerId===ch.id)&&ch.inventory.some(r=>r.instanceId===c.instanceId)))throw new RoomError('只能引用已公开物件或本人实际容器',403)}
  if(op.operation==='cast'&&op.magic?.pointId&&!scene?.points.some(p=>p.id===op.magic!.pointId&&p.enabled&&!p.hidden))throw new RoomError('只能指定当前已公开的真实互动点',403)
  if(op.operation==='cast'&&op.objectId&&!a.m3?.entities.some(o=>o.id===op.objectId&&o.enabled&&!o.hidden&&o.sceneId===scene?.id))throw new RoomError('只能指定当前已公开物件',403)
    if(op.operation==='throw-flame'){const to=scene?.tokens.find(t=>[t.characterId,t.npcId,t.actorId,t.id].includes(op.targetId));const object=a.m3?.entities.find(o=>o.id===op.targetId&&o.enabled&&!o.hidden&&o.sceneId===scene?.id);if(to?(to.hidden||!tokenPerception(room.world,a,scene!,token,to,catOf(room)).canPerceive):!object||!scenePointVisible(room.world,a,scene!,[token],object,catOf(room)))throw new RoomError('只能指定已知且可感知目标',403)}
    return
  }
  if(action.kind==='spatial'){
    const op=action.action
    if(!['cast','move','effect-action','portal'].includes(op.operation))throw new RoomError('该空间环境／后果裁定只允许GM',403)
    const id='casterId'in op?op.casterId:'entityId'in op?op.entityId:''
    const t=activeScene(room)?.tokens.find(t=>[t.characterId,t.npcId,t.actorId,t.id].includes(id))
    if(!t||t.hidden)throw new RoomError('操作人物不在当前公开场景',403)
    control(member,t.characterId,t.actorId??'')
    if(op.operation==='portal'||op.operation==='move'&&op.supportId){
      const id=op.operation==='portal'?op.portalId:op.supportId,a=adventure(room),scene=activeScene(room)!
      if(!a.m3?.entities.some(e=>e.id===id&&e.sceneId===scene.id&&e.enabled&&(!e.hidden||e.kind==='portal'&&(e.sourceId===t.characterId||e.targetIds?.includes(t.characterId??'')||e.knownTo?.includes(t.characterId??'')))&&sightLine(scene,t,e).clear))throw new RoomError('只能操作已知的实际支撑／入口',403)
    }
    if(op.operation==='cast'){
      const scene=activeScene(room)!,a=adventure(room),cat=catOf(room)
      for(const id of op.targets){const target=scene.tokens.find(q=>[q.characterId,q.npcId,q.actorId,q.id].includes(id));if(!target||target.hidden||target.id!==t.id&&!tokenPerception(room.world,a,scene,t,target,cat).canPerceive)throw new RoomError('只能指定当前已知且可感知的实际目标',403)}
      if(op.objectId&&!a.m3?.entities.some(e=>e.id===op.objectId&&e.sceneId===scene.id&&e.enabled&&!e.hidden&&sightLine(scene,t,e).clear))throw new RoomError('只能指定当前公开可见的实际物件',403)
    }
    return
  }
  if (action.kind === 'runtime') {
    control(member, action.characterId)
    if (action.command.type === 'special-weapon' || action.command.type === 'mounted')
      throw new RoomError('武器配置与骑乘状态只能由 GM 设置', 403)
    if (action.command.type === 'origin')
      for (const id of action.command.targets) {
        if (id === action.characterId) continue
        const s = activeScene(room)
        if (!s?.tokens.some((t) => t.characterId === id && !t.hidden))
          throw new RoomError('只能选择当前公开场景中的角色', 403)
      }
    return
  }
  if (action.kind === 'give') {
    control(member, action.fromId)
    return
  }
  const c = action.command,
    scene = activeScene(room)
  if (!('sceneId' in c) || c.sceneId !== scene?.id) throw new RoomError('只能操作当前公开场景', 403)
  if(member.role==='player'&&scene.fog?.enabled){
    const fog=fogProjection(room,member,scene.id)!,known=decodeFog(fog.explored,fog.columns,fog.rows)
    if(c.type==='move'&&!enclosedMode(scene)&&c.path.some(p=>!known.has(p.x+','+p.y)))throw new RoomError('请在已探索范围内分步前进',403)
    const refs=new Set<string>();const read=(value:unknown,key='')=>{if(typeof value==='string'&&['targetId','targetIds','targets','pointId','npcId'].includes(key))refs.add(value);else if(Array.isArray(value))value.forEach(v=>read(v,key));else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>read(v,k))};read(c)
    const currentlyVisible = decodeFog(fog.visible, fog.columns, fog.rows)
    for (const id of refs) {
      const target = scene.tokens.find(t => [t.id,t.actorId,t.characterId,t.npcId].includes(id))
      if (target && !fogEntityAllowed(room,member,scene.id,target)) throw new RoomError('目标当前不可感知',403)
      const point = scene.points.find(p => p.id === id)
      if (!point) continue
      const allowed = point.kind === 'door'
        ? !point.hidden && point.enabled && (!!fogDoorAccess(room,member,scene.id,point.id,fog) || currentlyVisible.has(point.x+','+point.y))
        : known.has(point.x+','+point.y)
      if (!allowed) throw new RoomError('互动目标尚未获知',403)
    }
  }
  if(c.type==='explore'||c.type==='combat'){const b=c.command;if('gmChoice'in b)authorizeGChoice(room,member,b.gmChoice)}
  if(c.type==='move')assertSummonControl(room,member,c.tokenId)
  if(c.type==='combat'&&'actorId'in c.command)assertSummonControl(room,member,c.command.actorId)
  if(c.type==='combat'&&c.command.type==='feature'&&c.command.id==='phb/companion-command')assertSummonControl(room,member,c.command.targetId)
  if(c.type==='explore'&&'tokenId'in c.command)assertSummonControl(room,member,c.command.tokenId)
  if (c.type === 'explore') {
    const b = c.command
    if (['toggle', 'roster', 'finish', 'trigger'].includes(b.operation)) {
      if (b.operation !== 'toggle') throw new RoomError('队伍探索控制需要 GM 审核', 403)
    } else if (b.operation === 'control-ruling')throw new RoomError('持续控制的条件核对与后续裁定仅限GM',403)
    else if (b.operation === 'zone-roll' || b.operation === 'zone-resolve')
      throw new RoomError('持续区域裁定需要 GM', 403)
    else if ('tokenId' in b) {
      const t = scene.tokens.find((t) => t.id === b.tokenId && !t.hidden)
      if (!t) throw new RoomError('棋子不可操作', 403)
      control(member, t.characterId, t.actorId ?? '')
      if (
        b.operation === 'spell-cast' &&
        [...b.targets,...(b.controlTargets??[])].some((id) => !scene.tokens.some((t) => t.id === id && !t.hidden))
      )
        throw new RoomError('只能选择公开目标', 403)
      if (
        b.operation === 'jump-cast' &&
        b.targets.some((id) => !scene.tokens.some((t) => t.characterId === id && !t.hidden))
      )
        throw new RoomError('只能选择当前公开角色', 403)
    }
  } else if (c.type === 'battle-request') {
    if (!c.characterId) throw new RoomError('战斗请求需要受控角色', 403)
    control(member, c.characterId)
    if (c.source !== 'player' || c.presetId) throw new RoomError('指定预设与触发来源需要 GM', 403)
    if (
      isNpcCharacter(room.world, c.characterId) ||
      !scene.tokens.some((t) => t.characterId === c.characterId && !t.hidden)
    )
      throw new RoomError('角色不在当前公开场景', 403)
  } else if (c.type === 'move') {
    if (member.role === 'ai' && member.internalNpcId) {
      const npc = adventure(room).ai?.npcs.find(
        (n) => n.id === member.internalNpcId && n.enabled && n.sceneId === scene.id,
      )
      const ownToken = scene.tokens.find((t) => t.id === c.tokenId && t.npcId === npc?.id)
      if (!npc || !ownToken || npcAbsent(npc))
        throw new RoomError('NPC只能移动自己在当前场景的棋子', 403)
      return
    }
    const t = scene.tokens.find((t) => t.id === c.tokenId && !t.hidden)
    if (!t) throw new RoomError('标记不可操作', 403)
    const e = room.world.encounters.find((e) => e.id === scene.encounterId),
      actor = e?.actors.find((a) => a.id === t.actorId),
      owner = ['spell-summon', 'primal-companion'].includes(actor?.companion?.source ?? '')
        ? e?.actors.find((a) => a.id === actor?.companion?.ownerId)
        : undefined
    control(member, owner?.characterId ?? t.characterId, t.actorId ?? '')
  } else if (c.type === 'grapple-release') {
    control(member, c.characterId)
  } else if (c.type === 'ground-drop') {
    control(member, c.characterId)
    if (!scene.tokens.some((t) => t.characterId === c.characterId && !t.hidden))
      throw new RoomError('角色不在当前公开场景', 403)
  } else if (c.type === 'ground-pickup') {
    control(member, c.characterId)
    if (!scene.groundItems?.some((g) => g.id === c.itemId && !g.hidden && g.enabled))
      throw new RoomError('物品不可操作', 403)
    if (!scene.tokens.some((t) => t.characterId === c.characterId && !t.hidden))
      throw new RoomError('角色不可操作', 403)
  } else if (c.type === 'discovery-continue' || c.type === 'discovery-cancel-route') {
    const r = scene.pausedRoutes?.find(
      (r) => r.id === c.routeId && r.branchId === adventure(room).broadcastLog?.branchId,
    )
    if (!r) throw new RoomError('暂停路线不存在', 403)
    control(member, r.characterId)
  } else if (c.type === 'interact') {
    if(c.npcId || c.bypassItems) throw new RoomError('NPC互动与物品覆盖仅限GM',403)
    control(member, c.characterId)
    if (!scene.points.some((p) => p.id === c.pointId && !p.hidden && p.enabled))
      throw new RoomError('互动点不可操作', 403)
    if (!scene.tokens.some((t) => !t.hidden && t.characterId === c.characterId))
      throw new RoomError('角色不在公开场景中', 403)
  } else if (c.type === 'combat') {
    const b = c.command
    if (b.type === 'npc-ability' && member.role === 'ai' && member.internalNpcId) {
      const npc = adventure(room).ai?.npcs.find(
        (n) => n.id === member.internalNpcId && n.actorId === b.actorId,
      )
      const e = room.world.encounters.find((e) => e.id === scene.encounterId),
        actor = e?.actors.find((a) => a.id === b.actorId)
      const ability = actor?.npc?.abilities?.find((a) => a.id === b.abilityId)
      if (
        !npc ||
        !actor?.npc ||
        !ability ||
        ability.support !== 'automatic' ||
        ability.cost === 'reaction' ||
        !npc.abilities.some((a) => a.enabled && a.key === 'monster:' + ability.id)
      )
        throw new RoomError('NPC内部能力身份、来源或配置不可用', 403)
      control(member, actor.characterId, actor.id)
      for (const id of b.targetIds) if (id !== actor.id) visibleActor(room, id)
      return
    }
    if (c.openingRequestId) {
      const r = adventure(room).battles?.requests.find((r) => r.id === c.openingRequestId)
      if (!r || r.source !== 'player' || r.sourceId !== member.id)
        throw new RoomError('只能执行自己提交并获确认的主动行动', 403)
    }
    if (
      !('actorId' in b) ||
      ![
        'attack',
        'unarmed',
        'grapple-release',
        'grapple-escape',
        'end-turn',
        'item-use',
        'damage-roll',
        'hit-spell',
        'transfer-mark','escape-vines',
        'cast',
        'action',
        'inventory',
        'death-save',
        'concentration',
        'end-concentration',
        'reaction-shield',
        'reaction-counterspell',
        'sanctuary-retarget',
        'reaction-defense',
        'spell-reroll',
        'trigger-feature',
        'wild-shape',
        'wild-companion',
        'dismiss-companion',
        'maintain-spell',
        'zone-move',
        'companion-power',
        'inspiration',
        'feature',
        'convert',
        'end-effect',
      ].includes(b.type)
    )
      throw new RoomError('该战斗操作需要 GM 执行', 403)
    const actor = visibleActor(room, b.actorId)
    const owner =
      actor.companion && ['spell-summon', 'primal-companion'].includes(actor.companion.source)
        ? room.world.encounters
            .find((e) => e.id === scene.encounterId)
            ?.actors.find((a) => a.id === actor.companion!.ownerId)
        : undefined
    control(member, owner?.characterId ?? actor.characterId, actor.id)
    const targets = [
      ...new Set([
        ...('targets' in b ? (b.targets ?? []) : []),
        ...('excludedIds' in b ? (b.excludedIds ?? []) : []),
        ...('targetId' in b && b.targetId ? [b.targetId] : []),
        ...('triggerActorId' in b && b.triggerActorId ? [b.triggerActorId] : []),
      ]),
    ]
    targets.forEach((target) => visibleActor(room, target))
    if(b.type==='cast'&&b.controlTargets?.some(id=>!scene.tokens.some(t=>!t.hidden&&[t.id,t.actorId,t.characterId,t.npcId].includes(id))))throw new RoomError('只能选择当前公开的关系对象',403)
  } else throw new RoomError('场景管理需要 GM 身份', 403)
}
export function executeAction(
  room: Room,
  member: RoomMember,
  action: RoomAction,
  approved = false,
  targetEnvironments?: Record<string, import('../core/combat-types').Environment>,
  approvedMapOptions?: MapCombatOptions,
  npcExecution?: {
    environment?: import('../core/combat-types').Environment
    reactionsConfirmed?: boolean
  },
) {
  authorizeAction(room, member, action)
  if (action.kind === 'container') {
    executeContainer(room, member, action, approved)
    forgetUndo(room.world)
    return
  }
  if (action.kind === 'npc') {
    executeNpcAction(room, member, action, approved)
    return
  }
  const cat = catOf(room)
  if(action.kind==='m1'){if(member.role!=='gm'&&!approved)throw new RoomError('专用法术须先提交实际目标申请');const gm=room.members.find(m=>m.role==='gm'&&!m.revoked);if(!gm)throw Error('缺少GM');executeM1Utility(room,gm,{kind:'m1-utility',action:action.action});return}
  if(action.kind==='scene-effect'){if(member.role!=='gm'&&!approved)throw new RoomError('场景效果请先提交GM审核');executeSceneEffectAction(room,action.action);return}
  if(action.kind==='summon'){if(member.role!=='gm'&&!approved)throw new RoomError('召唤与指挥请先提交GM审核');executeSummonAction(room,action.action);return}
  if(action.kind==='spatial'){if(member.role!=='gm'&&!approved)throw new RoomError('此空间操作请先提交GM审核');executeM3Action(room,action.action);return}
  if (action.kind === 'map') {
    if (action.command.type === 'battle-request-review' && action.command.approve) {
      const requestId = action.command.requestId,
        request = adventure(room).battles?.requests.find((r) => r.id === requestId)
      if (
        request?.source === 'player' &&
        !room.members.some(
          (m) =>
            m.id === request.sourceId &&
            !m.revoked &&
            m.characterIds.includes(request.characterId ?? ''),
        )
      )
        throw new RoomError('请求者的角色权限已撤销', 403)
    }
    const c = clone(action.command)
    if (
      c.type === 'interact' &&
      member.role !== 'gm' &&
      !approved &&
      activeScene(room)?.points.find((p) => p.id === c.pointId)?.assistedReview?.enabled
    )
      throw new RoomError('此互动已启用审核，请先提交意图')
    if (
      c.type === 'ground-pickup' &&
      member.role !== 'gm' &&
      !approved &&
      activeScene(room)?.groundItems?.find((g) => g.id === c.itemId)?.requiresGM
    )
      throw new RoomError('此物品拾取需要先提交GM审核')
    if (
      c.type === 'explore' &&
      (c.command.operation === 'end' || c.command.operation === 'finish')
    ) {
      const tokenId = c.command.operation === 'end' ? c.command.tokenId : null,
        characterId = activeScene(room)?.tokens.find((t) => t.id === tokenId)?.characterId
      const waiting = room.intents.some(
        (i) =>
          i.status === 'pending' &&
          (!approved || JSON.stringify(i.action) !== JSON.stringify(action)) &&
          (tokenId === null ||
            (i.action.kind === 'runtime' && i.action.characterId === characterId) ||
            (i.action.kind === 'give' && i.action.fromId === characterId) ||
            (i.action.kind === 'map' &&
              (('tokenId' in i.action.command && i.action.command.tokenId === tokenId) ||
                (i.action.command.type === 'explore' &&
                  'tokenId' in i.action.command.command &&
                  i.action.command.command.tokenId === tokenId)))),
      )
      if (waiting) throw new RoomError('请先处理待审核行动，再结束角色回合或收尾探索轮')
    }
    if (c.type === 'explore' && member.role !== 'gm') {
      if (
        ['toggle', 'jump-cast', 'spell-cast', 'zone-move', 'trigger', 'finish', 'roster'].includes(
          c.command.operation,
        ) &&
        !approved
      )
        throw new RoomError('请先提交 GM 审核')
      if ('confirmed' in c.command) c.command.confirmed = approved
      if (c.command.operation === 'toggle') delete c.command.tokenIds
      if (c.command.operation === 'end') {
        const tokenId = c.command.tokenId
        if (
          room.intents.some(
            (i) =>
              i.status === 'pending' &&
              i.action.kind === 'map' &&
              i.action.command.type === 'explore' &&
              'tokenId' in i.action.command.command &&
              i.action.command.command.tokenId === tokenId,
          )
        )
          throw new RoomError('请先处理该角色待审核行动')
      }
    }
    if (member.role !== 'gm') {
      if (c.type === 'move') {
        c.gm = false
        c.reactionsConfirmed =
          member.internalNpcId && npcExecution ? !!npcExecution.reactionsConfirmed : approved
      }
      if (c.type === 'interact') { c.gm = false; c.bypassItems = false }
      if (c.type === 'combat') {
        c.options =
          approved && approvedMapOptions
            ? clone(approvedMapOptions)
            : { distance: true, highGround: true, obstacles: true, reason: '' }
        const b = c.command
        if (
          b.type === 'action' &&
          ['hide', 'search', 'study', 'influence'].includes(b.action) &&
          !approved
        )
          throw new RoomError('此动作的检定、目标和条件需要先由 GM 审核')
        if (b.type === 'cast' && c.openingRequestId && !approved)
          throw new RoomError('主动施法请先提交 GM 审核')
        if (
          b.type === 'end-turn' &&
          room.intents.some(
            (i) =>
              i.status === 'pending' &&
              i.action.kind === 'map' &&
              i.action.command.type === 'combat' &&
              i.action.command.sceneId === c.sceneId,
          )
        )
          throw new RoomError('请先处理本场战斗的待审核行动或反应，再结束回合')
        if ('env' in b)
          b.env = clone(
            member.internalNpcId && npcExecution?.environment
              ? npcExecution.environment
              : room.environment,
          )
        if ('targetEnvironments' in b) delete b.targetEnvironments
        if (approved && targetEnvironments && (b.type === 'cast' || b.type === 'feature'))
          b.targetEnvironments = clone(targetEnvironments)
        if ('gmReason' in b) delete b.gmReason
        if ('requirementsConfirmed' in b) b.requirementsConfirmed = approved
        if ('triggerConfirmed' in b) b.triggerConfirmed = approved
        if (approved && (b.type === 'feature' || b.type === 'inventory'))
          b.note =
            (b.type === 'feature' ? targetEnvironments?.[b.targetId]?.note : '') ||
            room.environment.note ||
            b.note
        if (
          [
            'reaction-defense',
            'trigger-feature',
            'wild-shape',
            'wild-companion',
            'dismiss-companion',
            'maintain-spell',
            'zone-move',
            'companion-power',
          ].includes(b.type) &&
          !approved
        )
          throw new RoomError('触发与防御反应请先提交 GM 审核')
        if ((b.type === 'feature' || b.type === 'convert') && !approved)
          throw new RoomError('职业与物种特性请先提交 GM 审核')
        if (b.type === 'item-use' && !approved) throw new RoomError('使用伤害物品请先提交 GM 审核')
        if ((b.type === 'attack' || b.type === 'unarmed') && b.cost === 'opportunity' && !approved)
          throw new RoomError('借机攻击的触发时机请先提交 GM 审核')
        if (b.type === 'unarmed' && !approved)
          throw new RoomError('徒手选项的目标豁免与落点请先提交 GM 审核')
        if (b.type === 'end-effect' && !approved)
          throw new RoomError('移除效果请先提交 GM 审核；自愿结束专注请使用专用入口')
        if (b.type === 'inventory') {
          if (
            !['equip', 'item-remove', 'item-move', 'item-note', 'item-split'].includes(
              b.command.type,
            )
          )
            throw new RoomError('该背包操作需要 GM')
          if ('potionRolls' in b.command) delete b.command.potionRolls
        }
      }
    }
    if (c.type === 'battle-request' && member.role !== 'gm') {
      c.source = 'player'
      c.sourceId = member.id
    }
    if(c.type==='combat'){
      const b=c.command
      if(b.type==='runtime'||b.type==='inventory'){
        const characterId=room.world.encounters.flatMap(e=>e.actors).find(a=>a.id===b.actorId)?.characterId
        if(characterId){assertM1InventoryChange(room.world,characterId,b.command);assertSupplyInventoryChange(room.world,characterId,b.command)}
      }
    }
    room.world = applyMap(room.world, adventure(room).id, c, cat)
    if (['restore', 'battle-reset', 'battle-finish', 'battle-cancel'].includes(c.type))
      for (const intent of room.intents.filter((i) => i.status === 'pending')) {
        intent.status = 'rejected'
        intent.reason =
          c.type === 'restore'
            ? 'GM已整体读档，旧分支请求失效'
            : 'GM 已结束/取消战斗或整体重置，本请求失效'
      }
    if (c.type === 'interact') {
      const p = adventure(room)
          .scenes.find((s) => s.id === c.sceneId)
          ?.points.find((p) => p.id === c.pointId),
        log = adventure(room).log.at(-1)?.detail ?? '',
        check = log.match(/判定总值 (-?[\d.]+) \/ DC [\d.]+，(成功|失败)/)
      result(
        room,
        member,
        c.characterId,
        check
          ? p!.name + '：检定总值 ' + check[1] + '；' + check[2]
          : (p?.name ?? '物体') + '：互动已完成',
      )
    }
    if (c.type === 'combat' && 'actorId' in c.command) {
      const actorId = c.command.actorId,
        e = room.world.encounters.find((e) => e.id === activeScene(room)?.encounterId),
        actor = e?.actors.find((a) => a.id === actorId)
      if (actor?.characterId) {
        const character = room.world.characters.find((x) => x.id === actor.characterId)!
        // Own journal entries have no NPC defence/DC or GM notes. Never forward the full combat log.
        const b = c.command
        const detail = ['death-save', 'concentration'].includes(b.type)
          ? (character.journal?.at(-1)?.detail ?? '操作已结算')
          : b.type === 'feature'
            ? `${resources(character, cat).find((r) => r.id === b.id)?.name ?? '特性'}已执行；当前 HP ${character.runtime!.hp}，该资源剩余 ${character.runtime!.resources[b.id] ?? 0}`
            : b.type === 'inventory'
              ? '背包操作已结算，请查看当前装备与库存'
              : b.type === 'inspiration'
                ? '激励已使用，请查看待结算 D20 结果'
                : b.type === 'end-concentration'
                  ? '自愿结束专注（不消耗动作）'
                  : '战斗操作已执行，等待 GM 统一结算'
        result(room, member, actor.characterId, detail)
      }
    }
  } else if (action.kind === 'runtime') {
    const index = room.world.characters.findIndex((c) => c.id === action.characterId)
    if (index < 0) throw new RoomError('角色不存在')
    const c = clone(action.command)
    if (
      room.world.encounters.some(
        (e) => e.phase === 'active' && e.actors.some((a) => a.characterId === action.characterId),
      ) &&
      c.type !== 'portrait-set'
    )
      throw new RoomError('角色正在战斗中，请使用战斗命令')
    if (manualDiceActive()) {
      if (c.type === 'death-save') c.roll = rollDie(20)
      if (c.type === 'resource') delete c.roll
      if (c.type === 'rest') delete c.hitDieRoll
      if ('potionRolls' in c) delete c.potionRolls
    }
    if (member.role !== 'gm') {
      if (runtimeNeedsReview(c) && !approved) throw new RoomError('此操作请先提交 GM 审核')
      if (c.type === 'undo') throw new RoomError('撤销需要 GM 统一执行', 403)
      if (c.type === 'death-save' && !manualDiceActive()) c.roll = rollDie(20)
      if (c.type === 'resource') delete c.roll
      if (c.type === 'rest' && c.hitDieRoll !== undefined) {
        c.useHitDie = true
        delete c.hitDieRoll
      }
      if ('potionRolls' in c) delete c.potionRolls
      if (c.type === 'check')
        c.context = {
          ...c.context,
          fearVisible: room.environment.fearVisible,
          advantage: room.environment.advantage,
          disadvantage: room.environment.disadvantage,
        }
    }
    if(c.type==='cast'){
      const grant=runtimeSpells(room.world.characters[index]!,cat).find(g=>g.key===c.key)
      if(grant&&M4_LIGHT_SPELLS.includes(grant.spell.id as typeof M4_LIGHT_SPELLS[number]))throw new RoomError('此法术请使用“持续区域 · 光照与遮蔽”入口登记实际光源与位置，不能只扣资源');
      if(grant&&M1_UTILITY_SPELLS.includes(grant.spell.id))throw new RoomError('此法术需要GM使用M1遗体、物件与光环结算入口')
    }
    assertM1InventoryChange(room.world,action.characterId,c)
    assertSupplyInventoryChange(room.world,action.characterId,c)
    explorationRuntime(room.world, adventure(room), action.characterId, c, cat)
    if (c.type === 'origin') {
      if (member.role !== 'gm') c.confirmed = approved
      if (
        room.world.encounters.some(
          (e) =>
            e.phase === 'active' &&
            e.actors.some((a) => a.characterId && c.targets.includes(a.characterId)),
        )
      )
        throw new RoomError('目标正在战斗中，请使用战斗命令')
      room.world.characters = applyOriginParty(room.world.characters, action.characterId, cat, c)
    } else {const oldHP=room.world.characters[index]!.runtime?.hp??0,isBerry=c.type==='item-remove'&&c.consume&&room.world.characters[index]!.inventory.some(i=>i.instanceId===c.instanceId&&i.itemId==='goodberry');applyWorldRuntime(room.world,action.characterId,cat,c);if(isBerry)steedRecoveredHP(room.world,adventure(room),action.characterId,Math.max(0,(room.world.characters[index]!.runtime?.hp??oldHP)-oldHP))}
    result(
      room,
      member,
      action.characterId,
      room.world.characters[index]!.journal?.at(-1)?.detail ?? '角色操作完成',
    )
    forgetUndo(room.world)
  } else {
    const from = room.world.characters.find((c) => c.id === action.fromId),
      to = room.world.characters.find((c) => c.id === action.toId)
    const scene = activeScene(room)
    if (!from || !to || from === to || !scene) throw new RoomError('请选择同场景的另一名角色')
    const a = scene.tokens.find((t) => t.characterId === from.id && !t.hidden),
      b = scene.tokens.find((t) => t.characterId === to.id && !t.hidden)
    if (!a || !b || distance(scene, a, b) > 5)
      throw new RoomError('给予需要双方在同场景且相距不超过 5 尺')
    if (!sightLine(scene, a, b, 'blocksTargeting').clear)
      throw new RoomError('给予路线被实体墙门阻挡')
    if (room.world.encounters.some((e) => e.phase === 'active'))
      throw new RoomError('战斗中的物品交接请由 GM 在战斗桌裁定')
    const budget = explorationMember(adventure(room), a.id)
    if (adventure(room).exploration?.status === 'active' && !budget)
      throw new RoomError('该角色未加入探索名单，请 GM 更新名单或收尾')
    if (budget) {
      assertExplorationReady(room.world, adventure(room), budget, cat)
      explorationSpend(budget, budget.interaction ? 'interaction' : 'action')
      adventure(room).exploration!.acted = true
      budget.trail = []
    }
    const item = from.inventory.find((i) => i.instanceId === action.instanceId)
    if(item&&itemSpellBusy(from,item))throw new RoomError('物品用于连续施法中，请先取消原施法')
    assertM1InventoryChange(room.world,from.id,{type:'item-remove',instanceId:action.instanceId,quantity:action.quantity})
    if (!item || item.equipped || from.inventory.some((i) => i.containerId === item.instanceId))
      throw new RoomError('请先卸下装备或清空容器')
    if (action.quantity > item.quantity) throw new RoomError('给予数量超过库存')
    const sourceDefinition = [...cat.items, ...from.build.customItems].find(
        (i) => i.id === item.itemId,
      ),
      targetDefinition = [...cat.items, ...to.build.customItems].find((i) => i.id === item.itemId)
    if (!targetDefinition || JSON.stringify(sourceDefinition) !== JSON.stringify(targetDefinition))
      throw new RoomError('接收方缺少该物品的规则定义')
    const bound = runtimeState(from, cat).effects.filter(
        (f) => f.weapon?.instanceId === item.instanceId,
      ),
      receivedId = room.world.adventures.some(a=>a.sceneEffects?.supplies?.containers.some(c=>c.instanceId===item.instanceId&&(!c.ownerId||c.ownerId===from.id)))||item.specialWeapon||room.world.adventures.some(a=>a.sceneEffects?.regions.some(e=>e.status==='active'&&e.anchor.kind==='inventory'&&e.anchor.id===item.instanceId&&(!e.anchor.ownerId||e.anchor.ownerId===from.id))) ? item.instanceId : randomUUID()
    if (to.inventory.some((i) => i.instanceId === receivedId))
      throw new RoomError('接收方已存在同编号物品实例，请由 GM 核对')
    if (bound.length && item.quantity !== action.quantity)
      throw new RoomError('附魔武器须整件给予，不能拆分附魔堆叠')
    to.inventory.push({
      ...clone(item),
      ...(item.consumable?.expiresAt !== undefined
        ? {
            consumable: {
              ...item.consumable,
              expiresAt:
                (to.runtime?.hours ?? 0) +
                Math.max(0, item.consumable.expiresAt - (from.runtime?.hours ?? 0)),
            },
          }
        : {}),
      instanceId: receivedId,
      quantity: action.quantity,
      equipped: false,
      containerId: null,
      equipmentSlot: null,
      grip: null,
    })
    if (bound.length) {
      from.runtime = runtimeState(from, cat)
      to.runtime = runtimeState(to, cat)
      from.runtime.effects = from.runtime.effects!.filter((f) => !bound.some((b) => b.id === f.id))
      to.runtime.effects!.push(
        ...bound.map((f) => ({
          ...clone(f),
          expiresAt: null,
          ...(f.endsAt !== undefined
            ? {
                endsAt:
                  (to.runtime!.hours ?? 0) + Math.max(0, f.endsAt - (from.runtime!.hours ?? 0)),
              }
            : {}),
          weapon: { ...f.weapon!, instanceId: receivedId },
        })),
      )
    }
    for(const a of room.world.adventures)for(const e of a.sceneEffects?.regions??[])if(e.status==='active'&&e.anchor.kind==='inventory'&&e.anchor.id===item.instanceId&&(!e.anchor.ownerId||e.anchor.ownerId===from.id)){e.anchor.id=receivedId;e.anchor.ownerId=to.id}
    for(const a of room.world.adventures)for(const c of a.sceneEffects?.supplies?.containers??[])if(c.instanceId===item.instanceId&&(!c.ownerId||c.ownerId===from.id)){c.instanceId=receivedId;c.ownerId=to.id;c.groundItemId=undefined}
    transferHutInventory(room.world,item.instanceId,item.quantity,action.quantity,receivedId)
    item.quantity -= action.quantity
    if (item.quantity && item.uses !== undefined) item.uses = 10
    if (!item.quantity) from.inventory = from.inventory.filter((i) => i !== item)
    for (const c of [from, to]) {
      c.revision++
      c.updatedAt = new Date().toISOString()
      validateInventory(c, cat)
      validateRuntimeArchive(c, cat)
    }
    forgetUndo(room.world)
  }
  reconcileWorld(room.world)
  room.worldRevision++
}
export function executeCommand(room: Room, member: RoomMember, command: RoomCommand) {
  if (member.role === 'ai' && command.kind !== 'intent-submit')
    throw new RoomError('AI 身份只能提交意图', 403)
  if(command.kind==='opening'){executeOpeningReading(room,member,command);return}
  if (command.kind === 'corpse-loot') {
    lootCorpse(room, member, command)
    forgetUndo(room.world)
    room.events.push({ id: crypto.randomUUID(), at: new Date().toISOString(), detail: '已从可感知遗体转移登记财产' })
  } else if (command.kind === 'review-archive-expired') {
    const count = archiveExpiredReviews(room, member)
    room.events.push({ id: crypto.randomUUID(), at: new Date().toISOString(), detail: `已归档${count}条失效审核，历史与结算保留` })
  } else if(command.kind==='practical-recheck'){
    requireGM(member);const task=room.practicalReview?.tasks.find(t=>t.id===command.taskId)
    if(!task||task.phase!=='intent')throw Error('该任务请使用对应原入口接管')
    recheckPracticalIntent(room,task.sourceId)
  }else if(executePracticalSpellInput(room,member,command)||executePracticalEffectInput(room,member,command)){
    if(command.kind==='practical-spell-input')recheckPracticalIntent(room,command.intentId)
  }else if (practicalTakeover(room,member,command)||executePracticalResponse(room,member,command)||executePracticalInitiative(room,member,command)||executePracticalStagingRoll(room,member,command)||executePracticalFrameAction(room,member,command)) {
    // This endpoint selects one current server-generated option only.
  } else if (changeGmControl(room, member, command) || changeStoryItem(room, member, command)) {
    // Control metadata never refreshes action or resource budgets.
  } else if (command.kind === 'message-delivery') {
    requireGM(member)
    if ((room.messageDelivery ?? 'both') !== command.mode) {
      const a = adventure(room)
      room.messageDeliveryState = {
        generation: (room.messageDeliveryState?.generation ?? 0) + 1,
        boundary: (a.broadcastLog?.nextSequence ?? 1) - 1,
        branchId: a.broadcastLog?.branchId ?? 'legacy',
      }
    }
    room.messageDelivery = command.mode
  } else if (command.kind === 'npc-talk-withdraw') {
    const job = adventure(room).aiLog?.jobs.find((j) => j.id === command.jobId)
    if (
      !job ||
      job.kind !== 'npc' ||
      job.purpose !== 'dialogue' ||
      (member.role !== 'gm' && job.sessionId !== member.id)
    )
      throw new RoomError('不可撤回该会话', 403)
    if (!['queued', 'waiting-gm'].includes(job.status))
      throw new RoomError('仅可撤回尚未生成或裁定的会话')
    job.status = 'canceled'
    job.attempt = null
  } else if (executeSceneEffects(room,member,command)) {
    // Actual scene effects retain source, costs, visibility and reaction validation.
  } else if (executeM3(room,member,command)) {
    // Structured spatial operations retain their own authoritative validation.
  } else if (executeM1Utility(room,member,command)) {
    // Atomic, GM-confirmed corpse/material/object settlement.
  } else if (executeSummonCommand(room,member,command)) {
    // Stable world summon identity and explicit GM migration; no model-generated template.
  } else if (executeGmSpellCommand(room, member, command)) {
    // Interpretation stays with GM; casting costs were already charged once.
  } else if (reviewManagement(room, member, command)) {
    // Restricted room policy management only; model output never enters this command path.
  } else if (executeCharacterRequest(room, member, command)) {
    // Character applications are independent of action intent revisions.
  } else if (command.kind === 'quest-step-review') {
    requireGM(member)
    reviewQuestStep(adventure(room), command.questId, command.suggestionId, command.approve)
    room.worldRevision++
  } else if (command.kind === 'quest-save') {
    requireGM(member)
    const a = adventure(room),
      items = clone(a.quests ?? []),
      q = clone(command.quest),
      index = items.findIndex((x) => x.id === q.id)
    if (index < 0 && items.length >= QUEST_LIMIT) throw new RoomError('任务数量达到上限100')
    if (index >= 0 && items[index]?.stepSuggestions)
      q.stepSuggestions = clone(items[index]!.stepSuggestions)
    if (q.main)
      items.forEach((x) => {
        x.main = false
      })
    if (q.current)
      items.forEach((x) => {
        x.current = false
      })
    if (index < 0) items.push(q)
    else items[index] = q
    validateQuests(
      { ...a, quests: items },
      room.world.characters.map((c) => c.id),
    )
    a.quests = items
    room.worldRevision++
  } else if (executeAiCommand(room, member, command)) {
    // Conversation decisions and narration reviews do not bypass rule reducers.
  } else if (['map', 'runtime', 'give', 'npc','summon','container'].includes(command.kind)) {
    executeAction(room, member, command as RoomAction)
  } else if (command.kind === 'character-import') {
    requireGM(member)
    importRoomCharacters(room, command.archives, {
      purpose: command.asPlayerCopy ? 'player-copy' : 'player',
    })
  } else if (command.kind === 'control') {
    requireGM(member)
    const target = room.members.find((m) => m.id === command.sessionId && m.role !== 'gm')
    if (!target) throw new RoomError('成员不存在')
    if (target.role === 'player' && command.actorIds.length)
      throw new RoomError('玩家身份只能操控角色，NPC 请分配给 AI 或 GM')
    if (command.characterIds.some((id) => isNpcCharacter(room.world, id)))
      throw new RoomError('NPC 角色卡由 GM 管理，不能分配为玩家角色')
    if (
      command.actorIds.some((id) =>
        room.world.adventures.some((a) => a.ai?.npcs.some((n) => n.actorId === id)),
      ) &&
      !target.internalNpcId
    )
      throw new RoomError('已管理 NPC 请在 NPC 面板配置控制方式')
    if (
      command.characterIds.some((id) => !room.world.characters.some((c) => c.id === id)) ||
      command.actorIds.some(
        (id) => !room.world.encounters.some((e) => e.actors.some((a) => a.id === id)),
      )
    )
      throw new RoomError('操控对象不存在')
    if (
      command.characterIds.some((id) =>
        room.members.some(
          (m) => m.id !== target.id && m.role !== 'gm' && !m.revoked && m.characterIds.includes(id),
        ),
      )
    )
      throw new RoomError('角色已分配给其他成员，请先解除分配')
    target.characterIds = [...new Set(command.characterIds)]
    target.actorIds = [...new Set(command.actorIds)]
    target.revoked = command.revoked
  } else if (command.kind === 'invite-rotate') {
    requireGM(member)
    room.inviteHash = hash(command.invite)
    room.inviteExpiresAt = new Date(
      Date.now() + (command.hours ?? 24) * 60 * 60 * 1000,
    ).toISOString()
    room.inviteEnabled = true
    for (const r of room.lanRequests ?? []) if (r.status === 'pending') r.status = 'rejected'
  } else if (command.kind === 'invite-policy') {
    requireGM(member)
    room.inviteEnabled = command.enabled
    if (command.hours)
      room.inviteExpiresAt = new Date(Date.now() + command.hours * 60 * 60 * 1000).toISOString()
    if (!command.enabled)
      for (const r of room.lanRequests ?? []) if (r.status === 'pending') r.status = 'rejected'
  } else if (command.kind === 'lan-review') {
    requireGM(member)
    const r = room.lanRequests?.find((r) => r.id === command.id && r.status === 'pending')
    if (!r) throw new RoomError('入网申请已处理或不存在')
    if (Date.now() - Date.parse(r.at) > 24 * 60 * 60 * 1000)
      throw new RoomError('入网申请已过期，请重新申请')
    if (command.approve) {
      if (room.members.length >= 100) throw new RoomError('房间人数已满')
      const id = randomUUID()
      room.members.push({
        id,
        nickname: r.nickname,
        role: 'player',
        tokenHash: r.tokenHash,
        characterIds: [],
        actorIds: [],
        revoked: false,
      })
      r.memberId = id
    }
    r.status = command.approve ? 'approved' : 'rejected'
  } else if (command.kind === 'environment') {
    requireGM(member)
    room.environment = clone(command.environment)
  } else if (command.kind === 'ai-create') {
    requireGM(member)
    if (room.members.length >= 30) throw new RoomError('房间最多 30 个成员身份')
    if (room.members.some((m) => m.tokenHash === hash(command.token)))
      throw new RoomError('令牌已存在')
    const ai: RoomMember = {
      id: randomUUID(),
      nickname: command.name,
      role: 'ai',
      tokenHash: hash(command.token),
      characterIds: [],
      actorIds: [],
      revoked: false,
    }
    room.members.push(ai)
    executeCommand(room, member, {
      kind: 'control',
      sessionId: ai.id,
      characterIds: command.characterIds,
      actorIds: command.actorIds,
      revoked: false,
    })
  } else if (command.kind === 'intent-submit') {
    authorizeAction(room, member, command.action)
    if (command.baseWorldRevision !== room.worldRevision)
      throw new RoomError('意图基于过期世界状态，请重新读取场景', 409)
    if (room.intents.filter((i) => i.status === 'pending').length >= 50)
      throw new RoomError('待审意图已满')
    room.intents.push({
      id: randomUUID(),
      sessionId: member.id,
      summary: command.summary,
      source: member.role === 'player' ? 'player' : command.source,
      action: clone(command.action),
      sceneEffectContext:command.action.kind==='scene-effect'||command.action.kind==='summon'?{sceneId:activeScene(room)!.id,branch:adventure(room).broadcastLog?.branchId??'legacy',encounterId:room.world.encounters.find(e=>e.id===activeScene(room)?.encounterId&&e.phase==='active')?.id,tick:room.world.encounters.find(e=>e.id===activeScene(room)?.encounterId&&e.phase==='active')?.tick}:undefined,
      pendingWindow:
        command.action.kind === 'map' &&
        command.action.command.type === 'combat' &&
        isHitReaction(command.action.command.command)
          ? room.world.encounters.find((e) => e.id === activeScene(room)?.encounterId)?.pending?.id
          : undefined,
      baseWorldRevision: room.worldRevision,
      status: 'pending',
      reason: '',
      at: new Date().toISOString(),
    })
    room.intents = room.intents.slice(-100)
    queuePracticalIntent(room,room.intents.at(-1)!)
  } else if (command.kind === 'intent-review') {
    requireGM(member)
    const intent = room.intents.find((i) => i.id === command.intentId && i.status === 'pending')
    if (!intent) throw new RoomError('意图不存在或已经审核')
    if (command.approve) {
      const source = room.members.find((m) => m.id === intent.sessionId && !m.revoked)
      if (!source) throw new RoomError('提交者权限已撤销', 403)
      if(intent.action.kind==='scene-effect'||intent.action.kind==='summon'){const context=intent.sceneEffectContext,battle=room.world.encounters.find(e=>e.id===activeScene(room)?.encounterId&&e.phase==='active');if(!context||context.sceneId!==activeScene(room)?.id||context.branch!==(adventure(room).broadcastLog?.branchId??'legacy')||context.encounterId!==battle?.id||context.tick!==battle?.tick)throw new RoomError('场景效果申请的场景、分支或回合已改变，请重新申请',409)}
      const qq = room.qq?.requests.find((r) => r.intentId === intent.id)
      if (qq && !qqRequestLive(room, qq))
        throw new RoomError('QQ 申请的权限、场景、分支或回合已失效，请重新提交', 409)
      if (
        intent.action.kind!=='scene-effect' && intent.action.kind!=='spatial' && intent.action.kind!=='summon' && intent.baseWorldRevision !== room.worldRevision &&
        !sameDefenseWindow(
          intent,
          room.world.encounters.find((e) => e.id === activeScene(room)?.encounterId),
        )
      )
        throw new RoomError('世界已变化，请拒绝旧意图并重新提交', 409)
      if (command.environment) room.environment = clone(command.environment)
      const action = clone(intent.action)
      applyPracticalConsent(room,intent,action)
      if (command.itemCost) {
        if (
          action.kind !== 'map' ||
          action.command.type !== 'combat' ||
          action.command.command.type !== 'item-use'
        )
          throw new RoomError('只有物品使用意图可裁定动作成本')
        action.command.command.manualCost = command.itemCost
      }
      if (command.npcDirective) {
        if (action.kind !== 'npc') throw new RoomError('此意图不支持 NPC 行为调整')
        action.directive = clone(command.npcDirective)
      }
      if (command.targets) {
        if (
          action.kind !== 'map' ||
          action.command.type !== 'combat' ||
          !['cast', 'feature'].includes(action.command.command.type)
        )
          throw new RoomError('此意图不支持修改目标')
        const b = action.command.command
        if (b.type === 'cast') b.targets = command.targets
        else if (b.type === 'feature') {
          if (b.id === 'breath') b.targets = command.targets
          else {
            if (command.targets.length !== 1) throw new RoomError('此特性只支持一个目标')
            delete b.targets
          }
          b.targetId = command.targets[0]!
        }
      }
      if (command.targetEnvironments) {
        if (
          action.kind !== 'map' ||
          action.command.type !== 'combat' ||
          !(action.command.command.type === 'cast' || action.command.command.type === 'feature')
        )
          throw new RoomError('此意图不支持逐目标环境')
        const b = action.command.command,
          ids = b.type === 'cast' ? b.targets : b.targets?.length ? b.targets : [b.targetId]
        if (Object.keys(command.targetEnvironments).some((id) => !ids.includes(id)))
          throw new RoomError('环境条件包含意图以外的目标')
      }
      if (command.mapOptions && (action.kind !== 'map' || action.command.type !== 'combat'))
        throw new RoomError('只有战斗意图支持地图条件覆盖')
      // Exclude this approved application from the pending-action end-turn guard.
      // The room transaction still rolls back entirely if execution fails.
      intent.status = 'approved'
      try {
        if(action.kind==='map'&&action.command.type==='interact'&&action.command.requestItemRuling){
          authorizeAction(room,source,action)
          const pointId=action.command.pointId
          const point=activeScene(room)?.points.find(p=>p.id===pointId)
          if(point?.itemUse?.fallback!=='gm')throw new RoomError('此互动未开放GM物品替代裁定，请先明确编辑配置')
          if(!command.reason.trim())throw new RoomError('物品替代裁定需要GM填写理由')
          action.command.bypassItems=true;action.command.gm=false;action.command.reason=command.reason
          executeAction(room,member,action,true)
        }else executeAction(room, source, action, true, command.targetEnvironments, command.mapOptions)
      } catch (error) {
        intent.status = 'pending'
        throw error
      }
      intent.adjudication = clone({
        environment: room.environment,
        itemCost: command.itemCost,
        targets: command.targets,
        targetEnvironments: command.targetEnvironments,
        mapOptions: command.mapOptions,
        npcDirective: command.npcDirective,
      })
    }
    intent.status = command.approve ? 'approved' : 'rejected'
    intent.reason = command.reason
  } else throw new RoomError('图片上传需使用图片事务入口')
  room.events.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    detail: `${member.nickname} · ${command.kind === 'intent-submit' ? '提交意图' : command.kind === 'intent-review' ? '完成意图审核' : command.kind === 'control' ? '调整操控权限' : '提交操作'}`,
  })
  room.events = room.events.slice(-80)
}
function projectRoomUncached(
  room: Room,
  member: RoomMember,
  assets: MapAsset[],
  live = false,
): RoomView {
  const gm = member.role === 'gm',
    scene = activeScene(room),
    cat = catOf(room)
  const fogAccess = !gm && scene ? createFogAccess(room,member,scene.id) : undefined
  const publicMember = ({ tokenHash: _secret, ...m }: RoomMember) => clone(m)
  const encounter = room.world.encounters.find((e) => e.id === scene?.encounterId)
  const controls = (a: NonNullable<typeof encounter>['actors'][number]) => {
    const summon=adventure(room).summons?.instances.find(i=>i.id===a.companion?.instanceId);if(!gm&&summon&&(summon.control!=='controlled'||!summon.controllerId||!member.characterIds.includes(summon.controllerId)))return false
    const owner =
      a.companion &&
      ['spell-summon', 'primal-companion'].includes(a.companion.source) &&
      !a.companion.dismissed
        ? encounter?.actors.find((x) => x.id === a.companion!.ownerId)
        : undefined
    return (
      gm ||
      member.characterIds.includes(a.characterId ?? '') ||
      member.actorIds.includes(a.id) ||
      (!!owner &&
        (member.characterIds.includes(owner.characterId ?? '') ||
          member.actorIds.includes(owner.id)))
    )
  }
  const perceptionCache=m3PerceptionCache(),summonViewObservers=scene?.fog?.enabled?scene.tokens.filter(t=>fogIds(room,member,scene.id).includes(t.characterId??t.actorId??t.id)):summonObservers(room,member)
  const permittedTokenUncached = (t: import('../core/map-types').MapToken) => {
    if (gm) return true
    if (t.hidden || !scene) return false
    if(enclosedMode(scene))return fogMapAllowed(room,member,scene.id,t,fogAccess)
    if (scene.fog?.enabled && !fogEntityAllowed(room,member,scene.id,t,fogAccess)) return false
    const observers = summonViewObservers
    return observers.length ? observers.some(from => from.id === t.id || tokenPerception(room.world, adventure(room), scene, from, t, cat, undefined, perceptionCache).canPerceive)
      : !member.characterIds.length&&!member.actorIds.length&&publicCameraToken(room.world, adventure(room), scene, t, cat)
  }
  const tokenAccess = new Map<string, boolean>()
  const permittedToken = (t: import('../core/map-types').MapToken) => {
    if (!tokenAccess.has(t.id)) tokenAccess.set(t.id, permittedTokenUncached(t))
    return tokenAccess.get(t.id)!
  }
  const pendingCaster = encounter?.actors.find((a) => a.id === encounter.pending?.actorId)
  const ownsPendingCaster = gm || (!!pendingCaster && controls(pendingCaster))
  const pendingCharacter = room.world.characters.find((c) => c.id === pendingCaster?.characterId)
  const pendingPublic =
    !!encounter?.pending &&
    !!scene?.tokens.some((t) => !t.hidden && t.actorId === encounter.pending!.actorId && (!scene.fog?.enabled || permittedToken(t)))
  const permittedAssets = gm
    ? assetReferences(adventure(room))
    : new Set(scene?.background ? [scene.background.assetId] : [])
  const projected: RoomView = {
    id: room.id,
    messageDelivery: room.messageDelivery ?? 'both',
    gmControls: (adventure(room).gmControls ?? [])
      .filter((control) => gm || (control.targetKind === 'character' && member.characterIds.includes(control.targetId)))
      .map(({ previousController: _previous, ...control }) => clone(control)),
    exploration: adventure(room).exploration
      ? (() => {
          const x = clone(adventure(room).exploration!)
          if (gm) return x
          const own = (id: string) =>
            scene?.tokens.some(
              (t) =>
                t.id === id &&
                !t.hidden &&
                (member.characterIds.includes(t.characterId ?? '') ||
                  member.actorIds.includes(t.actorId ?? '')),
            )
          x.members = x.members
            .filter((m) => scene?.tokens.some((t) => t.id === m.tokenId && !t.hidden))
            .map((m) => (own(m.tokenId) ? m : { ...m, trail: [], flags: [] }))
          x.retired = []
          x.clocks = Object.fromEntries(
            Object.entries(x.clocks).filter(([id]) => member.characterIds.includes(id)),
          )
          x.triggers = x.triggers
            .filter((t) => own(t.tokenId))
            .map((t) => ({
              ...t,
              sourceId: 'private',
              encounterId: 'private',
              turnTokenId: scene?.tokens.some(
                (token) => token.id === t.turnTokenId && !token.hidden,
              )
                ? t.turnTokenId
                : 'private',
              note: '',
            }))
          return x
        })()
      : undefined,
    ...(gm ? { reviewArchive: room.reviewArchive ?? [], expiredReviewCount: expiredReviews(room).length, archivedPracticalReviewIds: expiredReviews(room, true).filter(r => r.label === 'practical' && room.reviewArchive?.includes(r.key)).map(r => r.key.slice(10, -6)), archivedAiReviewIds: expiredReviews(room, true).filter(r => r.label === 'ai' && room.reviewArchive?.includes(r.key)).map(r => r.key.slice(3, -6)) } : {}),
    characterRequests: projectCharacterRequests(room, member),
    ai: projectAi(room, member),
    ...(gm&&adventure(room).ai?.spatialState?.reportNpcId?(()=>{const n=adventure(room).ai?.npcs.find(n=>n.id===adventure(room).ai?.spatialState?.reportNpcId);return n?{npcSpatial:{npcId:n.id,observation:npcSpatialObservation(room,n)}}:{}})():{}),
    mapFeedback: projectMapFeedback(room,member),
    broadcast: broadcastFeed(
      room,
      member,
      Math.max(0, (adventure(room).broadcastLog?.nextSequence ?? 1) - 101),
      100,
    ),
    name: room.name,
    shortCode: shortRoomCode(room),
    ...(gm
      ? {
          invitation: {
            expiresAt: room.inviteExpiresAt ?? null,
            enabled: room.inviteEnabled !== false,
          },
          lanRequests: (room.lanRequests ?? []).map(({ id, nickname, status, at }) => ({
            id,
            nickname,
            status,
            at,
          })),
        }
      : {}),
    dice: projectDice(room, member),
    ...(gm ? { lastSavedAt: room.lastSavedAt } : {}),
    revision: room.revision,
    gmSpells: projectGmSpells(room, member),
    summons:projectSummons(room,member),summonChoices:summonChoices(room,member),summonTouchChoices:summonTouchChoices(room,member),summonCorpses:summonCorpses(room,member),
    worldRevision: room.worldRevision,
    importedCharacterIds: gm
      ? Object.entries(room.characterSources ?? {})
          .filter(([, id]) => room.world.characters.some((c) => c.id === id))
          .map(([source]) => source)
      : [],
    openingReading: openingReadingView(room,member),
    self: {
      ...publicMember(member),
      actorIds: [
        ...new Set([
          ...member.actorIds,
          ...(encounter?.actors
            .filter(
              (a) =>
                controls(a) &&
                a.companion &&
                !a.companion.dismissed &&
                scene?.tokens.some((t) => !t.hidden && t.actorId === a.id),
            )
            .map((a) => a.id) ?? []),
        ]),
      ],
    },
    members: room.members
      .filter((m) => (!m.revoked || gm) && (gm || !m.internalNpcId))
      .map((m) =>
        gm || m.id === member.id
          ? publicMember(m)
          : { ...publicMember(m), characterIds: [], actorIds: [] },
      ),
    scene: scene
      ? {
          groundItems: scene.groundItems
            ?.filter((g) => gm || (!g.hidden && g.enabled && g.quantity > 0 && (enclosedMode(scene)?fogMapAllowed(room,member,scene.id,g,fogAccess):scenePointVisible(room.world,adventure(room),scene,summonViewObservers,g,cat))))
            .map(({ note: _note, initialQuantity: _initial,inventoryState:_privateInventory, ...g }) => clone(g)),
          awaitingTokens: gm
            ? (adventure(room)
                .ai?.npcs.filter((n) => n.sceneId === scene.id && n.initiallyAbsent && !n.appeared)
                .map((n) => ({ id: n.id, name: n.name, ...n.position, color: '#75609e' })) ?? [])
            : undefined,
          id: scene.id,
          name: scene.name,
          note: gm ? scene.note : '',
          grid: clone(scene.grid),
          background: clone(scene.background),
          template:
            scene.template && !gm
              ? (({ note: _gmNote, ...publicTemplate }) => publicTemplate)(clone(scene.template))
              : clone(scene.template),
          areaCandidates: areaTargets(scene)
            .filter((r) => permittedToken(r.token))
            .map((r) => ({
              tokenId: r.token.id,
              inside: r.inside,
              blocked: r.blocked,
              eligible: r.eligible,
              cover: r.cover,
            })),
          walls: (scene.walls ?? [])
            .filter((w) => gm || !w.hidden)
            .map((w) => ({
              ...clone(w),
              state: wallState(scene, w) as 'closed' | 'open' | 'locked',
              pointId: gm||scene.points.some(p=>p.id===w.pointId&&p.enabled&&!p.hidden) ? w.pointId : null,
            })),
          sightLines: scene.tokens
            .filter(
              (t) =>
                !t.hidden &&
                ((gm && !live) ||
                  (t.characterId && member.characterIds.includes(t.characterId)) ||
                  (t.actorId && member.actorIds.includes(t.actorId))),
            )
            .flatMap((from) =>
              scene.tokens
                .filter((to) => permittedToken(to) && to.id !== from.id)
                .map((to) => ({
                  fromId: from.id,
                  toId: to.id,
                  sightRay:!gm&&!scene.fog?.enabled&&adventure(room).sceneEffects?.regions.some(e=>e.status==='active')?sceneRayView(room.world,adventure(room),scene,tokenPoint(from),tokenPoint(to),'visual',tokenM3State(room.world,adventure(room),from,cat)):undefined,
                  targetRay:!gm&&!scene.fog?.enabled&&adventure(room).sceneEffects?.regions.some(e=>e.status==='active')?sceneRayView(room.world,adventure(room),scene,tokenPoint(from),tokenPoint(to),'effect'):undefined,
                  sightClear: tokenPerception(room.world,adventure(room),scene,from,to,cat,undefined,perceptionCache).canSee,
                  targetingClear: sightLine(scene, from, to, 'blocksTargeting').clear,
                  cover: coverBetween(scene, from, to).degree,
                })),
            ),
          sceneEffects:projectSceneEffects(room.world,adventure(room),scene,cat,gm,summonViewObservers),
          lastKnownTokens:gm||enclosedMode(scene)?[]:(adventure(room).m3?.knowledge??[]).filter(k=>k.sceneId===scene.id&&scene.tokens.some(t=>t.id===k.observerId&&(member.characterIds.includes(t.characterId??'')||member.actorIds.includes(t.actorId??'')))&&scene.tokens.some(t=>t.id===k.targetId&&!t.hidden)&&!scene.tokens.some(from=>(member.characterIds.includes(from.characterId??'')||member.actorIds.includes(from.actorId??''))&&scene.tokens.some(to=>to.id===k.targetId&&tokenPerception(room.world,adventure(room),scene,from,to,cat,undefined,perceptionCache).canSee))).filter((k,i,rows)=>rows.findIndex(r=>r.targetId===k.targetId)===i).map(k=>({id:k.targetId,name:k.name,x:k.x,y:k.y,height:k.height})),
          spatialObjects:adventure(room).m3?.entities.filter(e=>e.sceneId===scene.id&&e.enabled&&(gm||(!e.layer||e.layer==='material'||scene.tokens.some(t=>member.characterIds.includes(t.characterId??'')&&t.spatial?.layer===e.layer&&t.spatial?.anchorId===e.anchorId))&&(!e.hidden||e.kind==='portal'&&(member.characterIds.includes(e.sourceId??'')||e.targetIds?.some(id=>member.characterIds.includes(id))||e.knownTo?.some(id=>member.characterIds.includes(id))))&&scene.tokens.some(t=>(member.characterIds.includes(t.characterId??'')||member.actorIds.includes(t.actorId??''))&&(enclosedMode(scene)?fogMapAllowed(room,member,scene.id,{...e,hidden:false},fogAccess):scenePointVisible(room.world,adventure(room),scene,[t],e,cat))))).map(e=>({id:e.id,name:e.name,kind:e.kind,x:e.x,y:e.y,height:e.height,width:e.width,heightFeet:e.heightFeet,depth:e.depth})),
          tokens: clone(
            scene.tokens
              .filter(permittedToken)
              .map((t) => {
                const statuses=tokenStatuses(room,t,gm||member.characterIds.includes(t.characterId??'')||member.actorIds.includes(t.actorId??''),gm,cat),npcType=adventure(room).ai?.npcs.find(n=>n.id===t.npcId||!!n.characterId&&n.characterId===t.characterId)?.npcType
                if (gm) return { ...t, statuses,npcType,portrait: tokenPortrait(room.world, adventure(room), t) }
                const {
                  npcBody: _body,
                  npcSourceActorId: _source,
                  companionKey: _key,
                  ...publicToken
                } = t
                return { ...publicToken, statuses,npcType,portrait: tokenPortrait(room.world, adventure(room), t) }
              }),
          ),
          regions: clone(
            scene.regions.filter((r) => gm || !r.hidden).map((r) => (gm ? r : { ...r, note: '' })),
          ),
          annotations: clone(
            (scene.annotations ?? [])
              .filter((a) => gm || !a.hidden)
              .map((a) => (gm ? a : { ...a, note: '' })),
          ),
          points: scene.points
            // Discovery configuration and unrevealed point IDs never enter player snapshots.
            .filter((p) => gm || (!p.hidden && p.enabled && (p.kind==='door'&&!!fogDoorAccess(room,member,scene.id,p.id,undefined,fogAccess)||(enclosedMode(scene)?fogMapAllowed(room,member,scene.id,p,fogAccess):scenePointVisible(room.world,adventure(room),scene,summonViewObservers,p,cat)))))
            .map((p) => ({
              ...(p.kind==='chest'?{repeatAccess:p.repeatAccess!==false}:{}),
              ...(p.assistedReview?.enabled ? { reviewRequired: true } : {}),
              ...(p.itemUse ? { acceptsItems: true, itemReviewAvailable:p.itemUse.fallback==='gm' } : {}),
              id: p.id,
              x: p.x,
              y: p.y,
              kind: p.kind,
              name: p.name,
              state: p.state,
              revealed: gm || ['resolved', 'disarmed', 'open'].includes(p.state) ? p.revealed : '',
            })),
          discovery: {
            attempts: (scene.discoveryAttempts ?? [])
              .filter(
                (x) =>
                  x.branchId === adventure(room).broadcastLog?.branchId &&
                  (gm || member.characterIds.includes(x.characterId)),
              )
              .slice(-30)
              .map((x) => ({ id: x.id, characterId: x.characterId, status: x.status })),
            routes: (scene.pausedRoutes ?? [])
              .filter(
                (x) =>
                  x.branchId === adventure(room).broadcastLog?.branchId &&
                  (gm || member.characterIds.includes(x.characterId)),
              )
              .map((x) => ({
                id: x.id,
                characterId: x.characterId,
                tokenId: x.tokenId,
                steps: x.path.length,
              })),
          },
        }
      : null,
    sceneNames: adventure(room)
      .scenes.filter((s) => gm || s.id === scene?.id)
      .map((s) => ({ id: s.id, name: s.name })),
    characters: room.world.characters
      .filter((c) => !isNpcCharacter(room.world, c.id))
      .filter((c) => gm || scene?.tokens.some((t) => !t.hidden && t.characterId === c.id))
      .map((c) => ({ id: c.id, name: c.build.name, portrait: safePortrait(c.portrait) })),
    ownCharacters: clone(
      room.world.characters
        .filter((c) => gm || member.characterIds.includes(c.id))
        .map((c) => ({
          ...c,
          runtime:
            !gm && c.runtime
              ? {
                  ...c.runtime,
                  advanced: c.runtime.advanced
                    ? {
                        ...c.runtime.advanced,
                        lastCheck: c.runtime.advanced.lastCheck
                          ? { ...c.runtime.advanced.lastCheck, dc: null }
                          : null,
                      }
                    : undefined,
                  effects: c.runtime.effects?.map((effect) => {const {protectedSourceIds,...safe}=effect;return {...safe,note:''}}),
                }
              : c.runtime,
          journal: gm
            ? c.journal
            : room.events
                .filter((e) => e.sessionId === member.id && e.characterId === c.id)
                .map((e) => ({
                  id: e.id,
                  at: e.at,
                  revision: c.revision,
                  kind: 'online',
                  detail: e.detail,
                  before: null,
                  undone: false,
                })),
        })),
    ),
    packs: clone(room.world.packs.map(p=>gm||!p.id.startsWith('story-')?p:{...p,items:p.items.filter(i=>room.world.characters.some(c=>member.characterIds.includes(c.id)&&c.inventory.some(row=>row.itemId===i.id)))})),
    environment: clone({
      ...room.environment,
      note: gm ? room.environment.note : '',
      attackAdvantages: gm ? room.environment.attackAdvantages : undefined,
      spatial: undefined,
    }),
    encounter: encounter
      ? {
          id: encounter.id,
          name: encounter.name,
          phase: encounter.phase,
          round: encounter.round,
          tick: encounter.tick,
          currentId: encounter.actors[encounter.current]?.id ?? '',
          pending: !!encounter.pending,
          endTurnBlocked:
            room.intents.some(
              (i) =>
                i.status === 'pending' &&
                i.action.kind === 'map' &&
                i.action.command.type === 'combat' &&
                i.action.command.sceneId === scene?.id,
            ) ||
            room.world.characters.some(
              (c) =>
                encounter.actors.some((a) => a.characterId === c.id) &&
                !!c.runtime?.concentration?.pendingDC,
            ),
          pendingAction: encounter.pending
            ? {
                id: encounter.pending.id,
                damageRolled: encounter.pending.damageRolled,
                spellId: gm || ownsPendingCaster ? encounter.pending.spellId : undefined,
                damageDice: ownsPendingCaster
                  ? (encounter.pending.targets[0]?.damageOverride ?? encounter.pending.damage)
                      .flatMap((p) => p.roll.dice)
                      .map((value, index) => ({ index, value }))
                  : undefined,
                damageRerolls: ownsPendingCaster
                  ? encounter.pending.targets.flatMap((target, targetIndex) => {
                      let offset = 0
                      return (target.damageOverride ?? encounter.pending!.damage).flatMap(
                        (part) => {
                          const records = (part.roll.rerolls ?? []).map((reroll) => ({
                            ...reroll,
                            index: offset + reroll.index,
                            targetIndex,
                          }))
                          offset += part.roll.dice.length
                          return records
                        },
                      )
                    })
                  : undefined,
                tavernRerollAvailable: ownsPendingCaster
                  ? !!pendingCharacter &&
                    encounter.pending.attack?.id === 'unarmed' &&
                    hasOrigin(pendingCharacter, cat, 'tavern-brawler')
                  : undefined,
                name: gm || pendingPublic ? encounter.pending.name : '未公开行动',
                kind: encounter.pending.kind,
                actorId: gm || pendingPublic ? encounter.pending.actorId : '',
                targets: encounter.pending.targets.flatMap((t, index) => {
                  const actor = encounter.actors.find((a) => a.id === t.id),
                    publicTarget = scene?.tokens.some((x) => !x.hidden && x.actorId === t.id),
                    ownTarget = !!actor && controls(actor),
                    rollingId =
                      encounter.pending!.kind === 'attack' ? encounter.pending!.actorId : t.id,
                    rollingActor = encounter.actors.find((a) => a.id === rollingId),
                    ownRoll = !!rollingActor && controls(rollingActor)
                  return gm || publicTarget
                    ? [
                        {
                          id: t.id,
                          index,
                          defenseChoices:
                            (gm || ownTarget) && actor
                              ? defenseOptions(
                                  actor,
                                  encounter.pending!,
                                  t,
                                  room.world.characters,
                                  cat,
                                )
                              : [],
                          defense: t.defense ? clone(t.defense) : undefined,
                          shieldAvailable:
                            (gm || ownTarget) &&
                            ((encounter.pending!.kind === 'attack' && t.hit) ||
                              encounter.pending!.spellId === 'magic-missile'),
                          roll:
                            gm || ownRoll
                              ? t.roll
                                ? clone({ ...t.roll, reasons: gm ? t.roll.reasons : [] })
                                : null
                              : null,
                          failed:
                            (gm || ownRoll) && t.roll
                              ? encounter.pending!.kind === 'attack'
                                ? !t.hit
                                : t.hit
                              : null,
                        },
                      ]
                    : []
                }),
              }
            : null,
          actors: encounter.actors
            .filter(
              (a) =>
                gm ||
                scene?.tokens.some(
                  (t) =>
                    !t.hidden && (!scene.fog?.enabled || permittedToken(t)) &&
                    (t.actorId === a.id || (!!a.characterId && t.characterId === a.characterId)),
                ),
            )
            .map((a) => ({
              portrait: actorPortrait(room.world, a),
              statuses: (()=>{const t=scene?.tokens.find(t=>t.actorId===a.id||!!a.characterId&&t.characterId===a.characterId);return t?tokenStatuses(room,t,controls(a),gm,cat):[]})(),
              id: a.id,
              characterId: a.characterId,
              companion:
                a.companion && controls(a)
                  ? {
                      ownerId: a.companion.ownerId,
                      source: a.companion.source,
                      form: a.companion.form,
                      spellId: a.companion.spellId,
                      hp: combatStats(a, room.world.characters, cat).hp,
                      maxHp: combatStats(a, room.world.characters, cat).maxHp,
                      dismissed: a.companion.dismissed,
                    }
                  : undefined,
              name: combatStats(a, room.world.characters, cat).name,
              side: a.side,
              initiative: a.initiative,
              movement: a.turn.movement,
              turn: controls(a)
                ? clone({
                    ...a.turn,
                    lastAttack:
                      !gm &&
                      a.turn.lastAttack &&
                      !scene?.tokens.some(
                        (t) => !t.hidden && t.actorId === a.turn.lastAttack!.targetId,
                      )
                        ? undefined
                        : a.turn.lastAttack,
                  })
                : null,
              slotSpent: controls(a) && encounter.slotSpent.includes(a.id),
              attacks: controls(a) ? attackOptions(a, room.world.characters, cat) : [],
            })),
        }
      : null,
    events: clone(room.events.filter((e) => gm || !e.sessionId || e.sessionId === member.id)),
    peerSessions: (room.peerSessions??[]).filter(s=>s.branchId===adventure(room).broadcastLog?.branchId&&s.sceneId===activeScene(room)?.id&&(gm||s.status==='active'||s.status==='paused')).map(({transcript,...s})=>s),
    gmReview: projectReview(room, member),
    practicalReview: projectPractical(room, member),
    practicalWindows: practicalCombatView(room,member),
    practicalInitiative:practicalInitiativeView(room,member),
    practicalSpellInputs:practicalSpellInputView(room,member),
    practicalM1:practicalM1Choices(room,member),
    practicalEffectInputs:practicalEffectInputView(room,member),
    intents: clone(
      room.intents
        .filter((i) => gm || i.sessionId === member.id)
        .map((i) => {
          if (gm) return i
          const { adjudication: _gmConditions, ...publicIntent } = i
          return publicIntent
        }),
    ),
    quests: visibleQuests(adventure(room), member.characterIds, gm),
    battleRequests: clone(
      (adventure(room).battles?.requests ?? [])
        .filter((r) => r.source === 'player' && r.sourceId === member.id)
        .map((r) => ({
          id: r.id,
          sceneId: r.sceneId,
          reason: r.reason,
          status: r.status,
          reviewReason: r.reviewReason,
          opening: r.opening,
          openingStatus: r.openingStatus,
          encounterId: r.encounterId,
          characterId: r.characterId,
        })),
    ),
    ...(gm
      ? {
          world: clone(live ? liveWorld(room.world) : room.world),
          historyAvailable: live,
          canUndo: adventure(room).log.some((l) => !!l.before && !l.undone),
        }
      : {}),
    assets: assets
      .filter((a) => permittedAssets.has(a.id))
      .map(({ blob: _blob, preview, ...a }) => ({
        ...a,
        ...(preview
          ? { preview: { mime: preview.mime, width: preview.width, height: preview.height } }
          : {}),
      })),
  }
  if (projected.scene) projected.scene.corpses = projectCorpses(room, member)
  applyFogProjection(room,member,projected,fogAccess)
  projected.trade=projectTrades(room,member,projected.ai.npcs.map(n=>n.id))
  return projected
}
import { npcAbsent } from '../core/scene-arrivals'

export function projectRoom(...args: Parameters<typeof projectRoomUncached>): RoomView { return withEvaluation(() => projectRoomUncached(...args)) }
