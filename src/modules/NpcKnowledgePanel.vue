<script setup lang="ts">
import { vNpcAutoHeight } from './npc-auto-height'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import type { RoomCommand, RoomView } from '../online/protocol'
import type {
  KnowledgeConfig,
  KnowledgeDesign,
  KnowledgeProfile,
} from '../persistence/npc-knowledge-schema'
import { defaultKnowledgeProfile, defaultMemoryConfig } from '../core/npc-relationships'

const props = defineProps<{ view: RoomView; busy: boolean; quickReview?: boolean }>()
const emit = defineEmits<{ command: [RoomCommand] }>()
const ai = computed(() => props.view.world?.adventures[0]?.ai)
const design = computed<KnowledgeDesign>(
  () => ai.value?.knowledgeDesign ?? { factions: [], templates: [] },
)
const config = computed<KnowledgeConfig>(() => ai.value?.memoryConfig ?? defaultMemoryConfig())
const state = computed(() => ai.value?.knowledgeState)
const npcs = computed(() => ai.value?.npcs ?? [])
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const configDraft = ref<KnowledgeConfig>(copy(config.value))
const designDraft = ref<KnowledgeDesign>(copy(design.value))
const configBase = ref(JSON.stringify(config.value)),
  designBase = ref(JSON.stringify(design.value)),
  profileBase = ref('')
const configConfirm = ref(false),
  designConfirm = ref(false),
  profileConfirm = ref(false)
const npcId = ref(''),
  characterId = ref(''),
  profileDraft = ref<KnowledgeProfile>(defaultKnowledgeProfile())
const npc = computed(() => npcs.value.find((n) => n.id === npcId.value))
const profile = computed<KnowledgeProfile>(
  () => npc.value?.knowledgeProfile ?? defaultKnowledgeProfile(),
)
const report = computed(() => props.view.ai.knowledgeReport)
const reportVisible = ref(false)
let requestedReport = ''
const profileChanged = computed(
  () => JSON.stringify(profile.value) !== JSON.stringify(profileDraft.value),
)
const configChanged = computed(
  () => JSON.stringify(config.value) !== JSON.stringify(configDraft.value),
)
const designChanged = computed(
  () => JSON.stringify(design.value) !== JSON.stringify(designDraft.value),
)
const configConflict = computed(
  () => JSON.stringify(config.value) !== configBase.value && configChanged.value,
)
const designConflict = computed(
  () => JSON.stringify(design.value) !== designBase.value && designChanged.value,
)
const profileConflict = computed(
  () => JSON.stringify(profile.value) !== profileBase.value && profileChanged.value,
)
const pending = computed(() =>
  (state.value?.requests ?? []).filter((r) => r.status === 'pending' || r.status === 'attribution'),
)
const reviewDrafts = ref<
  Record<string, { contribution: number; attributed: boolean; reason: string }>
>({})
let reviewRevisions: Record<string, number> = {}
const recordKinds: Record<string, string> = {
  fact: '事实',
  statement: '陈述',
  opinion: '印象',
  knowledge: '知识',
}
const recordVisibility: Record<string, string> = {
  public: '公开',
  personal: '个人',
  private: '私有',
}
const recordSources: Record<string, string> = {
  event: '事件',
  dialogue: '对话',
  relationship: '关系',
  manual: '手动',
}
const recordBasis: Record<string, string> = {
  witness: '亲历',
  told: '听闻',
  published: '已发布',
  gm: 'GM 指定',
}
const attitudes: Record<string, string> = { friendly: '友好', indifferent: '冷漠', hostile: '敌对' }
const selectedRecords = ref<string[]>([]),
  forgetReason = ref(''),
  page = ref(0)
