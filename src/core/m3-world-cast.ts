import {itemCastFailed,itemWaivesMaterials} from './item-spells'
import {m3GroundAt} from './m3-ground'
import {magicCrossing,silenced} from './scene-magic'
import {tokenPoint} from './scene-effects'
import {dispelSpellEffects} from './spell-dispelling'
import {m3RoundKey} from './m3-space-events'
import {castM3Creature} from './m3-creature-cast'
import {M3_NATIVE_SPELLS} from './m3-spells'
import type { Adventure, MapScene, MapToken, MapWorld } from './map-types'
import type { Catalogue } from './engine'
import type { M3Cast, M3Entity, M3WorldState } from '../persistence/m3-world-schema'
import type { ActiveEffect } from './types'
import { m1Entity } from './m1-utility'
import { applyCombat } from './combat'
import { applyRuntime, runtimeSpells, runtimeState, castSlotLevel, runtimeDerived, rollDie } from './runtime'
import { defaultEnvironment, combatStats, freshTurn, savingRoll } from './combat-rules'
import { consumeNpcAbility } from './npc-abilities'
import { explorationMember, explorationRuntime, explorationSpend, assertExplorationReady } from './exploration'
import { distance, inside, blocked, occupied } from './map'
import { movementWalls,sightLine } from './map-spatial'
import { spatialState } from './m3-spatial'

