import type {AdventureState} from './map-types'
import type {Character} from './types'
import type {Encounter} from './combat-types'
import {S_NATIVE_SPIRITS,S_RULES} from './summon-rules'
export function validateSummonState(a:AdventureState,characters:Character[],encounters:Encounter[]){
 const state=a.summons;if(!state)return
 if(new Set(state.instances.map(i=>i.id)).size!==state.instances.length||new Set(state.drafts.map(i=>i.id)).size!==state.drafts.length)throw Error('召唤实例／创建事务ID重复')
 if(new Set(state.drafts.map(i=>i.receipt)).size!==state.drafts.length)throw Error('召唤创建凭据重复')
 const exists=(id:string)=>characters.some(c=>c.id===id)||a.ai?.npcs.some(n=>n.id===id)||a.scenes.some(s=>s.tokens.some(t=>[t.id,t.npcId,t.actorId].includes(id)))||state.instances.some(i=>i.id===id)
 for(const i of state.instances){
  if(i.kind!==S_RULES[i.spellId].kind||i.kind==='force'&&i.body!==null||i.kind!=='force'&&!i.body)throw Error('召唤实体类别与实际数据不一致')
  if(i.state==='present'&&!i.position)throw Error('在场召唤物缺少实际位置')
  if(i.position){const s=a.scenes.find(s=>s.id===i.position!.sceneId);if(!s||i.position.x+i.position.span>s.grid.columns||i.position.y+i.position.span>s.grid.rows)throw Error('召唤实例位置引用无效')}
  if(i.state==='present'&&i.control==='controlled'&&(!exists(i.sourceEntityId)||!i.controllerId||!exists(i.controllerId)))throw Error('召唤来源／控制者引用无效')
  if(new Set(i.receipts.map(r=>r.id)).size!==i.receipts.length)throw Error('召唤操作凭据重复')
  if(new Set(i.actorRefs.map(r=>r.encounterId+':'+r.actorId)).size!==i.actorRefs.length)throw Error('召唤Actor映射重复')
  for(const ref of i.actorRefs){const actor=encounters.find(e=>e.id===ref.encounterId)?.actors.find(t=>t.id===ref.actorId);if(actor?.companion?.instanceId&&(actor.companion.instanceId!==i.id||actor.companion.castId!==i.castId&&!i.priorCastIds?.includes(actor.companion.castId??'')||actor.companion.sourceEntityId!==i.sourceEntityId))throw Error('Actor已关联其他召唤实例')}
  if((S_NATIVE_SPIRITS as readonly string[]).includes(i.spellId)&&state.instances.some(other=>other.id!==i.id&&other.castId===i.castId))throw Error('同一次灵魄施放不能复制实体')
 }
 for(const d of state.drafts){if(d.status==='pending'&&!exists(d.sourceEntityId))throw Error('待创建施法来源缺失');if(!a.scenes.some(s=>s.id===d.position.sceneId))throw Error('创建事务场景缺失')}
}
