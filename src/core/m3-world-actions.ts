import {magicCrossing,windMovementCost} from './scene-magic'
import {tokenPoint} from './scene-effects'
import {prepareTerrainRoute,terrainMultiplier,terrainEntityId,pendingTerrain} from './scene-terrain'
import {reconcileSceneSegment} from './scene-effect-route'
import {m3GroundAt} from './m3-ground'
import {rememberM3Sight} from './m3-sight-memory'
import {validateM3Route} from './m3-route'
import {endM3Blink,reconcileM3World} from './m3-world-lifecycle'
import {reconcileWorld} from './combat-lifecycle'
import {m3RoundKey,settleM3Event} from './m3-space-events'
import type { MapWorld, Adventure, MapToken, MapScene } from './map-types'
import type { Catalogue } from './engine'
import type { M3Action, M3Entity } from '../persistence/m3-world-schema'
import { clone } from './engine'
import { m1Entity } from './m1-utility'
import { m3WorldCast, m3State, m3Landing, sourceHours } from './m3-world-cast'
import { spatialState, spatialDistance, spatialCapabilities } from './m3-spatial'
import { applyCombat } from './combat'
import { runtimeDerived, rollDie } from './runtime'
import { combatStats, freshTurn as importFreshTurn } from './combat-rules'
import { explorationMember, explorationSpend, assertExplorationReady } from './exploration'
import { distance, directPath } from './map'
import { movementWalls } from './map-spatial'
import { m3SpellEffect, validateM3Choice } from './m3-spells'

