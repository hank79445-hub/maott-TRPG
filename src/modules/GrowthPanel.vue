<script setup lang="ts">
import {growthIssuePresentations} from './build-issue-presentation'
import {uiLabel} from './ui-label'
import {uiDate} from './locale-format'
import {ruleText,ruleLabel} from './rule-presentation'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {abilityDisplayName} from './rule-presentation'

import { spellPresentation } from "./runtime-presentation"
import { computed, ref, watch } from 'vue'
import { sourceCaption } from '../core/rule-sources'
import { featBoost } from '../core/advanced-rules'
import type { Ability, Character, GrowthRequest } from '../core/types'
import { ABILITIES, ABILITY_NAMES, SRD_SOURCE } from '../core/types'
import { clone, derived, getChoices, type Catalogue } from '../core/engine'
import { growthCandidate, growthIssues } from '../core/growth'
import { growthFeatures, slotLevels, SUBCLASSES } from '../core/growth-rules'
import ChoiceField from './ChoiceField.vue'
import GrowthSpellChoice from './growth/GrowthSpellChoice.vue'
import GrowthSpellbookChoice from './growth/GrowthSpellbookChoice.vue'
import { growthBaseline, growthChoicePolicy, schoolAward } from '../core/growth-choice-policy'
const props = defineProps<{
  character: Character
  content: Catalogue
  busy: boolean
  blocked: boolean
  reviewRequired?: boolean
}>()
const emit = defineEmits<{ command: [GrowthRequest & { type: 'level-up' }]; info: [string] }>()
const open = ref(false),
  step = ref(0),
  request = ref<GrowthRequest | null>(null),
  information = ref('')
