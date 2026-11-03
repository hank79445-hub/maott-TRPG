<script setup lang="ts">
import {uiDate} from './locale-format'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {localizedEvent} from '../shared/localization/system-messages'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import { routineExploration } from '../core/narration-policy'
import { newBroadcastTemplate, renderBroadcast } from '../core/broadcast'
import { clone } from '../core/engine'
import type { Adventure, MapCommand, MapWorld } from '../core/map-types'
import FixedTextTools from './config-imports/FixedTextTools.vue'
import type { BroadcastEvent, BroadcastCategory } from '../core/broadcast-types'
const props = defineProps<{
  adventure?: Adventure
  characters: { id: string; name: string }[]
  events: BroadcastEvent[]
  branchId: string
  gm: boolean
  busy?: boolean
  gap?: boolean
  designOnly?: boolean
  world?: MapWorld
  submitCommand?: (c: MapCommand, id?: string) => Promise<boolean>
}>()
const emit = defineEmits<{ command: [command: MapCommand] }>()
const draft = ref(newBroadcastTemplate()),
  selected = ref(''),
  category = ref('all'),
  shown = ref(60),
  historical = ref(false),
  markTitle = ref('任务阶段'),
  markText = ref('')
const names: Record<BroadcastCategory, string> = {
  preset: '预设',
  trigger: '触发',
  resolution: '结算',
  interaction: '互动',
  combat: '战斗',
  progress: '进程',
}
const templates = computed(() => props.adventure?.broadcast?.templates ?? [])
const targetScene = computed(() =>
  props.adventure?.scenes.find((s) => s.id === draft.value.sceneId),
)
const targets = computed(() =>
  draft.value.trigger === 'point'
    ? (targetScene.value?.points ?? [])
    : draft.value.trigger === 'region'
      ? (targetScene.value?.regions ?? [])
      : draft.value.trigger === 'wall'
        ? (targetScene.value?.walls ?? []).filter((w) => w.kind === 'door')
        : [],
)
const preview = computed(() =>
  renderBroadcast(draft.value.text, {
    story: props.adventure?.name ?? null,
    scene: targetScene.value?.name ?? null,
    actor: null,
    object: targets.value.find((t) => t.id === draft.value.targetId)?.name ?? null,
  }),
)
const filtered = computed(() =>
  [...props.events]
    .reverse()
    .filter(
      (e) =>
        (historical.value || e.branchId === props.branchId) &&
        (category.value === 'all' || e.category === category.value),
    ),
)
watch([category, historical, () => props.branchId], () => {
  shown.value = 60
})
const invalid = computed(() => new Set(props.events.flatMap((e) => e.supersedes)))
watch(selected, (id) => {
  draft.value = clone(templates.value.find((t) => t.id === id) ?? newBroadcastTemplate())
})
watch(templates, () => {
  if (selected.value && !templates.value.some((t) => t.id === selected.value)) {
    selected.value = ''
    return
  }
  if (!selected.value && templates.value.some((t) => t.id === draft.value.id))
    selected.value = draft.value.id
})
function changeTrigger() {
  draft.value.targetId = null
  draft.value.sceneId = null
}
function removeTemplate() {
  emit('command', { type: 'broadcast-delete', templateId: selected.value })
  fresh()
}
function fresh() {
  selected.value = ''
  draft.value = newBroadcastTemplate()
}
function save() {
  emit('command', { type: 'broadcast-template', template: clone(draft.value) })
}
const canSave = computed(
  () =>
    draft.value.title.trim() &&
    draft.value.text.trim() &&
    (!['scene', 'point', 'region', 'wall'].includes(draft.value.trigger) || draft.value.sceneId) &&
    (!['point', 'region', 'wall'].includes(draft.value.trigger) || draft.value.targetId) &&
    (draft.value.audience.kind !== 'personal' || draft.value.audience.characterIds.length),
)
</script>
<template>
  <section class="broadcast-panel" :aria-label="controlText('game.events')">
    <div class="broadcast-heading">
      <div>
        <h2>{{ controlText('game.events') }}</h2>
        <p class="muted">{{ controlText('broadcast.help') }}</p>
      </div>
      <span class="map-badge">{{ controlText('quantity.visibleRecords', {p0:(events.length)}) }}</span>
    </div>
    <p v-if="gap" class="map-feedback" role="status">
      {{ controlText('broadcast.retentionGap') }}
    </p>
    <details v-if="gm && adventure" class="room-card broadcast-editor" open>
      <summary>{{ controlText('broadcast.gmEditor') }}</summary>
      <FixedTextTools
        v-if="world && submitCommand"
        :world="world"
        :adventure="adventure"
        :busy="busy"
        :submit-command="submitCommand"
      />
      <div class="room-row">
        <button
          v-if="!designOnly"
          class="secondary"
          :disabled="busy || adventure.broadcast?.storyStarted"
          @click="emit('command', { type: 'broadcast-start' })"
        >
          {{ adventure.broadcast?.storyStarted ? controlText('expressionOne.storyStarted') : controlText('expressionOne.startStoryAndPlayOpening') }}</button
        ><button class="subtle" :disabled="busy" @click="fresh">{{ controlText('broadcast.newBroadcast') }}</button>
      </div>
      <div class="broadcast-fields">
        <label
          >{{ controlText('broadcast.existingTemplate') }}<select v-model="selected">
            <option value="">{{ controlText('broadcast.newTemplate') }}</option>
            <option v-for="t in templates" :key="t.id" :value="t.id">
              {{ t.title }}{{ t.enabled ? '' : controlText('ai.disabledSuffix') }}
            </option>
          </select></label
        >
        <label>{{ controlText('broadcast.title') }}<input v-model="draft.title" maxlength="120" /></label>
        <label
          >{{ controlText('game.narrationMode') }}<select v-model="draft.narration" :aria-label="controlText('game.narrationMode')">
            <option value="direct">{{ controlText('broadcast.direct') }}</option>
            <option value="generate">{{ controlText('broadcast.generate') }}</option>
            <option value="context">{{ controlText('broadcast.backgroundOnly') }}</option>
          </select></label
        >
        <label
          >{{ controlText('broadcast.triggerSource') }}<select v-model="draft.trigger" @change="changeTrigger">
            <option value="manual">{{ controlText('broadcast.manualOnly') }}</option>
            <option value="story">{{ controlText('broadcast.storyStart') }}</option>
            <option value="scene">{{ controlText('broadcast.sceneEnter') }}</option>
            <option value="point">{{ controlText('broadcast.pointOperation') }}</option>
            <option value="region">{{ controlText('broadcast.regionEnter') }}</option>
            <option value="wall">{{ controlText('broadcast.doorToggle') }}</option>
            <option value="event">{{ controlText('broadcast.resolutionEvent') }}</option>
          </select></label
        >
        <label v-if="['scene', 'point', 'region', 'wall'].includes(draft.trigger)"
          >{{ controlText('broadcast.broadcastScene') }}<select v-model="draft.sceneId" @change="draft.targetId = null">
            <option :value="null">{{ controlText('game.scene') }}</option>
            <option v-for="s in adventure.scenes" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
          </select></label
        >
        <label v-if="['point', 'region', 'wall'].includes(draft.trigger)"
          >{{ controlText('broadcast.triggerTarget') }}<select v-model="draft.targetId">
            <option :value="null">{{ controlText('broadcast.chooseObject') }}</option>
            <option v-for="t in targets" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
          </select></label
        >
        <label v-if="draft.trigger === 'event'"
          >{{ controlText('broadcast.matchEvent') }}<select v-model="draft.eventType">
            <option value="point.check">{{ controlText('broadcast.pointCheck') }}</option>
            <option value="character.check">{{ controlText('broadcast.characterCheck') }}</option>
            <option value="combat.save">{{ controlText('broadcast.combatSave') }}</option>
            <option value="combat.concentration">{{ controlText('broadcast.concentrationSave') }}</option>
            <option value="combat.death-save">{{ controlText('controls.deathSave') }}</option>
            <option value="life.state">{{ controlText('broadcast.lifeChange') }}</option>
            <option value="concentration.end">{{ controlText('broadcast.concentrationEnd') }}</option>
            <option value="target.resolved">{{ controlText('broadcast.targetResolution') }}</option>
            <option value="token.moved">{{ controlText('broadcast.movement') }}</option>
            <option value="npc.influence">{{ controlText('broadcast.influenceCheck') }}</option>
            <option value="npc.behavior">{{ controlText('broadcast.npcAction') }}</option>
            <option value="action.resolved">{{ controlText('broadcast.actionResolution') }}</option>
            <option value="encounter.active">{{ controlText('broadcast.encounterStart') }}</option>
            <option value="encounter.ended">{{ controlText('broadcast.encounterEnd') }}</option>
            <option value="turn.change">{{ controlText('broadcast.turnChange') }}</option>
            <option value="rest.short">{{ controlText('controls.shortRest') }}</option>
            <option value="rest.long">{{ controlText('controls.longRest') }}</option>
            <option value="time.advance">{{ controlText('broadcast.advanceTime') }}</option>
            <option value="item.given">{{ controlText('broadcast.giveItem') }}</option>
            <option value="point.result">{{ controlText('broadcast.interactionComplete') }}</option>
            <option value="gm.mark">{{ controlText('broadcast.gmProgress') }}</option>
          </select></label
        >
        <label v-if="draft.trigger === 'event'"
          >{{ controlText('broadcast.matchResult') }}<select v-model="draft.result">
            <option value="any">{{ controlText('broadcast.anyConfirmed') }}</option>
            <option value="success">{{ controlText('broadcast.successHit') }}</option>
            <option value="failure">{{ controlText('broadcast.failureMiss') }}</option>
          </select></label
        >
        <label
          >{{ controlText('broadcast.playPolicy') }}<select v-model="draft.policy">
            <option value="manual">{{ controlText('broadcast.playManual') }}</option>
            <option value="once">{{ controlText('broadcast.once') }}</option>
            <option value="always">{{ controlText('broadcast.always') }}</option>
            <option value="cooldown">{{ controlText('broadcast.cooldown') }}</option>
          </select></label
        >
        <label v-if="draft.policy === 'cooldown'"
          >{{ controlText('broadcast.cooldownSeconds') }}<input
            v-model.number="draft.cooldownSeconds"
            type="number"
            min="0"
            max="86400"
        /></label>
        <label
          >{{ controlText('broadcast.audience') }}<select v-model="draft.audience.kind">
            <option value="public">{{ controlText('broadcast.roomPublic') }}</option>
            <option value="party">{{ controlText('broadcast.party') }}</option>
            <option value="personal">{{ controlText('broadcast.characterPlayers') }}</option>
            <option value="gm">{{ controlText('broadcast.gmOnly') }}</option>
          </select></label
        >
      </div>
      <fieldset v-if="draft.audience.kind === 'personal'">
        <legend>{{ controlText('game.recipients') }}</legend>
        <label v-for="c in characters" :key="c.id" class="check"
          ><input v-model="draft.audience.characterIds" type="checkbox" :value="c.id" />{{
            localizedEntryName(c)
          }}</label
        >
      </fieldset>
      <label
        >{{ controlText('broadcast.fixedText') }}<textarea
          v-model="draft.text"
          rows="4"
          maxlength="4000"
          :placeholder="controlText('broadcast.fixedPlaceholder')"
        />
      </label>
      <p class="muted">
        {{ controlText('broadcast.variables') }}<code v-pre
          >{{ story }}、{{ scene }}、{{ actor }}、{{ object }}、{{ total }}、{{ result }}</code
        >{{ controlText('broadcast.variablesHelp') }}
      </p>
      <div class="broadcast-preview">
        <strong>{{ controlText('broadcast.preview') }}</strong>
        <p>{{ preview.text || controlText('expressionOne.writeTextToPreview') }}</p>
        <small v-if="preview.missing.length"
          >{{ controlText('broadcast.missingVariables') }}{{
            preview.missing.join('、')
          }}{{ controlText('broadcast.missingVariablesHelp') }}</small
        >
      </div>
      <label class="check"><input v-model="draft.enabled" type="checkbox" />{{ controlText('game.templateEnabled') }}</label>
      <div class="room-row">
        <button class="primary" :disabled="busy || !canSave" @click="save">{{ controlText('broadcast.saveTemplate') }}</button
        ><template v-if="selected"
          ><button
            v-if="!designOnly"
            class="secondary"
            :disabled="busy"
            @click="
              emit('command', { type: 'broadcast-play', templateId: selected, replay: false })
            "
          >
            {{ controlText('broadcast.manualPlay') }}</button
          ><button
            v-if="!designOnly"
            class="secondary"
            :disabled="busy"
            @click="emit('command', { type: 'broadcast-play', templateId: selected, replay: true })"
          >
            {{ controlText('broadcast.explicitReplay') }}</button
          ><button
            v-if="!designOnly"
            class="subtle"
            :disabled="busy"
            @click="emit('command', { type: 'broadcast-reset', templateId: selected })"
          >
            {{ controlText('broadcast.resetTriggers') }}</button
          ><button class="subtle danger" :disabled="busy" @click="removeTemplate">
            {{ controlText('broadcast.deleteTemplate') }}
          </button></template
        >
      </div>
      <p v-if="selected && !designOnly" class="muted">{{ controlText('quantity.played', {p0:(adventure.broadcast?.played.find((p) => p.templateId === selected)?.count ?? 0),p1:(controlText('broadcast.editingDoesNotReset'))}) }}
      </p>
      <details v-if="!designOnly">
        <summary>{{ controlText('broadcast.gmProgressPanel') }}</summary>
        <label>{{ controlText('broadcast.progressTitle') }}<input v-model="markTitle" maxlength="120" /></label
        ><label>{{ controlText('game.publicFacts') }}<textarea v-model="markText" rows="3" maxlength="4000" /></label
        ><button
          class="secondary"
          :disabled="busy || !markTitle.trim() || !markText.trim()"
          @click="
            emit('command', {
              type: 'broadcast-mark',
              title: markTitle,
              text: markText,
              audience: { kind: 'public', characterIds: [] },
            })
          "
        >
          {{ controlText('broadcast.publishProgress') }}
        </button>
      </details>
    </details>
    <div v-if="!designOnly" class="room-row broadcast-filters">
      <label
        >{{ controlText('broadcast.category') }}<select v-model="category">
          <option value="all">{{ controlText('controls.all') }}</option>
          <option v-for="(name, key) in names" :key="key" :value="key">{{ uiLabel(name) }}</option>
        </select></label
      ><label class="check"><input v-model="historical" type="checkbox" />{{ controlText('broadcast.oldBranches') }}</label>
    </div>
    <p v-if="!designOnly && !filtered.length" class="muted">
      {{ controlText('broadcast.empty') }}
    </p>
    <ol class="broadcast-list">
      <li
        v-for="e in filtered.slice(0, shown)"
        :key="e.id"
        :class="{ superseded: invalid.has(e.id) }"
      >
        <div class="broadcast-meta">
          <span>{{ uiLabel(names[e.category]) }} · {{localizedEvent(e,controlI18n.global.locale.value).title}}</span
          ><time>{{ uiDate(e.at,'datetime') }}</time
          ><small v-if="e.phase === 'pending'">{{ controlText('broadcast.pending') }}</small
          ><small v-if="e.phase === 'correction'">{{ controlText('broadcast.correction') }}</small
          ><small v-if="e.audience.kind !== 'public'">{{
            e.audience.kind === 'gm' ? controlText('expressionOne.gmPrivate') : e.audience.kind === 'party' ? controlText('controls.party') : controlText('knowledge.individual')
          }}</small
          ><small v-if="invalid.has(e.id)">{{ controlText('broadcast.superseded') }}</small>
        </div>
        <p>{{localizedEvent(e,controlI18n.global.locale.value).text}}</p>
        <small v-if="gm && routineExploration(e)" class="muted"
          >{{ controlText('broadcast.quietExploration') }}</small
        >
        <details v-if="gm">
          <summary>{{ controlText('broadcast.factsSources') }}</summary>
          <p>{{ controlText('quantity.eventSequence', {p0:(controlText('game.event')),p1:(e.id),p2:(e.sequence),p3:(e.worldRevision)}) }}</p>
          <pre>{{ JSON.stringify(e.facts, null, 2) }}</pre>
        </details>
      </li>
    </ol>
    <button v-if="filtered.length > shown" class="secondary" @click="shown += 60">{{ controlText('quantity.earlier', {p0:(filtered.length - shown)}) }}</button>
  </section>
</template>
