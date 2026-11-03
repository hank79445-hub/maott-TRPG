<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,onUnmounted,watch,ref} from 'vue'
import MapPositionPicker from '../map-selection/MapPositionPicker.vue'
import type {RoomView,RoomCommand} from '../../online/protocol'
const props=defineProps<{view:RoomView;busy:boolean}>(),emit=defineEmits<{command:[value:RoomCommand]}>()
const windows=computed(()=>props.view.practicalWindows??[]),confirm=ref<Record<string,boolean>>({}),dice=ref<Record<string,number[]>>({})
const initiatives=computed(()=>props.view.practicalInitiative??[])
const spellInputs=computed(()=>props.view.practicalSpellInputs??[])
const effectInputs=computed(()=>props.view.practicalEffectInputs??[]),landings=ref<Record<string,{x:number;y:number;height:number}>>({}),landingConfirmed=ref<Record<string,boolean>>({})
const landingReaction=ref<Record<string,boolean>>({})
function landing(p:NonNullable<RoomView['practicalEffectInputs']>[number]){return landings.value[p.id]??=({...p.from,height:p.type==='fall'||p.type==='descend'?p.floor:p.from.height})}
function submitLanding(p:NonNullable<RoomView['practicalEffectInputs']>[number]){if(landingConfirmed.value[p.id])emit('command',{kind:'practical-effect-input',taskId:p.id,to:{...landing(p)},reaction:p.canReact&&landingReaction.value[p.id]?'use':undefined})}
function ack(){if(props.busy||typeof document!=='undefined'&&document.visibilityState==='hidden')return;for(const w of windows.value)emit('command',{kind:'practical-response',windowId:w.id,actorId:w.actorId,operation:'delivered'});for(const w of initiatives.value)emit('command',{kind:'practical-initiative',windowId:w.id,actorId:w.actorId,operation:'delivered'})}
const timer=setInterval(ack,4000)
const effectTimer=setInterval(()=>{if(props.busy||typeof document==='undefined'||document.visibilityState==='hidden')return;for(const p of effectInputs.value.filter(p=>p.type==='ink-cloud'))emit('command',{kind:'practical-effect-input',taskId:p.id,operation:'delivered'})},4000)
onUnmounted(()=>clearInterval(timer))
onUnmounted(()=>clearInterval(effectTimer))
watch(()=>windows.value.map(w=>w.id+':'+w.actorId).join('|'),ack,{immediate:true,flush:'post'})
watch(()=>initiatives.value.map(w=>w.id+':'+w.actorId).join('|'),ack,{immediate:true,flush:'post'})
function toggle(id:string,index:number){const list=dice.value[id]??[];dice.value[id]=list.includes(index)?list.filter(i=>i!==index):[...list,index]}
</script>
<template>
 <Teleport to="body">
 <aside v-if="windows.length||initiatives.length||spellInputs.length||effectInputs.length" class="practical-windows" :aria-label="controlText('interactionField.myCombatChoices')" role="region">
  <section v-for="p in effectInputs" :key="p.id"><strong>{{localizedEntryName(p)}} · {{p.type==='fall'?controlText('expressionThree.falling'):p.type==='return'?controlText('expressionThree.blinkReturn'):p.type==='descend'?controlText('expressionThree.levitationEnds'):p.type==='dismount'?controlText('state.dismount'):p.type==='ink-cloud'?controlText('expressionThree.familiarInkCloudReaction'):controlText('expressionThree.ejectionDestination')}}</strong>
    <p v-if="p.waitingDice">{{ controlText('adjudication.waitingForAllPhysicalDiceInTheOriginal') }}</p>
    <template v-else-if="p.type==='ink-cloud'"><p>{{ controlText('adjudication.theControllerChoosesWhetherToUseTheActual') }}</p><button :disabled="busy" @click="emit('command',{kind:'practical-effect-input',taskId:p.id,reaction:'use'})">{{ controlText('adjudication.useInkCloudReaction') }}</button><button :disabled="busy" @click="emit('command',{kind:'practical-effect-input',taskId:p.id,reaction:'decline'})">{{ controlText('adjudication.declineThisReaction') }}</button></template>
    <template v-else><p>{{ controlText('adjudication.chooseActualMapCoordinatesExistingRulesRecheckRange') }}</p><MapPositionPicker required :scene-id="p.sceneId" :span="p.span" :x="landing(p).x" :y="landing(p).y" :height="landing(p).height" :disabled="busy||p.waitingDice" @select="v=>{landings[p.id]=v;landingConfirmed[p.id]=false}" /><div class="landing-fields"><label>{{ controlText('game.x') }}<input v-model.number="landing(p).x" type="number" min="0" :max="p.columns-1" @input="landingConfirmed[p.id]=false"></label><label>{{ controlText('game.y') }}<input v-model.number="landing(p).y" type="number" min="0" :max="p.rows-1" @input="landingConfirmed[p.id]=false"></label><label>{{ controlText('game.height') }}<input v-model.number="landing(p).height" type="number" min="0" max="10000" @input="landingConfirmed[p.id]=false"></label></div><label v-if="p.canReact"><input v-model="landingReaction[p.id]" type="checkbox">{{ controlText('interactionField.useMyActualReactionToRemainStandingWhen') }}</label><label><input v-model="landingConfirmed[p.id]" type="checkbox">{{ controlText('interactionField.iConfirmThisActualDestinationAndItsConsequences') }}</label><button :disabled="busy||p.waitingDice||!landingConfirmed[p.id]" @click="submitLanding(p)">{{ controlText('adjudication.confirmDestinationAndResolve') }}</button></template>
  </section>
  <section v-for="s in spellInputs" :key="s.intentId">
   <strong>{{s.source}} · {{localizedEntryName(s)}}</strong>
   <div v-for="target in s.targets" :key="target.id"><span>{{localizedEntryName(target)}}：{{target.declined?controlText('domain.rejected'):controlText('expressionThree.willingToAcceptThisSpell')}}</span><button :disabled="busy" @click="emit('command',{kind:'practical-spell-input',intentId:s.intentId,operation:'consent',targetId:target.id})">{{ controlText('adjudication.consentThisTime') }}</button><button :disabled="busy" @click="emit('command',{kind:'practical-spell-input',intentId:s.intentId,operation:'decline',targetId:target.id})">{{ controlText('controls.reject') }}</button></div>
   <p v-if="s.status">{{ controlText('progressSummary.continuousCastingGameMinutesRemaining', {p0:(s.status),p1:(s.remainingMinutes?.toFixed(1))}) }}</p>
   <button v-if="s.canBegin" :disabled="busy" @click="emit('command',{kind:'practical-spell-input',intentId:s.intentId,operation:'begin-casting'})">{{ controlText('adjudication.beginContinuousCastingEndsExistingConcentration') }}</button>
   <button v-if="s.canCancel" :disabled="busy" @click="emit('command',{kind:'practical-spell-input',intentId:s.intentId,operation:'cancel-casting'})">{{ controlText('adjudication.cancelContinuousCasting') }}</button>
  </section>
  <section v-for="w in initiatives" :key="w.id+':'+w.actorId">
   <strong>{{ controlText('progressSummary.initiative', {p0:(localizedEntryName(w)),p1:(w.value)}) }}</strong>
   <p>{{ controlText('adjudication.keepsOriginalInitiativeDiceAlertSwapsRequireThe') }}</p>
   <button v-if="w.heroic" :disabled="busy" @click="emit('command',{kind:'practical-initiative',windowId:w.id,actorId:w.actorId,operation:'reroll'})">{{ controlText('adjudication.heroicInspirationReroll') }}</button>
   <div v-for="target in w.targets.filter(t=>t.tie||t.swap||t.offered)" :key="target.id">
    <span>{{localizedEntryName(target)}}</span>
    <button v-if="target.tie" :disabled="busy" @click="emit('command',{kind:'practical-initiative',windowId:w.id,actorId:w.actorId,operation:'before',targetId:target.id})">{{ controlText('adjudication.placeBeforeThisParticipant') }}</button>
    <button v-if="target.swap" :disabled="busy" @click="emit('command',{kind:'practical-initiative',windowId:w.id,actorId:w.actorId,operation:'offer-swap',targetId:target.id})">{{ controlText('adjudication.requestSwap') }}</button>
    <template v-if="target.offered"><button :disabled="busy" @click="emit('command',{kind:'practical-initiative',windowId:w.id,actorId:w.actorId,operation:'accept-swap',targetId:target.id})">{{ controlText('adjudication.acceptSwap') }}</button><button :disabled="busy" @click="emit('command',{kind:'practical-initiative',windowId:w.id,actorId:w.actorId,operation:'decline-swap',targetId:target.id})">{{ controlText('controls.reject') }}</button></template>
   </div>
   <button :disabled="busy" @click="emit('command',{kind:'practical-initiative',windowId:w.id,actorId:w.actorId,operation:'pass'})">{{ controlText('adjudication.finishKeepCurrentInitiative') }}</button>
  </section>
  <section v-for="w in windows" :key="w.id+':'+w.actorId">
   <strong>{{w.actorName}} · {{w.phase==='d20'?controlText('expressionThree.hitsAndRerolls'):w.phase==='defense'?controlText('expressionThree.shieldAndCounterspell'):w.phase==='damage'?controlText('expressionThree.damageAbilities'):controlText('expressionThree.postDamageReactions')}}</strong>
   <p class="muted">{{ controlText('progressSummary.unusedAbilitiesSpendNoResources', {p0:(w.deadlineAt?controlText('expressionThree.optionalChoiceWindowDeliveredTheServerDeterminesRemaining'):controlText('expressionThree.countdownBeginsOnDeliveryAndPausesWhileOffline'))}) }}</p>
   <div v-for="o in w.options" :key="o.id" class="window-option">
    <label v-if="o.requiresConfirmation"><input v-model="confirm[o.id]" type="checkbox">{{ controlText('interactionField.myActualSpellComponentsAndHandlingRequirementsAre') }}</label>
    <div v-if="o.dice?.length" class="dice-choices"><label v-for="(value,index) in o.dice" :key="index"><input type="checkbox" :checked="dice[o.id]?.includes(index)" @change="toggle(o.id,index)">{{value}}</label></div>
    <button :disabled="busy||o.requiresConfirmation&&!confirm[o.id]" @click="emit('command',{kind:'practical-response',windowId:w.id,actorId:w.actorId,operation:'choose',optionId:o.id,requirementsConfirmed:confirm[o.id],diceIndices:dice[o.id]})">{{localizedEntryName(o)}} · {{o.cost}}</button>
   </div>
   <button :disabled="busy" @click="emit('command',{kind:'practical-response',windowId:w.id,actorId:w.actorId,operation:'pass'})">{{ controlText('adjudication.finishSelectionsDeclineRemainingOptions') }}</button>
  </section>
 </aside>
 </Teleport>
</template>
<style scoped>.landing-fields{display:flex;flex-wrap:wrap;gap:8px}.landing-fields label{display:grid;gap:4px;max-width:100px}.landing-fields input{width:100%;min-width:0;min-height:36px}section+section{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}</style>
<style scoped>.practical-windows{position:fixed;right:16px;bottom:72px;width:min(410px,calc(100vw - 32px));max-height:65dvh;overflow:auto;overscroll-behavior:contain;z-index:120;background:var(--surface);color:var(--ink);border:2px solid var(--line);border-radius:12px;padding:12px;box-shadow:0 8px 28px #0003}.window-option{margin:8px 0}.dice-choices{display:flex;gap:8px;flex-wrap:wrap}button{background:var(--button-bg);border:1px solid var(--button-border);border-radius:6px;min-height:40px;color:var(--ink);padding:6px 10px}button:disabled{background:var(--button-disabled);color:var(--muted)}p{font-size:.85rem}label{display:block}</style>