const reference = computed(() => props.content.spells.find((s) => s.id === information.value))
const cl = computed(() =>
  props.content.classes.find((c) => c.id === props.character.build.classId)!,
)
const candidate = computed(() =>
  request.value ? growthCandidate(props.character, request.value, props.content) : props.character,
)
const preview = computed(() =>
  derived(candidate.value.build, props.content, props.character.inventory),
)
const current = computed(() =>
  derived(props.character.build, props.content, props.character.inventory),
)
const features = computed(() => growthFeatures(candidate.value.build))
const baseline = computed(() => growthBaseline(props.character))
const award = computed(() => schoolAward(props.character, candidate.value))
const draftWarnings = ref<string[]>([])
const spellName = (id: string) => props.content.spells.find(s => s.id === id)?.name ?? id
function policy(node: ReturnType<typeof getChoices>[number]) {
  const p = growthChoicePolicy(props.character, candidate.value, node, props.content, baseline.value)
  if (node.id.startsWith('mi-') && p.replacements !== undefined && request.value) {
    const prefix = node.id.replace(/-(cantrips|spell)$/, '')
    const other = node.id.endsWith('-cantrips') ? prefix + '-spell' : prefix + '-cantrips'
    p.replacements = Math.max(0, 1 - (baseline.value[other] ?? []).filter(id => !request.value!.choices[other]?.includes(id)).length)
  }
  return p
}
const changes = computed(() => editable.value.map(node => {
  const p = policy(node), current = request.value?.choices[node.id] ?? []
  return { id: node.id, label: node.label, added: current.filter(id => !p.before.includes(id)), removed: p.before.filter(id => !current.includes(id)) }
}))
const boost = computed(() => featBoost(candidate.value.build, props.content))
const editable = computed(() =>
  getChoices(candidate.value.build, props.content).filter((n) => {
    const before = getChoices(props.character.build, props.content).find((x) => x.id === n.id)
    return (
      !before ||
      n.count !== before.count ||
      [
        'class-cantrips',
        'class-spells',
        'spellbook',
        'invocation',
        'style',
        'mastery',
        'metamagic',
        'warrior-cantrips',
      ].includes(n.id) ||
      n.id.startsWith('mi-') ||
      n.id.startsWith('tome-')
    )
  }),
)
const issues = computed(() =>
  request.value ? growthIssues(props.character, request.value, props.content) : [],
)
const presentedIssues=computed(()=>growthIssuePresentations(issues.value,candidate.value.build,props.content))
const source = (page: number) => SRD_SOURCE.url + '#page=' + page
function begin() {
  request.value = {
    expectedRevision: props.character.revision,
    targetLevel: props.character.level + 1,
    hpMethod: 'fixed',
    choices: clone(baseline.value),
    abilityIncreases: {},
    confirmed: false,
    reason: '',
  }
  draftWarnings.value = []
  prune()
  step.value = 0
  open.value = true
}
function prune() {
  if (!request.value) return
  for (let i = 0; i < 3; i++) {
    const nodes = getChoices(candidate.value.build, props.content),
      ids = new Set(nodes.map((n) => n.id))
    for (const key of Object.keys(request.value.choices))
      if (!ids.has(key)) {
        if (request.value.choices[key]?.length) draftWarnings.value.push('上游变更使来源不再可用：' + key + '；原角色未改动')
        delete request.value.choices[key]
      }
    for (const n of nodes)
      if (request.value.choices[n.id]) {
        const previous = request.value.choices[n.id]!, valid = previous.filter(id => n.options.some(o => o.id === id))
        if (valid.length !== previous.length) draftWarnings.value.push(n.label + '：' + previous.filter(id => !valid.includes(id)).map(spellName).join('、') + '不再符合当前来源，请核对')
        request.value.choices[n.id] = valid
      }
  }
  if (request.value.targetLevel !== 4 || !boost.value) request.value.abilityIncreases = {}
  else
    for (const key of Object.keys(request.value.abilityIncreases))
      if (!boost.value.abilities.includes(key as Ability))
        delete request.value.abilityIncreases[key as Ability]
}
function choose(id: string, values: string[]) {
  if (request.value) {
    request.value.choices[id] = values
    prune()
  }
}
watch(
  () => props.character.revision,
  () => {
    open.value = false
    request.value = null
  },
)
</script>
<template>
  <section class="panel growth-panel">
    <div class="runtime-bar">
      <h3>{{ controlText('quantity.growth', {p0:(character.level),p1:(localizedEntryName(cl))}) }}</h3>
      <button
        v-if="!open && character.level < 5"
        class="primary"
        :disabled="busy || blocked"
        @click="begin"
      >{{ controlText('quantity.nextLevel', {p0:(character.level + 1)}) }}</button>
    </div>
    <p class="muted">
      {{ controlText('workflow.growthHint') }}
    </p>
    <p v-if="blocked" class="runtime-feedback">{{ controlText('workflow.finishCombat') }}</p>
    <p v-if="character.level >= 5">{{ controlText('workflow.levelCap') }}</p>
    <template v-if="open && request">
      <nav class="runtime-tabs" :aria-label="controlText('workflow.growthSteps')">
        <button
          v-for="(name, i) in ['生命与资格', '成长选择', '检查与提交']"
          :key="name"
          :aria-pressed="step === i"
          :class="{ active: step === i }"
          @click="step = i"
        >
          {{ i + 1 }} · {{ uiLabel(name) }}
        </button>
      </nav>
      <section v-show="step === 0">
        <h4>{{ controlText('quantity.levelTransition', {p0:(character.level),p1:(request.targetLevel),p2:(localizedEntryName(cl))}) }}</h4>
        <label
          >{{ controlText('domain.levelHP') }}<select v-model="request.hpMethod" :aria-label="controlText('domain.levelHP')">
            <option value="fixed">{{ controlText('workflow.fixedHp') }} {{ Math.floor(cl.hitDie / 2) + 1 }} {{ controlText('domain.constitutionModifier') }}</option>
            <option value="roll">{{ controlText('workflow.hpRoll') }}{{ cl.hitDie }} {{ controlText('domain.constitutionModifier') }}</option>
          </select></label
        >
        <p class="muted">
          {{ controlText('workflow.hpHint') }}
        </p>
        <label
          >{{ controlText('domain.growthBasis') }}<input
            v-model="request.reason"
            :aria-label="controlText('domain.growthBasis')"
            maxlength="2000"
            :placeholder="controlText('workflow.milestoneExample')"
        /></label>
        <label class="check"
          ><input v-model="request.confirmed" type="checkbox" />{{ controlText('workflow.eligibility') }}</label
        >
      </section>
      <section v-show="step === 1">
        <div class="panel">
          <strong>{{ controlText('workflow.spellChanges') }}</strong>
          <p v-for="n in editable.filter(n => n.kind === 'spell')" :key="n.id">{{ controlText('quantity.newReplacedSpells', {p0:(n.label),p1:(policy(n).addedSlots),p2:(policy(n).replacements ?? 0),p3:(policy(n).timing)}) }}</p>
          <p>{{ controlText('workflow.spellChangeHint') }}</p>
        </div>
        <p v-if="request.targetLevel >= 3">
          {{ controlText('quantity.subclassOptions', {p0:(content.subclasses.filter((s) => s.classId === character.build.classId).length)}) }}</p>
        <p class="muted">
          {{ controlText('workflow.choicesHint') }}
        </p>
        <section v-if="reference" class="panel growth-reference" :aria-label="controlText('workflow.spellReference')">
          <div class="runtime-bar">
            <h4>{{ localizedEntryName(reference) }} · {{ reference.english }}</h4>
            <button class="text-button" @click="information = ''">{{ controlText('workflow.closeSpellReference') }}</button>
          </div>
          <p>
            {{ reference.level === 0 ? controlText('controls.cantrips') : reference.level + controlText('expressionOne.level') }} ·
            {{ spellPresentation(reference).castingTime }} · {{ spellPresentation(reference).range }} · {{ spellPresentation(reference).components }} ·
            {{ spellPresentation(reference).duration }}
          </p>
          <p>{{ spellPresentation(reference).description }}</p>
          <a
            v-if="reference.source.url && reference.source.page"
            :href="reference.source.url + '#page=' + reference.source.page"
            target="_blank"
            rel="noopener"
            >{{ sourceCaption(reference.source) }}</a
          >
          <span v-else>{{ sourceCaption(reference.source) }}</span>
        </section>
        <p v-if="draftWarnings.length" class="error" role="alert">{{ [...new Set(draftWarnings)].join('；') }}</p>
        <template v-for="n in editable" :key="n.id">
        <GrowthSpellbookChoice v-if="n.id === 'spellbook'" :node="n" :model-value="request.choices[n.id] ?? []" :before="baseline.spellbook ?? []" :school="award.school" :award-count="award.count" :max-level="award.maxLevel" :content="content" @update:model-value="choose(n.id, $event)" @info="information = $event" />
        <GrowthSpellChoice :content="content" v-else-if="policy(n).replacements !== undefined" :node="n" :model-value="request.choices[n.id] ?? []" :before="policy(n).before" :replacements="policy(n).replacements ?? 0" :timing="policy(n).timing" @update:model-value="choose(n.id, $event)" @info="information = $event" />
        <ChoiceField :content="content" v-else
          :node="n"
          :model-value="request.choices[n.id] ?? []"
          @update:model-value="choose(n.id, $event)"
          @info="information = $event"
        />
        </template>
        <fieldset v-if="request.targetLevel === 4 && boost">
          <legend>{{ controlText('workflow.abilityGrowth') }}</legend>
          <div class="growth-abilities">
            <label v-for="a in boost?.abilities" :key="a"
              >{{ abilityDisplayName(a) }} {{ controlText('field.current') }} {{ current.scores[a]
              }}<select
                v-model.number="request.abilityIncreases[a]"
                :aria-label="controlText('expressionOne.advancement') + abilityDisplayName(a)"
              >
                <option :value="undefined">+0</option>
                <option :value="1">+1</option>
                <option
                  v-if="request.choices['growth-feat']?.[0] === 'ability-score-improvement'"
                  :value="2"
                >
                  +2
                </option>
              </select></label
            >
          </div>
        </fieldset>
      </section>
      <section v-show="step === 2">
        <details open><summary>{{ controlText('workflow.spellDifferences') }}</summary><p v-for="row in changes.filter(r => r.added.length || r.removed.length)" :key="row.id">{{ controlText('quantity.spellChanges', {p0:(row.label),p1:(row.added.map(spellName).join('、') || controlText('controls.none')),p2:(row.removed.map(spellName).join('、') || controlText('controls.none'))}) }}</p><p>{{ controlText('workflow.spellbookHint') }}</p></details>
        <h4>{{ controlText('workflow.growthPreview') }}</h4>
        <p>
          {{ controlText('quantity.growthStats', {p0:(controlText('domain.maxHP')),p1:(current.hp),p2:(preview.hp),p3:(request.hpMethod === 'roll' ? controlText('expressionOne.estimatedWithFixedHitDiceActualRollsRecorded') : ''),p4:(current.pb),p5:(preview.pb),p6:(current.speed),p7:(preview.speed),p8:(current.ac),p9:(preview.ac)}) }}
        </p>
        <p>
          {{ controlText('workflow.slotMaximum') }}{{
            slotLevels(candidate.build)
              .map((n, i) => (n ? `${i + 1} 环 ×${n}` : ''))
              .filter(Boolean)
              .join('、') || controlText('controls.none')
          }}{{ controlText('workflow.growthResources') }}
        </p>
        <p v-if="reviewRequired">{{ controlText('workflow.gmGrowth') }}</p>
        <ul v-if="issues.length" class="growth-errors">
          <li v-for="issue in presentedIssues" :key="issue">{{ issue }}</li>
        </ul>
        <p v-else class="success">{{ controlText('workflow.growthValid') }}</p>
        <button
          class="primary"
          :disabled="busy || blocked || !!issues.length"
          @click="emit('command', { type: 'level-up', ...clone(request) })"
        >
          {{ reviewRequired ? controlText('expressionOne.submitLevelUpForReview') : controlText('expressionOne.confirmLevelUp') }}
        </button>
      </section>
      <div class="runtime-actions">
        <button v-if="step > 0" class="secondary" @click="step--">{{ controlText('workflow.previous') }}</button
        ><button v-if="step < 2" class="primary" @click="step++">{{ controlText('workflow.next') }}</button
        ><button class="text-button" @click="open = false">{{ controlText('workflow.cancelGrowth') }}</button>
      </div>
    </template>
    <details v-if="features.length">
      <summary>{{ open ? controlText('expressionTwo.proposedAndExisting') : controlText('expressionTwo.alreadyGained') }}{{ controlText('workflow.featureSources') }}</summary>
      <p class="muted">
        {{ controlText('workflow.growthScope') }}
      </p>
      <article v-for="f in features" :key="f.page + '-' + f.name" class="growth-feature">
        <details>
          <summary>
            {{ f.level }} {{ controlText('field.level') }} {{ localizedEntryName(f) }}
            <a v-if="f.page" :href="source(f.page)" target="_blank" rel="noopener"
              >SRD p.{{ f.page }}</a
            ><span v-else-if="f.source">{{ sourceCaption(f.source) }}</span>
          </summary>
          <p>{{ f.description }}</p>
        </details>
      </article>
    </details>
    <details v-if="character.build.growth?.length">
      <summary>{{ controlText('quantity.useCount', {p0:(controlText('workflow.growthLog')),p1:(character.build.growth.length)}) }}</summary>
      <p v-for="g in character.build.growth" :key="g.level">
        {{ controlText('quantity.growthEntry', {p0:(g.level),p1:(g.hpMethod === 'roll' ? controlText('expressionTwo.roll') : controlText('expressionTwo.fixed')),p2:(g.hp),p3:(g.reason),p4:(uiDate(g.at,'datetime'))}) }}
      </p>
    </details>
  </section>
</template>
<style scoped>
.growth-panel label {
  display: block;
  margin: 1rem 0;
}
.growth-panel .check {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.growth-panel select,
.growth-panel input:not([type='checkbox']) {
  max-width: 100%;
  width: 100%;
}
.growth-abilities {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}
.growth-errors {
  color: var(--danger, #b04435);
}
.growth-feature {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line, #ddd);
}
.growth-feature p {
  white-space: pre-wrap;
  font-size: 0.9rem;
}
.growth-panel .runtime-actions {
  margin-top: 1rem;
}
.growth-panel h4 {
  margin: 1rem 0;
}
</style>