export const M3_EXCLUSIVE_WORLD_SPELLS=['misty-step','floating-disk','rope-trick','meld-into-stone','arcanist-s-magic-aura','nondetection','feather-fall']
export const M3_WORLD_SPELLS=[...new Set([...M3_EXCLUSIVE_WORLD_SPELLS,...M3_NATIVE_SPELLS,'faerie-fire','dispel-magic'])]
export const m3State=(a:Adventure):M3WorldState=>a.m3??={environments:[],entities:[],events:[],casts:[],auraDays:[],reactions:[],materials:[],knowledge:[]}
export function m3Caster(world:MapWorld,a:Adventure,id:string,cat:Catalogue){
  const body=m1Entity(world,a,id)
  if(!body?.token||body.dead||body.state.hp<=0)throw Error('请选择当前场景存活且有实际数据卡的人物')
  const c=world.characters.find(c=>c.id===body.c?.id)
  const stats=c?runtimeDerived(c,cat):body.actor?combatStats(body.actor,world.characters,cat):body.body?combatStats({id:body.id,characterId:null,npc:body.body,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},world.characters,cat):undefined
  if(stats?.conditions.includes('incapacitated'))throw Error('失能者不能施法或操作')
  if(body.state.effects?.some(f=>f.key==='gaseous-form'))throw Error('气化形体不能施法或操作物件；可用专用魔法动作结束形态')
  return body
}
export function m3Landing(s:MapScene,token:MapToken,to:{x:number;y:number;height:number},layer=spatialState(token.spatial).layer,anchorId?:string,shared=false){
  if(occupied({...token,...to}).some(p=>!inside(s,p)))throw Error('落点超出场景边界')
  if(!shared&&s.tokens.some(t=>t.id!==token.id&&t.id!==token.riderTokenId&&spatialState(t.spatial).layer===layer&&spatialState(t.spatial).anchorId===anchorId&&Math.abs(spatialState(t.spatial).height-to.height)<s.grid.feet&&t.x<to.x+token.span&&t.x+t.span>to.x&&t.y<to.y+token.span&&t.y+t.span>to.y))throw Error('落点没有足够的未占用空间')
  if(layer==='material'&&movementWalls(s,{...token,...to},to,to).some(w=>(!shared||!w.gapFeet)&&(w.heightFeet===undefined||to.height<w.heightFeet)))throw Error('落点占地与实际墙体冲突，请GM核实墙高或选择足够空间')
  if(layer==='material'&&occupied({...token,...to}).some(p=>blocked(s,p)))throw Error('落点不可通行；请GM核对空间或选择其他落点')
}
export function sourceHours(world:MapWorld,id:string){
  const c=world.characters.find(c=>c.id===id)
  if(c?.runtime?.hours===undefined)throw Error('缺少已登记的冒险时钟')
  return c.runtime.hours
}
export function m3WorldCast(world:MapWorld,a:Adventure,action:M3Cast,cat:Catalogue,dice:(n:number)=>number=rollDie,settle=false){
  const state=m3State(a),scene=a.scenes.find(s=>s.id===a.activeSceneId)
  if(!scene)throw Error('请先进入实际场景')
  const caster=m3Caster(world,a,action.casterId,cat),from=caster.token!
  if(!scene.tokens.includes(from))throw Error('施法者不在当前场景')
  const grant=caster.c?runtimeSpells(caster.c,cat).find(g=>g.key===action.key):undefined
  const ability=caster.body?.abilities?.find(b=>b.id===action.key)
  const spell=grant?.spell??cat.spells.find(s=>s.id===ability?.spellId)
  if(['polymorph','alter-self','enlarge-reduce','gaseous-form'].includes(spell?.id??'')&&caster.state.effects?.some(f=>f.key==='moonbeam-no-shape'))throw Error('月华之光中不能再次变形')
  if(!grant&&action.mode!=='npc')throw Error('NPC施法方式须使用实际能力配置，不能指定任意施法环级')
  if(!spell||!M3_WORLD_SPELLS.includes(spell.id))throw Error('请选择实际可用的空间／物件法术来源')
  if(silenced(world,a,scene,from)&&/(^|[,\s])V([,\s(]|$)/.test(spell.components))throw Error('沉默区域中不能使用言语成分施法')
  if(state.events.some(e=>e.entityId===caster.id&&e.status==='pending')&&spell.id!=='feather-fall')throw Error('请先处理实际空间后果；羽落反应仍可使用')
  if(from.spatial?.layer==='stone'&&action.targets.some(id=>id!==caster.id))throw Error('石内只能施放自身法术')
  if(!M3_EXCLUSIVE_WORLD_SPELLS.includes(spell.id)&&!action.objectId)return castM3Creature(world,a,action,cat,dice)
  if(from.spatial?.layer==='stone')throw Error('石内无法看见或触及外部目标，请先合法退出石体')
  const object=state.entities.find(e=>e.id===action.objectId&&e.sceneId===scene.id&&e.enabled)
  if(object?.boundCharacterId&&world.characters.find(c=>c.id===object.boundCharacterId)?.runtime?.effects?.some(f=>f.key==='gaseous-form'))throw Error('气化形体携带的物品不能被使用或操作')
  if(object&&(object.layer??'material')!==spatialState(from.spatial).layer)throw Error('物件与来源不在同一可互动空间')
  const targets=action.targets.map(id=>m1Entity(world,a,id))
  const objectSpell=['floating-disk','rope-trick','meld-into-stone'].includes(spell.id)||!!object
  if(new Set(action.targets).size!==action.targets.length)throw Error('目标不能重复')
  if(objectSpell&&action.targets.some(id=>id!==caster.id&&id!==from.id&&id!==caster.actor?.id))throw Error('物件／位置施法使用施法者作为结算占位，真实目标另存')
  if(spell.id==='feather-fall'){
    if(targets.some(t=>t?.token&&spatialState(t.token.spatial).layer!==spatialState(from.spatial).layer))throw Error('羽落目标须处于同一可互动空间')
    if(targets.length>5||targets.some(t=>!t?.token||!state.events.some(e=>e.entityId===t.id&&e.type==='fall'&&e.status==='pending')||distance(scene,from,t.token)>60||!sightLine(scene,from,t.token).clear))throw Error('羽落术须选择60尺内至多5个实际正在坠落且可见的生物')
  }else if(!objectSpell&&(targets.some(t=>!t?.token||!scene.tokens.includes(t.token))||targets.length!==1))throw Error('此法术须指定一个本场景实际生物目标')
  if(['levitate','enlarge-reduce','faerie-fire'].includes(spell.id)&&!object)throw Error('该入口处理物件版本；生物版本请使用原施法入口')
  const target=targets[0]
  const touch=()=>{const to=object?{...object,spatial:{height:object.height,layer:'material' as const}}:target?.token;if(!to||distance(scene,from,to)>5||!sightLine(scene,from,to,'blocksTargeting').clear)throw Error('实际目标必须可触及且没有实体阻隔')}
  if(spell.id==='misty-step'){
    if(from.spatial?.layer==='pocket')throw Error('此魔绳空间没有可验证的独立内部地图；不能用迷踪步绕过实际入口')
    if(!action.to||action.targets.length!==1||target?.id!==caster.id)throw Error('迷踪步只能传送自身，请选目的地')
    const facts=state.environments.find(f=>f.sceneId===scene.id),floor=facts?.floorHeight??0
    if(action.to.height<floor||action.to.height>floor&&!facts||facts&&!facts.openSky&&action.to.height+scene.grid.feet>facts.ceilingHeight!)throw Error('目的高度须符合已核实地面和天花板／开放天空')
    const to={...action.to,spatial:{...spatialState(from.spatial),height:action.to.height}}
    if(distance(scene,from,to)>30||!sightLine(scene,from,to).clear)throw Error('迷踪步落点必须在30尺内且实际可见')
    m3Landing(scene,from,action.to)
    magicCrossing(world,a,scene,tokenPoint(from),{...action.to,x:action.to.x+from.span/2,y:action.to.y+from.span/2},caster.id,{teleport:true})
  }else if(spell.id==='floating-disk'){
    if(!action.to||action.to.height!==m3GroundAt(a,scene,action.to)+3)throw Error('浮碟须在离地3尺的已核实地面上方出现')
    if(distance(scene,from,{...action.to,spatial:{height:action.to.height,layer:'material'}})>30||!sightLine(scene,from,action.to).clear)throw Error('浮碟出现点须在30尺内可见')
    m3Landing(scene,{...from,id:'new-disk',span:1},action.to)
  }else if(spell.id==='rope-trick'){
    touch()
    if(!object||object.kind!=='rope'||object.heightFeet<=0||!object.enabled)throw Error('魔绳术必须关联实际绳索及已核实长度')
  }else if(spell.id==='meld-into-stone'){
    touch()
    const size=caster.c?runtimeDerived(caster.c,cat).currentSize:caster.body?.size??'medium'
    const fit=['large','huge','gargantuan'].includes(size)?from.span*scene.grid.feet:scene.grid.feet
    if(!object||object.kind!=='stone'||Math.min(object.width,object.heightFeet,object.depth)<fit)throw Error('融身入石需要实际可容纳人物及装备的石体')
  }else if(spell.id==='arcanist-s-magic-aura'){
    touch()
    if(object){if(!object.loose||object.boundCharacterId||action.choice?.option!=='false-aura'||action.choice.magical===undefined)throw Error('虚假灵光只用于未穿戴／未携带物品，须选魔法或非魔法灵光')}
    else if(!action.willing||action.choice?.option!=='mask'||!action.choice.creatureType)throw Error('生物须自愿，并指定伪装生物类型')
  }else if(spell.id==='levitate'||spell.id==='enlarge-reduce'){
    if(!object||!object.loose||object.boundCharacterId||distance(scene,from,{...object,spatial:{height:object.height,layer:'material'}})>(spell.id==='levitate'?60:30)||!sightLine(scene,from,object).clear)throw Error('目标必须是施法范围内实际可见、未穿戴／未携带的物件')
    if(spell.id==='levitate'&&(object.weight>500||!action.to||action.to.x!==object.x||action.to.y!==object.y||action.to.height<object.height||action.to.height-object.height>20))throw Error('浮空术物件须至多500磅，初始仅向上移动至多20尺')
    if(spell.id==='enlarge-reduce'&&!['enlarge','reduce'].includes(action.choice?.option??''))throw Error('请选择物件变大或缩小')
  }else if(spell.id==='faerie-fire'){
    if(!object||distance(scene,from,{...(action.to??object),spatial:{height:action.to?.height??object.height,layer:'material'}})>60||!sightLine(scene,from,action.to??object).clear)throw Error('妖火立方起点必须在60尺内，实际物件作为范围锚点')
  }else if(spell.id==='dispel-magic'){
    if(!object||distance(scene,from,{...object,spatial:{height:object.height,layer:'material'}})>120||!sightLine(scene,from,object,'blocksTargeting').clear)throw Error('请选择120尺内没有完全遮挡的实际物件／魔法产物')
  }else if(spell.id==='nondetection'){
    touch()
    if(object&&Math.max(object.width,object.depth,object.heightFeet)>10)throw Error('回避侦测的物品／地点任意方向不得大于10尺')
    if(!object&&!action.willing)throw Error('回避侦测生物须自愿')
    if(!settle&&!itemWaivesMaterials(grant)){
      const owner=caster.c,material=a.m1Utility?.materials.find(m=>m.characterId===owner?.id&&m.instanceId===action.materialId&&m.kind==='diamond-dust'&&m.valueGP>=25)
      const row=owner?.inventory.find(r=>r.instanceId===material?.instanceId&&r.quantity>=1)
      const supply=caster.n?.consumables?.find(c=>c.id===action.materialId),npcMaterial=state.materials?.find(m=>m.ownerId===caster.id&&m.instanceId===supply?.id&&m.valueGP>=25)
      if(!row&&(!supply||!npcMaterial||supply.quantity-(caster.n?.consumablesUsed?.[supply.id]??0)<1))throw Error('回避侦测需要已核验价值至少25GP的实际钻石尘；金币、整颗钻石和银粉不能替代')
    }
  }
  const battle=world.encounters.find(e=>e.id===scene.encounterId&&e.phase==='active')
  if(spell.id==='feather-fall'&&!settle&&!battle&&!explorationMember(a,from.id)){
    state.reactions??=[];const round=m3RoundKey(world,a,scene)
    if(state.reactions.some(r=>r.sourceId===caster.id&&r.round===round))throw Error('本轮反应已经使用；请明确推进下一轮或6秒冒险时间')
    state.reactions=state.reactions.filter(r=>r.sourceId!==caster.id).concat({sourceId:caster.id,round})
  }
  const actor=battle?.actors.find(t=>t.characterId===caster.c?.id||t.id===caster.actor?.id||!!caster.n&&t.npcId===caster.n.id)
  let saved=settle?state.casts.find(c=>c.id===battle?.pending?.m3WorldId&&!c.settled&&!c.canceled):undefined
  if(settle){
    if(!saved||JSON.stringify(saved.action)!==JSON.stringify(action)||!battle?.pending)throw Error('空间施法窗口已变化、被反制或已结算')
    delete battle.pending.m3WorldId
    const result=applyCombat(battle,world.characters,cat,{type:'resolve',nonlethal:false,savage:false,stone:false,relentless:false,pushConfirmed:false},dice)
    world.encounters[world.encounters.indexOf(battle)]=result.encounter;world.characters=result.characters
  }else{
    if(state.casts.length>=2000)throw Error('空间施法记录达到上限，请先归档')
    const clockSourceId=caster.c?.id??world.characters.find(c=>a.party.includes(c.id)&&c.runtime)?.id
    if(!clockSourceId)throw Error('NPC空间施法需要有效冒险时钟')
    const duration=spell.duration.match(/(\d+)\s*(minute|hour|day)/i)
    const hours=duration?Number(duration[1])*(duration[2]!.toLowerCase()==='day'?24:duration[2]!.toLowerCase()==='hour'?1:1/60):0
    const id=crypto.randomUUID()
    saved={id,spellId:spell.id,castHour:sourceHours(world,clockSourceId),castId:id,action:structuredClone(action),sceneId:scene.id,clockSourceId,endsAt:sourceHours(world,clockSourceId)+hours,settled:false,...(battle?{encounterId:battle.id}:{})}
    if(battle){
      if(!actor||battle.pending)throw Error('请先处理待结算，且施法者必须参战')
      const command=grant?{type:'cast' as const,actorId:actor.id,key:grant.key,mode:action.mode,targets:spell.id==='feather-fall'?targets.map(t=>battle.actors.find(a=>a.characterId===t?.c?.id||a.id===t?.actor?.id)?.id??''): [actor.id],env:{...defaultEnvironment(),note:action.note},damageType:'force' as const,requirementsConfirmed:true,triggerConfirmed:spell.id==='feather-fall',m3WorldId:id}:
        {type:'npc-ability' as const,actorId:actor.id,abilityId:ability!.id,targetIds:spell.id==='feather-fall'?targets.map(t=>battle.actors.find(a=>a.characterId===t?.c?.id||a.id===t?.actor?.id)?.id??''):[actor.id],env:defaultEnvironment(),confirmed:true,note:action.note,m3WorldId:id}
      const result=applyCombat(battle,world.characters,cat,command,dice)
      if(grant&&itemCastFailed(result.characters.find(c=>c.id===caster.c?.id),grant.key)){world.encounters[world.encounters.indexOf(battle)]=result.encounter;world.characters=result.characters;return '卷轴施法检定失败，卷轴和行动已消耗，没有法术效果'}
      if(!result.encounter.pending)throw Error('未能建立实际施法窗口')
      result.encounter.pending.m3WorldId=id
      world.encounters[world.encounters.indexOf(battle)]=result.encounter;world.characters=result.characters
    }else if(grant&&caster.c){
      const command={type:'cast' as const,key:grant.key,mode:action.mode,requirementsConfirmed:true,deferEffects:true}
      explorationRuntime(world,a,caster.c.id,command,cat)
      world.characters[world.characters.indexOf(caster.c)]=applyRuntime(caster.c,cat,command,dice)
      if(itemCastFailed(world.characters.find(c=>c.id===caster.c!.id),grant.key))return '卷轴施法检定失败，卷轴和行动已消耗，没有法术效果'
    }else{
      const budget=explorationMember(a,from.id)
      if(budget){assertExplorationReady(world,a,budget,cat);if(ability!.cost!=='none')explorationSpend(budget,ability!.cost,true)}
      if(!ability)throw Error('NPC没有实际施法能力')
      consumeNpcAbility(caster.body!,ability.id)
      caster.body!.effects=caster.body!.effects.filter(f=>f.key!=='invisibility')
      if(spell.concentration)caster.body!.concentration={spellId:spell.id,castId:saved.castId,clockSourceId,endsAt:saved.endsAt,encounterId:'outside'}
    }
    if(spell.id==='nondetection'&&!itemWaivesMaterials(grant)){
      const owner=world.characters.find(c=>c.id===caster.c?.id)
      if(owner){const row=owner.inventory.find(r=>r.instanceId===action.materialId)!;row.quantity--;if(!row.quantity)owner.inventory=owner.inventory.filter(r=>r!==row)}
      else{const n=caster.n!;n.consumablesUsed??={};n.consumablesUsed[action.materialId!]=(n.consumablesUsed[action.materialId!]??0)+1}
    }
    saved.castHour=sourceHours(world,clockSourceId);saved.endsAt=saved.castHour+hours
    state.casts.push(saved)
    if(spell.concentration){const live=m1Entity(world,a,caster.id);saved.castId=live?.c?.runtime?.concentration?.castId??live?.body?.concentration?.castId??saved.castId}
    if(battle)return '空间施法已支付实际费用，原目标与环境已保存，等待反制及最终结算'
  }
  saved!.settled=true
  const liveCaster=m1Entity(world,a,caster.id)!,liveTarget=target?m1Entity(world,a,target.id):undefined
  const effect:ActiveEffect={id:crypto.randomUUID(),key:spell.id,spellId:spell.id,spellLevel:castSlotLevel(action.mode)||ability?.slotLevel||spell.level,castId:saved!.castId,sourceId:caster.id,clockSourceId:saved!.clockSourceId,
    name:spell.name,page:spell.source.page,concentration:spell.concentration,expiresAt:null,encounterId:'outside',phase:'start',endsAt:saved!.endsAt,visibility:'owner',note:'实际空间／物件施法来源'}
  if(spell.id==='misty-step'){
    liveCaster.token!.x=action.to!.x;liveCaster.token!.y=action.to!.y;liveCaster.token!.spatial={...spatialState(liveCaster.token!.spatial),height:action.to!.height}
  }else if(['floating-disk','rope-trick'].includes(spell.id)){
    const disk=spell.id==='floating-disk'
    const entity:M3Entity={id:crypto.randomUUID(),sceneId:scene.id,name:spell.name,kind:disk?'disk':'portal',x:disk?action.to!.x:object!.x,y:disk?action.to!.y:object!.y,height:disk?action.to!.height:object!.height+object!.heightFeet,
      width:3,heightFeet:disk?0:5,depth:disk?3:0,weight:0,loose:false,enabled:true,hidden:!disk,sourceId:caster.id,clockSourceId:saved!.clockSourceId,castId:saved!.castId,endsAt:saved!.endsAt,loadIds:[],targetIds:[],anchorId:object?.id}
    if(state.entities.length>=1000)throw Error('空间实体达到上限')
    state.entities.push(entity)
  }else if(spell.id==='meld-into-stone'){
    const token=liveCaster.token!
    token.spatial={height:object!.height,layer:'stone',anchorId:object!.id}
    effect.m3={origin:{x:token.x,y:token.y,height:object!.height,layer:'material'}}
    liveCaster.state.effects=(liveCaster.state.effects??[]).concat(effect)
  }else if(spell.id==='dispel-magic'){
    const rows:ActiveEffect[]=[...(object!.effects??[])]
    if(object!.castId){const cast=state.casts.find(c=>c.castId===object!.castId);if(cast)rows.push({...effect,id:'entity-'+object!.id,key:cast.spellId,spellId:cast.spellId,spellLevel:cat.spells.find(s=>s.id===cast.spellId)?.level??3,castId:object!.castId})}
    const outcome=dispelSpellEffects(rows,castSlotLevel(action.mode)||ability?.slotLevel||3,()=>{throw Error('高于3环的物件法术不在当前自动解除范围，请GM另行裁定')})
    const lift=object!.effects?.find(f=>f.key==='levitate'&&outcome.removed.includes(f.id));if(lift&&!state.events.some(e=>e.entityId===object!.id&&e.status==='pending'))state.events.push({id:crypto.randomUUID(),type:'descend',entityId:object!.id,sceneId:scene.id,castId:lift.castId,from:{x:object!.x,y:object!.y,height:object!.height},layer:'material',status:'pending',note:'物件浮空已解除，轻柔降至实际地面'})
    object!.effects=(object!.effects??[]).filter(f=>!outcome.removed.includes(f.id));if(outcome.removed.includes('entity-'+object!.id))object!.enabled=false
  }else if(['levitate','enlarge-reduce','faerie-fire'].includes(spell.id)){
    effect.m3=action.choice
    if(spell.id==='faerie-fire'){
      effect.visibility='public'
      const origin=action.to??{x:object!.x,y:object!.y,height:object!.height}
      const within=(p:{x:number;y:number},height:number)=>p.x>=origin.x&&p.y>=origin.y&&(p.x-origin.x)*scene.grid.feet<20&&(p.y-origin.y)*scene.grid.feet<20&&height>=origin.height&&height<origin.height+20
      for(const item of state.entities.filter(item=>item.enabled&&item.sceneId===scene.id&&(item.layer??'material')===spatialState(from.spatial).layer&&within(item,item.height)))item.effects=[...(item.effects??[]),JSON.parse(JSON.stringify({...effect,id:crypto.randomUUID()}))]
      const abilityMod=liveCaster.c?runtimeDerived(liveCaster.c,cat).mods[grant!.ability]:Math.floor(((liveCaster.body?.scores[ability?.ability??liveCaster.body.spellcasting?.ability??'wis']??10)-10)/2)
      const dc=grant?.item?.dc??(liveCaster.c?8+Math.ceil(liveCaster.c.level/4)+1+abilityMod:liveCaster.body?.spellcasting?.dc??8+2+abilityMod)
      for(const token of scene.tokens.filter(t=>spatialState(t.spatial).layer===spatialState(from.spatial).layer&&within(t,spatialState(t.spatial).height)&&sightLine(scene,origin,t,'blocksTargeting').clear)){
        const victim=m1Entity(world,a,token.characterId??token.npcId??token.actorId??token.id)
        if(!victim)continue
        const actor=victim.actor??{id:token.id,characterId:victim.c?.id??null,npc:victim.body??null,side:'neutral' as const,initiative:null,surprised:false,turn:freshTurn()}
        const result=savingRoll(actor,'dex',defaultEnvironment(),world.characters,cat,dice)
        if(result.autoFail||result.total<dc)victim.state.effects=(victim.state.effects??[]).concat({...effect,id:crypto.randomUUID()})
      }
    }else{
      object!.effects=[...(object!.effects??[]),JSON.parse(JSON.stringify(effect))]
      if(spell.id==='levitate')object!.height=action.to!.height
    }
  }else if(spell.id==='nondetection'||spell.id==='arcanist-s-magic-aura'){
    effect.m3=action.choice
    if(object){object.effects=[...(object.effects??[]).filter(f=>!(f.key===spell.id&&f.sourceId===caster.id)),JSON.parse(JSON.stringify(effect))]}
    else{
      const recipient=liveTarget!
      recipient.state.effects=(recipient.state.effects??[]).filter(f=>!(f.key===spell.id&&f.sourceId===caster.id)).concat(effect)
    }
  }else if(spell.id==='feather-fall'){
    for(const t of targets){const recipient=m1Entity(world,a,t!.id)!;recipient.state.effects=(recipient.state.effects??[]).concat({...effect,id:crypto.randomUUID()})}
  }
  return spell.name+'已在实际目标／空间结算；没有重复扣费'
}