export function m3ActionCost(world:MapWorld,a:Adventure,entityId:string,cost:'action'|'bonus'|'reaction',cat:Catalogue,magic=false){
  const entity=m1Entity(world,a,entityId)
  if(!entity?.token||entity.dead||entity.state.hp<=0)throw Error('操作人物不再有效')
  if(a.summons?.events?.some(event=>event.status==='pending'&&[entity.id,entity.token!.id,entity.token!.actorId,entity.token!.characterId,entity.token!.npcId].includes(event.targetId??event.instanceId)))throw Error('请先处理当前人物待结算的召唤物后果')
  const stats=entity.c?runtimeDerived(entity.c,cat):combatStats(entity.actor??{id:entity.id,characterId:null,npc:entity.body!,side:'neutral',initiative:null,surprised:false,turn:importFreshTurn()},world.characters,cat)
  if(cost!=='reaction'&&entity.state.effects?.some(f=>f.key==='stinking-cloud-turn'))throw Error('臭云术中毒：不能使用动作或附赠动作')
  if(stats.conditions.includes('incapacitated'))throw Error('失能者不能使用此动作／反应')
  const scene=a.scenes.find(s=>s.tokens.includes(entity.token!))!,battle=world.encounters.find(e=>e.id===scene.encounterId&&e.phase==='active')
  if(battle){
    const actor=battle.actors.find(t=>t.id===entity.actor?.id||!!entity.c&&t.characterId===entity.c.id)
    if(!actor)throw Error('请先将人物加入当前战斗')
    if(cost==='reaction'){
      if(!actor.turn.reaction||combatStats(actor,world.characters,cat).conditions.includes('incapacitated'))throw Error('没有可用反应')
      actor.turn.reaction=false
    }else{
      const result=applyCombat(battle,world.characters,cat,{type:'effect-action-cost',actorId:actor.id,cost,magic})
      world.encounters[world.encounters.indexOf(battle)]=result.encounter;world.characters=result.characters
    }
  }else{
    const member=explorationMember(a,entity.token.id)
    if(member){assertExplorationReady(world,a,member,cat);explorationSpend(member,cost,magic)}
    else if(cost==='reaction')throw Error('反应需要战斗或探索回合中的明确预算')
  }
}
const actorForTerrain=(entity:NonNullable<ReturnType<typeof m1Entity>>)=>entity.actor??{id:entity.id,characterId:entity.c?.id??null,npc:entity.body??null,side:'neutral' as const,initiative:null,surprised:false,turn:importFreshTurn()}
function capabilities(world:MapWorld,a:Adventure,token:MapToken,cat:Catalogue){
  const entity=m1Entity(world,a,token.characterId??token.npcId??token.actorId??token.id)
  if(!entity)throw Error('缺少实际人物卡')
  if(entity.c)return runtimeDerived(entity.c,cat).spatialCapabilities
  if(entity.actor)return combatStats(entity.actor,world.characters,cat).spatialCapabilities
  return combatStats({id:entity.id,characterId:null,npc:entity.body!,side:'neutral',initiative:null,surprised:false,turn:importFreshTurn()},world.characters,cat).spatialCapabilities
}
function floor(a:Adventure,s:MapScene){return a.m3?.environments.find(e=>e.sceneId===s.id)?.floorHeight??0}
export function m3Airspace(a:Adventure,s:MapScene,height:number){
  const fact=a.m3?.environments.find(e=>e.sceneId===s.id)
  if(height<floor(a,s))throw Error('目的高度低于已登记地面，请先登记实际地下／液体空间')
  if(height>floor(a,s)&&!fact)throw Error('高度环境尚未确认，请GM登记室内天花板或室外开放天空')
  if(fact&&!fact.openSky&&height+(s.grid.feet)>fact.ceilingHeight!)throw Error('人物不能穿过实际天花板')
}
export function m3Queue(a:Adventure,s:MapScene,t:MapToken,type:'fall'|'return'|'eject'|'descend'|'stone-damage',castId?:string,note=''){
  const state=m3State(a),id=t.characterId??t.npcId??t.actorId??t.id
  if(state.events.some(e=>e.entityId===id&&e.type===type&&e.status==='pending'))return
  if(state.events.length>=2000)throw Error('空间后果记录达到上限，请先归档')
  state.events.push({id:crypto.randomUUID(),type,entityId:id,sceneId:s.id,castId,from:{x:t.x,y:t.y,height:spatialState(t.spatial).height},layer:spatialState(t.spatial).layer,anchorId:t.spatial?.anchorId,status:'pending',note})
}
function moveBudget(world:MapWorld,a:Adventure,s:MapScene,t:MapToken,cost:number,mode:'walk'|'climb'|'swim'|'fly'|'levitate',cat:Catalogue){
  const battle=world.encounters.find(e=>e.id===s.encounterId&&e.phase==='active'),cap=capabilities(world,a,t,cat)
  if(battle){
    const actor=battle.actors.find(x=>x.id===t.actorId||!!t.characterId&&x.characterId===t.characterId)
    if(!actor)throw Error('请先加入本场景战斗')
    const result=applyCombat(battle,world.characters,cat,{type:'move',actorId:actor.id,distance:cost,difficult:false,stand:false,note:'实际2.5D路线',mode})
    world.encounters[world.encounters.indexOf(battle)]=result.encounter;world.characters=result.characters
  }else{
    const member=explorationMember(a,t.id)
    if(member){assertExplorationReady(world,a,member,cat,false,true);if(member.movement+cost>cap[mode]+member.dash)throw Error('当前移动方式剩余移动不足；切换方式不刷新预算');member.movement+=cost}
  }
}
function inFootprint(s:MapScene,p:{x:number;y:number},e:M3Entity){return p.x>=e.x&&p.y>=e.y&&(p.x-e.x)*s.grid.feet<=Math.max(e.width,s.grid.feet)&&(p.y-e.y)*s.grid.feet<=Math.max(e.depth,s.grid.feet)}
function onSurface(s:MapScene,from:MapToken,to:{x:number;y:number;height:number},e:M3Entity){return e.sceneId===s.id&&e.enabled&&inFootprint(s,from,e)&&inFootprint(s,to,e)&&spatialState(from.spatial).height>=e.height&&to.height>=e.height&&Math.max(spatialState(from.spatial).height,to.height)<=e.height+e.heightFeet}
function near(s:MapScene,t:MapToken,e:M3Entity){return e.sceneId===s.id&&e.enabled&&distance(s,t,{...e,spatial:{height:e.height,layer:'material'}})<=5}
function setPosition(t:MapToken,to:{x:number;y:number;height:number},layer=spatialState(t.spatial).layer,anchorId?:string){
  t.x=to.x;t.y=to.y;t.spatial={height:to.height,layer,...(anchorId?{anchorId}:{})}
}
export function applyM3Action(input:MapWorld,adventureId:string,action:M3Action,cat:Catalogue,dice:(n:number)=>number=rollDie){
  const world=clone(input),a=world.adventures.find(a=>a.id===adventureId)
  if(!a)throw Error('冒险不存在')
  const state=m3State(a),scene=a.scenes.find(s=>s.id===a.activeSceneId)
  rememberM3Sight(world,cat)
  if(scene&&'to'in action&&action.to){
    const id='entityId'in action?action.entityId:'diskId'in action?action.diskId:undefined,object=state.entities.find(o=>o.id===id)
    if(object){magicCrossing(world,a,scene,{x:object.x+.5,y:object.y+.5,height:object.height},{...action.to,x:action.to.x+.5,y:action.to.y+.5},object.id,{object:true});for(const id of object.loadIds??[]){const t=m1Entity(world,a,id)?.token;if(t)magicCrossing(world,a,scene,tokenPoint(t),{...action.to,x:action.to.x+t.span/2,y:action.to.y+t.span/2},id)}}
  }
  let detail=''
  if(action.operation==='cast')detail=m3WorldCast(world,a,action,cat,dice)
  else if(action.operation==='environment'){
    if(!a.scenes.some(s=>s.id===action.facts.sceneId))throw Error('环境场景不存在')
    state.environments=state.environments.filter(e=>e.sceneId!==action.facts.sceneId).concat(clone(action.facts));detail='GM登记实际地面、天空／天花板事实'
  }else if(action.operation==='entity'){
    const e=action.entity,s=a.scenes.find(s=>s.id===e.sceneId)
    if(!s||e.x>=s.grid.columns||e.y>=s.grid.rows)throw Error('环境实体位置无效')
    if(['disk','portal'].includes(e.kind)||e.castId||e.sourceId||e.effects?.length)throw Error('施法产物及魔法效果必须由实际施法生成，不能在环境登记时捏造')
    const existing=state.entities.find(x=>x.id===e.id)
    if(existing?.castId||existing?.effects?.length)throw Error('不能以环境编辑覆盖生效中的法术实例')
    if(e.inventoryInstanceId&&!world.characters.find(c=>c.id===e.boundCharacterId)?.inventory.some(r=>r.instanceId===e.inventoryInstanceId&&r.quantity===1))throw Error('物件必须关联实际单件库存，不能复制物品')
    if(!existing&&state.entities.length>=1000)throw Error('环境实体达到上限')
    state.entities=state.entities.filter(x=>x.id!==e.id).concat(clone(e));detail='GM登记实际物件／表面／液体／石体'
  }else if(action.operation==='move'){
    if(!scene)throw Error('没有当前场景')
    const entity=m1Entity(world,a,action.entityId),t=entity?.token
    if(!t||!scene.tokens.includes(t)||entity!.dead||entity!.state.hp<=0)throw Error('请选择当前场景存活人物')
    if(state.events.some(e=>e.entityId===entity!.id&&e.status==='pending'))throw Error('请先处理该人物已保存的空间后果')
    if(['stone','pocket'].includes(spatialState(t.spatial).layer))throw Error('此空间须通过对应入口进出')
    const cap=capabilities(world,a,t,cat),gas=entity!.state.effects?.some(f=>f.key==='gaseous-form'),support=state.entities.find(e=>e.id===action.supportId)
    const fallback=(action.mode==='climb'||action.mode==='swim')&&cap[action.mode]===0&&(cap.walk>0||action.mode==='climb'&&cap.levitate>0)
    if(cap[action.mode]<=0&&!fallback)throw Error('当前没有该移动方式的有效速度')
    if(action.mode==='walk'&&action.to.height!==m3GroundAt(a,scene,action.to)&&!(cap.waterWalk&&support?.kind==='liquid'&&near(scene,{...t,...action.to},support)&&action.to.height===support.height))throw Error('步行须处于实际地面或水面行走支持的液体面')
    if(action.mode==='climb'&&(!support||!onSurface(scene,t,action.to,support)||!['surface','rope'].includes(support.kind)||support.kind==='rope'&&state.entities.some(e=>e.kind==='portal'&&e.anchorId===support.id&&e.enabled&&e.retracted)||action.to.height<support.height||action.to.height>support.height+support.heightFeet))throw Error('攀爬需要实际连续可攀附表面；蛛行术不提供无依托飞行')
    if(action.mode==='swim'&&(!support||support.kind!=='liquid'||!inFootprint(scene,action.to,support)||action.to.height>support.height||action.to.height<support.height-support.depth))throw Error('游泳必须在实际液体体积内')
    if(gas&&state.entities.some(e=>e.kind==='liquid'&&e.enabled&&e.sceneId===scene.id&&inFootprint(scene,action.to,e)&&action.to.height<e.height&&action.to.height>e.height-e.depth))throw Error('气化形体视液体为固体，不能飞入液体')
    if(action.mode!=='swim')m3Airspace(a,scene,action.to.height);m3Landing(scene,t,action.to,undefined,undefined,gas)
    const compression=entity!.body?.templateMetadata?.abilities.some(a=>a.id==='compression')
    const blockers=movementWalls(scene,t,t,action.to).filter(w=>!(gas&&w.gapFeet&&w.gapFeet>0||compression&&w.gapFeet!==undefined&&w.gapFeet>=1/12))
    if(blockers.some(w=>w.heightFeet===undefined))throw Error('路线经过高度未知的墙体，请GM先核实墙高，不能默认越墙')
    if(blockers.some(w=>Math.min(spatialState(t.spatial).height,action.to.height)<floor(a,scene)+w.heightFeet!))throw Error('实际移动路线被墙门阻挡')
    validateM3Route(world,a,scene,t,action.to,entity!.state.effects??[],cat,action.reactionsConfirmed,action.mode)
    const origin={x:t.x,y:t.y,height:t.spatial?.height??0},steps=Math.max(1,Math.ceil(Math.max(Math.abs(action.to.x-t.x),Math.abs(action.to.y-t.y),Math.abs(action.to.height-origin.height)/scene.grid.feet)))
    const requested=Array.from({length:steps},(_,i)=>({x:Math.round(origin.x+(action.to.x-origin.x)*(i+1)/steps),y:Math.round(origin.y+(action.to.y-origin.y)*(i+1)/steps),height:origin.height+(action.to.height-origin.height)*(i+1)/steps}))
    const route=prepareTerrainRoute(world,a,scene,t,requested,action.mode,!!action.reactionsConfirmed,action.supportId)
    const destination=route.at(-1)!
    let terrainCost=0,previous=origin
    for(const p of route){terrainCost+=spatialDistance(previous,{...p,spatial:{height:p.height,layer:spatialState(t.spatial).layer}},scene.grid.feet)*Math.max(terrainMultiplier(world,a,scene,{...t,...p,spatial:{...spatialState(t.spatial),height:p.height}}),scene.regions.some(r=>r.tags.includes('difficult')&&r.cells.includes(`${Math.floor(p.x)},${Math.floor(p.y)}`))?2:1)+spatialDistance(previous,{...p,spatial:{height:p.height,layer:spatialState(t.spatial).layer}},scene.grid.feet)*windMovementCost(world,a,scene,t,{...previous,x:previous.x+t.span/2,y:previous.y+t.span/2,height:'height'in previous?previous.height as number:t.spatial?.height??0},{...p,x:p.x+t.span/2,y:p.y+t.span/2});previous=p}
    action.to=destination
    const cost=spatialDistance(t,{...action.to,spatial:{height:action.to.height,layer:spatialState(t.spatial).layer}},scene.grid.feet)
    moveBudget(world,a,scene,t,terrainCost+cost*((fallback?1:0)+(combatStats(actorForTerrain(entity!),world.characters,cat).conditions.includes('prone')?1:0)),fallback?(cap.levitate>0?'levitate':'walk'):action.mode,cat)
    reconcileSceneSegment(world,a,t,action.to)
    setPosition(t,action.to);t.spatial!.supportId=action.mode==='climb'||action.mode==='swim'?action.supportId:undefined
    detail=`人物以${action.mode}移动${cost}尺；共用已消耗移动预算`
  }else if(action.operation==='effect-action'){
    if(!scene)throw Error('没有当前场景')
    const object=state.entities.find(e=>e.id===action.entityId&&e.enabled&&e.sceneId===scene.id),objectEffect=object?.effects?.find(f=>f.id===action.effectId)
    if(object&&objectEffect){
      if(action.action!=='levitate'||objectEffect.key!=='levitate'||!action.to)throw Error('该物件没有可调节的浮空效果')
      const source=m1Entity(world,a,objectEffect.sourceId)?.token
      if(!source||!scene.tokens.includes(source)||distance(scene,source,{...object,spatial:{height:object.height,layer:'material'}})>60)throw Error('物件必须在浮空术来源60尺内')
      if(action.to.x!==object.x||action.to.y!==object.y||Math.abs(action.to.height-object.height)>20)throw Error('物件浮空仅可升降至多20尺')
      m3Airspace(a,scene,action.to.height);m3ActionCost(world,a,objectEffect.sourceId,'action',cat,true);object.height=action.to.height
      reconcileWorld(world);reconcileM3World(world,cat,dice);return {world,detail:'消耗来源魔法动作调节实际物件高度'}
    }
    const entity=m1Entity(world,a,action.entityId),t=entity?.token,f=entity?.state.effects?.find(e=>e.id===action.effectId)
    if(!entity||!t||!f)throw Error('来源型效果已失效')
    if(action.action==='alter-option'){
      if(f.key!=='alter-self')throw Error('只能切换当前变身术选项')
      validateM3Choice('alter-self',action.choice);m3ActionCost(world,a,entity.id,'action',cat,true)
      const live=m1Entity(world,a,entity.id)!,effect=live.state.effects!.find(e=>e.id===f.id)!
      effect.m3=m3SpellEffect('alter-self',action.choice)!.m3;detail='变身术选项已用实际魔法动作切换，没有恢复资源'
    }else if(action.action==='end-form'){
      if(f.key!=='gaseous-form')throw Error('此操作只结束自身气化形体')
      m3ActionCost(world,a,entity.id,'action',cat,true)
      m1Entity(world,a,entity.id)!.state.effects= m1Entity(world,a,entity.id)!.state.effects!.filter(e=>e.id!==f.id)
      detail='气化形体已结束；若失去空中支持，另行处理实际坠落'
    }else if(action.action==='levitate'){
      if(f.key!=='levitate'||!action.to)throw Error('请选择浮空术实际高度')
      const source=m1Entity(world,a,f.sourceId),st=source?.token
      const turn=m3RoundKey(world,a,scene)+':levitate:'+f.sourceId
      if(f.m3?.lastTurn===turn)throw Error('本回合浮空高度已经调节，须推进下一回合；不能反复购买20尺升降')
      if(!st||!scene.tokens.includes(st)||distance(scene,st,t)>60)throw Error('浮空术调节要求来源在60尺内')
      if(action.to.x!==t.x||action.to.y!==t.y||Math.abs(action.to.height-spatialState(t.spatial).height)>20)throw Error('浮空术调节只可升降至多20尺，不能任意水平飞行')
      m3Airspace(a,scene,action.to.height);m3Landing(scene,t,action.to)
      if(source!.id!==entity.id)m3ActionCost(world,a,source!.id,'action',cat,true)
      else{
        const member=explorationMember(a,t.id),battle=world.encounters.find(e=>e.id===scene.encounterId&&e.phase==='active'),actor=battle?.actors.find(x=>x.id===t.actorId||x.characterId===t.characterId)
        if(battle&&battle.actors[battle.current]?.id!==actor?.id)throw Error('须在浮空术来源自身回合调节高度')
        if(member?.ended)throw Error('本轮探索回合已结束')
        moveBudget(world,a,scene,t,Math.abs(action.to.height-spatialState(t.spatial).height),'levitate',cat)
      }
      const live=m1Entity(world,a,entity.id)!.state.effects!.find(e=>e.id===f.id)!;live.m3={...live.m3,lastTurn:turn}
      setPosition(t,action.to);detail='浮空术实际高度已调节；不会获得水平飞行'
    }else if(action.action==='water-cross'){
      if(f.key!=='water-walk'||!action.to)throw Error('需要水面行走和明确液面位置')
      const liquid=state.entities.find(e=>e.kind==='liquid'&&e.enabled&&e.sceneId===scene.id&&inFootprint(scene,t,e))
      if(!liquid||action.to.x!==t.x||action.to.y!==t.y||action.to.height>liquid.height||action.to.height<liquid.height-liquid.depth)throw Error('须在当前实际液体的水面与内部之间转换')
      m3ActionCost(world,a,entity.id,'bonus',cat);setPosition(t,action.to);detail='以附赠动作穿过液面；没有获得游泳速度或热伤害免疫'
    }else{
      if(f.key!=='meld-into-stone'||!action.to||spatialState(t.spatial).layer!=='stone')throw Error('当前没有可退出的融身入石状态')
      if(action.to.x!==f.m3?.origin?.x||action.to.y!==f.m3.origin.y)throw Error('融身入石必须从原进入点离开')
      m3Landing(scene,t,action.to,'material')
      const cap=capabilities(world,a,t,cat);if(cap.walk<5)throw Error('离开石体需要5尺实际移动')
      moveBudget(world,a,scene,t,5,'walk',cat);setPosition(t,action.to,'material',undefined)
      m1Entity(world,a,entity.id)!.state.effects=m1Entity(world,a,entity.id)!.state.effects!.filter(e=>e.id!==f.id);detail='消耗5尺移动从原入口退出石体'
    }
  }else if(action.operation==='turn-phase'){
    const entity=m1Entity(world,a,action.entityId),t=entity?.token
    if(!entity||!t||!scene?.tokens.includes(t)||world.encounters.some(e=>e.phase==='active')||a.exploration?.status==='active')throw Error('仅在自由探索中由GM明确处理个人时序；战斗／探索轮使用原结束回合')
    const blink=entity.state.effects?.find(f=>f.key==='blink');if(!blink)throw Error('此人物没有有效闪现术')
    const key='free:'+blink.clockSourceId+':'+Math.floor(sourceHours(world,blink.clockSourceId!)*600+1e-7)
    if(action.phase==='end'){if(blink.m3?.lastTurn===key)throw Error('本次明确时序已处理，请推进6秒冒险时间后再结束下一回合');endM3Blink(world,a,scene,t,key,dice)}
    else if(t.spatial?.layer==='ethereal')m3Queue(a,scene,t,'return',blink.castId,'GM明确开始下一回合，闪现回返落点待选')
    else throw Error('当前不在需要回返的闪现以太状态')
    detail='GM明确处理自由探索时序；骰值与回返位置持久保存'
  }else if(action.operation==='initial-config'){
    const s=a.scenes.find(s=>s.id===action.sceneId),facts=state.environments.find(f=>f.sceneId===action.sceneId)
    if(!s||!facts)throw Error('请先核实实际场景环境')
    const objects=state.entities.filter(e=>e.sceneId===s.id&&!e.castId&&!e.inventoryInstanceId&&!e.boundCharacterId&&!e.effects?.length&&['object','rope','stone','surface','liquid'].includes(e.kind)).map(e=>({id:e.id,name:e.name,kind:e.kind as 'object'|'rope'|'stone'|'surface'|'liquid',x:e.x,y:e.y,height:e.height,width:e.width,heightFeet:e.heightFeet,depth:e.depth,weight:e.weight,supportsStanding:e.supportsStanding,loose:e.loose,enabled:e.enabled,hidden:e.hidden}))
    s.spatialSetup={floorHeight:facts.floorHeight,light:facts.light,openSky:facts.openSky,ceilingHeight:facts.ceilingHeight,objects}
    for(const t of s.tokens){if(spatialState(t.spatial).layer!=='material')continue;t.initialSpatialHeight=spatialState(t.spatial).height;t.initialSupportId=objects.some(o=>o.id===t.spatial?.supportId)?t.spatial?.supportId:undefined}
    detail='GM明确保存初始空间配置；排除所有魔法产物、库存身份、法术效果及运行历史'
  }else if(action.operation==='material'){
    const entity=m1Entity(world,a,action.ownerId)
    if(!entity?.n||!entity.n.consumables?.some(c=>c.id===action.instanceId&&c.quantity-(entity.n!.consumablesUsed?.[c.id]??0)>0))throw Error('NPC钻石尘必须关联自身尚有余量的真实物品条目；角色材料沿用原材料核验')
    state.materials??=[];if(state.materials.length>=1000)throw Error('材料登记达到上限')
    state.materials=state.materials.filter(m=>m.ownerId!==entity.id||m.instanceId!==action.instanceId).concat({ownerId:entity.id,instanceId:action.instanceId,valueGP:action.valueGP});detail='GM核验实际NPC物品为至少25GP钻石尘；施法时消耗一次'
  }else if(action.operation==='portal-control'){
    const p=state.entities.find(e=>e.id===action.portalId&&e.kind==='portal'&&e.enabled)
    if(!p)throw Error('入口已失效')
    if(action.retracted&&!(p.targetIds?.length))throw Error('须有生物在空间内才能把实际绳索收进空间')
    if(action.knownTo.some(id=>!m1Entity(world,a,id)))throw Error('告知对象必须是实际人物')
    p.retracted=action.retracted;p.knownTo=[...new Set(action.knownTo)];detail='GM核实绳索收放与已告知入口位置的人物；隐形入口没有向所有人公开'
  }else if(action.operation==='portal'){
    const portal=state.entities.find(e=>e.id===action.portalId&&e.kind==='portal'&&e.enabled),entity=m1Entity(world,a,action.entityId),t=entity?.token
    const s=portal&&a.scenes.find(s=>s.id===portal.sceneId)
    const object=state.entities.find(e=>e.id===action.entityId&&e.kind==='object'&&e.enabled)
    if(portal&&s&&object){
      if(action.enter){if(object.sceneId!==s.id||object.layer&&object.layer!=='material'||distance(s,{...object,spatial:{height:object.height,layer:'material'}},{...portal,spatial:{height:portal.height,layer:'material'}})>5||portal.retracted)throw Error('实际物件须位于可达的绳索上端入口');object.layer='pocket';object.anchorId=portal.id;portal.loadIds=[...new Set([...(portal.loadIds??[]),object.id])];object.x=portal.x;object.y=portal.y;object.height=portal.height}
      else{if(object.layer!=='pocket'||object.anchorId!==portal.id)throw Error('实际物件不在此魔绳空间');object.layer='material';delete object.anchorId;portal.loadIds=portal.loadIds?.filter(id=>id!==object.id);m3State(a).events.push({id:crypto.randomUUID(),type:'fall',entityId:object.id,sceneId:s.id,from:{x:portal.x,y:portal.y,height:portal.height},layer:'material',status:'pending',note:'实际物件从魔绳入口离开，核实落地位置'})}
      reconcileWorld(world);reconcileM3World(world,cat,dice);return {world,detail:'实际物件进出魔绳空间，未复制库存或创造物件'}
    }
    if(!portal||!s||!t||!s.tokens.includes(t))throw Error('实际魔绳入口或人物已变化')
    if(action.enter){
      const cap=capabilities(world,a,t,cat)
      if(!['tiny','small','medium'].includes(cap.size))throw Error('魔绳空间只容纳中型或更小生物')
      if((portal.targetIds?.length??0)>=8)throw Error('魔绳空间已达8个生物')
      if(spatialState(t.spatial).layer!=='material'||distance(s,t,{...portal,spatial:{height:portal.height,layer:'material'}})>5)throw Error('须实际攀爬至绳索上端入口')
      const rope=state.entities.find(e=>e.id===portal.anchorId&&e.enabled)
      if(!rope||portal.retracted)throw Error('绳索已收起或失效')
      // Entry follows the already paid climb to the rope's upper end; it costs no extra action.
      portal.targetIds=[...new Set([...(portal.targetIds??[]),entity!.id])]
      setPosition(t,{x:portal.x,y:portal.y,height:portal.height},'pocket',portal.id)
    }else{
      if(t.spatial?.layer!=='pocket'||t.spatial.anchorId!==portal.id)throw Error('人物不在该魔绳空间')
      const to={x:portal.x,y:portal.y,height:portal.height};m3Landing(s,t,to,'material');setPosition(t,to,'material',undefined);if(!portal.retracted)t.spatial!.supportId=portal.anchorId
      portal.targetIds=portal.targetIds?.filter(id=>id!==entity!.id)
    }
    detail=action.enter?'进入实际魔绳空间；外部效果不能穿过入口':'离开魔绳空间；空中位置须有绳索支持或处理坠落'
  }else if(action.operation==='disk'){
    const disk=state.entities.find(e=>e.id===action.diskId&&e.kind==='disk'&&e.enabled),s=disk&&a.scenes.find(s=>s.id===disk.sceneId)
    if(!disk||!s)throw Error('浮碟已失效')
    if(action.action==='follow'){
      const source=m1Entity(world,a,disk.sourceId!)?.token
      if(!source||!s.tokens.includes(source)){disk.enabled=false;detail='浮碟来源不在同场景，结束效果并卸下实际载荷'}
      else if(distance(s,source,disk)>100){disk.enabled=false;detail='浮碟距来源超过100尺，结束并卸下实际载荷'}
      else{
        if(distance(s,source,disk)<=20)throw Error('距来源20尺内浮碟保持静止，不能作为自主飞行坐骑')
        if(!action.to||action.to.height!==m3GroundAt(a,s,action.to)+3||distance(s,source,{...action.to,spatial:{height:action.to.height,layer:'material'}})>20)throw Error('跟随落点必须在来源20尺内')
        const path=directPath(disk,action.to);let previous=m3GroundAt(a,s,disk);for(const p of path){const next=m3GroundAt(a,s,p);if(Math.abs(next-previous)>=10)throw Error('浮碟跟随路线经过10尺或以上高差');previous=next}
        if(Math.abs(action.to.height-disk.height)>=10||movementWalls(s,{...disk,span:1,characterId:null,actorId:null,color:'#335566',facing:0},disk,action.to).length)throw Error('浮碟不能跨越10尺或以上高差、墙门或深坑')
        disk.x=action.to.x;disk.y=action.to.y;disk.height=action.to.height
        for(const id of disk.loadIds??[]){const t=m1Entity(world,a,id)?.token;if(t)setPosition(t,{x:disk.x,y:disk.y,height:disk.height})}
        detail='浮碟按实际地面路线跟随来源，载荷没有复制'
      }
    }else{
      if(!action.entityId)throw Error('请选择实际载荷')
      const entity=m1Entity(world,a,action.entityId),object=state.entities.find(e=>e.id===action.entityId&&e.kind==='object')
      if(!entity&&!object)throw Error('载荷必须引用实际生物或物件')
      if(action.action==='load'){
        if(entity?.id===disk.sourceId)throw Error('来源不能借自己浮碟的跟随规则实现自主骑乘')
        if(distance(s,disk,entity?.token??object!)>5)throw Error('载荷必须在浮碟附近')
        if((disk.loadIds??[]).includes(action.entityId)||state.entities.some(e=>e.id!==disk.id&&e.loadIds?.includes(action.entityId!)))throw Error('该实际载荷已在载具上，不能重复装载')
        const weight=(id:string)=>{const obj=state.entities.find(e=>e.id===id),body=m1Entity(world,a,id);if(obj)return obj.weight;const facts=state.entities.find(e=>e.boundCharacterId===body?.id);if(!facts)throw Error('生物及装备总重量未知，请GM先登记重量');return facts.weight}
        if([...(disk.loadIds??[]),action.entityId].reduce((sum,id)=>sum+weight(id),0)>500){disk.enabled=false;detail='实际总载荷超过500磅，浮碟结束，未复制或丢弃载荷'}
        else{disk.loadIds=[...(disk.loadIds??[]),action.entityId];if(entity?.token)setPosition(entity.token,{x:disk.x,y:disk.y,height:disk.height});if(object){object.x=disk.x;object.y=disk.y;object.height=disk.height};detail='实际载荷已装载'}
      }else{disk.loadIds=disk.loadIds?.filter(id=>id!==action.entityId);detail='实际载荷已卸下，当前位置及坠落后果单独处理'}
    }
  }else if(action.operation==='event'){
    detail=settleM3Event(world,a,action,cat,dice)
  }else{
    const cast=state.casts.find(c=>c.castId===action.castId&&c.settled),source=cast&&m1Entity(world,a,cast.action.casterId)
    if(!cast||!source||cast.spellId!=='arcanist-s-magic-aura')throw Error('须选择真实已完成的魔法灵光施法记录')
    if(action.day!==Math.floor(cast.castHour/24))throw Error('冒险日须与该次实际施法的游戏时钟一致，请先明确推进冒险时间')
    const targetId=cast.action.objectId??cast.action.targets[0]!
    let days=state.auraDays.find(d=>d.sourceId===source.id&&d.targetId===targetId)
    if(!days){days={sourceId:source.id,targetId,days:[],castIds:[]};state.auraDays.push(days)}
    if(days.days.length>=30)throw Error('连续30日条件已经满足，不重复累计')
    if(days.castIds.includes(cast.castId))throw Error('同次真实施法不能重复登记冒险日')
    if(days.days.includes(action.day))throw Error('同一冒险日只计一次')
    if(days.days.length&&action.day!==days.days.at(-1)!+1){days.days=[];days.castIds=[]}
    days.days.push(action.day);days.castIds.push(cast.castId)
    if(days.days.length===30){
      const effects=state.entities.find(e=>e.id===targetId)?.effects??m1Entity(world,a,targetId)?.state.effects
      const effect=effects?.find(f=>f.castId===cast.castId)
      if(!effect)throw Error('最后一次灵光效果已失效，不能凭历史记录制造永久效果')
      delete effect.endsAt;effect.expiresAt=null;detail='同来源、同目标连续30个冒险日的真实灵光施法已确认，持续至解除'
    }else detail=`同来源同目标已确认连续${days.days.length}个冒险日；不使用现实日期或重复点击补足`
  }
  reconcileWorld(world)
  reconcileM3World(world,cat,dice)
  return {world,detail}
}
