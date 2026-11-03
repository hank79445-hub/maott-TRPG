import {savingRoll,defaultEnvironment,freshTurn} from './combat-rules'
import {runtimeSpells,runtimeDerived} from './runtime'
import {magicalPerceptionAllowed} from './m3-magic-perception'
import {prepareDice,sourcedDie} from './dice-source'
import type {Adventure,MapWorld} from './map-types'
import type {GmSpellRequest} from './spell-workflow-types'
import type {Spell} from './types'
import type {Catalogue} from './engine'
import type {GmSpellChoice} from '../persistence/gm-spell-choice-schema'
import {spellWorkflowPolicy} from './spell-workflow-policies'
import {G_RULES,validateGChoice} from './gm-spell-rules'
import {gEntity,gClock,gFact,validateGWorld} from './gm-spell-world'
export function gRequestContext(w:MapWorld,a:Adventure,r:Pick<GmSpellRequest,'characterId'|'targetIds'|'choice'>){
 const source=gEntity(w,a,r.characterId).entity,target=gEntity(w,a,r.choice?.subjectId??r.targetIds[0]??''),position=(e:typeof source)=>e?.token?{scene:a.scenes.find(s=>[...s.tokens,...s.defeatedTokens??[]].includes(e.token!))?.id,x:e.token.x,y:e.token.y,height:e.token.spatial?.height??0,layer:e.token.spatial?.layer??'material',anchor:e.token.spatial?.anchorId}:null
 return JSON.stringify({source:source?.id,sourceAlive:!!source&&!source.dead&&source.state.hp>0,sourcePosition:position(source),target:target.id,dead:target.entity?.dead,corpse:target.corpse?.dead,object:target.object?.enabled,position:position(target.entity),point:target.object?{x:target.object.x,y:target.object.y,height:target.object.height}:null})
}
export function createGmSpellRequest(w:MapWorld,a:Adventure,cat:Catalogue,input:{spell:Spell;characterId:string;sceneId:string;targetIds:string[];slotLevel:number;question:string;encounterId?:string;pendingId?:string;choice?:GmSpellChoice;dc?:number}){
 if(!spellWorkflowPolicy(input.spell.id))return null
 const requests=a.gmSpellRequests??=[]
 if(input.pendingId){const old=requests.find(r=>r.encounterId===input.encounterId&&r.pendingId===input.pendingId);if(old)return old}
 if(requests.filter(r=>r.status==='pending').length>=100||requests.length>=500)throw Error('法术裁定记录容量已满，请先归档')
 const source=gEntity(w,a,input.characterId).entity;if(!source)throw Error('施法者数据卡不存在')
 const clock=gClock(w,a,source.id),choice=input.choice,targetIds=(choice?.subjectId?[choice.subjectId]:input.targetIds).map(id=>gEntity(w,a,id).id)
 validateGChoice(input.spell.id,choice)
 if(['identify','beast-sense'].includes(input.spell.id)&&targetIds.some(id=>{const t=gEntity(w,a,id);return !magicalPerceptionAllowed(t.entity?.state.effects??t.object?.effects??[],'divination-target')}))throw Error('目标受到回避侦测保护')
 if(input.spell.id==='speak-with-dead'){
  if(targetIds.length!==1)throw Error('死者交谈须指定一具尸体')
  if(requests.some(r=>r.spellId===input.spell.id&&r.questionIndex===1&&gEntity(w,a,r.targetIds[0]??'').id===targetIds[0]&&clock.hours-r.castHour<240))throw Error('同一具尸体10日内不能再次受死者交谈影响')
 }
 const duration=input.spell.duration.match(/(\d+)\s+(minute|hour|day|round)/i),conc=source.c?.runtime?.concentration??source.body?.concentration,castId=input.spell.concentration?conc?.castId??crypto.randomUUID():crypto.randomUUID(),restKey=source.id+':'+(source.c?.runtime?.lastLongRestEnd??'npc-day')
 const grant=source.c&&runtimeSpells(source.c,cat).find(g=>g.spell.id===input.spell.id),dc=input.dc??(source.c&&grant?8+Math.ceil(source.c.level/4)+1+runtimeDerived(source.c,cat).mods[grant.ability]:source.body?.spellcasting?.dc)
 const r:GmSpellRequest={id:crypto.randomUUID(),castId,spellId:input.spell.id,name:input.spell.name,sceneId:input.sceneId,characterId:source.id,sourceKind:source.c?'character':'npc',sourceNpcId:source.n?.id,clockSourceId:clock.id,restKey,targetIds,slotLevel:input.slotLevel,question:input.question.trim()||input.spell.name,questionIndex:1,createdAt:new Date().toISOString(),castHour:clock.hours,endsAt:duration?clock.hours+Number(duration[1])*(duration[2]!.toLowerCase()==='day'?24:duration[2]!.toLowerCase()==='hour'?1:duration[2]!.toLowerCase()==='round'?1/600:1/60):null,concentration:input.spell.concentration,status:'pending',...(input.encounterId?{encounterId:input.encounterId,pendingId:input.pendingId}:{}),...(choice?{choice}:{}),dc,observations:[],ongoing:{point:choice?.point,mode:choice?.mode,ended:false,uses:[]}}
 if(input.spell.id==='augury'){
  const rest=source.c?.runtime?.lastLongRestEnd??0,previous=requests.filter(q=>q.spellId==='augury'&&q.characterId===source.id&&q.questionIndex===1&&(q.restKey?q.restKey===restKey:q.castHour>=rest)).length
  r.uncertaintyChance=Math.min(100,previous*25)
  if(r.uncertaintyChance){prepareDice(1,100,'卜筮：重复施法无所得概率',sourcedDie);r.uncertaintyRoll=sourcedDie(100);r.noResult=r.uncertaintyRoll<=r.uncertaintyChance}
 }
 if(input.spell.id==='sending'&&choice?.crossPlane){prepareDice(1,100,'短讯：跨位面失败概率',sourcedDie);r.uncertaintyChance=5;r.uncertaintyRoll=sourcedDie(100);r.noResult=r.uncertaintyRoll<=5}
 if(input.spell.id==='animal-messenger'){const t=gEntity(w,a,targetIds[0]??'').entity;if(!t?.body||t.body.templateMetadata?.cr===undefined)throw Error('动物信使须核实真实野兽挑战等级');if(t.body.templateMetadata.cr!=='0')r.noResult=true;else{const actor=t.actor??{id:t.id,characterId:null,npc:t.body,side:'neutral' as const,initiative:null,surprised:false,turn:freshTurn()},roll=savingRoll(actor,'cha',defaultEnvironment(),w.characters,cat,sourcedDie);r.noResult=!roll.autoFail&&roll.total>=(r.dc??99)}if(r.endsAt!==null)r.endsAt+=Math.max(0,input.slotLevel-2)*48}
 const material=choice?.materialId&&gFact(a,choice.materialId,source.id)
 if(material&&G_RULES[input.spell.id]?.material?.consume){const owner=w.characters.find(c=>c.id===material.inventoryOwnerId),row=owner?.inventory.find(i=>i.instanceId===material.inventoryInstanceId&&i.quantity>0);if(row){row.quantity--;if(!row.quantity)owner!.inventory=owner!.inventory.filter(i=>i!==row);owner!.revision++}else {const object=a.m3?.entities.find(o=>o.id===material.entityId&&o.enabled);if(!object)throw Error('实际耗材已不存在');object.enabled=false}}
 r.contextKey=gRequestContext(w,a,r);requests.push(r);return r
}
export function assertGmSpellFresh(w:MapWorld,a:Adventure,r:GmSpellRequest,cat:Catalogue){
 if(r.status!=='pending')throw Error('该法术裁定已经处理')
 const source=gEntity(w,a,r.characterId).entity;if(!source?.token||source.dead||source.state.hp<=0)throw Error('施法者已不具备资格')
 const now=gClock(w,a,source.id).hours,conc=source.c?.runtime?.concentration??source.body?.concentration
 if(r.endsAt!==null&&now>=r.endsAt)throw Error('法术持续时间已结束')
 if(r.concentration&&(conc?.spellId!==r.spellId||conc.castId&&conc.castId!==r.castId))throw Error('法术专注已结束')
 if(r.contextKey&&r.contextKey!==gRequestContext(w,a,r))throw Error('相关人物／位置／目标条件已变化，请GM复核当前条件后继续')
 if(r.choice)validateGWorld(w,a,cat,r.spellId,r.characterId,r.targetIds,r.choice,true)
}