const proposal = ref({
  factionId: '',
  eventGroupId: '',
  sourceId: '',
  contribution: 0,
  attributed: false,
  reason: '',
})
const events = computed(() =>
  (props.view.world?.adventures[0]?.broadcastLog?.events ?? [])
    .filter(
      (e) =>
        e.phase === 'confirmed' &&
        e.audience.kind === 'public' &&
        e.branchId === props.view.broadcast.branchId &&
        !e.type.startsWith('ai.') &&
        !e.type.endsWith('.audit'),
    )
    .slice(-100)
    .reverse(),
)
function loadConfig() {
  configDraft.value = copy(config.value)
  configBase.value = JSON.stringify(config.value)
  configConfirm.value = false
}
function loadDesign() {
  designDraft.value = copy(design.value)
  designBase.value = JSON.stringify(design.value)
  designConfirm.value = false
}
function loadProfile() {
  profileDraft.value = copy(profile.value)
  profileBase.value = JSON.stringify(profile.value)
  profileConfirm.value = false
}
watch(configChanged, (changed) => {
  if (!changed) configBase.value = JSON.stringify(config.value)
})
watch(designChanged, (changed) => {
  if (!changed) designBase.value = JSON.stringify(design.value)
})
watch(profileChanged, (changed) => {
  if (!changed) profileBase.value = JSON.stringify(profile.value)
})
watch(
  () => npcId.value,
  () => {
    loadProfile()
    page.value = 0
    selectedRecords.value = []
  },
)
watch(
  () => npcs.value.map((n) => n.id).join('|'),
  () => {
    if (!npcs.value.some((n) => n.id === npcId.value)) npcId.value = npcs.value[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => pending.value.map((r) => `${r.id}:${r.revision}`).join('|'),
  () => {
    const next: typeof reviewDrafts.value = {}
    for (const r of pending.value)
      next[r.id] =
        reviewRevisions[r.id] === r.revision && reviewDrafts.value[r.id]
          ? reviewDrafts.value[r.id]
          : { contribution: r.suggested, attributed: r.attributed, reason: r.reason }
    reviewRevisions = Object.fromEntries(pending.value.map((r) => [r.id, r.revision]))
    reviewDrafts.value = next
  },
  { immediate: true },
)
watch(
  () => [npcId.value, characterId.value, page.value],
  () => {
    selectedRecords.value = []
  },
)
watch([npcId, characterId, page], () => {
  reportVisible.value = false
})
watch(report, (value) => {
  reportVisible.value =
    !!value &&
    requestedReport === `${npcId.value}:${characterId.value}:${page.value}` &&
    value.npcId === npcId.value &&
    value.characterId === (characterId.value || null) &&
    value.page === page.value
})
watch(
  configDraft,
  () => {
    configConfirm.value = false
  },
  { deep: true, flush: 'sync' },
)
watch(
  designDraft,
  () => {
    designConfirm.value = false
  },
  { deep: true, flush: 'sync' },
)
watch(
  profileDraft,
  () => {
    profileConfirm.value = false
  },
  { deep: true, flush: 'sync' },
)
function inspect() {
  if (!npcId.value) return
  reportVisible.value = false
  requestedReport = `${npcId.value}:${characterId.value}:${page.value}`
  emit('command', {
    kind: 'npc-knowledge',
    operation: {
      type: 'inspect',
      npcId: npcId.value,
      characterId: characterId.value || null,
      page: page.value,
    },
  })
}
function addFaction() {
  designDraft.value.factions.push({
    id: crypto.randomUUID(),
    name: '',
    description: '',
    hidden: false,
    initialScore: 0,
  })
  designConfirm.value = false
}
function addTemplate() {
  designDraft.value.templates.push({
    id: crypto.randomUUID(),
    name: '',
    version: 1,
    layer: 'world',
    visibility: 'public',
    text: '',
  })
  designConfirm.value = false
}
function addPolicy(factionId: string) {
  const faction = designDraft.value.factions.find((f) => f.id === factionId),
    scene = props.view.world?.adventures[0]?.scenes.find((s) => s.points.length)
  if (!faction || !scene) return
  ;(faction.policies ??= []).push({
    id: crypto.randomUUID(),
    sceneId: scene.id,
    pointId: scene.points[0]!.id,
    outcome: 'success',
    contribution: 0,
    automatic: false,
    reason: 'GM核对已确认互动结果',
  })
  designConfirm.value = false
}
function review(id: string, approve: boolean) {
  const request = pending.value.find((r) => r.id === id),
    draft = reviewDrafts.value[id]
  if (!request || !draft?.reason.trim()) return
  emit('command', {
    kind: 'npc-knowledge',
    operation: {
      type: 'reputation',
      requestId: id,
      approve,
      attributed: draft.attributed,
      contribution: draft.contribution,
      reason: draft.reason.trim(),
      revision: request.revision,
    },
  })
}
function saveConfig() {
  emit('command', {
    kind: 'npc-knowledge',
    operation: { type: 'configure', config: copy(configDraft.value), confirm: true },
  })
  configConfirm.value = false
}
function saveDesign() {
  emit('command', {
    kind: 'npc-knowledge',
    operation: { type: 'design', design: copy(designDraft.value), confirm: true },
  })
  designConfirm.value = false
}
function saveProfile() {
  emit('command', {
    kind: 'npc-knowledge',
    operation: {
      type: 'profile',
      npcId: npcId.value,
      profile: copy(profileDraft.value),
      confirm: true,
    },
  })
  profileConfirm.value = false
}
function removeFaction(index: number) {
  designDraft.value.factions.splice(index, 1)
  designConfirm.value = false
}
function removeTemplate(index: number) {
  designDraft.value.templates.splice(index, 1)
  designConfirm.value = false
}
function changePage(delta: number) {
  page.value += delta
  inspect()
}
function forgetRecords() {
  emit('command', {
    kind: 'npc-knowledge',
    operation: {
      type: 'forget',
      npcId: npcId.value,
      ids: [...selectedRecords.value],
      reason: forgetReason.value.trim(),
    },
  })
  selectedRecords.value = []
  reportVisible.value = false
}
</script>
<template>
  <details
    v-npc-auto-height
    v-if="view.self.role === 'gm'"
    class="room-card knowledge-panel"
    :open="quickReview || undefined"
  >
    <summary>
      {{ quickReview ? controlText('review.factionPending') : controlText('expressionTwo.gmWorldKnowledgeFactionsAndLongTermMemory') }}
      <span v-if="pending.length">{{ controlText('quantity.pending', {p0:(pending.length)}) }}</span>
    </summary>
    <p v-if="!quickReview" class="muted">
      {{ controlText('knowledge.gmOnlyHelp') }}
    </p>

    <details v-if="!quickReview">
      <summary>{{ controlText('knowledge.memoryStatus') }}</summary>
      <p class="muted">
        {{ controlText('inventory.current') }}{{ state?.status || controlText('expressionTwo.longTermMemoryIsNotEnabled') }}{{ controlText('knowledge.modelRefHelp') }}
      </p>
      <p v-if="configDraft.provider === 'mem0'" class="muted">
        {{ controlText('knowledge.mem0Setup') }}
      </p>
      <button
        v-if="config.provider === 'mem0'"
        :disabled="busy || configChanged || state?.probeRequested"
        @click="emit('command', { kind: 'npc-knowledge', operation: { type: 'probe' } })"
      >
        {{ controlText('knowledge.verifyEmbedding') }}
      </button>
      <div class="knowledge-grid">
        <label class="check"
          ><input
            v-model="configDraft.enabled"
            type="checkbox"
            @change="configConfirm = false"
          />{{ controlText('knowledge.enableLongTerm') }}</label
        >
        <label
          >{{ controlText('knowledge.retrievalBackend') }}<select v-model="configDraft.provider" @change="configConfirm = false">
            <option value="native">{{ controlText('knowledge.localSearch') }}</option>
            <option value="mem0">Mem0</option>
          </select></label
        >
        <label
          >{{ controlText('knowledge.embeddingModel') }}<select
            v-model="configDraft.embeddingModelRef"
            @change="configConfirm = false"
          >
            <option value="">{{ controlText('domain.unspecified') }}</option>
            <option
              v-if="
                configDraft.embeddingModelRef &&
                !view.ai.modelProfiles?.some((p) => p.name === configDraft.embeddingModelRef)
              "
              :value="configDraft.embeddingModelRef"
            >
              {{ configDraft.embeddingModelRef }}{{ controlText('game.unmapped') }}
            </option>
            <option v-for="p in view.ai.modelProfiles ?? []" :key="p.name" :value="p.name">
              {{ localizedEntryName(p) }} · {{ p.model }}
            </option>
          </select></label
        >
        <label
          >{{ controlText('knowledge.extractionModel') }}<select
            v-model="configDraft.extractorModelRef"
            @change="configConfirm = false"
          >
            <option value="">{{ controlText('domain.unspecified') }}</option>
            <option
              v-if="
                configDraft.extractorModelRef &&
                !view.ai.modelProfiles?.some((p) => p.name === configDraft.extractorModelRef)
              "
              :value="configDraft.extractorModelRef"
            >
              {{ configDraft.extractorModelRef }}{{ controlText('game.unmapped') }}
            </option>
            <option v-for="p in view.ai.modelProfiles ?? []" :key="p.name" :value="p.name">
              {{ localizedEntryName(p) }} · {{ p.model }}
            </option>
          </select></label
        >
        <label
          >{{ controlText('knowledge.embeddingDimensions') }}<input
            v-model.number="configDraft.dimension"
            type="number"
            min="1"
            max="8192"
            @input="configConfirm = false"
        /></label>
      </div>
      <details v-if="configChanged">
        <summary>{{ controlText('knowledge.configDiff') }}</summary>
        <p>{{ controlText('controls.current') }}</p>
        <pre>{{ JSON.stringify(config, null, 2) }}</pre>
        <p>{{ controlText('game.after') }}</p>
        <pre>{{ JSON.stringify(configDraft, null, 2) }}</pre>
      </details>
      <p v-if="configConflict" role="status">{{ controlText('knowledge.configChanged') }}</p>
      <label v-if="configChanged" class="check"
        ><input v-model="configConfirm" type="checkbox" />{{ controlText('knowledge.confirmConfigDiff') }}</label
      >
      <div class="room-row">
        <button
          :disabled="
            busy ||
            configConflict ||
            !configChanged ||
            !configConfirm ||
            !Number.isInteger(configDraft.dimension) ||
            configDraft.dimension < 1 ||
            configDraft.dimension > 8192
          "
          @click="saveConfig"
        >
          {{ controlText('knowledge.saveMemoryConfig') }}</button
        ><button type="button" @click="loadConfig">{{ controlText('game.restoreDraft') }}</button
        ><button
          type="button"
          :disabled="busy"
          @click="emit('command', { kind: 'npc-knowledge', operation: { type: 'reindex' } })"
        >
          {{ controlText('knowledge.rebuildIndex') }}
        </button>
      </div>
    </details>

    <details v-if="!quickReview">
      <summary>{{ controlText('knowledge.factionTemplates') }}</summary>
      <p class="muted">{{ controlText('knowledge.designHelp') }}</p>
      <details v-for="(f, index) in designDraft.factions" :key="f.id" class="knowledge-item">
        <summary>{{ localizedEntryName(f) || controlText('expressionTwo.newFaction') }} · {{ f.hidden ? controlText('controls.hidden') : controlText('controls.public') }}</summary>
        <div class="knowledge-grid">
          <label>{{ controlText('controls.name') }}<input v-model="f.name" maxlength="120" /></label
          ><label
            >{{ controlText('knowledge.initialReputation') }}<input
              v-model.number="f.initialScore"
              type="number"
              min="-100"
              max="100" /></label
          ><label class="check"><input v-model="f.hidden" type="checkbox" />{{ controlText('knowledge.hiddenFaction') }}</label>
        </div>
        <details><summary>{{ controlText('knowledge.practicalAttribution') }}</summary><button type="button" @click="f.practical??={enabled:false,allowAttackAdjudication:false,min:-10,max:10}">{{ controlText('knowledge.boundedAttribution') }}</button><template v-if="f.practical"><label><input v-model="f.practical.enabled" type="checkbox">{{ controlText('knowledge.enableAttribution') }}</label><label><input v-model="f.practical.allowAttackAdjudication" type="checkbox">{{ controlText('knowledge.aiResponsibility') }}</label><label>{{ controlText('knowledge.minimumContribution') }}<input v-model.number="f.practical.min" type="number" min="-100" max="0"></label><label>{{ controlText('knowledge.maximumContribution') }}<input v-model.number="f.practical.max" type="number" min="0" max="100"></label><p class="muted">{{ controlText('knowledge.attributionHelp') }}</p></template></details>
        <label>{{ controlText('controls.description') }}<textarea v-model="f.description" maxlength="4000" rows="2" /></label
        ><button type="button" @click="removeFaction(index)">{{ controlText('knowledge.removeFaction') }}</button>
      </details>
      <button type="button" @click="addFaction">{{ controlText('knowledge.addFaction') }}</button>
      <details v-for="f in designDraft.factions" :key="'policies:' + f.id" class="knowledge-item">
        <summary>{{ localizedEntryName(f) || controlText('expressionTwo.newFaction') }} {{ controlText('knowledge.onceReputation') }}</summary>
        <p class="muted">
          {{ controlText('knowledge.oncePolicyHelp') }}
        </p>
        <div v-for="(p, index) in f.policies" :key="p.id" class="knowledge-item">
          <div class="knowledge-grid">
            <label
              >{{ controlText('controls.scene') }}<select v-model="p.sceneId" @change="p.pointId = ''">
                <option v-for="s in view.world?.adventures[0]?.scenes" :key="s.id" :value="s.id">
                  {{ localizedEntryName(s) }}
                </option>
              </select></label
            ><label
              >{{ controlText('game.point') }}<select v-model="p.pointId">
                <option value="">{{ controlText('game.choose') }}</option>
                <option
                  v-for="point in view.world?.adventures[0]?.scenes.find((s) => s.id === p.sceneId)
                    ?.points"
                  :key="point.id"
                  :value="point.id"
                >
                  {{ localizedEntryName(point) }}
                </option>
              </select></label
            ><label
              >{{ controlText('knowledge.confirmedResult') }}<select v-model="p.outcome">
                <option value="success">{{ controlText('controls.success') }}</option>
                <option value="failure">{{ controlText('controls.failed') }}</option>
              </select></label
            ><label
              >{{ controlText('knowledge.netContribution') }}<input
                v-model.number="p.contribution"
                type="number"
                min="-100"
                max="100" /></label
            ><label class="check"
              ><input v-model="p.automatic" type="checkbox" />{{ controlText('knowledge.autoAuthorize') }}</label
            >
            <label>{{ controlText('domain.eventOwner') }}<select v-model="p.attribution"><option :value="undefined">{{ controlText('game.party') }}</option><option value="party">{{ controlText('game.party') }}</option><option value="world">{{ controlText('knowledge.worldEvent') }}</option><option value="proxy">{{ controlText('domain.npcAgent') }}</option></select></label>
            <label v-if="p.attribution==='proxy'">{{ controlText('domain.agentNpc') }}<select v-model="p.proxyNpcIds" multiple><option v-for="n in view.world?.adventures[0]?.ai?.npcs??[]" :key="n.id" :value="n.id">{{localizedEntryName(n)}}</option></select></label>
          </div>
          <label>{{ controlText('domain.sourceLabel') }}<textarea v-model="p.reason" rows="2" maxlength="4000" /></label
          ><button @click="f.policies?.splice(index, 1)">{{ controlText('knowledge.removePolicy') }}</button>
        </div>
        <button
          :disabled="!view.world?.adventures[0]?.scenes.some((s) => s.points.length)"
          @click="addPolicy(f.id)"
        >
          {{ controlText('knowledge.addReputationPolicy') }}
        </button>
      </details>
      <details v-for="(t, index) in designDraft.templates" :key="t.id" class="knowledge-item">
        <summary>
          {{ localizedEntryName(t) || controlText('expressionTwo.newKnowledgeTemplate') }} · v{{ t.version }} ·
          {{ t.visibility === 'private' ? controlText('knowledge.private') : controlText('controls.public') }}
        </summary>
        <div class="knowledge-grid">
          <label>{{ controlText('controls.name') }}<input v-model="t.name" maxlength="120" /></label
          ><label>{{ controlText('knowledge.version') }}<input v-model.number="t.version" type="number" min="1" /></label
          ><label
            >{{ controlText('knowledge.layer') }}<select v-model="t.layer">
              <option value="world">{{ controlText('domain.world') }}</option>
              <option value="region">{{ controlText('knowledge.region') }}</option>
              <option value="culture">{{ controlText('knowledge.culture') }}</option>
              <option value="upbringing">{{ controlText('knowledge.upbringing') }}</option>
              <option value="profession">{{ controlText('controls.class') }}</option>
              <option value="organization">{{ controlText('domain.faction') }}</option>
              <option value="script">{{ controlText('knowledge.script') }}</option>
              <option value="gm">{{ controlText('domain.gm') }}</option>
            </select></label
          ><label
            >{{ controlText('game.sight') }}<select v-model="t.visibility">
              <option value="public">{{ controlText('controls.public') }}</option>
              <option value="private">{{ controlText('knowledge.private') }}</option>
            </select></label
          >
        </div>
        <label>{{ controlText('knowledge.knowledgeText') }}<textarea v-model="t.text" maxlength="4000" rows="3" /></label
        ><button type="button" @click="removeTemplate(index)">{{ controlText('knowledge.removeTemplate') }}</button>
      </details>
      <button type="button" @click="addTemplate">{{ controlText('knowledge.addTemplate') }}</button>
      <details v-if="designChanged">
        <summary>{{ controlText('liveSummary.designDifferencesCurrentFactionsTemplatesUpdated', {p0:(design.factions.length),p1:(design.templates.length),p2:(designDraft.factions.length),p3:(designDraft.templates.length)}) }}
        </summary>
        <p>{{ controlText('controls.current') }}</p>
        <pre>{{ JSON.stringify(design, null, 2) }}</pre>
        <p>{{ controlText('game.after') }}</p>
        <pre>{{ JSON.stringify(designDraft, null, 2) }}</pre>
      </details>
      <p v-if="designConflict" role="status">{{ controlText('knowledge.designChanged') }}</p>
      <label v-if="designChanged" class="check"
        ><input v-model="designConfirm" type="checkbox" />{{ controlText('knowledge.confirmDesign') }}</label
      >
      <div class="room-row">
        <button
          :disabled="
            busy ||
            designConflict ||
            !designChanged ||
            !designConfirm ||
            designDraft.factions.some((f) => !f.name.trim()) ||
            designDraft.templates.some((t) => !t.name.trim() || !t.text.trim())
          "
          @click="saveDesign"
        >
          {{ controlText('knowledge.saveDesign') }}</button
        ><button type="button" @click="loadDesign">{{ controlText('game.restoreDraft') }}</button>
      </div>
    </details>

    <details :open="quickReview || undefined">
      <summary>
        {{ controlText('knowledge.reputationRequests') }} <span v-if="pending.length">{{ controlText('quantity.pending', {p0:(pending.length)}) }}</span>
      </summary>
      <p v-if="!design.factions.length" class="muted">{{ controlText('knowledge.noFactions') }}</p>
      <template v-if="!quickReview"
        ><p v-for="f in design.factions" :key="f.id">
          {{ controlText('liveSummary.partyReputation', {p0:(localizedEntryName(f)),p1:(f.hidden ? controlText('expressionTwo.hidden') : ''),p2:(state?.reputations[f.id] ?? f.initialScore)}) }}
        </p></template
      >
      <article v-for="r in pending" :key="r.id" class="knowledge-item">
        <strong
          >{{ localizedEntryName(design.factions.find((f) => f.id === r.factionId)) ?? r.factionId }} ·
          {{ r.status === 'attribution' ? controlText('expressionTwo.attributionPending') : controlText('domain.pending') }}</strong
        >
        <p>
          {{ controlText('liveSummary.suggestedAppliedSource', {p0:(controlText('knowledge.eventGroup')),p1:(r.eventGroupId),p2:(r.suggested),p3:(r.applied),p4:(r.sourceIds.join('、'))}) }}
        </p>
        <template v-if="reviewDrafts[r.id]"
          ><div class="knowledge-grid">
            <label
              >{{ controlText('knowledge.confirmedContribution') }}<input
                v-model.number="reviewDrafts[r.id].contribution"
                type="number"
                min="-100"
                max="100" /></label
            ><label class="check"
              ><input
                v-model="reviewDrafts[r.id].attributed"
                type="checkbox"
              />{{ controlText('knowledge.confirmResponsibility') }}</label
            >
          </div>
          <label
            >{{ controlText('knowledge.reason') }}<textarea v-model="reviewDrafts[r.id].reason" maxlength="4000" rows="2" />
          </label>
          <div class="room-row">
            <button
              :disabled="
                busy || !reviewDrafts[r.id].attributed || !reviewDrafts[r.id].reason.trim()
              "
              @click="review(r.id, true)"
            >
              {{ controlText('knowledge.confirmImpact') }}</button
            ><button
              :disabled="busy || !reviewDrafts[r.id].reason.trim()"
              @click="review(r.id, false)"
            >
              {{ controlText('knowledge.rejectImpact') }}
            </button>
          </div></template
        >
      </article>
      <p v-if="!pending.length" class="muted">{{ controlText('knowledge.noRequests') }}</p>
      <details v-if="!quickReview">
        <summary>{{ controlText('knowledge.newImpact') }}</summary>
        <div class="knowledge-grid">
          <label
            >{{ controlText('game.side') }}<select v-model="proposal.factionId">
              <option value="">{{ controlText('game.choose') }}</option>
              <option v-for="f in design.factions" :key="f.id" :value="f.id">{{ localizedEntryName(f) }}</option>
            </select></label
          ><label
            >{{ controlText('knowledge.confirmedSource') }}<select v-model="proposal.sourceId">
              <option value="">{{ controlText('game.choose') }}</option>
              <option v-for="e in events" :key="e.id" :value="e.id">
                {{ e.title }} · {{ e.text.slice(0, 60) }}
              </option>
            </select></label
          ><label>{{ controlText('knowledge.eventGroupId') }}<input v-model="proposal.eventGroupId" maxlength="160" /></label
          ><label
            >{{ controlText('knowledge.suggestedContribution') }}<input
              v-model.number="proposal.contribution"
              type="number"
              min="-100"
              max="100" /></label
          ><label class="check"
            ><input v-model="proposal.attributed" type="checkbox" />{{ controlText('knowledge.partyResponsible') }}</label
          >
        </div>
        <label>{{ controlText('knowledge.requestReason') }}<textarea v-model="proposal.reason" maxlength="4000" rows="2" /></label
        ><button
          :disabled="
            busy ||
            !proposal.factionId ||
            !proposal.sourceId ||
            !proposal.eventGroupId.trim() ||
            !proposal.reason.trim()
          "
          @click="
            emit('command', {
              kind: 'npc-knowledge',
              operation: {
                type: 'propose',
                factionId: proposal.factionId,
                eventGroupId: proposal.eventGroupId.trim(),
                sourceIds: [proposal.sourceId],
                contribution: proposal.contribution,
                attributed: proposal.attributed,
                reason: proposal.reason.trim(),
              },
            })
          "
        >
          {{ controlText('knowledge.submitImpact') }}
        </button>
      </details>
    </details>

    <details v-if="!quickReview">
      <summary>{{ controlText('knowledge.diagnostics') }}</summary>
      <div class="knowledge-grid">
        <label
          >NPC<select v-model="npcId">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="n in npcs" :key="n.id" :value="n.id">{{ localizedEntryName(n) }}</option>
          </select></label
        ><label
          >{{ controlText('domain.relationshipTarget') }}<select v-model="characterId">
            <option value="">{{ controlText('knowledge.noSelection') }}</option>
            <option v-for="c in view.characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
          </select></label
        >
      </div>
      <template v-if="npc"
        ><details>
          <summary>{{ controlText('knowledge.editAffiliation') }}</summary>
          <div class="knowledge-grid">
            <label class="check"
              ><input v-model="profileDraft.enabled" type="checkbox" />{{ controlText('knowledge.enableRelationship') }}</label
            ><label
              >{{ controlText('knowledge.primaryFaction') }}<select v-model="profileDraft.factionId">
                <option :value="null">{{ controlText('controls.none') }}</option>
                <option v-for="f in design.factions" :key="f.id" :value="f.id">
                  {{ localizedEntryName(f) }}{{ f.hidden ? controlText('expressionTwo.hidden') : '' }}
                </option>
              </select></label
            ><label
              >{{ controlText('knowledge.membership') }}<select v-model="profileDraft.membership">
                <option value="direct">{{ controlText('knowledge.directMember') }}</option>
                <option value="associated">{{ controlText('knowledge.associatedMember') }}</option>
              </select></label
            ><label class="check"
              ><input v-model="profileDraft.hiddenMembership" type="checkbox" />{{ controlText('knowledge.hiddenMembership') }}</label
            ><label
              >{{ controlText('knowledge.backgroundBias') }}<input
                v-model.number="profileDraft.backgroundBias"
                type="number"
                min="-100"
                max="100" /></label
            ><label
              >{{ controlText('knowledge.lockedAttitude') }}<select v-model="profileDraft.lockedAttitude">
                <option :value="null">{{ controlText('controls.none') }}</option>
                <option value="friendly">{{ controlText('knowledge.friendly') }}</option>
                <option value="indifferent">{{ controlText('knowledge.indifferent') }}</option>
                <option value="hostile">{{ controlText('game.hostile') }}</option>
              </select></label
            >
          </div>
          <label
            >{{ controlText('knowledge.lockReason') }}<textarea v-model="profileDraft.lockReason" maxlength="4000" rows="2" />
          </label>
          <fieldset>
            <legend>{{ controlText('knowledge.knowledgeTemplates') }}</legend>
            <label v-for="t in design.templates" :key="t.id" class="check"
              ><input v-model="profileDraft.templateIds" type="checkbox" :value="t.id" />{{
                localizedEntryName(t)
              }}
              · {{ t.visibility === 'private' ? controlText('knowledge.private') : controlText('controls.public') }}</label
            >
          </fieldset>
          <details v-if="profileChanged">
            <summary>{{ controlText('knowledge.affiliationDiff') }}</summary>
            <p>{{ controlText('controls.current') }}</p>
            <pre>{{ JSON.stringify(profile, null, 2) }}</pre>
            <p>{{ controlText('game.after') }}</p>
            <pre>{{ JSON.stringify(profileDraft, null, 2) }}</pre>
          </details>
          <p v-if="profileConflict" role="status">{{ controlText('knowledge.npcChanged') }}</p>
          <label v-if="profileChanged" class="check"
            ><input v-model="profileConfirm" type="checkbox" />{{ controlText('knowledge.confirmAffiliation') }}</label
          >
          <div class="room-row">
            <button
              :disabled="
                busy ||
                profileConflict ||
                !profileChanged ||
                !profileConfirm ||
                (!!profileDraft.lockedAttitude && !profileDraft.lockReason.trim())
              "
              @click="saveProfile"
            >
              {{ controlText('domain.saveNpc') }}</button
            ><button type="button" @click="loadProfile">{{ controlText('game.restoreDraft') }}</button>
          </div>
        </details>
        <div class="room-row">
          <button :disabled="busy" @click="inspect">{{ controlText('knowledge.readRelationships') }}</button>
        </div>
        <template v-if="reportVisible && report"
          ><p role="status">{{ controlText('liveSummary.totalEntries', {p0:(report.status),p1:(report.total)}) }}</p>
          <div v-if="report.relationship" class="knowledge-item">
            <strong
              >{{ controlText('liveSummary.relationshipBreakdown', {p0:(report.relationship.band),p1:(report.relationship.total)}) }}</strong
            >
            <p>
              {{ controlText('liveSummary.factionBackgroundRulesAttitude', {p0:(controlText('knowledge.individual')),p1:(report.relationship.personal),p2:(report.relationship.reputation),p3:(report.relationship.background),p4:(uiLabel(attitudes[report.relationship.attitude])),p5:(report.relationship.locked ? controlText('expressionTwo.storyLocked') : '')}) }}
            </p>
          </div>
          <article v-for="record in report.records" :key="record.id" class="knowledge-item">
            <label class="check"
              ><input v-model="selectedRecords" type="checkbox" :value="record.id" />{{
                uiLabel(recordKinds[record.kind])
              }}
              · {{ uiLabel(recordVisibility[record.visibility]) }} · {{ record.at }}</label
            >
            <p class="prose">{{ record.text }}</p>
            <p v-if="record.reply" class="prose">{{ record.reply }}</p>
            <p class="muted">
              {{ controlText('liveSummary.knowledgeBasis', {p0:(controlText('controls.source')),p1:(record.sourceId),p2:(uiLabel(recordSources[record.sourceKind])),p3:(uiLabel(recordBasis[record.basis]))}) }}
            </p>
          </article>
          <p v-if="!report.records.length" class="muted">{{ controlText('knowledge.noRecords') }}</p>
          <div class="room-row">
            <button :disabled="busy || page === 0" @click="changePage(-1)">{{ controlText('knowledge.previousPage') }}</button
            ><span>{{ controlText('liveSummary.page', {p0:(page + 1)}) }}</span
            ><button
              :disabled="busy || !report.records.length || report.total <= (page + 1) * 20"
              @click="changePage(1)"
            >
              {{ controlText('knowledge.nextPage') }}
            </button>
          </div>
          <label v-if="selectedRecords.length"
            >{{ controlText('knowledge.removeReason') }}<textarea v-model="forgetReason" maxlength="4000" rows="2" /></label
          ><button
            v-if="selectedRecords.length"
            :disabled="busy || !forgetReason.trim()"
            @click="forgetRecords"
          >
            {{ controlText('knowledge.removeMemories') }}
          </button></template
        >
      </template>
    </details>
  </details>
</template>
<style scoped>
.knowledge-panel > details {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.knowledge-panel summary {
  cursor: pointer;
  overflow-wrap: anywhere;
}
.knowledge-panel label {
  display: grid;
  gap: 6px;
  margin: 10px 0;
  min-width: 0;
}
.knowledge-panel input,
.knowledge-panel select,
.knowledge-panel textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.knowledge-panel .check {
  display: flex;
  align-items: center;
  gap: 8px;
}
.knowledge-panel .check input {
  width: auto;
}
.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}
.knowledge-item {
  margin: 10px 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow-wrap: anywhere;
}
.knowledge-panel .room-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 10px 0;
}
.knowledge-panel button {
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  color: var(--ink);
}
.knowledge-panel button:not(:disabled):hover {
  background: var(--button-hover);
}
.knowledge-panel button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.knowledge-panel button:disabled {
  background: var(--button-disabled);
  color: var(--muted);
}
.knowledge-panel pre,
.prose {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.knowledge-panel pre {
  max-height: 280px;
  overflow: auto;
  background: var(--surface);
  padding: 10px;
}
.knowledge-panel fieldset {
  min-width: 0;
}
@media (max-width: 540px) {
  .knowledge-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .knowledge-panel button {
    min-height: 44px;
  }
}
</style>
