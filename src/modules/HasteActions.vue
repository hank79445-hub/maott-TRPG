<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global

import type {CombatCommand} from '../core/combat-types'
defineProps<{actorId:string;enabled:boolean;used:boolean;disabled:boolean}>()
const emit=defineEmits<{command:[CombatCommand]}>()
const actions=[['dash','疾走'],['disengage','撤离'],['hide','躲藏'],['utilize','使用物品']] as const
</script>
<template><fieldset v-if="enabled" class="haste-actions"><legend>{{ controlText('quantity.hasteAction', {p0:(used?controlText('controls.usedState'):controlText('expressionTwo.useRemaining'))}) }}</legend><p class="muted">{{ controlText('configuration.selectASingleAttackThroughAttackOptionsThe') }}</p><div><button v-for="[action,name] in actions" :key="action" :disabled="disabled||used" @click="emit('command',{type:'action',actorId,cost:'haste',action,note:'使用加速术独立额外动作；后果仍按实际规则处理'})">{{name}}</button></div></fieldset></template>
<style scoped>.haste-actions{padding:.5rem;margin:.5rem 0;min-width:0;font-size:.85rem}.haste-actions p{margin:.2rem 0}.haste-actions div{display:flex;flex-wrap:wrap;gap:.4rem}.haste-actions button{min-height:36px;padding:.35rem .6rem}@media(max-width:600px){.haste-actions button{min-height:44px}}</style>
