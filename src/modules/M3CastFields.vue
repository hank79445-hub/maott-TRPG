<script setup lang="ts">
import {uiLabel} from './ui-label'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {computed} from 'vue'
import type {M3CastChoice} from '../core/m3-spells'
const props=defineProps<{spellId?:string}>()
const choice=defineModel<M3CastChoice>({default:()=>({})})
const options=computed(()=>props.spellId==='alter-self'?[['aquatic','水生适应'],['appearance','改变外观'],['weapons','天生武器']]:props.spellId==='enlarge-reduce'?[['enlarge','变大'],['reduce','缩小']]:[])
const hints:Record<string,string>={
  haste:'速度×2、AC＋2、敏捷豁免优势。额外动作单独记录，仅可一次攻击／疾走／撤离／躲藏／使用物品；结束后至下回合末迟滞。',
  jump:'2024：每个受术者每回合一次，以10尺移动换至多30尺跳跃；落点和剩余预算仍须合法。',
  'expeditious-retreat':'施法时立即疾走；持续期间可用附赠动作疾走，移动消耗不会刷新。',
  'mirror-image':'2024：攻击命中后，每个剩余幻象掷d6，任一≥3即摧毁一个幻象并代受本次攻击。',
  invisibility:'隐形不等于隐藏；攻击骰、造成伤害或施法后，仅该受术者结束隐形。',
  'spider-climb':'攀爬速度等于Speed，可免手攀墙与倒挂天花板；须有实际可攀附表面。',
  fly:'获得60尺飞行和悬浮。实际高度从空间工具调整；效果结束后没有其他支持将进入坠落处理。',
  levitate:'生物连同携带物须≤500磅，未知重量先交GM核实。初始可升高至多20尺；来源回合可再调节至多20尺，调节他人消耗魔法动作。不能无依托水平移动。',
  'gaseous-form':'仅10尺飞行／悬浮；不能攻击、施法、说话或操作物件。可用专用魔法动作结束形态。',
  'water-walk':'液体表面可步行；附赠动作穿越液面，坠入液体会穿过表面。熔岩等热伤害仍生效。',
  'water-breathing':'24小时保留正常呼吸并可水下呼吸；不额外获得游泳速度。',
  darkvision:'黑暗视觉150尺；不穿墙、不自动看穿魔法黑暗。',
  'see-invisibility':'仅受术者看见隐形并看入以太；看见不等于能够跨位面互动。',
}
</script>
<template>
  <fieldset v-if="options.length" class="m3-cast-fields"><legend>{{ controlText('configuration.spellForm') }}</legend>
    <label>{{ controlText('configurationField.optionsForThisRequest') }}<select :value="choice.option??''" @change="choice={option:($event.target as HTMLSelectElement).value as M3CastChoice['option']}"><option value="">{{ controlText('game.choose') }}</option><option v-for="option in options" :key="option[0]" :value="option[0]">{{option[1]}}</option></select></label>
    <label v-if="choice.option==='weapons'">{{ controlText('configurationField.naturalWeaponDamageType') }}<select v-model="choice.naturalDamageType"><option value="slashing">{{ controlText('configuration.clawsSlashing') }}</option><option value="piercing">{{ controlText('configuration.fangsHornsPiercing') }}</option><option value="bludgeoning">{{ controlText('configuration.hoovesBludgeoning') }}</option></select></label>
    <label v-if="choice.option==='appearance'">{{ controlText('configurationField.appearanceWithTheSameSizeAndBasicAnatomy') }}<textarea v-model="choice.description" maxlength="2000" rows="2" /></label>
  </fieldset>
  <p v-if="spellId&&hints[spellId]" class="muted m3-spell-hint">{{uiLabel(hints[spellId])}}</p>
</template>
<style scoped>.m3-cast-fields{display:grid;gap:.5rem;min-width:0}.m3-cast-fields label{display:grid;gap:.25rem}.m3-cast-fields select,.m3-cast-fields textarea{width:100%;min-width:0}.m3-spell-hint{font-size:.85rem;line-height:1.5}</style>
