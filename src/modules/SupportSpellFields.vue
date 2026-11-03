<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import GmSpellFields from './GmSpellFields.vue'
import M3CastFields from './M3CastFields.vue'
import type {ControlSelection} from '../core/m2-social-controls'
import { computed, watch } from 'vue'
import { SKILLS } from '../core/types'
import { DAMAGE_NAMES } from '../core/combat-types'
import { RESISTANCE_TYPES, RESTORABLE_CONDITIONS, SUPPORT_SPELLS } from '../core/support-spells'
const voluntarySpells = ['haste','levitate','enlarge-reduce','invisibility','fly','spider-climb','water-breathing','water-walk','darkvision','gaseous-form','guidance','resistance','heroism','mage-armor','barkskin','protection-from-energy','protection-from-evil-and-good','warding-bond','feign-death']
const props = defineProps<{ spellId?: string;targets?:{id:string;name:string}[];selectedIds?:string[] }>()
const control=defineModel<ControlSelection>('control',{default:()=>({})})
const controlOptions=computed(()=>props.spellId==='calm-emotions'?[{id:'suppress',name:'压制魅惑与恐惧'},{id:'indifferent',name:'对指定生物冷漠'}]:props.spellId==='bestow-curse'?[...Object.entries({str:'力量检定／豁免劣势',dex:'敏捷检定／豁免劣势',con:'体质检定／豁免劣势',int:'智力检定／豁免劣势',wis:'感知检定／豁免劣势',cha:'魅力检定／豁免劣势',attacks:'攻击施法者劣势',dodge:'回合开始感知失败只能闪避',damage:'来源攻击／法术额外1d8黯蚀'}).map(([id,name])=>({id,name}))]:[])
const choice = defineModel<string>('choice', { required: true })
const willing = defineModel<boolean>('willing', { required: true })
const active = computed(() =>
  [...SUPPORT_SPELLS,'hex','shillelagh','command', 'blindness-deafness','protection-from-energy','enhance-ability',...voluntarySpells].includes(props.spellId ?? ''),
)
const options = computed(() =>
  props.spellId==='hex'?[{id:'str',name:'力量检定劣势'},{id:'dex',name:'敏捷检定劣势'},{id:'con',name:'体质检定劣势'},{id:'int',name:'智力检定劣势'},{id:'wis',name:'感知检定劣势'},{id:'cha',name:'魅力检定劣势'}]:props.spellId==='shillelagh'?[{id:'original',name:'武器原伤害类型'},{id:'force',name:'力场伤害'}]:props.spellId==='command'?[{id:'approach',name:'接近'},{id:'drop',name:'丢弃'},{id:'flee',name:'逃跑'},{id:'grovel',name:'趴下'},{id:'halt',name:'止步'}]:props.spellId === 'guidance'
    ? Object.entries(SKILLS).map(([id, s]) => ({ id, name: s.name }))
    : props.spellId === 'resistance' || props.spellId === 'protection-from-energy'
      ? (props.spellId==='resistance'?RESISTANCE_TYPES:['acid','cold','fire','lightning','thunder'] as const).map((id) => ({ id, name: DAMAGE_NAMES[id] }))
      : props.spellId === 'enhance-ability'
        ? [{id:'str',name:'力量'},{id:'dex',name:'敏捷'},{id:'int',name:'智力'},{id:'wis',name:'感知'},{id:'cha',name:'魅力'}]
      : !['blindness-deafness','lesser-restoration'].includes(props.spellId??'') ? [] : (props.spellId === 'blindness-deafness'
          ? (['blinded', 'deafened'] as const)
          : RESTORABLE_CONDITIONS
        ).map((id) => ({
          id,
          name: { blinded: '目盲', deafened: '耳聋', paralyzed: '麻痹', poisoned: '中毒' }[id],
        })),
)
watch(
  () => props.spellId,
  () => {
    control.value={}
    choice.value = ''
    willing.value = false
  },
)
watch(()=>props.selectedIds?.join('|')??'',()=>{if(control.value.controlChoices)control.value={...control.value,controlChoices:Object.fromEntries(Object.entries(control.value.controlChoices).filter(([id])=>props.selectedIds?.includes(id)))}})
</script>
<template>
  <GmSpellFields :spell-id="spellId" :targets="targets" :model-value="control.gmChoice??{}" @update:model-value="control={...control,gmChoice:$event}" />
  <M3CastFields :spell-id="spellId" :model-value="control.m3Choice??{}" @update:model-value="control={...control,m3Choice:$event}" />
  <fieldset v-if="controlOptions.length" class="m2-control-fields"><legend>{{ controlText('resourceFlow.perTargetEffects') }}</legend><label v-for="target in (targets??[]).filter(t=>selectedIds?.includes(t.id))" :key="target.id">{{localizedEntryName(target)}}<select :value="control.controlChoices?.[target.id]??''" @change="control={...control,controlChoices:{...control.controlChoices,[target.id]:($event.target as HTMLSelectElement).value}}"><option value="">{{ controlText('game.choose') }}</option><option v-for="option in controlOptions" :key="option.id" :value="option.id">{{localizedEntryName(option)}}</option></select></label><label v-if="spellId==='calm-emotions'">{{ controlText('remainingField.originallyHostileCreaturesAffectedByIndifferenceGmVerifies') }}<select multiple v-model="control.controlTargets"><option v-for="target in targets" :key="target.id" :value="target.id">{{localizedEntryName(target)}}</option></select></label></fieldset>
  <label v-if="['suggestion','phantasmal-force'].includes(spellId??'')">{{spellId==='suggestion'?controlText('expressionFour.suggestionAchievableActivityNoObviousHarmToTarget'):controlText('expressionFour.illusionPerceivedByTargetOnlyUpToA')}}<textarea v-model="control.controlText" maxlength="2000" /></label>
  <p v-if="spellId==='warding-bond'" class="muted">{{ controlText('resourceFlow.wardingBondTouchAnotherWillingCreatureTheGm') }}</p>
  <p v-if="spellId==='prayer-of-healing'" class="muted">{{ controlText('resourceFlow.prayerOfHealingGmApprovalConfirmsUpTo') }}</p>
  <fieldset v-if="active">
    <legend>{{ controlText('resourceFlow.message2024SpellSelection') }}</legend>
    <label v-if="options.length"
      >{{
        spellId==='hex'?controlText('expressionFour.selectedAbilityNotASave'):spellId==='shillelagh'?controlText('expressionFour.shillelaghDamageType'):spellId ==='command'?controlText('expressionFour.commandContent'):spellId === 'guidance'
          ? controlText('expressionFour.selectedSkill')
          : ['resistance','protection-from-energy'].includes(spellId??'')
            ? controlText('expressionFour.selectedDamageType')
            : spellId === 'enhance-ability'
              ? controlText('expressionFour.selectedAbility')
            : spellId === 'blindness-deafness'
              ? controlText('expressionFour.conditionApplied')
              : controlText('expressionFour.conditionEnded')
      }}
      <select v-model="choice" :aria-label="controlText('remainingField.selectedSpellEffect')">
        <option value="">{{ controlText('game.choose') }}</option>
        <option v-for="option in options" :key="option.id" :value="option.id">
          {{ localizedEntryName(option) }}
        </option>
      </select>
    </label>
    <label v-if="voluntarySpells.includes(spellId??'')"
      ><input v-model="willing" type="checkbox" />{{ controlText('remainingField.confirmWillingRecipient') }}</label
    >
  </fieldset>
</template>
