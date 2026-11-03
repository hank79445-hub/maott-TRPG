<script setup lang="ts">
import {uiLabel} from '../ui-label'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,ref} from 'vue'
import type {RoomView,RoomCommand} from '../../online/protocol'
const props=defineProps<{view:RoomView;busy:boolean}>(),emit=defineEmits<{command:[RoomCommand]}>()
const a=computed(()=>props.view.world?.adventures[0]),events=computed(()=>a.value?.summons?.events?.filter(e=>e.status==='pending')??[]),drafts=computed(()=>a.value?.summons?.drafts.filter(d=>d.status==='pending')??[]),x=ref(0),y=ref(0),height=ref(0),note=ref('GM核对实际后果及落点')
function resolve(id:string){emit('command',{kind:'summon-action',action:{operation:'resolve-cast',draftId:id,receipt:crypto.randomUUID(),note:'GM核对反制窗口、来源与合法落点'}})}
const reaction=ref(false)
const labels={'putrid-aura':'腐灭灵光：体质豁免','ghost-eject':'幽体挤出：最近空位与力场伤害',dismount:'坐骑结束／关系变化：下马与坠落','ink-cloud':'可选墨水云反应：使用魔宠能力或放弃'}
function event(id:string,type:string){emit('command',{kind:'summon-action',action:{operation:'event',eventId:id,decline:type==='ink-cloud',useReaction:reaction.value,to:['putrid-aura','ink-cloud'].includes(type)?undefined:{x:x.value,y:y.value,height:height.value},receipt:crypto.randomUUID(),note:note.value}})}
</script>
<template><div class="summon-review"><article v-for="d in drafts" :key="d.id"><strong>{{ controlText('scriptSummary.summoningAwaitingConfirmation', {p0:(d.spellId),p1:(d.form)}) }}</strong><p>{{ controlText('resourceFlow.originalCastingAndCostsAreSavedHandleThe') }}</p><button :disabled="busy" @click="resolve(d.id)">{{ controlText('resourceFlow.confirmOriginalSummoningCasting') }}</button></article><article v-for="e in events" :key="e.id"><strong>{{uiLabel(labels[e.type])}}</strong><p>{{e.note}}</p><div v-if="e.type!=='putrid-aura'" class="s-point"><label>{{ controlText('game.landingX') }}<input v-model.number="x" type="number" min="0" /></label><label>{{ controlText('game.landingY') }}<input v-model.number="y" type="number" min="0" /></label><label>{{ controlText('game.height') }}<input v-model.number="height" type="number" /></label></div><label v-if="e.type==='dismount'&&e.reason==='mount-prone'"><input v-model="reaction" type="checkbox" />{{ controlText('remainingField.useRiderSReactionToLandStanding') }}</label><button :disabled="busy||!note.trim()" @click="event(e.id,e.type)">{{e.type==='ink-cloud'?controlText('expressionFour.explicitlyDeclineInkCloudReaction'):controlText('expressionFour.resolveOriginalConsequenceAutomaticGmPhysicalDice')}}</button></article><label v-if="events.length">{{ controlText('remainingField.verificationBasis') }}<input v-model="note" maxlength="1000" /></label></div></template>
<style scoped>.summon-review{display:grid;gap:.6rem}.summon-review article{border:1px solid var(--line);border-radius:8px;padding:.75rem}.summon-review p{font-size:.85rem}.s-point{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem}.summon-review label{display:grid;gap:.25rem;min-width:0}.summon-review input{width:100%;min-width:0}</style>
