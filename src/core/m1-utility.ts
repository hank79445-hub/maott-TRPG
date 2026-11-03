import {itemCastFailed,spellUsesSlot,itemWaivesMaterials} from './item-spells'
import {steedRecoveredHP} from './summon-steed'
import type {MapWorld,Adventure,MapToken} from './map-types'
import type {Catalogue} from './engine'
import {clone} from './engine'
import {applyRuntime,runtimeState,runtimeSpells,castSlotLevel,rollDie} from './runtime'
import {rollDamage,defaultEnvironment} from './combat-rules'
import {healingRollTotal,hpSpellBonus} from './spell-restoration'
import {distance} from './map'
import {sightLine} from './map-spatial'
import {syncNpcLifeTokens} from './npc-life-state'
import {reconcileWorld} from './combat-lifecycle'
import type {M1Action} from '../persistence/m1-utility-schema'
import type {M1Corpse,M1UtilityState} from './m1-utility-types'
import type {RuntimeCommand} from './runtime'

export const M1_UTILITY_SPELLS=['revivify','gentle-repose','remove-curse','purify-food-and-drink','aura-of-vitality','protection-from-evil-and-good']
export const m1State=(a:Adventure):M1UtilityState=>a.m1Utility??={corpses:[],materials:[],objects:[],pulses:[]}
export function assertM1InventoryChange(world:MapWorld,characterId:string,command:RuntimeCommand){
 if(!['equip','item-remove','item-move','item-split'].includes(command.type)||!('instanceId'in command))return
 if(world.adventures.some(a=>a.m1Utility?.objects.some(o=>o.magical&&o.cursed&&o.boundCharacterId===characterId&&o.inventoryInstanceId===command.instanceId)))
  throw Error('该诅咒魔法物品仍绑定；请先用移除诅咒打破绑定，或由GM明确修正物件事实')
}
export function m1Entity(world:MapWorld,a:Adventure,id:string){
 const n=a.ai?.npcs.find(n=>n.id===id || n.characterId===id)
 const c=world.characters.find(c=>c.id===(n?.characterId??id))
 const encounters=[...world.encounters].sort((x,y)=>Number(y.phase==='active')-Number(x.phase==='active')),actors=encounters.flatMap(e=>e.actors)
 const stableToken=a.scenes.flatMap(s=>[...s.tokens,...s.defeatedTokens??[]]).find(t=>t.id===id)
 const actor=actors.find(t=>n?.actorId?t.id===n.actorId:!!c&&t.characterId===c.id)??actors.find(t=>t.id===(stableToken?.actorId??id)||t.npcId===(n?.id??id))
 const ordered=[...a.scenes.filter(s=>s.id===a.activeSceneId),...a.scenes.filter(s=>s.id!==a.activeSceneId)]
 const token=ordered.flatMap(s=>[...s.tokens,...s.defeatedTokens??[]]).find(t=>t.characterId===(c?.id??'')||t.npcId===(n?.id??id)||t.actorId===(actor?.id??id)||t.id===id)
 const body=actor?.npc??n?.body??token?.npcBody
 const state=c?.runtime??body
 if(!state || (!token&&!n&&!a.party.includes(c?.id??'')))return undefined
 return {id:c?.id??n?.id??actor?.id??id,name:n?.name??c?.build.name??body?.name??token?.name??id,
 c,body,actor,n,token,state,dead:c?!!c.runtime?.death?.dead:!!body?.dead}
}
/** Called with the pre-transaction world. Old deaths with no evidence get no invented timestamp. */
export function recordM1Deaths(world:MapWorld,before:MapWorld){
 for(const a of world.adventures){
  const old=before.adventures.find(b=>b.id===a.id)
  const ids=new Set([...a.party,...(a.ai?.npcs.map(n=>n.characterId??n.id)??[]),
   ...a.scenes.flatMap(s=>[...s.tokens,...s.defeatedTokens??[]].map(t=>t.characterId??t.npcId??t.actorId??t.id))])
  for(const id of ids){
   const entity=m1Entity(world,a,id);if(!entity)continue
   const current=a.m1Utility?.corpses.find(c=>c.entityId===entity.id&&c.dead)
   if(!entity.dead){if(current)current.dead=false;continue}
   if(current)continue
   const prior=old&&m1Entity(before,old,id),clock=world.characters.find(c=>a.party.includes(c.id)&&c.runtime)??entity.c
   if(!clock?.runtime)continue
   const state=m1State(a);if(state.corpses.length>=1000)throw Error('遗体记录达到1000项，请先归档')
   state.corpses.push({id:crypto.randomUUID(),entityId:entity.id,sceneId:a.scenes.find(s=>[...s.tokens,...s.defeatedTokens??[]].includes(entity.token!))?.id??a.activeSceneId??a.scenes[0]!.id,
    clockSourceId:clock.id,deathHour:prior&&!prior.dead?clock.runtime.hours??0:null,dead:true,
    oldAge:false,bodyViable:true,repose:[]})
  }
 }
}
export function corpseAge(corpse:M1Corpse,now:number){
 if(corpse.deathHour===null)throw Error('遗体缺少可靠死亡时间，请GM先核对')
 let covered=0,end=corpse.deathHour
 for(const interval of [...corpse.repose].sort((a,b)=>a.start-b.start)){
  const start=Math.max(corpse.deathHour,interval.start,end),until=Math.min(now,interval.end)
  if(until>start){covered+=until-start;end=until}
 }
 return Math.max(0,now-corpse.deathHour-covered)
}
/** Shared guard for any future corpse-to-Undead implementation; summons are not enabled here. */
export function assertM1CorpseTransformation(world:MapWorld,a:Adventure,entityId:string){
 const corpse=a.m1Utility?.corpses.find(c=>c.entityId===entityId&&c.dead)
 if(!corpse)return
 const clock=world.characters.find(c=>c.id===corpse.clockSourceId)?.runtime
 if(!clock)throw Error('遗体时钟来源缺失，请GM核对')
 if(corpse.repose.some(r=>r.start<=(clock.hours??0)&&(clock.hours??0)<r.end))throw Error('遗体防腐期间不能转变为亡灵')
}
export function applyM1Action(input:MapWorld,adventureId:string,action:M1Action,cat:Catalogue,dice:(n:number)=>number=rollDie,phase:'commit'|'prepare'|'settle'='commit'){
 const world=clone(input),a=world.adventures.find(a=>a.id===adventureId)
 if(!a)throw Error('冒险不存在')
 const state=m1State(a),scene=a.scenes.find(s=>s.id===a.activeSceneId)
 if(!scene)throw Error('请先进入场景')
 let detail=''
 if(action.operation==='material'){
  const c=world.characters.find(c=>c.id===action.characterId),row=c?.inventory.find(r=>r.instanceId===action.instanceId&&r.quantity>0)
  if(!c||!row)throw Error('材料须关联真实角色背包条目')
  state.materials=state.materials.filter(m=>m.instanceId!==row.instanceId)
  if(state.materials.length>=1000)throw Error('材料标记已达上限')
  state.materials.push({...action});delete (state.materials.at(-1)! as unknown as Record<string,unknown>).operation
  detail='GM核实并标记施法材料（没有生成物品或扣金币）'
 }else if(action.operation==='object'){
  const object=action.object,s=a.scenes.find(s=>s.id===object.sceneId)
  if(!s||object.x>=s.grid.columns||object.y>=s.grid.rows)throw Error('物件场景或位置无效')
  if(object.inventoryInstanceId&&!world.characters.find(c=>c.id===object.boundCharacterId)?.inventory.some(r=>r.instanceId===object.inventoryInstanceId&&r.quantity===1))throw Error('诅咒物件须关联实际持有人的单件背包条目，请先拆分堆叠')
  if(!state.objects.some(o=>o.id===object.id)&&state.objects.length>=1000)throw Error('物件记录已达上限')
  state.objects=state.objects.filter(o=>o.id!==object.id);state.objects.push(clone(object));detail='GM登记食粮／物件状态'
 }else if(action.operation==='corpse'){
  recordM1Deaths(world,world)
  const entity=m1Entity(world,a,action.entityId),corpse=state.corpses.find(c=>c.entityId===entity?.id&&c.dead)
  if(!entity?.dead||!corpse)throw Error('只能核对已死亡且有稳定身份的遗体')
  const clock=world.characters.find(c=>c.id===corpse.clockSourceId)?.runtime
  if(!clock||(clock.hours??0)<action.ageSeconds/3600)throw Error('死亡时间早于当前冒险时钟；请先明确推进时钟，不使用现实时间猜测')
  if(corpse.repose.length)throw Error('已有防腐历史，不能直接改写死亡时间')
  corpse.deathHour=(clock.hours??0)-action.ageSeconds/3600;corpse.oldAge=action.oldAge;corpse.bodyViable=action.bodyViable
  detail='GM核对遗体时间及复活资格'
 }else{
  const caster=world.characters.find(c=>c.id===action.characterId),from=scene.tokens.find(t=>t.characterId===caster?.id)
  if(!caster||!from)throw Error('施法者须是本场景中的完整角色卡')
  caster.runtime=runtimeState(caster,cat)
  if(caster.runtime.hp<=0||caster.runtime.death?.dead)throw Error('施法者须存活且能够行动')
  const battle=world.encounters.find(e=>e.id===scene.encounterId&&e.phase==='active'),actor=battle?.actors.find(t=>t.characterId===caster.id)
  if(phase==='settle'){
   const pending=battle?.pending,stored=state.casts?.find(c=>c.id===pending?.utilityId)
   if(!battle||!pending||!stored||JSON.stringify(stored.action)!==JSON.stringify(action))throw Error('专用法术待结算已改变或被反制')
   battle.pending=null;state.casts=state.casts!.filter(c=>c.id!==stored.id)
  }
  if(battle&&(battle.pending||battle.actors[battle.current]?.id!==actor?.id))throw Error('请先完成待结算并等待施法者回合')
  if(action.operation==='pulse'&&battle)throw Error('战斗中请使用原活力灵光治疗入口')
  const target=m1Entity(world,a,action.targetId),corpse=state.corpses.find(c=>c.id===action.targetId&&c.dead),object=state.objects.find(o=>o.id===action.targetId)
  const entity=corpse?m1Entity(world,a,corpse.entityId):target
  const targetToken=entity?.token
  const boundToken=object?.boundCharacterId?scene.tokens.find(t=>t.characterId===object.boundCharacterId):undefined
  const targetPoint=object?(object.boundCharacterId?boundToken:object):targetToken
  if(!targetPoint||!(object?(object.boundCharacterId?!!boundToken:object.sceneId===scene.id):[...scene.tokens,...scene.defeatedTokens??[]].includes(targetToken!)))throw Error('目标须位于当前场景，遗体也须有原位置记录')
  const range=action.operation==='pulse'?30:0
  const grant=action.operation==='cast'?runtimeSpells(caster,cat).find(g=>g.key===action.key):undefined
  if(action.operation==='cast'&&(!grant||!M1_UTILITY_SPELLS.includes(grant.spell.id)))throw Error('请选择本批已支持的实际法术来源')
  const spellId=grant?.spell.id??'aura-of-vitality'
  const allowed=spellId==='purify-food-and-drink'?10:spellId==='aura-of-vitality'?30:5
  if(distance(scene,from,targetPoint)>Math.max(range,allowed)||!sightLine(scene,from,targetPoint,'blocksTargeting').clear)throw Error('目标超距或有实体阻隔')
  const material=(kind:string,count:number,minGP=0)=>{
   if(phase==='settle'||itemWaivesMaterials(grant))return // Actual components were paid at preparation; never pay twice.
   const m=state.materials.find(m=>m.instanceId===('materialId'in action?action.materialId:undefined)&&m.characterId===caster.id&&m.kind===kind&&m.valueGP>=minGP)
   const row=caster.inventory.find(r=>r.instanceId===m?.instanceId)
   if(!row||row.quantity<count)throw Error('缺少已核实、价值及数量足够的实际材料，不能用金币或施法法器替代')
   row.quantity-=count;if(!row.quantity)caster.inventory=caster.inventory.filter(r=>r!==row)
  }
  if(spellId==='revivify'||spellId==='gentle-repose'){
   if(!corpse||!entity?.dead)throw Error('请选择实际遗体记录')
   const clock=world.characters.find(c=>c.id===corpse.clockSourceId)?.runtime
   if(!clock)throw Error('遗体时钟来源缺失')
   if(spellId==='revivify'){
    if(corpseAge(corpse,clock.hours??0)>1/60+1e-10)throw Error('回生术超过有效死亡一分钟期限')
    if(corpse.oldAge||!corpse.bodyViable)throw Error('不能回生老死或缺损妨碍存活的遗体；本术不恢复肢体')
    material('diamond',1,300)
   }else material('copper',2,0.01)
  }
  if(spellId==='protection-from-evil-and-good'){
   if(!entity||entity.dead)throw Error('请选择存活且自愿的受术者，GM确认包含自愿条件')
   material('holy-water',1,25)
  }
  if(action.operation==='cast'&&phase!=='settle'){
   if(battle&&(!actor?.turn.action||(spellUsesSlot(action.mode)&&battle.slotSpent.includes(actor.id))))throw Error('本回合动作／法术位施法预算不可用')
   if(battle&&phase==='commit')throw Error('战斗专用施法必须先进入反制窗口')
   if(battle&&action.mode==='ritual')throw Error('战斗中不能以仪式完成本次施法')
   const result=applyRuntime(caster,cat,{type:'cast',key:action.key,mode:action.mode,requirementsConfirmed:true,deferEffects:true},dice)
   world.characters[world.characters.indexOf(caster)]=result
   const elapsed=(result.runtime?.hours??0)-(caster.runtime?.hours??0)
   if(elapsed>0)for(const other of world.characters.filter(c=>c.id!==caster.id&&(a.party.includes(c.id)||a.ai?.npcs.some(n=>n.characterId===c.id))))
     world.characters[world.characters.indexOf(other)]=applyRuntime(other,cat,{type:'time',hours:elapsed},dice)
   if(battle&&actor){actor.turn.action=false;actor.turn.attacksLeft=0;if(spellUsesSlot(action.mode))actor.turn.levelSpellCast=true}
   reconcileWorld(world)
   if(itemCastFailed(result,action.key))return {world,detail:'卷轴施法检定失败，卷轴和行动已消耗，没有法术效果'}
   detail=`施放${grant!.spell.name}` // Do not publish internal grant/subclass or journal details.
   if(phase==='prepare'){
    if(!battle||!actor)throw Error('仅战斗施法使用反制准备阶段')
    const id=crypto.randomUUID(),level=castSlotLevel(action.mode),pool=level===1?'slots':'slots-'+level
    const old=runtimeState(caster,cat),paid=runtimeState(result,cat)
    const slotReceipt=level&&spellUsesSlot(action.mode)?{resourceId:pool,created:(old.createdSlots[pool]??0)>(paid.createdSlots[pool]??0)}:undefined
    state.casts=(state.casts??[]).filter(c=>c.encounterId!==battle.id)
    if(state.casts.length>=1000)throw Error('专用施法记录已达上限，请先归档')
    state.casts.push({id,encounterId:battle.id,action:clone(action)})
    if(level&&spellUsesSlot(action.mode))battle.slotSpent.push(actor.id)
    battle.pending={id,utilityId:id,kind:'automatic',actorId:actor.id,name:grant!.spell.name,page:grant!.spell.source.page,
      ...(grant?.item&&!grant.item.definition.charges?{itemReceipt:{receiptId:paid.itemCasts.at(-1)!.id,item:{...clone(caster.inventory.find(i=>i.instanceId===grant.item!.instanceId)!),quantity:1}}}:{}),
      spellId,sourceKey:action.key,slotLevel:level||grant!.spell.level,slotReceipt,attack:null,targets:[{id:actor.id,env:defaultEnvironment(),roll:null,hit:true,critical:false,ac:0}],
      damage:[],save:null,dc:null,half:false,effectKey:null,modifier:0,mode:'utility',notes:['实际目标与GM依据保存在私有专用请求；最终确认前效果不生效'],sneak:false,mastery:false,startedAt:battle.tick}
    return {world,detail:detail+'；费用已登记，等待反制及最终结算，效果尚未生效'}
   }
  }
  if(spellId==='protection-from-evil-and-good'){
   const c=world.characters.find(c=>c.id===caster.id)!,r=runtimeState(c,cat)
   const targetC=entity!.c&&world.characters.find(c=>c.id===entity!.c!.id),targetState=targetC?runtimeState(targetC,cat):entity!.body!
   targetState.effects=targetState.effects.filter(e=>!(e.key===spellId&&e.sourceId===c.id))
   for(const e of targetState.effects){
    e.sourceCreatureType??=world.encounters.flatMap(t=>t.actors).find(t=>[t.id,t.npcId].includes(e.sourceId))?.npc?.creatureType??a.ai?.npcs.find(n=>n.id===e.sourceId)?.body?.creatureType
   }
   targetState.effects.push({id:crypto.randomUUID(),key:spellId,spellId,spellLevel:action.operation==='cast'?(castSlotLevel(action.mode)||grant!.spell.level):1,castId:r.concentration!.castId!,name:'防护善恶',sourceId:c.id,
    clockSourceId:c.id,endsAt:r.hours+1/6,concentration:true,expiresAt:null,encounterId:'outside',phase:'start',page:grant!.spell.source.page,
    note:'防护异怪、天族、元素、妖精、邪魔、亡灵；不能被其魅惑、恐慌或附身，已有对应来源状态的后续豁免优势；不直接清除旧状态'})
   if(targetC)targetC.runtime=targetState as ReturnType<typeof runtimeState>
   detail+='；防护善恶已实际登记，未知来源或附身等未自动化效果由GM核对'
  }else if(spellId==='gentle-repose'){
   const clock=world.characters.find(c=>c.id===corpse!.clockSourceId)!.runtime!,start=clock.hours??0
   if(corpse!.repose.length>=100)throw Error('遗体防腐历史达到上限')
   corpse!.repose.push({start,end:start+240});detail+='；遗体防腐10日，暂停有效死亡时间并阻止转变亡灵'
  }else if(spellId==='revivify'){
   if(entity!.c){const c=world.characters.find(c=>c.id===entity!.c!.id)!,r=runtimeState(c,cat);r.hp=1;r.death={dead:false,stable:false,successes:0,failures:0};c.runtime=r}
   else{entity!.body!.hp=1;entity!.body!.dead=false;delete entity!.body!.concentration}
   corpse!.dead=false;detail+='；回生为1HP；没有恢复肢体、职业次数或法术位'
  }else if(spellId==='remove-curse'){
   if(object){
    if(object.magical){const owner=world.characters.find(c=>c.id===object.boundCharacterId),row=owner?.inventory.find(r=>r.instanceId===object.inventoryInstanceId)
     if(!row)throw Error('诅咒魔法物品缺少持有人／物品实例，不能仅删除文字说明')
     row.equipped=false;row.equipmentSlot=null;object.boundCharacterId=undefined
     detail+='；打破诅咒物件绑定并卸下，物件诅咒保留'
    }else{object.cursed=false;detail+='；物件诅咒解除'}
   }else if(entity){
    const c=entity.c&&world.characters.find(c=>c.id===entity.c!.id),s=c?runtimeState(c,cat):entity.body!
    s.effects=s.effects.filter(e=>!e.curse);if(c)c.runtime=s as ReturnType<typeof runtimeState>
    detail+='；解除目标身上的已登记诅咒，其他状态保留'
   }else throw Error('请选择实际生物或已登记物件')
  }else if(spellId==='purify-food-and-drink'){
   if(!object)throw Error('请选择登记食粮作为施法中心')
   let count=0;for(const o of state.objects)if(o.sceneId===scene.id&&o.food&&!o.magical&&distance(scene,object,o)<=5){o.poisoned=false;o.rotten=false;count++}
   detail+=`；中心半径5尺内${count}处非魔法食粮已去除毒素和腐败，没有治疗生物或净化魔法毒物`
  }else if(spellId==='aura-of-vitality'){
   const c=world.characters.find(c=>c.id===caster.id)!,r=runtimeState(c,cat)
   if(action.operation==='cast'){
    r.effects.push({id:crypto.randomUUID(),castId:r.concentration!.castId!,spellId,spellLevel:castSlotLevel(action.mode)||grant!.spell.level,key:spellId,name:'活力灵光',
     sourceId:c.id,clockSourceId:c.id,page:grant!.spell.source.page,concentration:true,expiresAt:null,encounterId:'outside',phase:'start',endsAt:r.hours+1/60,note:'创造与自身回合开始各一次，30尺内治疗2d6'})
    c.runtime=r
   }
   const effect=r.effects.find(e=>e.key===spellId&&e.castId===r.concentration?.castId)
   if(!effect?.castId||r.concentration?.spellId!==spellId||r.hours>=(effect.endsAt??0))throw Error('活力灵光已结束')
   const window=Math.floor((r.hours-((effect.endsAt??0)-1/60))*600+1e-7)
   if(action.operation==='pulse'&&action.window!==window)throw Error('请选择当前游戏时间对应的回合开始窗口，不补领过去治疗')
   if(window<0||window>9||state.pulses.some(p=>p.castId===effect.castId&&p.window===window))throw Error('本次活力灵光治疗窗口已使用或无效')
   if(!entity||entity.dead)throw Error('活力灵光不能复活死者')
   const targetC=entity.c&&world.characters.find(c=>c.id===entity.c!.id),targetState=targetC?runtimeState(targetC,cat):entity.body!
   if(targetState.effects.some(e=>e.blocksHealing))throw Error('当前目标不能恢复生命')
   const hpBefore=targetState.hp
   const roll=rollDamage('2d6',targetState.effects.some(e=>e.maximizeHealing)?s=>s:dice),amount=healingRollTotal(targetState.effects,roll)
   if(targetC)world.characters[world.characters.indexOf(targetC)]=applyRuntime(targetC,cat,{type:'heal',amount,note:'活力灵光'},dice)
   else entity.body!.hp=Math.min(entity.body!.maxHp+hpSpellBonus(entity.body!.effects),entity.body!.hp+amount)
   steedRecoveredHP(world,a,entity.id,Math.max(0,(m1Entity(world,a,entity.id)?.state.hp??hpBefore)-hpBefore))
   if(state.pulses.length>=1000)throw Error('光环窗口记录已达上限，请归档')
   state.pulses.push({castId:effect.castId,window});detail+=`；活力灵光窗口${window}，恢复${amount}HP，无附赠动作费用`
  }
 }
 reconcileWorld(world);syncNpcLifeTokens(world)
 for(const c of world.characters){
  const old=input.characters.find(o=>o.id===c.id)
  if(old&&c.revision===old.revision&&JSON.stringify([c.runtime,c.inventory])!==JSON.stringify([old.runtime,old.inventory])){
   c.revision++;c.updatedAt=new Date().toISOString()
  }
 }
 return {world,detail}
}
