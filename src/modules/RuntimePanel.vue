<script setup lang="ts">
import {itemCastLabel} from './item-spell-presentation'
import {uiDate} from './locale-format'
import {uiLabel} from './ui-label'
import {ruleText,ruleLabel} from './rule-presentation'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {abilityDisplayName,damageDisplayName,skillDisplayName,checkReasonPresentation} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { useOperationFeedback } from '../app/useOperationFeedback'
import OriginPanel from './OriginPanel.vue'
import { useSpellGroupPreferences } from './spell-group-preferences'
import {
  groupResources,
  groupSpellGrants,
  spellPresentation,
  spellLevelName,
} from './runtime-presentation'
import AdvancedPanel from './AdvancedPanel.vue'
import { beast } from '../core/beasts'
import { advancedResources } from '../core/phb-powers'
import { computed, nextTick, ref, watch } from 'vue'
import type { Character, Ability, Source } from '../core/types'
import { ABILITIES, ABILITY_NAMES, SKILLS, SRD_SOURCE } from '../core/types'
import { signed, type Catalogue } from '../core/engine'
import { DAMAGE_TYPES, DAMAGE_NAMES, type DamageType } from '../core/combat-types'
import { CONDITIONS } from '../content/conditions'
import GrowthPanel from './GrowthPanel.vue'
import RestSpellChoices from './growth/RestSpellChoices.vue'
import RuntimeInventory from './RuntimeInventory.vue'
import { runtimeNeedsReview } from '../online/permissions'
import { useWorkshop } from '../app/store'
import {
  checkDetail,
  MODE_NAMES,
  preparation,
  resources,
  rollDie,
  runtimeDerived,
  runtimeSpells,
  runtimeState,
  type RuntimeCommand,
  type RollContext,
  type Resource,
  type SpellGrant,
} from '../core/runtime'

const props = defineProps<{
  character: Character
  people?: { id: string; name: string }[]
  content: Catalogue
  workshop?: ReturnType<typeof useWorkshop>
  mapSpells?: boolean
  reviewRequired?: boolean
  serverRolls?: boolean
  battleName?: string
  initialTab?: string
  sectionRequest?: number
  railTarget?: string
  railVisible?: boolean
  railFull?: boolean
}>()
const emit = defineEmits<{ info: [string]; notice: [string, boolean]; navigate: [string]; itemSpell:[string] }>()
const store = props.workshop ?? useWorkshop()
const battleEncounter = computed(
  () =>
    store.encounters.find(
      (e) => e.phase === 'active' && e.actors.some((a) => a.characterId === props.character.id),
    ) ?? (props.battleName ? { name: props.battleName } : undefined),
)
const tab = ref('status'),
  pending = ref(false),
  feedback = ref(''),
  failure = ref(false)
