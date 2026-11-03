import {combatStats,freshTurn} from './combat-rules'
import {m3GroundAt} from './m3-ground'
import {rememberM3Sight} from './m3-sight-memory'
import {concentrationMatches} from './spell-source-state'
import type { MapWorld } from './map-types'
import type { Catalogue } from './engine'
import { m1Entity } from './m1-utility'
import {m3Landing} from './m3-world-cast'
import { m3State } from './m3-world-cast'
import { m3Queue } from './m3-world-actions'
import {distance} from './map'
import { sightLine } from './map-spatial'
import { spatialState } from './m3-spatial'
import { runtimeDerived, rollDie } from './runtime'
import { prepareDice } from './dice-source'

export function endM3Blink(world:MapWorld,a:import('./map-types').Adventure,s:import('./map-types').MapScene,t:import('./map-types').MapToken,key:string,dice:(n:number)=>number){
 const entity=m1Entity(world,a,t.characterId??t.npcId??t.actorId??t.id),blink=entity?.state.effects?.find(f=>f.key==='blink'),space=spatialState(t.spatial)
 if(!blink||blink.m3?.lastTurn===key)return
 blink.m3={...blink.m3,lastTurn:key};prepareDice(1,6,'闪现术：回合结束位面骰',dice)
 const roll=dice(6);if(!Number.isInteger(roll)||roll<1||roll>6)throw Error('闪现术需要有效d6面值')
 if(roll>=4&&space.layer==='material'){blink.m3.origin={x:t.x,y:t.y,height:space.height,layer:'material'};t.spatial={height:space.height,layer:'ethereal',returnOrigin:blink.m3.origin}}
}
/** No wall-clock timers: this runs in the original saved transaction. All dice
 * use the room dice source; a missing physical die rolls back the whole trial. */
