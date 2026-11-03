import {itemCastFailed,itemWaivesMaterials} from './item-spells'
import type {Adventure,MapWorld,MapScene} from './map-types'
import {completedCasting} from './completed-casting'
import type {Catalogue} from './engine'
import {clone} from './engine'
import {gClock,gEntity,gFact} from './gm-spell-world'
import {S_SPELL_IDS,S_RULES,S_RULE_VERSION,type SummonSpell} from './summon-rules'
import {summonState,summonTokenKey,reconcileSummons,endSummon} from './summon-world'
import {m3Caster,m3Landing} from './m3-world-cast'
import {m3ActionCost} from './m3-world-actions'
import {runtimeSpells,applyRuntime,runtimeDerived,castSlotLevel,rollDie} from './runtime'
import {consumeNpcAbility} from './npc-abilities'
import {summonBody} from './summon-templates'
import {distance} from './map'
import {sightLine} from './map-spatial'
import {tokenPerception} from './m3-map-perception'
import {silenced} from './scene-magic'
import {applyCombat,rebaseTurnExpiries} from './combat'
import {defaultEnvironment,freshTurn,d20} from './combat-rules'
import {m1Entity,assertM1CorpseTransformation} from './m1-utility'
import {actorCreatureType} from './control-spells'
import type {SummonDraft,SummonInstance} from '../persistence/summon-schema'
export interface SummonPreparation{sourceId:string;key:string;mode:string;form:string;position:SummonDraft['position'];materialId:string;receipt:string;note:string;options?:SummonDraft['options']}
const range=(s:SummonSpell)=>s==='find-familiar'||s==='animate-dead'?10:s==='unseen-servant'?60:s.startsWith('summon-')?90:30
function validateCorpses(w:MapWorld,a:Adventure,c:SummonPreparation,source:ReturnType<typeof m3Caster>,slot:number,cat:Catalogue){
 const state=summonState(a),ids=c.options?.corpseIds??[],maintain=c.options?.maintainIds??[],s=a.scenes.find(s=>s.id===c.position.sceneId)!
 if(maintain.length){if(ids.length||new Set(maintain).size!==maintain.length||maintain.length>4+2*(slot-3))throw Error('维持控制不能同时创造；目标须独立且在数量范围内')
  for(const id of maintain){const i=state.instances.find(i=>i.id===id);if(!i||i.spellId!=='animate-dead'||i.sourceEntityId!==source.id||i.control!=='controlled'||i.controlEndsAt===null||i.controlEndsAt<=gClock(w,a,source.id).hours||i.state!=='present'||i.position?.sceneId!==s.id||distance(s,source.token!,{...i.position,spatial:i.position.spatial})>10)throw Error('只能在到期前对10尺内本人创造且仍受控的亡灵维持控制')}
  return
 }
 if(!ids.length||new Set(ids).size!==ids.length||ids.length>1+2*(slot-3))throw Error('须选择独立遗骸，数量按实际环位')
 for(const id of ids){const corpse=a.m1Utility?.corpses.find(c=>c.id===id&&c.dead&&c.bodyViable),entity=corpse&&m1Entity(w,a,corpse.entityId)
  if(!state.remains?.some(r=>r.corpseId===id&&r.form===c.form))throw Error('须GM登记实际遗骨／遗体形态，不能任意互换骷髅与丧尸')
  if(!corpse||!entity?.token||!entity.dead||!['small','medium'].includes(entity.c?runtimeDerived(entity.c,cat).currentSize:entity.body?.size??'medium')||actorCreatureType(entity.actor??{id:entity.id,characterId:entity.c?.id??null,npc:entity.body??null,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},w.characters)!=='humanoid'||corpse.sceneId!==s.id||distance(s,source.token!,entity.token)>10)throw Error('须10尺内实际小型／中型类人遗骨或遗体')
  assertM1CorpseTransformation(w,a,corpse.entityId)
  if(state.instances.some(i=>i.corpseId===id)||state.drafts.some(d=>d.status==='pending'&&d.options?.corpseIds?.includes(id)))throw Error('该遗骸已占用，不能重复唤起')
 }
}
/** Validate and pay once. A battle keeps the original counterspell frame; no creature exists until confirmation. */
export function prepareSummon(input:MapWorld,adventureId:string,c:SummonPreparation,cat:Catalogue,dice:(n:number)=>number=rollDie){
 const w=clone(input),a=w.adventures.find(a=>a.id===adventureId);if(!a)throw Error('冒险不存在')
 const state=summonState(a);if(state.drafts.some(d=>d.receipt===c.receipt))throw Error('召唤创建凭据已经使用')
 if(state.drafts.length>=500||state.instances.length+state.drafts.filter(d=>d.status==='pending').length>=200)throw Error('召唤事务／实例容量已满')
 const source=m3Caster(w,a,c.sourceId,cat),grant=source.c?runtimeSpells(source.c,cat).find(g=>g.key===c.key&&g.modes.includes(c.mode)):undefined,ability=source.body?.abilities?.find(b=>b.id===c.key)
 const spell=grant?.spell??cat.spells.find(s=>s.id===ability?.spellId)
 if(!spell||!(S_SPELL_IDS as readonly string[]).includes(spell.id)||source.c&&!grant||!source.c&&(!ability||c.mode!=='npc'))throw Error('来源必须实际授予此召唤法术')
 const sid=spell.id as SummonSpell,rule=S_RULES[sid],slot=grant?castSlotLevel(c.mode)||spell.level:ability!.slotLevel??spell.level,options=c.options??{}
 if(slot<spell.level||!rule.forms.includes(c.form))throw Error('实际环位或形态不合法')
 const scene=a.scenes.find(s=>s.id===c.position.sceneId)
 if(!c.note.trim())throw Error('请填写实际施法依据')
 if(!scene||scene.id!==a.activeSceneId||!scene.tokens.includes(source.token!))throw Error('来源和落点必须在当前实际场景')
 if(scene.tokens.length>=100)throw Error('场景棋子容量已满')
 if(['stone','pocket'].includes(source.token!.spatial?.layer??'material'))throw Error('内部空间不能绕过实际入口施法')
 if(silenced(w,a,scene,source.token!)&&/(^|[,\s])V([,\s(]|$)/.test(spell.components))throw Error('沉默区域中不能使用言语成分施法')
 const expectedSpan=['find-steed','phantom-steed'].includes(sid)?2:1,to={x:c.position.x,y:c.position.y,height:c.position.spatial.height,spatial:c.position.spatial}
 if(c.position.span!==expectedSpan||c.position.spatial.layer!==(source.token!.spatial?.layer??'material')||distance(scene,source.token!,to)>range(sid)||!sightLine(scene,source.token!,to,'blocksTargeting').clear)throw Error('落点须在法术实际距离内、同空间且无遮挡')
 if(sid!=='animate-dead')m3Landing(scene,{...source.token!,id:'new-summon',span:expectedSpan},to,c.position.spatial.layer,c.position.spatial.anchorId)
 if(sid.startsWith('summon-')&&!tokenPerception(w,a,scene,source.token!,{...source.token!,id:'summon-landing',characterId:null,actorId:null,npcId:undefined,npcBody:undefined,...to,span:expectedSpan},cat).canSee)throw Error('落点必须在实际光照及感官下可见')
 if(['phantom-steed','unseen-servant'].includes(sid)&&to.height!==(a.m3?.environments.find(e=>e.sceneId===scene.id)?.floorHeight??0))throw Error('此召唤必须出现在地面')
 if(state.drafts.some(d=>d.status==='pending'&&d.position.sceneId===scene.id&&d.position.x===to.x&&d.position.y===to.y&&d.position.spatial.height===to.height))throw Error('落点已有未完成创建事务')
 const fact=rule.material?gFact(a,c.materialId,source.id):undefined,row=source.c?.inventory.find(i=>i.instanceId===fact?.inventoryInstanceId&&i.quantity>0),object=a.m3?.entities.find(o=>o.id===fact?.entityId&&o.enabled&&o.boundCharacterId===source.id)
 if(rule.material&&!itemWaivesMaterials(grant)&&(!fact||fact.material!==rule.material.name||(fact.valueGP??0)<rule.material.gp||!(row&&fact.inventoryOwnerId===source.c?.id||object)))throw Error('须已登记的实际'+rule.material.name+'（至少'+rule.material.gp+'GP），不能用勾选替代材料')
 if(rule.material?.consume&&!itemWaivesMaterials(grant)&&row&&row.quantity!==1)throw Error('耗材须先拆分为本次使用的一份，避免误扣整叠材料')
 if(options.riderId&&!m1Entity(w,a,options.riderId))throw Error('指定骑手必须是实际存在的生物')
 if(sid==='animate-dead')validateCorpses(w,a,c,source,slot,cat)
 const battle=w.encounters.find(e=>e.id===scene.encounterId&&e.phase==='active'),chain=grant?.key.startsWith('chain:')&&c.mode==='at-will',long=/minute|hour/i.test(spell.castingTime)&&!chain
 const duration=spell.castingTime.match(/(\d+)\s*(minute|hour)/i),castingHours=(duration?Number(duration[1])*(duration[2]!.toLowerCase()==='hour'?1:1/60):0)+(c.mode==='ritual'?1/6:0),proven=completedCasting(source.id,c.key)+1e-9>=castingHours
 if(long&&((!options.castingCompleted&&!proven)||battle))throw Error('长时间施法须实际连续进度或GM核对完成，不能作为战斗中一个动作')
 let failed=false
 const id=crypto.randomUUID(),env={...defaultEnvironment(),note:c.note},actor=battle?.actors.find(t=>t.id===source.actor?.id||!!source.c&&t.characterId===source.c.id)
 if(battle){
  if(!actor||battle.pending)throw Error('施法者须在当前战斗且没有待结算')
  const command=grant?{type:'cast' as const,actorId:actor.id,key:grant.key,mode:c.mode,targets:[actor.id],env,damageType:'force' as const,requirementsConfirmed:true,summonDraftId:id}:{type:'npc-ability' as const,actorId:actor.id,abilityId:ability!.id,targetIds:[actor.id],env,confirmed:true,note:c.note,summonDraftId:id}
  const result=applyCombat(battle,w.characters,cat,command,dice)
  if(grant&&itemCastFailed(result.characters.find(v=>v.id===source.c?.id),grant.key)){w.encounters[w.encounters.indexOf(battle)]=result.encounter;w.characters=result.characters;failed=true}
  if(!failed&&!result.encounter.pending)throw Error('没有建立实际反制窗口，事务未提交')
  w.encounters[w.encounters.indexOf(battle)]=result.encounter;w.characters=result.characters
 }else if(grant&&source.c){const next=applyRuntime(source.c,cat,{type:'cast',key:c.key,mode:c.mode,requirementsConfirmed:true,deferEffects:true},dice);w.characters[w.characters.indexOf(source.c)]=next;m3ActionCost(w,a,source.id,'action',cat,true);if(itemCastFailed(next,c.key))failed=true}
 else{if(ability!.cost!=='none')m3ActionCost(w,a,source.id,ability!.cost,cat,true);consumeNpcAbility(gEntity(w,a,source.id).entity!.body!,ability!.id)}
 if(!failed&&rule.material?.consume&&!grant?.item){if(row){const actual=w.characters.find(x=>x.id===source.c?.id)?.inventory.find(x=>x.instanceId===row.instanceId);if(actual){const character=w.characters.find(x=>x.id===source.c?.id)!;character.inventory=character.inventory.filter(x=>x.instanceId!==actual.instanceId)}}else if(object)object.enabled=false}
 if(long&&!source.c&&!proven){const beforeClock=gClock(w,a,source.id),clockCharacter=w.characters.find(x=>x.id===beforeClock.id)!;clockCharacter.runtime!.hours=(clockCharacter.runtime!.hours??0)+castingHours}
 const clock=gClock(w,a,source.id),live=gEntity(w,a,source.id).entity!,castId=rule.concentration?(live.c?.runtime?.concentration?.castId??live.body?.concentration?.castId??crypto.randomUUID()):crypto.randomUUID()
 if(live.body&&rule.concentration)live.body.concentration={spellId:sid,castId,clockSourceId:clock.id,endsAt:clock.hours+rule.hours,encounterId:battle?.id??'outside'}
 const stats=live.c&&runtimeDerived(live.c,cat),attack=grant?.item?.attackBonus??(stats&&grant?stats.pb+stats.mods[grant.ability]-2*(live.c!.runtime?.exhaustion??0):live.body?.spellcasting?.attackBonus),dc=grant?.item?.dc??(stats&&grant?8+stats.pb+stats.mods[grant.ability]:live.body?.spellcasting?.dc)
 if((sid.startsWith('summon-')||sid==='find-steed')&&(attack===undefined||dc===undefined))throw Error('须登记真实NPC施法攻击及豁免DC')
 const pending=battle&&w.encounters.find(e=>e.id===battle.id)!.pending!
 // PendingAction uses startedAt rather than a stable id; the summon draft is its durable identity.
 const draft:SummonDraft={id,castId,receipt:c.receipt,spellId:sid,sourceEntityId:source.id,slot,form:c.form,position:clone(c.position),createdHour:clock.hours,clockSourceId:clock.id,materialIds:fact?[fact.entityId]:[],status:failed?'canceled':'pending',note:c.note,options:clone(options),dc,attackBonus:attack,proficiencyBonus:stats?stats.pb:live.body?.templateMetadata?.proficiencyBonus,...(pending?{battle:{encounterId:battle!.id,frameId:id}}:{})}
 state.drafts.push(draft);return {world:w,draft,failed}
}
function tokenFor(a:Adventure,i:SummonInstance){
 if(!i.position||i.kind==='force')return;const s=a.scenes.find(s=>s.id===i.position!.sceneId)!
 s.tokens.push({id:i.id,characterId:null,actorId:null,name:i.body?.name??'隐形仆役',x:i.position.x,y:i.position.y,span:i.position.span,spatial:clone(i.position.spatial),hidden:false,color:'#597a60',facing:0,...(i.body?{npcBody:clone(i.body)}:{}),companionKey:summonTokenKey(i.id)})
}
export function attachSummon(w:MapWorld,a:Adventure,i:SummonInstance,scene:MapScene,dice:(n:number)=>number=rollDie){
 if(!i.body||i.state!=='present')return
 const e=w.encounters.find(e=>e.id===scene.encounterId&&e.phase!=='ended');if(!e)return
 const source=gEntity(w,a,i.sourceEntityId).entity,owner=e.actors.find(t=>t.id===source?.actor?.id||!!source?.c&&t.characterId===source.c.id)
 // Independent bodies remain real when their creator is not a participant; never invent a creator actor.
 if(e.actors.some(t=>t.companion?.instanceId===i.id&&!t.companion.dismissed))return
 if(e.actors.length>=100)throw Error('遭遇容量不足')
 const independent=!owner||i.spellId==='find-familiar'||i.spellId==='animate-dead',actor={id:crypto.randomUUID(),characterId:null,npc:clone(i.body),side:owner?.side??'neutral' as const,initiative:independent?(e.phase==='active'?d20(i.body.initiativeBonus,[],[],dice).total:null):owner!.initiative,surprised:false,turn:freshTurn(),companion:{instanceId:i.id,castId:i.castId,sourceEntityId:i.sourceEntityId,ownerId:owner?.id??i.sourceEntityId,worldManaged:true,controllerExpired:i.control!=='controlled',commandText:i.task&&!i.task.completed?i.task.text:undefined,source:'spell-summon' as const,spellId:i.spellId,slotLevel:i.slot,form:i.form,expiresAfterRest:null,dismissed:false}}
 const oldIds=e.actors.map(t=>t.id),current=e.actors[e.current]?.id;e.actors.push(actor)
 if(!independent){e.actors.splice(e.actors.indexOf(actor),1);e.actors.splice(e.actors.indexOf(owner!)+1,0,actor)}
 if(independent&&e.phase==='active')e.actors.sort((x,y)=>(y.initiative??0)-(x.initiative??0));if(current){e.current=e.actors.findIndex(t=>t.id===current);rebaseTurnExpiries(e,oldIds,current,w.characters)}
 const t=scene.tokens.find(t=>t.id===i.id);if(t)t.actorId=actor.id
 i.actorRefs.push({encounterId:e.id,actorId:actor.id})
}
export function commitSummonInPlace(w:MapWorld,adventureId:string,draftId:string,cat:Catalogue){
 const a=w.adventures.find(a=>a.id===adventureId);if(!a)throw Error('冒险不存在')
 const state=summonState(a),d=state.drafts.find(d=>d.id===draftId)
 if(!d||d.status!=='pending')throw Error('创建事务不存在或已经处理')
 const source=m3Caster(w,a,d.sourceEntityId,cat),conc=source.c?.runtime?.concentration??source.body?.concentration,scene=a.scenes.find(s=>s.id===d.position.sceneId),rule=S_RULES[d.spellId]
 if(rule.concentration&&conc?.castId!==d.castId||!scene||rule.hours&&gClock(w,a,source.id).hours>=d.createdHour+rule.hours)throw Error('原施放／期限或场景已改变，不能生成替代实体')
 if(d.options?.maintainIds?.length){for(const id of d.options.maintainIds){const i=state.instances.find(i=>i.id===id)!;if(i.controlEndsAt===null||i.controlEndsAt<=gClock(w,a,source.id).hours)throw Error('原控制已到期，不能重新夺取');i.controlEndsAt=gClock(w,a,source.id).hours+24;i.receipts.push({id:d.receipt,operation:'maintain'})}d.status='committed';return {instance:state.instances.find(i=>i.id===d.options!.maintainIds![0])!,instances:d.options.maintainIds.map(id=>state.instances.find(i=>i.id===id)!)} }
 const corpses=d.options?.corpseIds??[],count=corpses.length||1
 if(state.instances.length+count>200||scene.tokens.length+count>100)throw Error('召唤容量不足，原已支付事务保留')
 const existing=['find-familiar','find-steed'].includes(d.spellId)?state.instances.find(i=>i.sourceEntityId===source.id&&i.spellId===d.spellId&&i.state!=='vanished'):undefined
 const body=summonBody(d.spellId,d.slot,d.form,d.attackBonus??0,d.options?.creatureType),out:SummonInstance[]=[]
 if(body?.templateMetadata&&d.proficiencyBonus)body.templateMetadata.proficiencyBonus=d.proficiencyBonus
 for(let n=0;n<count;n++){
  const corpse=corpses[n]&&a.m1Utility?.corpses.find(c=>c.id===corpses[n]),corpseToken=corpse&&m1Entity(w,a,corpse.entityId)?.token,position=corpseToken?{sceneId:scene.id,x:corpseToken.x,y:corpseToken.y,span:1,spatial:clone(corpseToken.spatial??{height:0,layer:'material' as const})}:clone(d.position)
  if(d.spellId!=='animate-dead')m3Landing(scene,{...source.token!,id:existing?.id??'new-summon',span:position.span},{...position,height:position.spatial.height},position.spatial.layer,position.spatial.anchorId)
  if(existing&&d.spellId==='find-steed')endSummon(w,a,existing,'新施放替换旧坐骑')
  const i:SummonInstance={id:existing&&d.spellId==='find-familiar'?existing.id:crypto.randomUUID(),castId:d.castId,sourceEntityId:source.id,controllerId:source.id,spellId:d.spellId,slot:d.slot,form:d.form,templateVersion:S_RULE_VERSION,kind:rule.kind,body:clone(body),position,actorRefs:[],state:'present',control:'controlled',createdHour:d.createdHour,existenceEndsAt:rule.hours?d.createdHour+rule.hours:null,controlEndsAt:rule.controlHours?d.createdHour+rule.controlHours:null,...(rule.concentration?{concentrationCastId:d.castId}:{}),vanishOnZero:rule.vanishOnZero,vanishOnSourceDeath:rule.vanishOnSourceDeath,carriedItemIds:[],generatedItemIds:[],receipts:[{id:d.receipt,operation:'creation-commit'}],migration:'native',note:d.note,dc:d.dc,designatedRiderId:d.options?.riderId??source.id,...(corpse?{corpseId:corpse.id}:{}),...(body?{lastHp:body.hp+body.temporaryHp}:{}),...(d.spellId==='unseen-servant'?{forceState:{ac:10,hp:1,maxHp:1,strength:2}}:{})}
  if(existing&&d.spellId==='find-familiar'){if(['present','pocket'].includes(existing.state)&&existing.body&&i.body){i.body.hp=Math.min(existing.body.hp,i.body.maxHp);i.body.temporaryHp=existing.body.temporaryHp;i.body.effects=clone(existing.body.effects)}i.carriedItemIds=clone(existing.carriedItemIds);i.actorRefs=clone(existing.actorRefs);i.priorCastIds=[...(existing.priorCastIds??[]),existing.castId];for(const ref of i.actorRefs){const e=w.encounters.find(e=>e.id===ref.encounterId),actor=e?.actors.find(t=>t.id===ref.actorId);if(e?.phase==='active'&&actor?.companion&&!actor.companion.dismissed){actor.companion.castId=i.castId;actor.companion.form=i.form;actor.npc=clone(i.body)}}for(const s of a.scenes)s.tokens=s.tokens.filter(t=>t.companionKey!==summonTokenKey(i.id));state.instances[state.instances.indexOf(existing)]=i}else state.instances.push(i)
  if(corpse){const remains=state.remains?.find(r=>r.corpseId===corpse.id);for(const gear of remains?.equipment??[]){const object=a.m3?.entities.find(o=>o.id===gear.objectId&&o.enabled&&!o.boundCharacterId),item=cat.items.find(it=>it.id===gear.itemId);if(!object||!item||item.kind!=='weapon')throw Error('实际遗骸武器已被占用或规则引用无效');object.boundCharacterId=i.id;i.carriedItemIds.push(object.id);if(i.form==='skeleton'&&['shortsword','shortbow'].includes(item.id)){const ranged=item.id==='shortbow',attackId='corpse-'+item.id;i.body!.attacks.push({id:attackId,name:item.name,bonus:5,damage:'1d6+3',damageType:'piercing',reach:5,range:ranged?80:0,longRange:ranged?320:0});(i.body!.equipment??=[]).push({id:crypto.randomUUID(),objectId:object.id,itemId:item.id,attackIds:[attackId],held:true,proficient:true,magical:false,material:ranged?'wood':'metal'})}}corpse.bodyViable=false;if(corpseToken)scene.tokens=scene.tokens.filter(t=>t.id!==corpseToken.id)}
  if(i.spellId==='phantom-steed'){const objects=a.m3??=( {environments:[],entities:[],events:[],casts:[],auraDays:[],reactions:[],materials:[],knowledge:[]} );if(objects.entities.length+3>1000)throw Error('生成装备超出实体容量');for(const name of ['鞍座','嚼子','缰绳']){const objectId=crypto.randomUUID();objects.entities.push({id:objectId,name:'魅影驹生成'+name,sceneId:scene.id,kind:'object',x:position.x,y:position.y,height:position.spatial.height,width:1,heightFeet:1,depth:1,weight:0,loose:true,enabled:true,hidden:false,sourceId:i.id,castId:i.castId,boundCharacterId:i.id,magical:true});i.generatedItemIds.push(objectId)}}
  tokenFor(a,i);attachSummon(w,a,i,scene);out.push(i)
 }
 d.status='committed';return {instance:out[0]!,instances:out}
}
export function commitSummon(input:MapWorld,adventureId:string,draftId:string,cat:Catalogue){const world=clone(input),result=commitSummonInPlace(world,adventureId,draftId,cat);reconcileSummons(world);return {world,...result}}