const tabs = {
  status: '生命与状态',
  inventory: '装备与背包',
  spells: '法术与资源',
  checks: '技能与豁免',
  journal: '操作记录',
  growth: '职业成长',
}
watch(
  () => props.sectionRequest,
  () => {
    if (props.initialTab && props.initialTab in tabs) tab.value = props.initialTab
  },
  { immediate: true },
)
const r = computed(() => runtimeState(props.character, props.content))
const d = computed(() => runtimeDerived(props.character, props.content))
const defs = computed(() => resources(props.character, props.content))
const grants = computed(() => runtimeSpells(props.character, props.content).filter(g=>!g.retired))
const restSpellChoices = ref<Record<string,string[]>>({})
const prep = computed(() => preparation(props.character, props.content))
const classEntry = computed(() =>
  props.content.classes.find((x) => x.id === props.character.build.classId),
)
const incapacitated = computed(
  () => d.value.conditions.includes('incapacitated') || r.value.death.dead,
)
const source = (page: number) => SRD_SOURCE.url + '#page=' + page
const spellSource = (s: Source) => {
  if (s.url && /^https?:\/\//.test(s.url))
    return /\.pdf(?:[?#]|$)/i.test(s.url) ? s.url.split('#')[0] + '#page=' + s.page : s.url
  return s.pack === SRD_SOURCE.pack ? source(s.page) : undefined
}
const journal = computed(() => [...(props.character.journal ?? [])].reverse())
const undoable = computed(() => journal.value.some((x) => x.before && !x.undone))
const hpPercent = computed(() =>
  Math.min(100, Math.max(0, (r.value.hp / Math.max(1, d.value.hp)) * 100)),
)
const tempPercent = computed(() =>
  Math.min(100, Math.max(0, (r.value.temporaryHp / Math.max(1, d.value.hp)) * 100)),
)
const conditionName = (id: string) => CONDITIONS.find((x) => x.id === id)?.name ?? id
const conditionList = computed(() => CONDITIONS.filter((x) => x.id !== 'exhaustion'))
const visibleConditions = computed(() => {
  const active = conditionList.value.filter((x) => d.value.conditions.includes(x.id))
  const rest = conditionList.value.filter((x) => !d.value.conditions.includes(x.id))
  return [...active, ...rest.slice(0, 6)]
})
const hiddenConditions = computed(() => {
  const shown = new Set(visibleConditions.value.map((x) => x.id))
  return conditionList.value.filter((x) => !shown.has(x.id))
})
async function run(command: RuntimeCommand) {
  if (pending.value || store.readFailure) return false
  pending.value = true
  feedback.value = ''
  failure.value = false
  try {
    const next = await store.operate(props.character.id, command)
    feedback.value =
      props.reviewRequired && runtimeNeedsReview(command)
        ? '已提交 GM 审核，尚未执行'
        : (next.journal?.at(-1)?.detail ?? '已保存')
    emit('notice', feedback.value, false)
    return true
  } catch (e) {
    failure.value = true
    feedback.value = e instanceof Error ? e.message : String(e)
    emit('notice', feedback.value, true)
    return false
  } finally {
    pending.value = false
  }
}
const hpAmount = ref(1),
  resistanceUnresolved = ref(false),
  hpDamageType = ref<DamageType>('fire'),
  hpNote = ref(''),
  critical = ref(false),
  relentless = ref(false)
const tempAmount = ref(0),
  replaceTemp = ref(false),
  exhaustion = ref(0),
  deathRoll = ref(10)
const castModes = ref<Record<string, string>>({}),
  castConfirmed = ref<Record<string, boolean>>({}),
  spellSearch = ref('')
const expandedSpells = ref<Record<string, boolean>>({})
const spellCategories = useSpellGroupPreferences(
  () => props.character.id,
  () => spellSearch.value,
)
function expandSpells(open: boolean) {
  for (const g of filteredGrants.value) expandedSpells.value[g.key] = open
  spellCategories.expandForDescriptions(
    spellGroups.value.map((group) => group.level),
    open,
  )
}
const vigorDice = ref(1),
  wildCheck = ref(false)
const filteredGrants = computed(() =>
  grants.value.filter((x) =>
    (x.spell.name + ' ' + x.spell.english + ' ' + x.source)
      .toLowerCase()
      .includes(spellSearch.value.trim().toLowerCase()),
  ),
)
const resourceGroups = computed(() => groupResources(defs.value))
const spellGroups = computed(() => groupSpellGrants(filteredGrants.value))
const spellInfo = computed(() =>
  Object.fromEntries(grants.value.map((g) => [g.key, spellPresentation(g.spell)])),
)
const spellLevelFilter = ref<number | 'all'>('all')
const castableOnly = ref(false)
const availableSpellLevels = computed(() =>
  [...new Set(grants.value.map((g) => g.spell.level))].sort((a, b) => a - b),
)
const concentrationName = computed(
  () => props.content.spells.find((x) => x.id === r.value.concentration?.spellId)?.name ?? '',
)
const resourceBands = computed(() => {
  const groups = resourceGroups.value
  const slots = groups.find((g) => g.id === 'slots')
  const rest = groups.filter((g) => g.id !== 'slots').flatMap((g) => g.items)
  return [
    ...(slots ? [{ id: 'slots', name: '法术位', items: slots.items }] : []),
    ...(rest.length ? [{ id: 'rest', name: '职业与物种资源', items: rest }] : []),
  ]
})
const disabledResourceIds = new Set([
  'slots',
  'wild-slot',
  'paladin-smite',
  'faithful-steed',
  'magical-cunning',
  'sorcerous-restoration',
  'depths',
  'lay-on-hands',
  'arcane-recovery',
  'relentless',
  'favored-enemy',
  'forest-magic',
  'lucky',
  'healing-hands',
  'aasimar-revelation',
  'mi-background',
  'mi-human',
])
const canUseResource = (def: Resource) =>
  !def.id.startsWith('slots') &&
  !def.id.startsWith('feat-') &&
  !def.id.startsWith('species-') &&
  !def.id.startsWith('mi-') &&
  !disabledResourceIds.has(def.id) &&
  !advancedResources(props.character).some((p) => p.id === def.id)
const canCastGrant = (grant: SpellGrant) => {
  if (incapacitated.value || !grant.modes.length) return false
  return grant.modes.some((mode) => {
    if (mode === 'free') return (r.value.resources[grant.resource ?? ''] ?? 0) > 0
    if (mode.startsWith('item-') || mode === 'ritual' || mode === 'cantrip' || mode === 'at-will') return true
    const key = mode === 'slot' ? 'slots' : mode
    return (
      (r.value.resources[key] ?? 0) + (r.value.createdSlots?.[key] ?? 0) > 0
    )
  })
}
const visibleSpellGroups = computed(() =>
  spellGroups.value
    .filter((g) => spellLevelFilter.value === 'all' || g.level === spellLevelFilter.value)
    .map((g) => ({
      ...g,
      items: castableOnly.value ? g.items.filter((x) => canCastGrant(x)) : g.items,
    }))
    .filter((g) => g.items.length),
)
function openInventorySpell(key:string){if(props.mapSpells){emit('itemSpell',key);return};tab.value='spells';const grant=grants.value.find(g=>g.key===key);if(grant){castModes.value[key]=grant.modes[0]??'';void nextTick(()=>openCast(grant))}}
function openCast(grant: SpellGrant) {
  expandedSpells.value[grant.key] = true
  void nextTick(() =>
    document
      .getElementById('spell-cast-' + grant.key)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
  )
}
const layAmount = ref(1),
  layTarget = ref<'self' | 'other' | 'purify'>('self'),
  layNote = ref('')
const gmResource = ref(''),
  gmAmount = ref(0),
  gmReason = ref('')
const restKind = ref<'short' | 'long'>('short'),
  restConfirmed = ref(false),
  recoverySlots = ref([1, 0, 0]),
  sorcerousRestoration = ref(false),
  recoveryId = ref<
    | 'magical-cunning'
    | 'font-slot'
    | 'font-points'
    | 'font-inspiration'
    | 'wild-resurgence'
    | 'wild-slot'
  >('magical-cunning'),
  recoveryLevel = ref(1),
  useHitDie = ref(false),
  arcaneRecovery = ref(false),
  recoverExhaustion = ref(false),
  restPrepared = ref<string[]>([]),
  memorizeSpell = ref(false)
const luckyDeath = ref(false)
const timeHours = ref(16)
const rollKind = ref<'skill' | 'save' | 'initiative'>('skill'),
  rollId = ref('perception'),
  purpose = ref<NonNullable<RollContext['purpose']>>('normal'),
  advantage = ref(false),
  disadvantage = ref(false),
  fearVisible = ref(false),
  lucky = ref(false),
  rollDC = ref<number | null>(null)
const context = computed(() => ({
  lucky: lucky.value,
  purpose: purpose.value,
  advantage: advantage.value,
  disadvantage: disadvantage.value,
  fearVisible: fearVisible.value,
}))
const rollInfo = computed(() =>
  checkDetail(props.character, props.content, rollKind.value, rollId.value, context.value),
)
watch(rollKind, (v) => {
  rollId.value = v === 'skill' ? 'perception' : v === 'save' ? 'con' : 'initiative'
})
watch(purpose, (v) => {
  if (v === 'concentration') {
    rollKind.value = 'save'
    rollId.value = 'con'
  }
})
watch(
  () => props.character.id,
  () => {
    tab.value = props.initialTab && props.initialTab in tabs ? props.initialTab : 'status'
    expandedSpells.value = {}
    feedback.value = ''
  },
)
watch(
  () => [props.character.id, props.character.revision],
  () => {
    exhaustion.value = r.value.exhaustion
    restPrepared.value = [...prep.value.current]
    restConfirmed.value = false
    memorizeSpell.value = false
    castConfirmed.value = {}
    recoveryId.value =
      props.character.build.classId === 'sorcerer'
        ? 'font-slot'
        : props.character.build.classId === 'druid'
          ? 'wild-resurgence'
          : props.character.build.classId === 'bard'
            ? 'font-inspiration'
            : 'magical-cunning'
  },
  { immediate: true },
)
async function rest() {
  await run({
    type: 'rest',
    kind: restKind.value,
    confirmed: restConfirmed.value,
    hitDieRoll:
      restKind.value === 'short' && useHitDie.value && !props.serverRolls
        ? rollDie(classEntry.value!.hitDie)
        : undefined,
    useHitDie: props.serverRolls && restKind.value === 'short' && useHitDie.value,
    arcaneRecovery: restKind.value === 'short' && arcaneRecovery.value,
    recoverySlots:
      restKind.value === 'short' && arcaneRecovery.value
        ? recoverySlots.value.flatMap((n, i) => Array.from({ length: n }, () => i + 1))
        : undefined,
    sorcerousRestoration: restKind.value === 'short' && sorcerousRestoration.value,
    prepared:
      (restKind.value === 'long' && prep.value.change !== 'none') ||
      (restKind.value === 'short' && memorizeSpell.value)
        ? restPrepared.value
        : undefined,
    spellChoices: Object.keys(restSpellChoices.value).length ? restSpellChoices.value : undefined,
    recoverExhaustion: recoverExhaustion.value,
  })
}
const spellDC = (ability: Ability, sorcerer: boolean) =>
  8 + d.value.pb + d.value.mods[ability] + (sorcerer && r.value.innateSorcery ? 1 : 0)
async function undo() {
  if (window.confirm(controlText('confirmation.undoTheMostRecentReversibleRuntimeOperationHp')))
    await run({ type: 'undo' })
}
useOperationFeedback(feedback, failure, pending)
const needsReview = (type: RuntimeCommand['type']) =>
  !!props.reviewRequired && runtimeNeedsReview({ type } as RuntimeCommand)
const actionText = (type: RuntimeCommand['type'], gmText: string, playerText: string) =>
  uiLabel(needsReview(type) ? playerText : gmText)
const scrollToRequests = () => {
  document.querySelector('.character-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="runtime" :aria-label="controlText('runtime.title')" :aria-busy="pending">
    <section class="character-hero" :aria-label="controlText('runtime.overview')">
      <div class="hero-top">
        <div class="hero-id">
          <p class="eyebrow">{{ controlText('runtime.adventureMode') }} {{ character.level }}</p>
          <h1>{{ localizedEntryName(character.build) }}</h1>
          <p class="hero-meta">{{ controlText('progressSummary.phbCompletionPP', {p0:(serverRolls ? controlText('expressionThree.roomSave') : controlText('expressionThree.localSave')),p1:(controlText('runtime.revision')),p2:(character.revision)}) }}
          </p>
        </div>
        <slot name="hero-extra" />
      </div>

      <div class="hero-vitals">
        <div class="hero-hp-wrap">
          <strong class="hero-hp" data-testid="current-hp">{{ r.hp }} / {{ d.hp }}</strong>
          <span v-if="r.hp <= d.hp / 2 && r.hp > 0" class="hero-bloodied">{{ controlText('runtime.bloodied') }}</span>
        </div>
        <div class="hero-bars">
          <div class="hero-bar">
            <i
              :style="{ width: hpPercent + '%' }"
              :class="{ mid: hpPercent <= 50, low: hpPercent <= 25 }"
            />
          </div>
          <div v-if="r.temporaryHp" class="hero-bar temp">
            <i :style="{ width: tempPercent + '%' }" />
          </div>
        </div>
        <div class="hero-facts">
          <span>{{ controlText('domain.tempHP') }} <b data-testid="temporary-hp">{{ r.temporaryHp }}</b></span>
          <span class="hero-dice"
            >{{ controlText('domain.hitDice') }}
            <span class="pips" :title="'d' + (classEntry?.hitDie ?? 6)"
              ><s v-for="n in character.level" :key="n" :class="{ on: n <= r.hitDice }"></s
            ></span>
            {{ r.hitDice }} / {{ character.level }}</span
          >
        </div>
      </div>

      <div class="hero-tags">
        <span v-for="id in d.conditions" :key="id" class="hero-chip">{{ conditionName(id) }}</span>
        <span v-if="r.exhaustion" class="hero-chip">{{ controlText('runtime.exhaustion') }} {{ r.exhaustion }}</span>
        <span v-if="r.heroicInspiration" class="hero-chip gold">{{ controlText('domain.heroicInspiration') }}</span>
        <span v-if="!d.conditions.length && !r.exhaustion" class="hero-empty">{{ controlText('runtime.noConditions') }}</span>
      </div>

      <p v-if="d.blindsight || d.flyingSpeed || d.tremorsense" class="hero-senses">
        {{ d.blindsight ? controlText('expressionThree.blindsight') + d.blindsight + controlText('expressionThree.ft') : ''
        }}{{ d.tremorsense ? controlText('expressionThree.tremorsense') + d.tremorsense + controlText('expressionThree.ftGmVerifiesStoneSurfaceConditions') : ''
        }}{{ d.flyingSpeed ? controlText('expressionThree.flySpeed') + d.flyingSpeed + controlText('expressionThree.ftGmVerifiesHeightAndRoute') : '' }}
      </p>
      <p v-if="r.death.dead" class="runtime-feedback error">
        {{ controlText('runtime.deadHelp') }}
      </p>

      <details v-if="!r.hp && !r.death.dead" class="hero-death" open>
        <summary>{{ controlText('progressSummary.deathSavesSuccessesFailures', {p0:(r.death.successes),p1:(r.death.failures),p2:(r.death.stable ? controlText('expressionThree.stableStillUnconscious') : controlText('expressionTwo.notStable'))}) }}
        </summary>
        <label v-if="defs.some((x) => x.id === 'lucky')" class="check"
          ><input
            v-model="luckyDeath"
            type="checkbox"
            :disabled="!r.resources.lucky || pending || store.readFailure"
          />{{ controlText('configurationField.useLuckPointForDeathSaveRemaining') }} {{ r.resources.lucky }}）</label
        >
        <label
          >{{ controlText('runtime.deathNatural') }}<input
            v-model.number="deathRoll"
            type="number"
            min="1"
            max="20"
            :disabled="pending || store.readFailure" /></label
        >
        <div class="runtime-actions">
          <button
            class="secondary"
            :disabled="r.death.stable || pending || store.readFailure"
            @click="run({ type: 'death-save', roll: deathRoll, lucky: luckyDeath })"
          >
            {{ actionText('death-save', '记录死亡豁免', '提交死亡豁免给 GM') }}</button
          ><button
            class="secondary"
            :disabled="pending || store.readFailure"
            @click="run({ type: 'stabilize' })"
          >
            {{ actionText('stabilize', '记录已完成的稳定救治', '提交稳定救治给 GM') }}
          </button>
        </div>
        <p class="small muted">
          {{ controlText('runtime.deathHelp') }}
        </p>
      </details>
    </section>
    <nav class="runtime-tabs is-underline" :aria-label="controlText('runtime.runtimePanel')">
      <button
        v-for="(name, id) in tabs"
        :key="id"
        :class="{ active: tab === id }"
        :aria-pressed="tab === id"
        @click="tab = id"
      >
        {{ uiLabel(name) }}
      </button>
    </nav>
    <p v-if="battleEncounter" class="runtime-feedback">{{ controlText('progressSummary.participatingIn', {p0:(localizedEntryName(battleEncounter)),p1:(controlText('runtime.linkedBattleHelp'))}) }}
    </p>
    <p v-if="r.wildShape" class="runtime-feedback">{{ controlText('progressSummary.wildShape', {p0:(localizedEntryName(beast(r.wildShape.formId))),p1:(controlText('runtime.wildShapeState')),p2:(character.build.choices.subclass?.includes('moon')
          ? controlText('expressionThree.circleOfTheMoonMayCastAcquiredCircle')
          : controlText('expressionThree.cannotCastSpellsInThisForm'))}) }}
    </p>
    <p v-if="store.readFailure" class="runtime-feedback error">
      {{ controlText('runtime.archiveFailure') }}
    </p>
    <fieldset :disabled="pending || store.readFailure" class="runtime-fieldset">
      <div v-show="tab === 'status'" class="runtime-content runtime-status-page">
  <div class="runtime-status-main">
    <section class="runtime-block runtime-block-adjust">
      <header class="runtime-block-head"><span class="runtime-block-no">03</span><h3>{{ controlText('runtime.adjustHP') }}</h3><span v-if="reviewRequired" class="runtime-review-tag">{{ controlText('game.submit') }}</span><span class="runtime-block-note">{{ controlText('runtime.hpModes') }}</span></header>
<div class="runtime-grid">
          <section class="panel">
            <h3>{{ controlText('runtime.hpChange') }}</h3>
            <label
              >{{ controlText('runtime.hpValue') }}<input
                v-model.number="hpAmount"
                type="number"
                min="1"
                max="100000" /></label
            ><label
              >{{ controlText('runtime.hpDescription') }}<input
                v-model="hpNote"
                maxlength="2000"
                :placeholder="controlText('runtime.hpSource')"
            /></label>
            <div class="inline-options">
              <label><input v-model="critical" type="checkbox" />{{ controlText('runtime.criticalDamage') }}</label
              ><label v-if="character.build.speciesId === 'orc'"
                ><input v-model="relentless" type="checkbox" />{{ controlText('runtime.relentless') }}</label
              >
            </div>
            <label><input v-model="resistanceUnresolved" type="checkbox" />{{ controlText('runtime.resistanceNotApplied') }}</label
            ><label v-if="resistanceUnresolved"
              >{{ controlText('game.damageType') }}<select v-model="hpDamageType" :aria-label="controlText('runtime.damageType')">
                <option v-for="t in DAMAGE_TYPES" :key="t" :value="t">{{ damageDisplayName(t) }}</option>
              </select></label
            >
            <p v-if="resistanceUnresolved" class="small muted">
              {{ controlText('runtime.resistanceHelp') }}
            </p>
            <div class="runtime-actions">
              <button
                class="danger"
                @click="
                  run({
                    type: 'damage',
                    amount: hpAmount,
                    critical,
                    relentless,
                    damageType: resistanceUnresolved ? hpDamageType : undefined,
                    note: hpNote,
                  })
                "
              >
                {{ actionText('damage', '记录已结算伤害', '提交伤害给 GM') }}</button
              ><button
                class="primary"
                @click="run({ type: 'heal', amount: hpAmount, note: hpNote })"
              >
                {{ actionText('heal', '记录治疗', '提交治疗给 GM') }}
              </button>
            </div>
            <p class="small muted">
              {{ controlText('runtime.damageHelp') }}<a
                :href="source(17)"
                target="_blank"
                rel="noopener"
                >{{ controlText('adjudication.rulesPp1718') }}</a
              >
            </p>
          </section>
          <section class="panel">
            <h3>{{ controlText('runtime.tempHP') }}</h3>
            <label>{{ controlText('runtime.newTempHP') }}<input v-model.number="tempAmount" type="number" min="0" /></label
            ><label class="inline-check"
              ><input v-model="replaceTemp" type="checkbox" />{{ controlText('runtime.replaceLower') }}</label
            ><button
              class="secondary"
              @click="run({ type: 'temporary', amount: tempAmount, replace: replaceTemp })"
            >
              {{ actionText('temporary', '记录临时 HP', '提交临时 HP 给 GM') }}
            </button>
            <p class="small muted">
              {{ controlText('runtime.tempHelp') }}
            </p>
            <div class="runtime-actions">
              <button
                class="secondary"
                @click="run({ type: 'inspiration', active: !r.heroicInspiration })"
              >
                {{ needsReview('inspiration') ? (r.heroicInspiration ? controlText('expressionThree.requestSpendingHeroicInspiration') : controlText('expressionThree.requestGainingHeroicInspiration')) : (r.heroicInspiration ? controlText('expressionThree.spendHeroicInspiration') : controlText('expressionThree.gainHeroicInspiration')) }}</button
              ><span>{{ r.heroicInspiration ? controlText('expressionThree.owned') : controlText('expressionThree.notOwned') }}</span>
            </div>
            <p class="small muted">
              {{ controlText('runtime.inspirationHelp') }}<a
                :href="source(183)"
                target="_blank"
                rel="noopener"
                >{{ controlText('adjudication.rulesP183') }}</a
              >
            </p>
          </section>
        </div>
            </section>
    <section class="runtime-block runtime-block-conditions">
      <header class="runtime-block-head"><span class="runtime-block-no">04</span><h3>{{ controlText('runtime.conditionsExhaustion') }}</h3><span v-if="reviewRequired" class="runtime-review-tag">{{ controlText('game.submit') }}</span><span class="runtime-block-note">{{ controlText('runtime.effectModes') }}</span></header>
<details v-if="r.effects.length" class="panel">
      <summary>{{ controlText('progressSummary.currentSourceEffects', {p0:(r.effects.length)}) }}</summary>
      <article v-for="effect in r.effects" :key="effect.id" class="active-effect">
        <div>
          <strong>{{ localizedEntryName(effect) }}</strong
          ><small
            >{{ effect.concentration ? controlText('expressionThree.sourceMustMaintainConcentration') : '' }}SRD p.{{ effect.page
            }}{{ effect.endsAt !== undefined ? controlText('expressionThree.expiresWithAdventureTime') : controlText('expressionThree.gmEnded') }}</small
          >
          <p class="muted">{{ effect.note }}</p>
        </div>
        <button
          class="text-button"
          :disabled="pending || !!battleEncounter"
          @click="
            run({ type: 'effect-remove', effectId: effect.id, reason: 'GM 确认效果满足结束条件' })
          "
        >
          {{ actionText('effect-remove', '结束效果', '申请结束效果') }}
        </button>
      </article>
    </details><section class="panel runtime-conditions-panel">
          <div class="runtime-actions">
            <label
              >{{ controlText('domain.exhaustion') }}<select v-model.number="exhaustion" :aria-label="controlText('domain.exhaustion')">
                <option v-for="n in 7" :key="n" :value="n - 1">
                  {{ n - 1 }}{{ n === 7 ? controlText('expressionThree.dead') : '' }}
                </option>
              </select></label
            ><button class="secondary" @click="run({ type: 'exhaustion', level: exhaustion })">
              {{ actionText('exhaustion', '记录力竭', '提交力竭给 GM') }}
            </button>
          </div>
          <div class="condition-grid">
            <article
              v-for="condition in visibleConditions"
              :key="condition.id"
              class="condition-card"
              :class="{ on: d.conditions.includes(condition.id) }"
            >
              <div class="condition-text">
                <b>{{ localizedEntryName(condition) }} <small>{{ condition.english }}</small></b>
                <p>{{ ruleText(condition.summary) }}</p>
              </div>
              <div class="condition-foot">
                <button
                  class="secondary"
                  :disabled="
                    !r.conditions.includes(condition.id) && d.conditions.includes(condition.id)
                  "
                  @click="
                    run({
                      type: 'condition',
                      id: condition.id,
                      active: !r.conditions.includes(condition.id),
                    })
                  "
                >
                  {{ needsReview('condition') ? controlText('expressionThree.request') : '' }}{{ r.conditions.includes(condition.id) ? controlText('game.remove') : controlText('controls.add')
                  }}{{ localizedEntryName(condition) }}</button
                ><a :href="source(condition.source.page)" target="_blank" rel="noopener"
                  >SRD p.{{ condition.source.page }}</a
                >
              </div>
              <p
                v-if="!r.conditions.includes(condition.id) && d.conditions.includes(condition.id)"
                class="condition-note"
              >
                {{ controlText('runtime.derivedConditionHelp') }}
              </p>
            </article>
          </div>
          <details v-if="hiddenConditions.length" class="condition-more">
            <summary>{{ controlText('progressSummary.allConditionsAdditional', {p0:(hiddenConditions.length)}) }}</summary>
            <div class="condition-grid">
              <article
                v-for="condition in hiddenConditions"
                :key="condition.id"
                class="condition-card"
                :class="{ on: d.conditions.includes(condition.id) }"
              >
                <div class="condition-text">
                  <b>{{ localizedEntryName(condition) }} <small>{{ condition.english }}</small></b>
                  <p>{{ ruleText(condition.summary) }}</p>
                </div>
                <div class="condition-foot">
                  <button
                    class="secondary"
                    :disabled="
                      !r.conditions.includes(condition.id) && d.conditions.includes(condition.id)
                    "
                    @click="
                      run({
                        type: 'condition',
                        id: condition.id,
                        active: !r.conditions.includes(condition.id),
                      })
                    "
                  >
                    {{ needsReview('condition') ? controlText('expressionThree.request') : '' }}{{ r.conditions.includes(condition.id) ? controlText('game.remove') : controlText('controls.add')
                    }}{{ localizedEntryName(condition) }}</button
                  ><a :href="source(condition.source.page)" target="_blank" rel="noopener"
                    >SRD p.{{ condition.source.page }}</a
                  >
                </div>
              </article>
            </div>
          </details>
          <p class="small muted">
            {{ controlText('runtime.exhaustionHelp') }}
          </p>
        </section>
        <section v-if="r.concentration" class="panel">
          <h3>{{ controlText('progressSummary.concentratingOn', {p0:(localizedEntryName(content.spells.find((x) => x.id === r.concentration?.spellId)))}) }}
          </h3>
          <p>{{ r.concentration.source }}</p>
          <p v-if="r.concentration.pendingDC" class="runtime-feedback">{{ controlText('progressSummary.damageTriggersAConstitutionSaveDcResolve', {p0:(r.concentration.pendingDC)}) }}</p>
          <div class="runtime-actions">
            <button
              v-if="r.concentration.pendingDC"
              class="secondary"
              @click="
                run({
                  type: 'check',
                  kind: 'save',
                  id: 'con',
                  context: { purpose: 'concentration' },
                  dc: r.concentration.pendingDC,
                })
              "
            >
              {{ controlText('runtime.concentrationRoll') }}</button
            ><button
              v-if="r.concentration.pendingDC"
              class="secondary"
              @click="run({ type: 'concentration-result', success: true })"
            >
              {{ controlText('runtime.confirmConcentration') }}</button
            ><button
              class="secondary"
              @click="run({ type: 'end-effect', effect: 'concentration' })"
            >
              {{ controlText('domain.endConcentration') }}
            </button>
          </div>
          <p class="small muted">
            {{ controlText('runtime.concentrationHelp') }}<a
              :href="source(179)"
              target="_blank"
              rel="noopener"
              >{{ controlText('adjudication.rulesP179') }}</a
            >
          </p>
        </section>
            </section>
    <section class="runtime-block runtime-block-journal">
      <header class="runtime-block-head"><span class="runtime-block-no">05</span><h3>{{ controlText('domain.operationHistory') }}</h3><span v-if="reviewRequired" class="runtime-review-tag">{{ controlText('game.submit') }}</span><span class="runtime-block-note">{{ controlText('runtime.recentUndo') }}</span></header>
      <ol v-if="journal.length" class="runtime-journal-preview">
        <li v-for="event in journal.slice(0, 5)" :key="event.id" :class="{ undone: event.undone }">
          <time>{{ uiDate(event.at,'time',{ hour12: false }) }}</time>
          <span>{{ event.detail }}</span>
        </li>
      </ol>
      <p v-else class="muted">{{ controlText('runtime.noOperations') }}</p>
      <div class="runtime-actions">
        <button class="secondary" :disabled="!undoable" @click="undo">
          {{ actionText('undo', '撤销最近操作', '申请撤销最近操作') }}
        </button>
        <button class="text-button" @click="tab = 'journal'">{{ controlText('quantity.recordCount', {p0:(controlText('runtime.viewAll')),p1:(journal.length)}) }}</button>
      </div>
    </section>
  </div>

  <Teleport v-if="tab === 'status' || railVisible" :to="railTarget || 'body'" :disabled="!railTarget">
    <fieldset :disabled="pending || store.readFailure" class="runtime-status-rail-fieldset">
      <aside class="runtime-status-rail">
        <slot name="rail-top" />
        <section v-if="railFull" class="runtime-block runtime-block-request">
      <header class="runtime-block-head"><span class="runtime-block-no">08</span><h3>{{ controlText('runtime.characterRequests') }}</h3></header>
          <template v-if="reviewRequired">
            <p class="runtime-block-note">{{ controlText('runtime.localRequestHelp') }}</p>
            <button class="secondary" @click="scrollToRequests">{{ controlText('runtime.viewRequests') }}</button>
          </template>
          <template v-else>
            <p class="runtime-block-note">{{ controlText('runtime.requestManagement') }}</p>
            <button class="secondary" @click="emit('navigate', 'members')">{{ controlText('domain.members') }}</button>
          </template>
        </section>
        <section v-if="railFull" class="runtime-block runtime-block-rest">
      <header class="runtime-block-head"><span class="runtime-block-no">06</span><h3>{{ controlText('runtime.restTime') }}</h3><span v-if="reviewRequired" class="runtime-review-tag">{{ controlText('game.submit') }}</span><span class="runtime-block-note">{{ controlText('runtime.restModes') }}</span></header>
<section class="panel runtime-rest-panel">
          <h3>{{ controlText('runtime.adventureTime') }}</h3>
          <p class="small">
            {{ controlText('progressSummary.hours', {p0:(controlText('runtime.cumulative')),p1:(Number(r.hours.toFixed(2))),p2:(r.lastLongRestEnd === null
                ? controlText('expressionThree.noLongRestRecordedYet')
                : controlText('expressionThree.sinceLastLongRestEnded') + Number((r.hours - r.lastLongRestEnd).toFixed(2)) + controlText('expressionThree.hours'))}) }}
          </p>
          <div class="runtime-actions">
            <label
              >{{ controlText('runtime.advanceHours') }}<input
                v-model.number="timeHours"
                type="number"
                min="0.01"
                step="0.01" /></label
            ><button class="secondary" @click="run({ type: 'time', hours: timeHours })">
              {{ actionText('time', '推进时间', '提交推进时间给 GM') }}
            </button>
          </div>
          <label
            >{{ controlText('domain.restType') }}<select v-model="restKind" :aria-label="controlText('domain.restType')">
              <option value="short">{{ controlText('runtime.shortRest') }}</option>
              <option value="long">{{ controlText('progressSummary.longRest', {p0:(character.build.speciesId === 'elf' ? controlText('expressionThree.hourTrance') : controlText('expressionThree.atLeastHours'))}) }}
              </option>
            </select></label
          >
          <div v-if="restKind === 'short'" class="inline-options">
            <label
              ><input
                v-model="useHitDie"
                type="checkbox"
                :disabled="!r.hitDice"
              />{{ controlText('interactionField.spendOneHitDieToHealAutomaticallyRoll') }}{{ classEntry?.hitDie }}）</label
            ><label v-if="character.build.classId === 'wizard'"
              ><input v-model="arcaneRecovery" type="checkbox" />{{ controlText('runtime.arcaneRecovery') }}</label
            >
          </div>
          <template v-else
            ><label class="inline-check"
              ><input
                v-model="recoverExhaustion"
                type="checkbox"
              />{{ controlText('runtime.recoverExhaustion') }}</label
            >
            <details v-if="prep.change !== 'none'">
              <summary>{{ controlText('progressSummary.changeClassPreparedSpellsOnLongRest', {p0:(prep.count)}) }}</summary>
              <p class="small muted">
                {{
                  prep.change === 'one' ? controlText('expressionThree.replaceAtMostOnePerLongRest') : controlText('expressionThree.theListMayBeChosenAgain')
                }}{{ controlText('runtime.independentFreeCasts') }}
              </p>
              <div class="prepare-grid">
                <label v-for="option in prep.options" :key="option.id" class="inline-check"
                  ><input v-model="restPrepared" type="checkbox" :value="option.id" />{{
                    localizedEntryName(option)
                  }}</label
                >
              </div>
              <p>{{ controlText('game.selected') }} {{ restPrepared.length }} / {{ prep.count }}</p>
            </details></template
          >
          <div
            v-if="restKind === 'short' && arcaneRecovery && character.build.classId === 'wizard'"
          >
            <p>{{ controlText('progressSummary.maximumTotalSlotLevelsRecovered', {p0:(Math.ceil(character.level / 2))}) }}</p>
            <label v-for="(_, i) in recoverySlots" :key="i"
              >{{ i + 1 }} {{ controlText('interactionField.slotRecoveryQuantity') }}<input
                v-model.number="recoverySlots[i]"
                type="number"
                min="0"
                max="3"
                :aria-label="controlText('expressionThree.arcaneRecovery') + (i + 1) + controlText('expressionThree.slotCount')"
            /></label>
          </div>
          <label
            v-if="
              restKind === 'short' && character.level >= 5 && character.build.classId === 'sorcerer'
            "
            class="check"
            ><input v-model="sorcerousRestoration" type="checkbox" />{{ controlText('runtime.sorcerousRestoration') }}</label
          >
          <details
            v-if="
              restKind === 'short' && character.level >= 5 && character.build.classId === 'wizard'
            "
          >
            <summary>{{ controlText('runtime.memorizeSpell') }}</summary>
            <label class="inline-check"
              ><input v-model="memorizeSpell" type="checkbox" />{{ controlText('runtime.shortRestPreparation') }}</label
            >
            <div v-if="memorizeSpell" class="prepare-grid">
              <label v-for="option in prep.options" :key="option.id" class="inline-check"
                ><input v-model="restPrepared" type="checkbox" :value="option.id" />{{
                  localizedEntryName(option)
                }}</label
              >
            </div>
            <p v-if="memorizeSpell">
              {{ controlText('game.selected') }} {{ restPrepared.length }} / {{ prep.count }} {{ controlText('runtime.independentBookSlots') }}
            </p>
          </details>
          <RestSpellChoices v-model="restSpellChoices" :character="character" :content="content" :kind="restKind" />
          <label class="inline-check rest-confirm"
            ><input
              v-model="restConfirmed"
              type="checkbox"
            />{{ controlText('runtime.confirmRest') }}</label
          ><button class="primary" :disabled="!restConfirmed" @click="rest">
            {{ needsReview('rest') ? controlText('expressionThree.submit') : controlText('state.done') }}{{ restKind === 'short' ? controlText('controls.shortRest') : controlText('controls.longRest') }}{{ needsReview('rest') ? controlText('expressionThree.toGm') : '' }}
          </button>
          <details class="rule-note">
            <summary>{{ controlText('runtime.restRules') }}</summary>
            <p class="small muted">
              {{ controlText('runtime.restHelp') }}<a
                :href="source(185)"
                target="_blank"
                rel="noopener"
                >{{ controlText('domain.longRestSource') }}</a
              >
              · <a :href="source(187)" target="_blank" rel="noopener">{{ controlText('domain.shortRestSource') }}</a>
            </p>
          </details>
        </section>        </section>
        <section class="runtime-block runtime-block-summary">
      <header class="runtime-block-head"><span class="runtime-block-no">07</span><h3>{{ controlText('domain.characterOverview') }}</h3></header>
          <div class="runtime-summary-grid">
            <div><span>AC</span><b>{{ d.ac }}</b></div>
            <div><span>{{ controlText('domain.proficiency') }}</span><b>+{{ 2 + Math.floor((character.level - 1) / 4) }}</b></div>
            <div><span>{{ controlText('controls.speed') }}</span><b>{{ d.speed }} {{ controlText('game.feet') }}</b></div>
            <div><span>{{ controlText('domain.hitDice') }}</span><b>{{ r.hitDice }} / {{ character.level }}</b></div>
            <div><span>{{ controlText('domain.heroicInspiration') }}</span><b>{{ r.heroicInspiration ? controlText('expressionThree.owned') : controlText('expressionThree.notOwned') }}</b></div>
            <div><span>{{ controlText('game.conditions') }}</span><b>{{ d.conditions.length }}</b></div>
            <div><span>{{ controlText('controls.concentration') }}</span><b>{{ r.concentration ? controlText('expressionThree.concentrating') : controlText('controls.none') }}</b></div>
          </div>
          <details class="rule-note rule-links">
            <summary>{{ controlText('runtime.rulePages') }}</summary>
            <a :href="source(17)" target="_blank" rel="noopener">{{ controlText('runtime.lifeDeathPages') }}</a>
            <a :href="source(183)" target="_blank" rel="noopener">{{ controlText('runtime.inspirationPage') }}</a>
            <a :href="source(185)" target="_blank" rel="noopener">{{ controlText('domain.longRestSource') }}</a>
            <a :href="source(187)" target="_blank" rel="noopener">{{ controlText('domain.shortRestSource') }}</a>
            <p class="runtime-block-note">{{ controlText('runtime.conditionSourceHelp') }}</p>
          </details>
        </section>
      </aside>
    </fieldset>
  </Teleport>
</div>

      <div v-show="tab === 'inventory'" class="runtime-content">
        <RuntimeInventory
          :character="character"
          :content="content"
          :pending="pending"
          :active="tab === 'inventory'"
          :run="run"
          :feedback="feedback"
          :failure="failure"
          :allow-gm-configuration="!reviewRequired"
          @cast="openInventorySpell"
        />
        <slot name="inventory-after" />
      </div>

      <div v-show="tab === 'spells'" class="runtime-content spell-page">
        <section class="panel spell-resource-panel">
          <div class="spell-section-head">
            <h3>{{ controlText('game.resources') }}</h3>
            <span v-if="reviewRequired" class="spell-badge">{{ controlText('runtime.recordAfterUse') }}</span>
            <span v-else class="spell-badge quiet">{{ controlText('runtime.autoRecord') }}</span>
          </div>

          <section v-for="band in resourceBands" :key="band.id" class="resource-band">
            <div class="group-heading">
              <h4>{{ uiLabel(localizedEntryName(band)) }}</h4>
              <small>{{ controlText('quantity.itemCount', {p0:(band.items.length)}) }}</small>
            </div>
            <div class="spell-resource-grid">
              <article v-for="def in band.items" :key="def.id" class="spell-resource-card">
                <div class="spell-resource-top">
                  <b>{{ uiLabel(localizedEntryName(def)) }}</b>
                  <strong :data-testid="'resource-' + def.id"
                    >{{ r.resources[def.id] }} / {{ def.max }}</strong
                  >
                </div>
                <div
                  v-if="def.max > 0 && def.max <= 12"
                  class="spell-pips"
                  aria-hidden="true"
                >
                  <s
                    v-for="n in def.max"
                    :key="n"
                    :class="{ on: n <= (r.resources[def.id] ?? 0) }"
                  ></s>
                </div>
                <p class="spell-resource-hint">
                  {{
                    def.short === 'all'
                      ? controlText('expressionThree.shortRestRestoresAllLongRestRestoresAll')
                      : def.short === 'one'
                        ? controlText('expressionThree.shortRestRestoresOnceLongRestRestoresAll')
                        : controlText('expressionOne.restoresOnLongRest')
                  }}
                </p>
                <details class="resource-rules">
                  <summary>{{ controlText('runtime.useRecovery') }}</summary>
                  <p class="small">{{ ruleText(def.detail) }}</p>
                  <p class="small muted">
                    {{
                      def.short === 'all'
                        ? controlText('expressionThree.shortRestRestoresAll')
                        : def.short === 'one'
                          ? controlText('expressionThree.shortRestRestoresOnce')
                          : ''
                    }}{{ controlText('interactionField.fullyRestoredOnLongRest') }}
                    <a v-if="def.page" :href="source(def.page)" target="_blank" rel="noopener"
                      >SRD p.{{ def.page }}</a
                    ><span v-else>{{ controlText('runtime.featureSource') }}</span>
                  </p>
                </details>
                <button
                  v-if="canUseResource(def)"
                  class="secondary spell-resource-use"
                  :disabled="incapacitated || !r.resources[def.id]"
                  @click="run({ type: 'resource', id: def.id, amount: 1 })"
                >
                  {{ reviewRequired ? controlText('expressionThree.submitUse') : controlText('controls.use') }} {{ uiLabel(localizedEntryName(def)) }}
                </button>
              </article>
            </div>
          </section>

          <details
            v-if="
              character.level >= 2 &&
              (['sorcerer', 'warlock'].includes(character.build.classId) ||
                (character.level >= 5 && ['druid', 'bard'].includes(character.build.classId)))
            "
          >
            <summary>{{ controlText('runtime.resourceConversion') }}</summary>
            <label
              >{{ controlText('domain.restoreConvert') }}<select v-model="recoveryId" :aria-label="controlText('domain.restoreConvert')">
                <option v-if="character.build.classId === 'warlock'" value="magical-cunning">
                  {{ controlText('runtime.magicalCunning') }}
                </option>
                <template v-if="character.build.classId === 'sorcerer'"
                  ><option value="font-slot">{{ controlText('runtime.createSlot') }}</option>
                  <option value="font-points">{{ controlText('runtime.slotsToPoints') }}</option></template
                ><template v-if="character.build.classId === 'druid' && character.level >= 5"
                  ><option value="wild-resurgence">{{ controlText('runtime.slotToWild') }}</option>
                  <option value="wild-slot">
                    {{ controlText('runtime.wildToSlot') }}
                  </option></template
                >
                <option v-if="character.build.classId === 'bard'" value="font-inspiration">
                  {{ controlText('runtime.fontInspiration') }}
                </option>
              </select></label
            ><label
              >{{ controlText('game.conversionLevel') }}<select v-model.number="recoveryLevel" :aria-label="controlText('game.conversionLevel')">
                <option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ controlText('quantity.spellLevel', {p0:(l)}) }}</option>
              </select></label
            ><button
              class="secondary"
              @click="run({ type: 'recover', id: recoveryId, slotLevel: recoveryLevel })"
            >
              {{ controlText('runtime.submitConversion') }}
            </button>
            <p>{{ controlText('progressSummary.inCombatUseResourceConversionAtThe', {p0:(Object.entries(r.createdSlots)
                  .map(([id, n]) => id + ' ×' + n)
                  .join('、') || controlText('controls.none'))}) }}</p>
          </details>
          <div class="runtime-actions">
            <button
              v-if="r.rage"
              class="secondary"
              @click="run({ type: 'end-effect', effect: 'rage' })"
            >
              {{ controlText('runtime.endRage') }}</button
            ><button
              v-if="r.innateSorcery"
              class="secondary"
              @click="run({ type: 'end-effect', effect: 'innateSorcery' })"
            >
              {{ controlText('runtime.endInnateSorcery') }}
            </button>
          </div>
          <p v-if="r.rage" class="small muted">
            {{ controlText('runtime.rageHelp') }}
          </p>
          <div v-if="character.build.classId === 'paladin'" class="runtime-grid">
            <label
              >{{ controlText('runtime.layOnHandsPoints') }}<input
                v-model.number="layAmount"
                type="number"
                min="1"
                :max="character.level * 5" /></label
            ><label
              >{{ controlText('domain.layOnHands') }}<select v-model="layTarget" :aria-label="controlText('domain.layOnHands')">
                <option value="self">{{ controlText('runtime.healSelf') }}</option>
                <option value="other">{{ controlText('runtime.healOther') }}</option>
                <option value="purify">{{ controlText('runtime.removeOwnPoison') }}</option>
              </select></label
            ><label>{{ controlText('runtime.layTarget') }}<input v-model="layNote" /></label
            ><button
              class="secondary"
              :disabled="incapacitated"
              @click="
                run({
                  type: 'resource',
                  id: 'lay-on-hands',
                  amount: layAmount,
                  target: layTarget,
                  note: layNote,
                })
              "
            >
              {{ controlText('runtime.useLay') }}
            </button>
          </div>
          <details>
            <summary>{{ controlText('runtime.gmResource') }}</summary>
            <label
              >{{ controlText('domain.adjustResource') }}<select v-model="gmResource" :aria-label="controlText('domain.adjustResource')">
                <option value="">{{ controlText('game.choose') }}</option>
                <option v-for="def in defs" :key="def.id" :value="def.id">{{ uiLabel(localizedEntryName(def)) }}</option>
              </select></label
            ><label>{{ controlText('runtime.remainingAfter') }}<input v-model.number="gmAmount" type="number" min="0" /></label
            ><label>{{ controlText('domain.gmReason') }}<input v-model="gmReason" maxlength="2000" /></label
            ><button
              class="secondary"
              :disabled="!gmResource"
              @click="
                run({ type: 'resource-set', id: gmResource, amount: gmAmount, reason: gmReason })
              "
            >
              {{ controlText('runtime.recordAdjustment') }}
            </button>
            <p class="small muted">{{ controlText('runtime.localAdjustmentHelp') }}</p>
          </details>
        </section>

        <section class="panel spell-list-panel">
          <div class="spell-section-head">
            <h3>{{ controlText('runtime.spellsSources') }}</h3>
            <span v-if="r.concentration" class="spell-badge">{{ controlText('progressSummary.concentrating', {p0:(concentrationName)}) }}</span>
            <button
              v-if="r.concentration"
              class="secondary spell-end-concentration"
              @click="run({ type: 'end-effect', effect: 'concentration' })"
            >
              {{ controlText('domain.endConcentration') }}
            </button>
          </div>
          <p class="small muted spell-intro">
            {{ controlText('runtime.castRecordHelp') }}
          </p>

          <div class="spell-toolbar">
            <label class="spell-search"
              >{{ controlText('runtime.searchSpells') }}<input
                v-model="spellSearch"
                type="search"
                :placeholder="controlText('runtime.spellSearchPlaceholder')"
            /></label>
            <div class="spell-levels" role="group" :aria-label="controlText('runtime.filterLevel')">
              <button
                type="button"
                :class="{ on: spellLevelFilter === 'all' }"
                @click="spellLevelFilter = 'all'"
              >
                {{ controlText('controls.all') }}
              </button>
              <button
                v-for="level in availableSpellLevels"
                :key="level"
                type="button"
                :class="{ on: spellLevelFilter === level }"
                @click="spellLevelFilter = level"
              >
                {{ level === 0 ? controlText('controls.cantrips') : spellLevelName(level) }}
              </button>
            </div>
            <label class="inline-check spell-castable"
              ><input v-model="castableOnly" type="checkbox" />{{ controlText('runtime.castableOnly') }}</label
            >
          </div>

          <div class="spell-toolbar spell-toolbar-secondary">
            <button
              class="secondary"
              :disabled="spellCategories.searching.value"
              @click="
                spellCategories.setAll(
                  spellGroups.map((group) => group.level),
                  true,
                )
              "
            >
              {{ controlText('runtime.expandCategories') }}</button
            ><button
              class="secondary"
              :disabled="spellCategories.searching.value"
              @click="
                spellCategories.setAll(
                  spellGroups.map((group) => group.level),
                  false,
                )
              "
            >
              {{ controlText('runtime.collapseCategories') }}</button
            ><button class="secondary" @click="expandSpells(true)">{{ controlText('runtime.expandSpells') }}</button
            ><button class="secondary" @click="expandSpells(false)">{{ controlText('runtime.collapseSpells') }}</button>
          </div>
          <p v-if="spellCategories.searching.value" class="small muted">
            {{ controlText('runtime.searchExpandHelp') }}
          </p>

          <section
            v-for="group in visibleSpellGroups"
            :key="group.level"
            class="spell-group"
            :data-level="group.level"
          >
            <div class="group-heading">
              <h4>
                <button
                  class="text-button"
                  :aria-expanded="spellCategories.isExpanded(group.level)"
                  :aria-controls="'spell-category-' + group.level + '-' + character.id"
                  :disabled="spellCategories.searching.value"
                  @click="spellCategories.toggle(group.level)"
                >
                  {{ spellCategories.isExpanded(group.level) ? '▾' : '▸' }} {{ localizedEntryName(group) }}
                </button>
              </h4>
              <small>{{ controlText('progressSummary.sources', {p0:(group.items.length)}) }}</small>
            </div>
            <div
              v-show="spellCategories.isExpanded(group.level)"
              :id="'spell-category-' + group.level + '-' + character.id"
            >
              <details
                v-for="grant in group.items"
                :key="grant.key"
                class="spell-card"
                :data-spell="grant.key"
                :data-spell-id="grant.spell.id"
                :open="expandedSpells[grant.key] ?? false"
                @toggle="
                  expandedSpells[grant.key] = ($event.target as HTMLDetailsElement).open
                "
              >
                <summary>
                  <span class="spell-summary-main">
                    <span class="spell-name-line">
                      <b>{{ localizedEntryName(grant.spell) }}</b>
                      <small>{{ grant.spell.english }}</small>
                      <em v-if="grant.spell.concentration" class="spell-badge">{{ controlText('controls.concentration') }}</em>
                    </span>
                    <span class="spell-meta">
                      {{ controlText('progressSummary.dcAttack', {p0:(spellLevelName(grant.spell.level)),p1:(spellInfo[grant.key]!.school),p2:(grant.source),p3:(abilityDisplayName(grant.ability)),p4:(grant.item?.dc??spellDC(grant.ability, grant.sorcerer)),p5:(signed((grant.item?.attackBonus??d.pb + d.mods[grant.ability]) - r.exhaustion * 2)),p6:(grant.sorcerer && r.innateSorcery ? controlText('expressionThree.innateSorceryAttackAdvantage') : '')}) }}
                    </span>
                  </span>
                  <button
                    class="secondary spell-cast-entry"
                    type="button"
                    :disabled="!canCastGrant(grant)"
                    @click.stop.prevent="openCast(grant)"
                  >
                    {{ controlText('runtime.recordCast') }}
                  </button>
                </summary>
                <div class="spell-body">
                  <dl class="spell-facts">
                    <div>
                      <dt>{{ controlText('runtime.spellLevel') }}</dt>
                      <dd>
                        {{ spellLevelName(grant.spell.level) }} {{ spellInfo[grant.key]!.school }}
                      </dd>
                    </div>
                    <div>
                      <dt>{{ controlText('runtime.actionCost') }}</dt>
                      <dd>{{ spellInfo[grant.key]!.castingTime }}</dd>
                    </div>
                    <div>
                      <dt>{{ controlText('controls.duration') }}</dt>
                      <dd>{{ spellInfo[grant.key]!.duration }}</dd>
                    </div>
                    <div>
                      <dt>{{ controlText('runtime.castingRange') }}</dt>
                      <dd>{{ spellInfo[grant.key]!.range }}</dd>
                    </div>
                    <div v-if="spellInfo[grant.key]!.rounds !== null">
                      <dt>{{ controlText('runtime.durationRounds') }}</dt>
                      <dd>
                        {{ spellInfo[grant.key]!.rounds }} {{ controlText('game.turn') }}{{
                          grant.spell.concentration ? controlText('expressionThree.concentrationMayEndEarly') : ''
                        }}
                      </dd>
                    </div>
                    <div class="spell-components">
                      <dt>{{ controlText('runtime.components') }}</dt>
                      <dd>{{ spellInfo[grant.key]!.components }}</dd>
                    </div>
                  </dl>
                  <p class="spell-body-text">{{ spellInfo[grant.key]!.description }}</p>
                  <p class="small muted">{{ spellInfo[grant.key]!.reference }}</p>

                  <div :id="'spell-cast-' + grant.key" class="spell-cast">
                    <label
                      v-if="character.build.choices.subclass?.includes('wild-magic')"
                      class="inline-check"
                      ><input v-model="wildCheck" type="checkbox" />{{ controlText('runtime.wildMagicCheck') }}</label
                    >
                    <label
                      >{{ controlText('domain.castMethod') }}<select
                        v-model="castModes[grant.key]"
                        :aria-label="grant.key + controlText('domain.castMethod')"
                      >
                        <option value="">{{ controlText('game.choose') }}</option>
                        <option v-for="mode in grant.modes" :key="mode" :value="mode">
                          {{ mode.startsWith('item-')?itemCastLabel(mode):uiLabel(MODE_NAMES[mode])
                          }}{{
                            mode === 'free'
                              ? controlText('expressionOne.remaining') + r.resources[grant.resource!]
                              : mode.startsWith('slot')
                                ? controlText('expressionOne.remaining') +
                                  ((r.resources[mode === 'slot' ? 'slots' : mode] ?? 0) +
                                    (r.createdSlots[mode === 'slot' ? 'slots' : mode] ?? 0))
                                : ''
                          }}
                        </option>
                      </select></label
                    ><label v-if="grant.spell.id === 'arcane-vigor'"
                      >{{ controlText('field.arcaneVigorHitDiceCountRemaining') }} {{ r.hitDice }}）<input
                        v-model.number="vigorDice"
                        type="number"
                        min="1"
                        max="3"
                        :aria-label="controlText('runtime.arcaneVigorDice')" /></label
                    ><label class="inline-check"
                      ><input
                        v-model="castConfirmed[grant.key]"
                        type="checkbox"
                      />{{ controlText('runtime.confirmCastRequirements') }}</label
                    ><button
                      class="primary"
                      :disabled="
                        incapacitated || !castModes[grant.key] || !castConfirmed[grant.key]
                      "
                      @click="
                        run({
                          type: 'cast',
                          key: grant.key,
                          mode: castModes[grant.key]!,
                          requirementsConfirmed: !!castConfirmed[grant.key],
                          hitDice: grant.spell.id === 'arcane-vigor' ? vigorDice : undefined,
                          wildCheck,
                        })
                      "
                    >
                      {{ controlText('runtime.completeCast') }} {{ localizedEntryName(grant.spell) }}
                    </button>
                    <p class="small muted">
                      {{
                        castModes[grant.key] === 'ritual'
                          ? controlText('expressionThree.ritualsTakeExtraMinutesAndSpendNoSlot')
                          : ''
                      }}{{
                        grant.spell.concentration ? controlText('expressionThree.startsConcentrationAndEndsExistingConcentration') : ''
                      }}{{ controlText('runtime.materialHelp') }}<a
                        v-if="spellSource(grant.spell.source)"
                        :href="spellSource(grant.spell.source)"
                        target="_blank"
                        rel="noopener"
                        >{{ grant.spell.source.pack }} {{ grant.spell.source.version }} · p.{{
                          grant.spell.source.page
                        }}</a
                      ><span v-else
                        >{{ controlText('progressSummary.sourceP', {p0:(grant.spell.source.pack),p1:(grant.spell.source.version),p2:(grant.spell.source.page)}) }}</span
                      >
                    </p>
                  </div>
                </div>
              </details>
            </div>
          </section>
          <p v-if="!visibleSpellGroups.length" class="muted">{{ controlText('runtime.noSpells') }}</p>
          <details v-if="character.build.choices.spellbook?.length">
            <summary>{{ controlText('progressSummary.spellbookCount', {p0:(character.build.choices.spellbook.length)}) }}</summary>
            <div class="tag-row">
              <button
                v-for="id in character.build.choices.spellbook"
                :key="id"
                class="tag"
                @click="emit('info', id)"
              >
                {{ localizedEntryName(content.spells.find((x) => x.id === id)) }}
              </button>
            </div>
          </details>
        </section>

        <details class="panel spell-team">
          <summary>{{ controlText('domain.partyOriginSpecies') }}</summary>
          <div class="spell-team-body">
            <AdvancedPanel
              :character="character"
              :content="content"
              :busy="pending"
              :blocked="!!battleEncounter"
              :review="reviewRequired"
              @runtime="run"
            />
            <OriginPanel
              v-if="!battleEncounter"
              :character="character"
              :content="content"
              :people="people ?? store.characters.map((c) => ({ id: c.id, name: c.build.name }))"
              :busy="pending"
              @execute="run"
            />
          </div>
        </details>
      </div>

      <div v-show="tab === 'checks'" class="runtime-content">
        <section class="panel">
          <h3>{{ controlText('runtime.checkAssistant') }}</h3>
          <div class="runtime-grid">
            <label
              >{{ controlText('runtime.checkType') }}<select v-model="rollKind" :aria-label="controlText('runtime.checkType')">
                <option value="skill">{{ controlText('domain.skillCheck') }}</option>
                <option value="save">{{ controlText('domain.abilitySave') }}</option>
                <option value="initiative">{{ controlText('controls.initiative') }}</option>
              </select></label
            ><label v-if="rollKind !== 'initiative'"
              >{{ controlText('runtime.checkEntry') }}<select v-model="rollId" :aria-label="controlText('runtime.checkEntry')">
                <template v-if="rollKind === 'skill'"
                  ><option v-for="(skill, id) in SKILLS" :key="id" :value="id">
                    {{ skillDisplayName(id) }}
                  </option></template
                ><template v-else
                  ><option v-for="ability in ABILITIES" :key="ability" :value="ability">
                    {{ abilityDisplayName(ability) }}
                  </option></template
                >
              </select></label
            ><label
              >{{ controlText('runtime.checkContext') }}<select v-model="purpose" :aria-label="controlText('runtime.checkContext')">
                <option value="normal">{{ controlText('runtime.normalContext') }}</option>
                <option value="poison">{{ controlText('runtime.poisonContext') }}</option>
                <option value="charm">{{ controlText('runtime.charmContext') }}</option>
                <option value="fear">{{ controlText('runtime.fearContext') }}</option>
                <option value="concentration">{{ controlText('runtime.concentrationContext') }}</option>
                <option value="grapple">{{ controlText('runtime.grappleContext') }}</option>
                <option value="sight">{{ controlText('runtime.needsVision') }}</option>
                <option value="hearing">{{ controlText('runtime.needsHearing') }}</option>
              </select></label
            ><label
              >{{ controlText('runtime.optionalDC') }}<input
                v-model.number="rollDC"
                type="number"
                min="1"
                max="100"
                :placeholder="controlText('runtime.effectOrGm')"
            /></label>
          </div>
          <div class="inline-options">
            <label v-if="defs.some((d) => d.id === 'lucky')" class="check"
              ><input
                v-model="lucky"
                type="checkbox"
                :disabled="!r.resources.lucky"
              />{{ controlText('interactionField.useALuckPointForAdvantageOnThis') }} {{ r.resources.lucky }}）</label
            >
            <label><input v-model="advantage" type="checkbox" />{{ controlText('runtime.extraAdvantage') }}</label
            ><label><input v-model="disadvantage" type="checkbox" />{{ controlText('runtime.extraDisadvantage') }}</label
            ><label v-if="d.conditions.includes('frightened')"
              ><input v-model="fearVisible" type="checkbox" />{{ controlText('runtime.fearInSight') }}</label
            >
          </div>
          <p>
            {{ rollInfo.reasons.map(value=>checkReasonPresentation(value)).join(' + ') }} = <b>{{ signed(rollInfo.bonus) }}</b>
          </p>
          <p class="small">{{ controlText('progressSummary.advantageDisadvantage', {p0:(rollInfo.adv.join('、') || controlText('controls.none')),p1:(rollInfo.dis.join('、') || controlText('controls.none')),p2:(rollInfo.autoFail
                ? controlText('expressionThree.thisSituationAutomaticallyFailsUnderConditionRules')
                : rollInfo.mode === 'normal'
                  ? controlText('expressionThree.rollOneDSimultaneousAdvantageAndDisadvantageCancel')
                  : rollInfo.mode === 'advantage'
                    ? controlText('expressionThree.rollTwoDSAndTakeTheHigher')
                    : controlText('expressionThree.rollTwoDSAndTakeTheLower'))}) }}
          </p>
          <button
            class="primary"
            @click="
              run({
                type: 'check',
                kind: rollKind,
                id: rollId,
                context,
                dc: rollDC ? Number(rollDC) : undefined,
              })
            "
          >
            {{ rollInfo.autoFail ? controlText('expressionThree.recordAutomaticFailure') : controlText('expressionThree.rollAndRecordCheck') }}
          </button>
          <p class="small muted">
            {{ controlText('runtime.checkRulesHelp') }}<a :href="source(6)" target="_blank" rel="noopener"
              >{{ controlText('adjudication.rulesPp68') }}</a
            >
          </p>
        </section>
        <div class="runtime-grid">
          <section class="panel">
            <h3>{{ controlText('runtime.allSkills') }}</h3>
            <div v-for="(skill, id) in SKILLS" :key="id" class="runtime-detail-row">
              <b>{{ skillDisplayName(id) }} {{ signed(d.skillValues[id]!) }}</b
              ><small>{{ checkDetail(character, content, 'skill', id).reasons.map(value=>checkReasonPresentation(value)).join(' + ') }}</small>
            </div>
          </section>
          <section class="panel">
            <h3>{{ controlText('runtime.allSaves') }}</h3>
            <div v-for="ability in ABILITIES" :key="ability" class="runtime-detail-row">
              <b>{{ abilityDisplayName(ability) }} {{ signed(d.saves[ability]!) }}</b
              ><small>{{
                checkDetail(character, content, 'save', ability).reasons.map(value=>checkReasonPresentation(value)).join(' + ')
              }}</small
              ><small>{{
                checkDetail(character, content, 'save', ability).autoFail
                  ? controlText('expressionThree.strengthDexterityAutomaticallyFailUnderConditions')
                  : checkDetail(character, content, 'save', ability).adv.join('、')
              }}</small>
            </div>
            <p class="small muted">
              {{ controlText('runtime.speciesAdvantageHelp') }}
            </p>
          </section>
        </div>
      </div>

      <GrowthPanel
        v-show="tab === 'growth'"
        :character="character"
        :content="content"
        :busy="pending"
        :blocked="!!battleEncounter"
        :review-required="reviewRequired"
        @command="run"
        @info="emit('info', $event)"
      />
      <div v-show="tab === 'journal'" class="runtime-content">
        <section class="panel">
          <div class="runtime-bar">
            <h3>{{ controlText('domain.operationHistory') }}</h3>
            <button class="secondary" :disabled="!undoable" @click="undo">{{ actionText('undo', '撤销最近操作', '申请撤销最近操作') }}</button>
          </div>
          <p class="small muted">
            {{ controlText('runtime.undoLimits') }}
          </p>
          <ol class="runtime-journal">
            <li v-for="event in journal" :key="event.id" :class="{ undone: event.undone }">
              <small
                >{{ controlText('progressSummary.revision', {p0:(uiDate(event.at,'datetime')),p1:(event.revision),p2:(event.undone ? controlText('expressionOne.undone') : '')}) }}</small
              >
              <p>{{ event.detail }}</p>
            </li>
          </ol>
          <p v-if="!journal.length" class="muted">
            {{ controlText('runtime.legacySaveHelp') }}
          </p>
        </section>
      </div>
    </fieldset>
  </section>
</template>
<style scoped>
.spell-dashboard {
  --spell-muted: color-mix(in srgb, var(--muted) 65%, var(--ink));
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.4fr);
  align-items: start;
  gap: 20px;
}
.spell-dashboard > .panel {
  min-width: 0;
  margin: 0;
}
.resource-group,
.spell-group {
  margin-top: 22px;
}
.group-heading {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
  margin: 0 0 12px;
}
.group-heading h4 {
  margin: 0;
}
.group-heading small {
  font-weight: 400;
  color: var(--spell-muted);
  font-size: 12px;
}
.spell-dashboard .resource-grid {
  grid-template-columns: 1fr;
  gap: 10px;
}
.spell-dashboard .resource-card {
  border: 1px solid var(--line);
  padding: 14px;
}
.resource-card strong {
  font-size: 18px;
}
.resource-rules {
  margin: 10px 0;
}
.resource-rules summary {
  font-size: 13px;
  color: var(--spell-muted);
  cursor: pointer;
  min-height: 44px;
}
.spell-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.spell-facts > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.spell-facts dt {
  color: var(--spell-muted);
  font-size: 12px;
  margin-bottom: 3px;
}
.spell-facts dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}
.spell-components {
  grid-column: 1 / -1;
}
.spell-preview,
.spell-description > p {
  font-size: 15px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.spell-description > p {
  color: var(--ink);
  white-space: pre-line;
  max-width: 70ch;
}
.spell-description summary {
  cursor: pointer;
  min-height: 44px;
  padding: 4px 0;
}
.spell-description {
  margin: 12px 0;
}
.spell-dashboard .small.muted {
  color: var(--spell-muted);
}
@media (max-width: 1100px) {
  .spell-dashboard {
    grid-template-columns: minmax(0, 1fr);
  }
  .spell-dashboard .resource-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .spell-dashboard .resource-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .spell-facts {
    gap: 10px;
  }
  .spell-preview,
  .spell-description > p {
    font-size: 16px;
  }
}

/* TASK-UI-004：生命与状态主区 + 角色右栏 */
.runtime-status-page {
  padding: 0;
}
.runtime-status-main {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.runtime-block {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
}
.runtime-block-head {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  min-height: 24px;
  margin-bottom: 6px;
}
.runtime-block-head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}
.runtime-block-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface);
  color: var(--accent);
  font-size: 9.5px;
  font-weight: 700;
  flex: none;
}
.runtime-block-note {
  font-size: 10px;
  color: var(--muted);
  font-weight: 400;
}
.runtime-review-tag {
  font-size: 9.5px;
  line-height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  background: #f3e9d8;
  color: #7a5a24;
  border: 1px solid #dcc39a;
  font-weight: 500;
}
.runtime-block-vitals .runtime-metrics {
  margin: 0 0 8px;
  gap: 8px;
}
.runtime-block-vitals .runtime-metrics > div {
  padding: 9px 10px;
  border-radius: 8px;
}
.runtime-block-vitals .runtime-metrics strong {
  font-size: 20px;
}
.runtime-block-vitals .runtime-metrics span,
.runtime-block-vitals .runtime-metrics small {
  font-size: 10px;
}
.runtime-block-vitals > .panel {
  padding: 8px 0 0;
  margin: 6px 0 0;
  border: 0;
  border-top: 1px solid var(--line);
  border-radius: 0;
}
.runtime-block-vitals > .panel h3 {
  margin: 0 0 6px;
  font-size: 12.5px;
}
.runtime-block-adjust .runtime-grid {
  gap: 10px;
}
.runtime-status-main .runtime-grid .panel {
  padding: 10px;
  margin: 0;
}
.runtime-status-main .runtime-grid .panel h3 {
  margin: 0 0 8px;
  font-size: 13px;
}
.runtime-status-main label {
  margin: 6px 0;
  font-size: 10.5px;
}
.runtime-status-main h3 {
  font-size: 13px;
}
.runtime-status-main input[type='number'] {
  max-width: 200px;
}
.runtime-status-rail input[type='number'] {
  max-width: 110px;
}
.runtime-status-main label input:not([type='checkbox']),
.runtime-status-main label select {
  margin-top: 3px;
}
.runtime-block-conditions > .panel,
.runtime-block-conditions > details.panel {
  padding: 0;
  margin: 0 0 8px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
.runtime-block-conditions .runtime-conditions-panel > h3,
.runtime-status-rail .runtime-rest-panel > h3 {
  display: none;
}
.runtime-block-conditions .tag-row {
  margin-bottom: 4px;
}
.runtime-block-conditions .conditions-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 14px;
}
.runtime-block-conditions .conditions-list details {
  padding: 5px 0;
}
.runtime-block-conditions .conditions-list summary {
  min-height: 28px;
  font-size: 12px;
}
.runtime-block-conditions .conditions-list p {
  font-size: 10.5px;
  line-height: 1.5;
}
.runtime-block-journal .runtime-journal-preview {
  list-style: none;
  margin: 0;
  padding: 0;
}
.runtime-journal-preview li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 4px 0;
  border-top: 1px dashed #e7e9e5;
  font-size: 10.5px;
  color: var(--ink);
}
.runtime-journal-preview li:first-child {
  border-top: 0;
}
.runtime-journal-preview time {
  flex: none;
  font-size: 9.5px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.runtime-journal-preview span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.runtime-journal-preview li.undone span {
  color: var(--muted);
  text-decoration: line-through;
}
.runtime-status-rail-fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.runtime-status-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.runtime-status-rail .runtime-block {
  padding: 9px 10px;
}
.runtime-status-rail .runtime-block-head h3 {
  font-size: 12px;
}
.runtime-status-rail label {
  display: block;
  margin: 5px 0;
  font-size: 10px;
  color: var(--muted);
}
.runtime-status-rail label input:not([type='checkbox']),
.runtime-status-rail label select {
  width: 100%;
  max-width: 100%;
  margin-top: 2px;
}
.runtime-status-rail .runtime-actions {
  gap: 4px;
  margin: 6px 0;
}
.runtime-status-rail .runtime-actions button {
  min-height: 28px;
  padding: 3px 7px;
  font-size: 10.5px;
}
.runtime-status-rail .runtime-actions label {
  flex: 1 1 80px;
  margin: 0;
}
.runtime-status-rail .runtime-rest-panel {
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
}
.runtime-status-rail .runtime-rest-panel details summary {
  min-height: 28px;
  font-size: 11px;
}
.runtime-status-rail .runtime-rest-panel .small,
.runtime-status-rail .runtime-rest-panel p {
  font-size: 9.5px;
  line-height: 1.5;
}
.runtime-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}
.runtime-summary-grid > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  min-height: 24px;
  border-top: 1px dashed #e7e9e5;
  padding-top: 3px;
  font-size: 10px;
  color: var(--muted);
}
.runtime-summary-grid > div:nth-child(-n + 2) {
  border-top: 0;
}
.runtime-summary-grid b {
  color: var(--ink);
  font-size: 11px;
  font-weight: 600;
}
.runtime-block-request .secondary,
.runtime-block-rules a {
  width: 100%;
  margin-top: 4px;
}
.runtime-block-request .secondary {
  min-height: 30px;
  font-size: 11px;
}
.runtime-block-rules a {
  display: block;
  padding: 3px 0;
  border-top: 1px dashed #e7e9e5;
  color: var(--ink);
  font-size: 10px;
  text-decoration: none;
}
.runtime-block-rules a:first-of-type {
  border-top: 0;
}
.runtime-block-rules a:hover {
  color: var(--accent);
}
@media (max-width: 1100px) {
  .runtime-block-conditions .conditions-list {
    grid-template-columns: 1fr;
  }
}

