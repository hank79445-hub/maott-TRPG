import {m3GroundAt} from './m3-ground'
import type { Adventure, MapWorld, MapScene, MapToken } from './map-types'
import type { Catalogue } from './engine'
import type { M3Action } from '../persistence/m3-world-schema'
import { m1Entity } from './m1-utility'
import { m3Landing, m3State } from './m3-world-cast'
import { spatialState } from './m3-spatial'
import {m3Airspace} from './m3-world-actions'
import { distance } from './map'
import { sightLine } from './map-spatial'
import { applyWorldRuntime } from './world-runtime'
import { adjustDamage, defenses, freshTurn, rollDamage } from './combat-rules'
import { prepareDice } from './dice-source'
import { rollDie } from './runtime'
export function m3RoundKey(world:MapWorld,a:Adventure,s:MapScene){
  const battle=world.encounters.find(e=>e.id===s.encounterId&&e.phase==='active')
  if(battle)return battle.id+':round:'+battle.round
  if(a.exploration?.status==='active')return a.exploration.roundId
  return 'time:'+Math.floor((world.characters.find(c=>a.party.includes(c.id))?.runtime?.hours??0)*600+1e-7)
}
export function m3Hazard(world:MapWorld,a:Adventure,id:string,amount:number,type:import('./combat-types').DamageType,cat:Catalogue,dice:(n:number)=>number){
  const entity=m1Entity(world,a,id)
  if(!entity)throw Error('后果目标的实际数据卡已失效')
  const before=entity.state.hp
  if(entity.c){const actor=entity.actor??{id:entity.id,characterId:entity.c.id,npc:null,side:'neutral' as const,initiative:null,surprised:false,turn:freshTurn()},adjusted=adjustDamage(amount,type,defenses(actor,world.characters,cat));if(adjusted)applyWorldRuntime(world,entity.c.id,cat,{type:'damage',amount:adjusted,damageType:type,note:'实际空间／区域后果，已核对真实抗性'},dice)}
  else{
    const actor=entity.actor??{id:entity.token!.id,characterId:null,npc:entity.body!,side:'neutral' as const,initiative:null,surprised:false,turn:freshTurn()}
    const damage=adjustDamage(amount,type,defenses(actor,world.characters,cat))
    const absorbed=Math.min(entity.body!.temporaryHp,damage)
    entity.body!.temporaryHp-=absorbed;entity.body!.hp=Math.max(0,entity.body!.hp-damage+absorbed)
    if(!entity.body!.hp)delete entity.body!.concentration
    else if(damage>absorbed&&entity.body!.concentration)entity.body!.concentration.pendingDC=Math.max(entity.body!.concentration.pendingDC??0,10,Math.floor((damage-absorbed)/2))
  }
  return before-m1Entity(world,a,id)!.state.hp
}
export function settleM3Event(world:MapWorld,a:Adventure,action:Extract<M3Action,{operation:'event'}>,cat:Catalogue,dice:(n:number)=>number=rollDie){
  const state=m3State(a),event=state.events.find(e=>e.id===action.eventId&&e.status==='pending')
  const entity=event&&m1Entity(world,a,event.entityId),object=state.entities.find(o=>o.id===event?.entityId),s=a.scenes.find(s=>s.id===event?.sceneId)
  if(!event||!s||!entity?.token&&!object)throw Error('空间后果已处理或实际目标已失效')
  if(event.type==='stone-damage'&&action.stoneDamage==='minor'){
    if(!state.entities.find(o=>o.id===event.anchorId)?.enabled)throw Error('石体被标为失效，请先核实并修正石体事实')
    event.status='resolved';event.damage=0;event.note=action.note;return '石体轻微损伤，未排出人物或造成伤害'
  }
  if(!action.to)throw Error('请选择实际落点')
  const to=action.to,t=entity?.token??{id:object!.id,characterId:null,actorId:null,name:object!.name,x:object!.x,y:object!.y,span:1,hidden:object!.hidden,color:'#335566',facing:0}
  m3Airspace(a,s,to.height)
  m3Landing(s,t,to,'material')
  const floor=m3GroundAt(a,s,event.from)
  if(event.type==='return'){
    const origin=t.spatial?.returnOrigin??entity?.state.effects?.find(f=>f.key==='blink')?.m3?.origin??event.from
    const inRange=distance(s,{...origin,spatial:{height:origin.height,layer:'material'}},{...to,spatial:{height:to.height,layer:'material'}})<=10
    if(!inRange){
      const candidates:{x:number;y:number;height:number}[]=[]
      for(let y=0;y<s.grid.rows;y++)for(let x=0;x<s.grid.columns;x++){
        const cell={x,y,height:origin.height}
        try{m3Landing(s,t,cell,'material');candidates.push(cell)}catch{ /* occupied geometry is not a candidate */ }
      }
      if(candidates.some(c=>distance(s,origin,c)<=10))throw Error('10尺内仍有未占用空间，不能选择更远的闪现落点')
      const nearest=Math.min(...candidates.map(c=>distance(s,origin,c)))
      if(distance(s,{...origin,spatial:{height:origin.height,layer:'material'}},{...to,spatial:{height:to.height,layer:'material'}})!==nearest)throw Error('10尺内没有空位时必须选择最近的实际未占用空间')
    }else if(!sightLine(s,origin,to).clear)throw Error('10尺内的闪现回返落点必须可见')
  }else if(event.type==='fall'||event.type==='descend'){
    if(to.x!==event.from.x||to.y!==event.from.y||to.height>event.from.height||to.height<floor)throw Error('升降／坠落须沿实际竖直位置，不能借此任意移位')
  }else if(event.type==='eject'||event.type==='stone-damage'){
    // An ejection chooses an adjacent/nearest vacant space, not an arbitrary teleport.
    if(to.height!==event.from.height)throw Error('排出必须先回到实际入口高度，不能借排出改变高度')
    if(distance(s,event.from,to)>s.grid.feet){
      const candidates:{x:number;y:number}[]=[]
      for(let y=0;y<s.grid.rows;y++)for(let x=0;x<s.grid.columns;x++)try{m3Landing(s,t,{x,y,height:to.height},'material');candidates.push({x,y})}catch{}
      if(distance(s,event.from,to)!==Math.min(...candidates.map(c=>distance(s,event.from,c))))throw Error('排出须选择入口附近最近的实际空位')
    }
  }
  let taken=0
  if(event.type==='descend'&&to.height!==floor)throw Error('浮空结束须轻柔降至实际地面／平台，不能停在无支持空中')
  if(event.type==='fall'&&to.height>=event.from.height)throw Error('坠落必须实际下降')
  if(event.type==='fall'){
    const feather=entity?.state.effects?.some(f=>f.key==='feather-fall'),height=Math.max(0,event.from.height-to.height)
    if(!feather&&to.height!==floor)throw Error('没有羽落支持时须结算至实际地面／平台，不能任意悬停')
    if(feather){
      const round=m3RoundKey(world,a,s)
      if(t.spatial?.fallUsedAt===round)throw Error('本轮羽落下降已经处理，请明确推进下一轮或6秒冒险时间')
      if(height>60)throw Error('羽落术每轮下降至多60尺')
      t.spatial={...spatialState(t.spatial),fallUsedAt:round}
    }else if(entity&&height>=10){
      const count=Math.min(20,Math.floor(height/10))
      prepareDice(count,6,'坠落：每10尺1d6钝击，至多20d6',dice)
      const raw=rollDamage(count+'d6',dice).total
      taken=m3Hazard(world,a,entity.id,raw,'bludgeoning',cat,dice);event.damage=taken
    }
    if(entity&&to.height===floor&&feather)m1Entity(world,a,entity.id)!.state.effects=m1Entity(world,a,entity.id)!.state.effects!.filter(f=>f.key!=='feather-fall')
  }
  if(event.type==='stone-damage'){
    if(!entity||!action.stoneDamage)throw Error('请核实石体的实际破坏程度')
    const raw=action.stoneDamage==='destroyed'?50:rollDamage('6d6',dice).total
    taken=m3Hazard(world,a,entity.id,raw,'force',cat,dice);event.damage=taken
    m1Entity(world,a,entity.id)!.state.effects=m1Entity(world,a,entity.id)!.state.effects!.filter(f=>f.key!=='meld-into-stone')
  }
  if(entity){
    t.x=to.x;t.y=to.y;t.spatial={height:to.height,layer:'material',...(t.spatial?.fallUsedAt?{fallUsedAt:t.spatial.fallUsedAt}:{})}
    const live=m1Entity(world,a,entity.id)!.state
    if((taken>0&&event.type==='fall'||event.type==='stone-damage')&&!live.conditions?.includes('prone'))live.conditions=[...(live.conditions??[]),'prone']
  }else{object!.x=to.x;object!.y=to.y;object!.height=to.height;object!.layer='material';delete object!.anchorId;if(event.type==='eject'&&to.height>floor)state.events.push({id:crypto.randomUUID(),type:'fall',entityId:object!.id,sceneId:s.id,from:structuredClone(to),layer:'material',status:'pending',note:'物件排出后核实实际落地'})}
  event.to=structuredClone(to);event.status='resolved';event.note=action.note
  return '空间后果已结算一次，原法术收益未因等待延长'
}