export function reconcileM3World(world:MapWorld,cat:Catalogue,dice:(n:number)=>number=rollDie){
  for(const a of world.adventures){
    for(const s of a.scenes){
      const e=world.encounters.find(e=>e.id===s.encounterId),last=e?.log.at(-1)
      const ending=last?.kind==='next'&&last.before?.encounter.tick===e!.tick-1?last.before.encounter.actors[last.before.encounter.current]:undefined
      for(const t of s.tokens){
        if(t.characterId&&a.party.includes(t.characterId)&&s.id!==a.activeSceneId)continue
        if(t.npcId&&a.ai?.npcs.some(n=>n.id===t.npcId&&n.sceneId!==s.id))continue
        const entity=m1Entity(world,a,t.characterId??t.npcId??t.actorId??t.id)
        if(!entity)continue
        const state=entity.state,effects=state.effects??[];let space=spatialState(t.spatial)
        if(state.hp<=0)state.effects=effects.filter(f=>f.key!=='gaseous-form')
        const cap=entity.c?runtimeDerived(entity.c,cat).spatialCapabilities:combatStats(entity.actor??{id:entity.id,characterId:null,npc:entity.body!,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},world.characters,cat).spatialCapabilities
        t.effectiveSize=cap.size
        if(effects.some(f=>f.key==='enlarge-reduce')){
          const span=cap.size==='gargantuan'?4:cap.size==='huge'?3:cap.size==='large'?2:1
          if(t.baseSpan===undefined)t.baseSpan=t.span
          if(t.span!==span){m3Landing(s,{...t,span},{x:t.x,y:t.y,height:space.height},space.layer,space.anchorId);t.span=span}
        }else if(t.baseSpan!==undefined){t.span=t.baseSpan;delete t.baseSpan}
        for(const f of effects.filter(f=>f.key==='pass-without-trace')){
          const source=m1Entity(world,a,f.sourceId)?.token
          const sourceScene=source&&a.scenes.find(s=>s.tokens.includes(source))
          f.m3={...f.m3,withinAura:!!source&&sourceScene?.id===s.id&&spatialState(source.spatial).layer===space.layer&&(space.layer!=='pocket'||space.anchorId===source.spatial?.anchorId)&&distance(s,source,t)<=30&&sightLine(s,source!,t,'blocksTargeting').clear}
        }
        const blink=state.effects?.find(f=>f.key==='blink')
        if(blink&&space.layer==='ethereal'&&!blink.m3?.origin){state.effects=state.effects!.filter(f=>f.id!==blink.id)}
        else if(blink&&ending&&(ending.id===t.actorId||!!t.characterId&&ending.characterId===t.characterId)){
          const key=e!.id+':'+e!.tick
          if(blink.m3?.lastTurn!==key){
            blink.m3={...blink.m3,lastTurn:key}
            prepareDice(1,6,'闪现术：回合结束位面骰',dice)
            const roll=dice(6)
            if(!Number.isInteger(roll)||roll<1||roll>6)throw Error('闪现术需要有效d6面值')
            if(roll>=4&&space.layer==='material'){
              blink.m3.origin={x:t.x,y:t.y,height:space.height,layer:'material'}
              t.spatial={height:space.height,layer:'ethereal',returnOrigin:blink.m3.origin}
            }
          }
        }
        space=spatialState(t.spatial)
        const current=e?.actors[e.current],explorationMember=a.exploration?.status==='active'?a.exploration.members.find(m=>m.tokenId===t.id):undefined
        if(spatialState(t.spatial).layer==='ethereal'&&(!state.effects?.some(f=>f.key==='blink')||current&&(current.id===t.actorId||!!t.characterId&&current.characterId===t.characterId)||explorationMember&&!explorationMember.ended))
          m3Queue(a,s,t,'return',blink?.castId,'闪现回返；原消失位置与已掷结果保留')
        if(space.layer==='stone'&&a.m3?.entities.find(o=>o.id===space.anchorId)?.enabled===false)m3Queue(a,s,t,'stone-damage',undefined,'实际石体失效，请核实破坏程度和排出后果')
        if(space.layer==='stone'&&!effects.some(f=>f.key==='meld-into-stone'))m3Queue(a,s,t,'eject',undefined,'融身入石已结束，从石体入口附近退出')
        const floor=m3GroundAt(a,s,t)
        const portal=a.m3?.entities.find(o=>o.id===space.anchorId&&o.kind==='portal')
        if(space.layer==='pocket'&&(!portal?.enabled||portal.endsAt!==undefined&&(world.characters.find(c=>c.id===portal.clockSourceId)?.runtime?.hours??0)>=portal.endsAt))m3Queue(a,s,t,'eject',portal?.castId,'魔绳空间结束；所有实际生物／物品须从入口排出')
        if(effects.some(f=>f.key==='levitate')){t.spatial={...spatialState(t.spatial),liftKind:'levitate'}}
        else if(cap.fly>0||cap.hover){t.spatial={...spatialState(t.spatial),liftKind:'fly'}}
        if(space.liftKind==='levitate'&&!effects.some(f=>f.key==='levitate')&&cap.fly<=0&&!cap.hover&&space.height>floor)m3Queue(a,s,t,'descend',undefined,'浮空术已结束，轻柔降至地面，不结算普通坠落伤害')
        if(space.layer==='material'&&space.height>floor&&space.liftKind!=='levitate'&&cap.fly<=0&&!cap.hover&&!effects.some(f=>f.key==='levitate')&&!space.supportId&&!a.m3?.entities.some(o=>o.kind==='disk'&&o.enabled&&o.loadIds?.includes(entity.id)))
          m3Queue(a,s,t,'fall',undefined,'实际空中支持已失效，等待羽落反应或坠落结算')
      }
    }
    if(!a.m3)continue
    const state=a.m3
    for(const cast of state.casts.filter(c=>!c.settled&&!c.canceled&&c.encounterId)){const e=world.encounters.find(e=>e.id===cast.encounterId);if(![e?.pending,...e?.reactionParents??[]].some(p=>p?.m3WorldId===cast.id))cast.canceled=true}
    for(const object of state.entities){
      const hadLevitate=object.effects?.find(f=>f.key==='levitate')
      object.effects=object.effects?.filter(f=>{
        if(f.endsAt!==undefined&&f.endsAt<=(world.characters.find(c=>c.id===f.clockSourceId)?.runtime?.hours??0))return false
        const source=m1Entity(world,a,f.sourceId)
        return !f.concentration||concentrationMatches(f,source?.c?.runtime?.concentration??source?.body?.concentration)
      })
      if(hadLevitate&&!object.effects?.some(f=>f.key==='levitate')&&object.height>(state.environments.find(e=>e.sceneId===object.sceneId)?.floorHeight??0)&&!state.events.some(e=>e.entityId===object.id&&e.status==='pending'))state.events.push({id:crypto.randomUUID(),type:'descend',entityId:object.id,sceneId:object.sceneId,castId:hadLevitate.castId,from:{x:object.x,y:object.y,height:object.height},layer:'material',status:'pending',note:'物件浮空术已结束，轻柔降至地面'})
      if(object.endsAt!==undefined&&object.endsAt<=(world.characters.find(c=>c.id===object.clockSourceId)?.runtime?.hours??0))object.enabled=false
      if(object.layer==='pocket'){
        const portal=state.entities.find(p=>p.id===object.anchorId&&p.kind==='portal'&&p.enabled)
        if(!portal&&!state.events.some(e=>e.entityId===object.id&&e.status==='pending'))state.events.push({id:crypto.randomUUID(),type:'eject',entityId:object.id,sceneId:object.sceneId,from:{x:object.x,y:object.y,height:object.height},layer:'pocket',anchorId:object.anchorId,status:'pending',note:'魔绳结束，实际物件从入口排出，不复制库存'})
      }
      if(object.kind==='disk'&&!object.enabled){
        const s=a.scenes.find(s=>s.id===object.sceneId)
        if(s)for(const id of object.loadIds??[]){
          const target=m1Entity(world,a,id)
          if(target?.token)m3Queue(a,s,target.token,'fall',object.castId,'浮碟结束，实际载荷留在原位置并处理坠落')
          else{const item=state.entities.find(o=>o.id===id);if(item)item.height=state.environments.find(e=>e.sceneId===s.id)?.floorHeight??0}
        }
        object.loadIds=[]
      }
    }
  }
  rememberM3Sight(world,cat)
}
