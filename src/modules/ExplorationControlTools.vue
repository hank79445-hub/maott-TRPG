<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,ref,watch} from 'vue'
import type {RoomView,RoomCommand} from '../online/protocol'
import type {ExplorationCommand} from '../core/exploration-types'
const props=defineProps<{view:RoomView;busy:boolean}>(),emit=defineEmits<{command:[RoomCommand]}>()
const waker=ref('')
const scene=computed(()=>props.view.world?.adventures[0]?.scenes.find(s=>s.id===props.view.world?.adventures[0]?.activeSceneId))
const selected=ref(''),kind=ref<Extract<ExplorationCommand,{operation:'control-ruling'}>['kind']>('end'),inside=ref(true),visible=ref(true),confirmed=ref(false),note=ref('')
const rows=computed(()=>{
 const w=props.view.world,a=w?.adventures[0],s=a?.scenes.find(s=>s.id===a.activeSceneId)
 return s?.tokens.flatMap(t=>{
  const n=a?.ai?.npcs.find(n=>n.id===t.npcId),actor=w?.encounters.flatMap(e=>e.actors).find(a=>a.id===(t.actorId??n?.actorId)),effects=w?.characters.find(c=>c.id===t.characterId)?.runtime?.effects??actor?.npc?.effects??n?.body?.effects??t.npcBody?.effects??[]
  return effects.filter(f=>f.endDamage||['sleep','hypnotic-pattern','command','fear','suggestion','calm-emotions','crown-of-madness','phantasmal-force','compelled-duel','zone-of-truth','feign-death','bestow-curse'].includes(f.key)).map(f=>({token:t,effect:f,scene:s}))
 })??[]
})
const row=computed(()=>rows.value.find(r=>r.effect.id===selected.value))
const options=computed(()=>[
 ...(row.value?.effect.endDamage?[{id:'end-damage',name:'GM确认目标实际下一回合末，结算一次延迟伤害'}]:[]),
 {id:'end',name:'GM确认实际结束条件／解除本来源'},
 ...(row.value&&['sleep','hypnotic-pattern'].includes(row.value.effect.key)?[{id:'wake',name:'另一人物5尺内花动作摇醒'}]:[]),
 ...(row.value?.effect.key==='fear'?[{id:'fear-context',name:'确认本轮实际路线及结束时视线'}]:[]),
 ...(row.value?.effect.key==='command'?[{id:'command-complete',name:'确认指定命令实际执行完成'}]:[]),
 ...(row.value?.effect.key==='phantasmal-force'?[{id:'illusion-study',name:'研究动作调查'},{id:'illusion-damage',name:'来源本轮危险幻象伤害（2d8心灵）'}]:[]),
 ...(row.value?.effect.key==='zone-of-truth'?[{id:'truth-presence',name:'登记实际进入／离开范围'}]:[]),
 ...(row.value?.effect.key==='crown-of-madness'?[{id:'maintain-crown',name:'来源魔法动作维持'},{id:'crown-no-target',name:'GM确认受术者本轮触及内没有合法近战目标'}]:[]),
])
watch(rows,r=>{if(!r.some(r=>r.effect.id===selected.value))selected.value=r[0]?.effect.id??''},{immediate:true})
watch(selected,()=>{kind.value='end';note.value='';confirmed.value=false})
function submit(){const r=row.value;if(!r)return;emit('command',{kind:'map',command:{type:'explore',sceneId:r.scene.id,command:{operation:'control-ruling',...(kind.value==='wake'?{wakerTokenId:waker.value}:{}),tokenId:r.token.id,effectId:r.effect.id,kind:kind.value,inside:inside.value,sourceVisible:visible.value,confirmed:confirmed.value,note:note.value}}})}
</script>
<template>
 <details v-if="rows.length&&!view.encounter?.phase?.includes('active')" class="battle-card m2-control-form">
  <summary>{{ controlText('operations.ongoingControlOutsideCombatGmFollowUpResolution') }}</summary>
  <label>{{ controlText('domain.characterSources') }}<select v-model="selected"><option v-for="r in rows" :key="r.effect.id" :value="r.effect.id">{{localizedEntryName(r.token)}} · {{localizedEntryName(r.effect)}}</option></select></label>
  <label>{{ controlText('domain.process') }}<select v-model="kind"><option v-for="o in options" :key="o.id" :value="o.id">{{localizedEntryName(o)}}</option></select></label>
  <label v-if="kind==='wake'">{{ controlText('field.actualAwakener') }}<select v-model="waker"><option value="">{{ controlText('operations.chooseACharacterMustJoinExplorationRounds') }}</option><option v-for="t in scene?.tokens.filter(t=>t.id!==row?.token.id)??[]" :key="t.id" :value="t.id">{{localizedEntryName(t)}}</option></select></label>
  <label v-if="kind==='fear-context'||kind==='truth-presence'"><input v-model="inside" type="checkbox" />{{kind==='fear-context'?controlText('expressionOne.safeRouteExistsDashAndMovingAwayActually'):controlText('expressionOne.currentlyInsideActualAreaAlias168')}}</label>
  <label v-if="kind==='fear-context'"><input v-model="visible" type="checkbox" />{{ controlText('field.sourceOfFearStillInSightAtTurn') }}</label>
  <p class="muted">{{ controlText('adjudication.startExplorationRoundsAndIncludeTheSourceAnd') }}</p>
  <label>{{ controlText('field.confirmationBasis') }}<textarea v-model="note" maxlength="2000" rows="2" /></label>
  <label><input v-model="confirmed" type="checkbox" />{{ controlText('field.gmVerifiedCurrentSourceActualConditionsAndResults') }}</label>
  <button :disabled="busy||!row||!confirmed||!note.trim()" @click="submit">{{ controlText('domain.confirmFollowup') }}</button>
 </details>
</template>
