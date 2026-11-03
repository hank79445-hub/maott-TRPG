<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { computed, ref, watch } from 'vue'
import type { Character } from '../core/types'
import type { Catalogue } from '../core/engine'
import { clone, featIds } from '../core/engine'
import type { CombatCommand, Environment } from '../core/combat-types'
import { hasStyle } from '../core/growth-rules'
import { runtimeState } from '../core/runtime'
const props = defineProps<{
  character?: Character
  content: Catalogue
  actorId: string
  actors: { id: string; name: string; characterId: string | null }[]
  currentId: string
  pending?: { kind: string; targets: { id: string; index?: number }[] } | null
  env: Environment
  busy: boolean
}>()
const emit = defineEmits<{ execute: [command: CombatCommand] }>()
const choice = ref(''),
  targetId = ref(''),
  triggerId = ref(''),
  targetIndex = ref(0),
  mode = ref('wings'),
  targets = ref<string[]>([]),
  note = ref(''),
  confirmed = ref(false),
  distance = ref(5),
  sees = ref(true),
  kitId = ref('')
const state = computed(() => props.character && runtimeState(props.character, props.content))
// Content is required separately so the same panel can be used with the filtered player view.
const content = computed(() => props.content)
const options = computed(() => {
  const c = props.character
  if (!c) return []
  const list: { id: string; name: string }[] = []
  const add = (id: string, name: string) => list.push({ id, name })
  const feats = featIds(c.build, content.value)
  if (feats.includes('lucky')) {
    add('lucky-own', '幸运 · 下一笔自身检定优势')
    add('lucky-defense', '幸运 · 下一笔针对自己攻击劣势')
  }
  if (hasStyle(c.build, 'interception', content.value)) add('interception', '拦截 · 命中后减伤反应')
  if (hasStyle(c.build, 'protection', content.value)) add('protection', '守护 · 掷骰前保护反应')
  if (feats.includes('healer')) add('healer', '医疗师 · 战地医师')
  if (c.build.speciesId === 'aasimar') {
    add('healing-hands', '阿斯莫 · 治愈之手')
    if (c.level >= 3) {
      add('revelation', '阿斯莫 · 开启天启')
      add('end-revelation', '阿斯莫 · 结束天启')
      if (state.value?.revelation?.mode === 'radiance') add('radiance', '内耀辉光 · 回合结束伤害')
    }
  }
  if (hasStyle(c.build, 'unarmed-fighting', content.value))
    add('grapple-damage', '徒手战斗 · 回合开始擒抱伤害')
  return list
})
const self = computed(() =>
  ['lucky-own', 'lucky-defense', 'revelation', 'end-revelation'].includes(choice.value),
)
const multi = computed(
  () => choice.value === 'radiance' || (choice.value === 'revelation' && mode.value === 'shroud'),
)
const kits = computed(
  () =>
    props.character?.inventory.filter((r) => r.itemId === 'healers-kit' && !r.containerId) ?? [],
)
watch(
  options,
  (list) => {
    if (!list.some((o) => o.id === choice.value)) choice.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => props.actorId,
  () => {
    targetId.value = props.actorId
    targets.value = []
    confirmed.value = false
  },
  { immediate: true },
)
watch(
  () => props.currentId,
  (id) => (triggerId.value = id),
  { immediate: true },
)
watch(
  kits,
  (list) => {
    if (!list.some((r) => r.instanceId === kitId.value)) kitId.value = list[0]?.instanceId ?? ''
  },
  { immediate: true },
)
const can = computed(
  () =>
    !props.busy &&
    confirmed.value &&
    !!note.value.trim() &&
    !!props.character &&
    (choice.value === 'interception' ? !!props.pending : !props.pending),
)
function run() {
  const env = clone(props.env)
  env.distance = distance.value
  env.attackerSees = sees.value
  const pendingTarget = props.pending?.targets.find((t, i) => (t.index ?? i) === targetIndex.value)
  emit('execute', {
    type: 'feature',
    actorId: props.actorId,
    id: 'origin/' + choice.value,
    targetId:
      choice.value === 'interception'
        ? (pendingTarget?.id ?? targetId.value)
        : self.value
          ? props.actorId
          : targetId.value,
    amount:
      choice.value === 'interception'
        ? targetIndex.value
        : mode.value === 'radiance'
          ? 1
          : mode.value === 'shroud'
            ? 2
            : 0,
    kitId: kitId.value || undefined,
    triggerActorId: triggerId.value || undefined,
    env,
    note: note.value,
    ...(multi.value ? { targets: targets.value } : {}),
  })
}
</script>
<template>
  <details v-if="options.length" class="complex-combat origin-combat" open>
    <summary>{{ controlText('workspace.originFeatsCelestialRevelationAndFightingStyles') }}</summary>
    <label
      >{{ controlText('domain.originCombat') }}<select v-model="choice" :aria-label="controlText('domain.originCombat')">
        <option v-for="o in options" :key="o.id" :value="o.id">{{ localizedEntryName(o) }}</option>
      </select></label
    >
    <p v-if="choice.includes('lucky')">{{ controlText('liveSummary.luckPointsNoReactionCostApprovalMust', {p0:(state?.resources.lucky ?? 0)}) }}</p>
    <p v-if="choice === 'protection'">
      {{ controlText('adjudication.protectionMustBeApprovedBeforeTheTriggeringAttack') }}
    </p>
    <p v-if="self">{{ controlText('game.selfTarget') }}</p>
    <label v-else
      >{{ controlText('game.featureTarget') }}<MapFieldPicker kind="entity"><select v-model="targetId" :aria-label="controlText('configurationField.originCombatTarget')">
        <option v-for="a in actors" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
      </select></MapFieldPicker></label
    >
    <label v-if="choice === 'interception'"
      >{{ controlText('configurationField.hitAwaitingResolution') }}<select v-model.number="targetIndex" :aria-label="controlText('configurationField.interceptionHitIndex')">
        <option v-for="(t, i) in pending?.targets ?? []" :key="t.index ?? i" :value="t.index ?? i">{{ controlText('liveSummary.entry', {p0:((t.index ?? i) + 1),p1:(localizedEntryName(actors.find((a) => a.id === t.id)) ?? t.id)}) }}
        </option>
      </select></label
    >
    <label v-if="choice === 'protection'"
      >{{ controlText('configurationField.creatureDeclaringAttack') }}<select v-model="triggerId" :aria-label="controlText('configurationField.attackerTriggeringProtection')">
        <option v-for="a in actors.filter((a) => a.id !== actorId)" :key="a.id" :value="a.id">
          {{ localizedEntryName(a) }}
        </option>
      </select></label
    >
    <label v-if="choice === 'healer'"
      >{{ controlText('configurationField.useHealerSKit') }}<select v-model="kitId" :aria-label="controlText('configurationField.combatHealerSKit')">
        <option v-for="r in kits" :key="r.instanceId" :value="r.instanceId">{{ controlText('liveSummary.healerSKit', {p0:(r.uses ?? 10),p1:(controlText('inventory.kitTotal'))}) }}
        </option>
      </select></label
    >
    <label v-if="choice === 'revelation'"
      >{{ controlText('game.revelation') }}<select v-model="mode" :aria-label="controlText('configurationField.combatRevelationMode')">
        <option value="wings">{{ controlText('domain.heavenlyWings') }}</option>
        <option value="radiance">{{ controlText('domain.innerRadiance') }}</option>
        <option value="shroud">{{ controlText('domain.necroticShroud') }}</option>
      </select></label
    >
    <fieldset v-if="multi">
      <legend>
        {{ choice === 'radiance' ? controlText('expressionTwo.allCreaturesWithinFtIncludingAllies') : controlText('expressionTwo.nonAlliesWithinFtWhoCanSeeYou') }}
      </legend>
      <label v-for="a in actors" :key="a.id" class="check"
        ><input v-model="targets" type="checkbox" :value="a.id" />{{ localizedEntryName(a) }}</label
      >
    </fieldset>
    <label
      >{{ controlText('configurationField.abilityTargetDistanceFt') }}<input
        v-model.number="distance"
        type="number"
        min="0"
        :aria-label="controlText('configurationField.originAbilityDistance')"
    /></label>
    <label class="check"><input v-model="sees" type="checkbox" />{{ controlText('configurationField.protectorInterceptorCanSeeTriggeringAttacker') }}</label>
    <label
      >{{ controlText('domain.originBasis') }}<input
        v-model="note"
        :aria-label="controlText('domain.originBasis')"
        :placeholder="controlText('configurationField.confirmDeclarationHitIndexTouchStartEndTiming')"
    /></label>
    <label class="check"
      ><input v-model="confirmed" type="checkbox" />{{ controlText('configurationField.gmConfirmedTriggerTimingAndAllTargetConditions') }}</label
    >
    <button class="secondary" :disabled="!can" @click="run">{{ controlText('workspace.submitOriginCombatAbility') }}</button>
  </details>
</template>