/* TASK-UI-006：法术与资源页（单列 + 资源卡 + 法术卡） */
.spell-page {
  display: grid;
  gap: 16px;
}
.spell-page .panel {
  margin: 0;
  padding: 18px;
  border-radius: 12px;
}
.spell-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.spell-section-head h3 {
  margin: 0;
  font-family: Georgia, 'Songti SC', 'Noto Serif SC', serif;
  font-size: 17px;
}
.spell-badge {
  padding: 1px 9px;
  border-radius: 99px;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  color: var(--accent);
  font-size: 11px;
  font-style: normal;
  line-height: 1.7;
  white-space: nowrap;
}
.spell-badge.quiet {
  background: var(--surface);
  border-color: var(--line);
  color: var(--muted);
}
.spell-end-concentration {
  margin-left: auto;
  min-height: 30px;
  font-size: 12px;
}
.resource-band + .resource-band {
  margin-top: 14px;
}
.resource-band .group-heading {
  margin-bottom: 8px;
  padding-bottom: 8px;
}
.spell-resource-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.spell-resource-card {
  flex: 0 1 210px;
  min-width: 150px;
  display: grid;
  gap: 6px;
  align-content: start;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  min-width: 0;
}
.spell-resource-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.spell-resource-top b {
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.spell-resource-top strong {
  font-family: Georgia, 'Songti SC', 'Noto Serif SC', serif;
  font-size: 20px;
  line-height: 1.1;
  white-space: nowrap;
}
.spell-pips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.spell-pips s {
  width: 11px;
  height: 11px;
  border: 2px solid var(--gold);
  border-radius: 50%;
}
.spell-pips s.on {
  background: var(--gold);
}
.spell-resource-hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.5;
}
.spell-resource-card .resource-rules {
  margin: 2px 0;
}
.spell-resource-card .resource-rules summary {
  min-height: 30px;
  font-size: 11.5px;
  color: var(--muted);
}
.spell-resource-use {
  min-height: 30px;
  font-size: 12px;
}
.spell-intro {
  margin: 0 0 10px;
}
.spell-toolbar {
  display: flex;
  align-items: end;
  gap: 8px;
  flex-wrap: wrap;
  margin: 10px 0;
}
.spell-toolbar-secondary {
  align-items: center;
}
.spell-toolbar-secondary .secondary {
  min-height: 30px;
  font-size: 12px;
}
.spell-search {
  flex: 1;
  min-width: 200px;
  display: grid;
  gap: 4px;
  font-size: 11.5px;
  color: var(--muted);
}
.spell-search input {
  width: 100%;
}
.spell-levels {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.spell-levels button {
  min-height: 28px;
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: 99px;
  background: var(--panel);
  color: var(--ink);
  font-size: 12px;
  cursor: pointer;
}
.spell-levels button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.spell-castable {
  white-space: nowrap;
  font-size: 12px;
  padding-bottom: 6px;
}
.spell-card {
  margin-bottom: 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  overflow: visible;
}
.spell-card > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 10px 12px;
  cursor: pointer;
  list-style: none;
}
.spell-card > summary::-webkit-details-marker {
  display: none;
}
.spell-summary-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.spell-name-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.spell-name-line b {
  font-family: Georgia, 'Songti SC', 'Noto Serif SC', serif;
  font-size: 14px;
}
.spell-name-line small {
  color: var(--muted);
  font-size: 11px;
}
.spell-meta {
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.spell-cast-entry {
  flex: none;
  min-height: 32px;
  padding: 4px 10px;
  font-size: 12px;
}
.spell-body {
  display: grid;
  gap: 10px;
  padding: 0 12px 14px;
  max-height: none;
  overflow: visible;
}
.spell-body-text {
  display: block;
  margin: 0;
  max-height: none;
  overflow: visible;
  -webkit-line-clamp: unset;
  line-clamp: unset;
  white-space: pre-line;
  font-size: 15px;
  line-height: 1.8;
  max-width: 70ch;
  overflow-wrap: anywhere;
}
.spell-cast {
  display: grid;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}
.spell-cast > .primary {
  justify-self: start;
}
.spell-team {
  padding: 0;
}
.spell-team > summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 14px 18px;
  cursor: pointer;
  list-style: none;
  font-family: Georgia, 'Songti SC', 'Noto Serif SC', serif;
  font-size: 15px;
  font-weight: 600;
}
.spell-team > summary::-webkit-details-marker {
  display: none;
}
.spell-team-body {
  padding: 0 18px 18px;
  display: grid;
  gap: 14px;
}
.spell-team-body > .panel {
  margin: 0;
}
@media (max-width: 720px) {
  .spell-page .panel {
    padding: 14px;
  }
  .spell-resource-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .spell-resource-card {
    flex: none;
    min-width: 0;
  }
  .spell-card > summary {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .spell-cast-entry {
    width: 100%;
  }
  .spell-body-text {
    font-size: 16px;
  }
}

</style>
