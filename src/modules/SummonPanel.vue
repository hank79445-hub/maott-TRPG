<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import SummonTemplateLibrary from './summons/SummonTemplateLibrary.vue'
import SummonRemainsForm from './summons/SummonRemainsForm.vue'
import SummonCreateForm from './summons/SummonCreateForm.vue'
import SummonActions from './summons/SummonActions.vue'
import type {SummonAction} from '../persistence/summon-action-schema'
import {computed,ref} from 'vue'
import type {RoomCommand,RoomView} from '../online/protocol'
const props=defineProps<{view:RoomView;busy:boolean}>(),emit=defineEmits<{command:[RoomCommand]}>()
const drafts=computed(()=>props.view.world?.adventures[0]?.summons?.drafts.filter(d=>d.status==='pending')??[])
const states:Record<string,string>={present:'在场',pocket:'暂时收起',fading:'渐隐',vanished:'已消散',dead:'已死亡'},controls:Record<string,string>={controlled:'可指挥',expired:'控制过期',released:'已解除控制'}
const gm=computed(()=>props.view.self.role==='gm'),issues=computed(()=>props.view.world?.adventures[0]?.summons?.migrationIssues??[]),note=ref(''),originalEndsAt=ref(0)
function action(action:SummonAction){if(gm.value)emit('command',{kind:'summon-action',action});else emit('command',{kind:'intent-submit',action:{kind:'summon',action},summary:action.note,source:'player',baseWorldRevision:props.view.worldRevision})}
function lifecycle(id:string,operation:'release'|'end'){emit('command',{kind:'summon-lifecycle',instanceId:id,operation,receipt:crypto.randomUUID(),note:note.value})}
</script>
<template>
 <details v-if="view.summonChoices?.length||view.summons?.length||gm&&(issues.length||drafts.length)" class="room-card summon-panel"><summary>{{ controlText('review.summons') }} {{view.summons?.length??0}}</summary>
  <p class="muted">{{ controlText('resourceFlow.actualCreationCommandsSensesRidingAndSimpleTasks') }}</p>
  <SummonTemplateLibrary />
  <SummonRemainsForm :view="view" :busy="busy" @action="action" />
  <SummonCreateForm :view="view" :busy="busy" @action="action" />
  <article v-for="i in view.summons" :key="i.id" class="summon-row"><div><strong>{{localizedEntryName(i)}}</strong><span> · {{uiLabel(states[i.state])??i.state}} / {{uiLabel(controls[i.control])??i.control}}</span></div><p v-if="i.hp!==undefined">{{ controlText('remainingField.hp') }} {{i.hp}}／{{i.maxHp}}<span v-if="i.temporaryHp">{{ controlText('scriptSummary.temporary', {p0:(i.temporaryHp)}) }}</span><span v-if="i.sourceName">{{ controlText('scriptSummary.source', {p0:(i.sourceName)}) }}</span></p><p v-if="i.existenceEndsAt!==undefined" class="muted">{{ controlText('remainingField.existsUntilGameTime') }} {{i.existenceEndsAt??controlText('expressionFour.noFixedExpiry')}} {{ controlText('game.hours') }}<span v-if="i.controlEndsAt!==null">{{ controlText('scriptSummary.controlledUntil', {p0:(i.controlEndsAt),p1:(controlText('game.hours'))}) }}</span></p><p v-if="i.position" class="muted">{{ controlText('scriptSummary.currentPositionHeight', {p0:(i.position.x),p1:(i.position.y),p2:(i.position.height),p3:(controlText('game.feet'))}) }}</p><p v-if="i.task">{{ controlText('scriptSummary.currentCommand', {p0:(i.task)}) }}</p><details v-if="i.card"><summary>{{ controlText('resourceFlow.actualStatBlock') }}</summary><p>{{ controlText('scriptSummary.acSpeedFt', {p0:(i.card.ac),p1:(i.card.speed),p2:(i.card.size)}) }}</p><p v-if="i.card.templateMetadata?.movement.length">{{ controlText('scriptSummary.movement', {p0:(i.card.templateMetadata.movement.map(m=>m.kind+' '+m.feet+'尺').join('、'))}) }}</p><p v-if="i.card.templateMetadata?.senses.length">{{ controlText('scriptSummary.senses', {p0:(i.card.templateMetadata.senses.join('、'))}) }}</p><p v-for="attack in i.card.attacks" :key="attack.id">{{ controlText('scriptSummary.attackBonus', {p0:(localizedEntryName(attack)),p1:(attack.bonus>=0?'+':''),p2:(attack.bonus),p3:(attack.damage)}) }}</p><p v-if="i.spellId==='find-familiar'">{{ controlText('resourceFlow.naturalAttackDataDoesNotGrantOrdinaryFamiliars') }}</p></details><SummonActions :view="view" :instance="i" :busy="busy" @action="action" /><div v-if="gm" class="inline"><button :disabled="busy||!note.trim()||i.control!=='controlled'" @click="lifecycle(i.id,'release')">{{ controlText('resourceFlow.gmReleasesControl') }}</button><button :disabled="busy||!note.trim()||i.state==='vanished'" @click="lifecycle(i.id,'end')">{{ controlText('resourceFlow.gmExplicitlyEndsEntity') }}</button></div></article>
  <template v-if="gm"><article v-for="d in drafts" :key="d.id" class="summon-row"><p>{{ controlText('scriptSummary.pendingCreationCostsRecordedEntityNotCreated', {p0:(d.spellId)}) }}</p><button :disabled="busy||!note.trim()" @click="emit('command',{kind:'summon-cancel-creation',draftId:d.id,note})">{{ controlText('resourceFlow.gmEndsCreationTransactionNoDuplicateChargeBlanket') }}</button></article><label>{{ controlText('remainingField.takeoverAdoptionBasis') }}<input v-model="note" maxlength="2000" /></label><label v-if="issues.length">{{ controlText('remainingField.legacyCompanionSOriginalExpiryGameHoursGm') }}<input v-model.number="originalEndsAt" type="number" min="0" /></label><article v-for="issue in issues" :key="issue.encounterId+issue.actorId" class="summon-row"><p>{{issue.reason}}</p><button :disabled="busy||!note.trim()" @click="emit('command',{kind:'summon-adopt',encounterId:issue.encounterId,actorId:issue.actorId,note,originalEndsAt,confirmed:true})">{{ controlText('resourceFlow.gmConfirmsOriginalCastingLinkAndAdopts') }}</button></article></template>
 </details>
</template>
<style scoped>.summon-panel{min-width:0}.summon-row{padding:.65rem 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.summon-row p{margin:.3rem 0}.summon-panel input{max-width:100%;min-width:0}</style>
