<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {i18n} from '../app/i18n'
const {t}=i18n.global
import TextStyleSettings from './TextStyleSettings.vue'
import ModelTokenField from './ModelTokenField.vue'
import NarrationSkills from './NarrationSkills.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { clone } from '../core/engine'
import type { RoomView, RoomCommand } from '../online/protocol'
import AiJobCard from './AiJobCard.vue'
import ModelProfiles from './ModelProfiles.vue'
import { pendingRoomReviews } from './room-review-queue'
import NpcEditor from './NpcEditor.vue'
import NpcMemoryPanel from './NpcMemoryPanel.vue'
import NpcKnowledgePanel from './NpcKnowledgePanel.vue'
import NpcSpatialPanel from './NpcSpatialPanel.vue'
import NpcDiagnosticsPanel from './NpcDiagnosticsPanel.vue'
import PortraitPicker from './PortraitPicker.vue'
const props = defineProps<{
    view: RoomView
    busy: boolean
    quickReview?: boolean
    submitCommand?: (c: RoomCommand, id?: string) => Promise<boolean>
  }>(),
  emit = defineEmits<{ command: [command: RoomCommand]; navigate: [tab: string]; knowledgeReport:[] }>()
const gm = computed(() => props.view.self.role === 'gm'),
  settings = ref(clone(props.view.ai.settings)),
  model = ref({
    baseUrl: props.view.ai.model.baseUrl || 'https://api.openai.com/v1',
    model: props.view.ai.model.model,
    apiKey: '',
    clearKey: false,
    contextBudgetTokens:
      props.view.ai.model.contextBudgetTokens === undefined
        ? 32768
        : props.view.ai.model.contextBudgetTokens,
    timeoutSeconds: props.view.ai.model.timeoutSeconds,
    maxOutputTokens: props.view.ai.model.maxOutputTokens,
    tokenParameter: props.view.ai.model.tokenParameter,
    jsonMode: props.view.ai.model.jsonMode,
  })
watch(
  () => props.view.ai.settings,
  (v) => {
    settings.value.qqDialogueReview = v.qqDialogueReview ? clone(v.qqDialogueReview) : undefined
    settings.value.narrationModelRef = v.narrationModelRef
    settings.value.npcModelRef = v.npcModelRef
    settings.value.narrationSkills = v.narrationSkills ? clone(v.narrationSkills) : undefined
    settings.value.defaultNarrationSkill = v.defaultNarrationSkill
    settings.value.sceneNarrationSkills = v.sceneNarrationSkills
      ? clone(v.sceneNarrationSkills)
      : undefined
  },
)
watch(()=>JSON.stringify(props.view.ai.settings.textStyle),()=>{settings.value.textStyle=props.view.ai.settings.textStyle?clone(props.view.ai.settings.textStyle):undefined})
const npcId = ref(props.view.ai.npcs.find((n) => n.sceneId === props.view.scene?.id)?.id ?? ''),
  characterId = ref(props.view.ownCharacters[0]?.id ?? ''),
  message = ref(''),
  goal = ref(''),
  visibility = ref<'public' | 'personal'>('public'),
  historical = ref(false),
  kind = ref('all')
const dialogueFilter = ref('all'),
  jobSearch = ref('')
const proactiveNpc = ref(''),
  proactiveCharacter = ref(props.view.characters[0]?.id ?? ''),
  proactiveReason = ref('GM 希望 NPC 根据当前情况主动问候或提出建议'),
  proactiveVisibility = ref<'public' | 'personal'>('public')
watch(
  () => [
    props.view.scene?.id,
    ...props.view.ai.npcs.map((n) => n.id),
    ...props.view.ownCharacters.map((c) => c.id),
  ],
  () => {
    const candidates = props.view.ai.npcs.filter((n) => n.sceneId === props.view.scene?.id)
    if (!candidates.some((n) => n.id === npcId.value)) npcId.value = candidates[0]?.id ?? ''
    const characters = props.view.ownCharacters.filter((c) => !c.npcOwnerId)
    if (!characters.some((c) => c.id === characterId.value))
      characterId.value = characters[0]?.id ?? ''
    if (!props.view.characters.some((c) => c.id === proactiveCharacter.value))
      proactiveCharacter.value = props.view.characters[0]?.id ?? ''
  },
  { immediate: true },
)
type AiSection = [id: string, label: string]
type AiGroup = { id: string; label: string; items: AiSection[] }
const AI_GROUPS: AiGroup[] = [
  {
    id: 'model',
    label: '模型配置',
    items: [
      ['model-service', '模型服务配置'],
      ['model-profiles', '多模型库与分配'],
      ['text-rules', '模型文本通用规则'],
    ],
  },
  {
    id: 'narr',
    label: '旁白设置',
    items: [
      ['pending-story', '待确认剧情结果'],
      ['narration-settings', '旁白聚合设置'],
      ['narration-skills', '旁白 Skill'],
      ['narration-log', '旁白记录'],
    ],
  },
  {
    id: 'npc',
    label: 'NPC 配置',
    items: [
      ['npc-editor', 'NPC 配置与行为边界'],
      ['npc-memory', 'NPC 运行记忆与关系'],
      ['npc-knowledge', '世界知识、阵营与长期记忆'],
      ['npc-spatial', '重要 NPC 空间代理'],
      ['npc-diagnostics', 'NPC 触发诊断与测试'],
      ['npc-proactive', '让重要 NPC 主动交谈'],
      ['npc-talk', '与 NPC 交谈'],
    ],
  },
]
const PLAYER_GROUPS: AiGroup[] = [
  { id: 'narr', label: '旁白设置', items: [['narration-log', '旁白记录']] },
  { id: 'npc', label: 'NPC 配置', items: [['npc-talk', '与 NPC 交谈']] },
]
const groups = computed<AiGroup[]>(() => (gm.value ? AI_GROUPS : PLAYER_GROUPS))
const sectionIds = computed(() => groups.value.flatMap((g) => g.items.map((i) => i[0])))
const AI_SECTION_KEY = 'trpg-ai-section'
function readSection() {
  try {
    const saved = localStorage.getItem(AI_SECTION_KEY)
    if (saved && sectionIds.value.includes(saved)) return saved
  } catch {}
  return gm.value ? 'model-service' : 'npc-talk'
}
const section = ref(readSection())
const groupOf = (id: string) =>
  groups.value.find((g) => g.items.some((i) => i[0] === id))?.id ?? 'model'
const openGroup = ref(groupOf(section.value))
if (!sectionIds.value.includes(section.value)) section.value = sectionIds.value[0] ?? 'npc-talk'
const currentItem = computed(() =>
  groups.value.flatMap((g) => g.items).find((i) => i[0] === section.value),
)
const currentGroup = computed(() => groups.value.find((g) => g.id === groupOf(section.value)))
function goSection(id: string) {
  section.value = id
  openGroup.value = groupOf(id)
  try {
    localStorage.setItem(AI_SECTION_KEY, id)
  } catch {}
}
function toggleGroup(id: string) {
  openGroup.value = openGroup.value === id ? '' : id
}
watch(
  () => gm.value,
  () => {
    if (!sectionIds.value.includes(section.value))
      section.value = sectionIds.value[0] ?? 'npc-talk'
  },
)
watch(
  section,
  async () => {
    await nextTick()
    document
      .querySelectorAll<HTMLDetailsElement>('.ai-main > details.room-card')
      .forEach((d) => (d.open = true))
  },
  { immediate: true },
)
const pendingStory = computed(() => {
  const log = props.view.world?.adventures[0]?.broadcastLog?.events ?? []
  return log.filter(
    (e) =>
      e.type === 'point.story.pending' &&
      e.branchId === props.view.broadcast.branchId &&
      e.sceneId === props.view.scene?.id &&
      !log.some((x) => x.supersedes.includes(e.id)),
  )
})
const jobs = computed(() =>
  [...props.view.ai.jobs]
    .filter(
      (j) =>
        (historical.value || !j.historical) &&
        !j.activityTest &&
        !j.spatialPlanning &&
        (kind.value === 'all' || j.kind === kind.value) &&
        (dialogueFilter.value === 'all' ||
          (dialogueFilter.value === 'automatic'
            ? j.dialogueReview?.stage === 'automatic'
            : dialogueFilter.value === 'manual'
              ? j.dialogueReview?.stage === 'manual'
              : !!j.dialogueReview && !['automatic', 'manual'].includes(j.dialogueReview.stage))) &&
        (!jobSearch.value.trim() ||
          (j.title + j.message + j.text).includes(jobSearch.value.trim())) &&
        !(props.quickReview && pendingRoomReviews(props.view).jobs.some((job) => job.id === j.id)),
    ),
)
function configure() {
  emit('command', { kind: 'model-config', configuration: clone(model.value) })
  model.value.apiKey = ''
}
function clearModel() {
  emit('command', { kind: 'model-clear' })
  model.value.apiKey = ''
}
function talk() {
  emit('command', {
    kind: 'npc-talk',
    npcId: npcId.value,
    characterId: characterId.value,
    message: message.value,
    goal: goal.value,
    visibility: visibility.value,
  })
  message.value = ''
}
</script>
<template>
  <section class="ai-panel">
    <div class="room-card">
      <h2>{{ controlText('game.aiPanel') }}</h2>
      <p>{{ controlText('ai.panelHelp') }}</p>
      <p v-if="gm" class="muted">
        {{ controlText('quantity.modelUsage', {p0:(view.ai.model.configured
            ? controlText('expressionOne.configuredModels') + view.ai.model.model
            : view.ai.modelProfiles?.length
              ? controlText('expressionOne.existing') + view.ai.modelProfiles.length + controlText('expressionOne.modelConfigurationsAssignBelow')
              : controlText('expressionOne.noModelConfiguredFixedTextIsAvailableFor')),p1:(view.ai.usage.requests),p2:(view.ai.usage.reservedTokens),p3:(view.ai.usage.reportedTokens)}) }}</p>
    </div>
    <div class="ai-shell">
      <nav class="ai-nav" :aria-label="controlText('ai.panelAria')">
        <div v-for="g in groups" :key="g.id" class="ai-nav-group">
          <button
            type="button"
            class="ai-nav-head"
            :class="{ on: currentGroup?.id === g.id }"
            :aria-expanded="openGroup === g.id"
            @click="toggleGroup(g.id)"
          >
            {{ uiLabel(g.label) }}
            <i v-if="g.id === 'narr' && pendingStory.length">{{ pendingStory.length }}</i>
            <em aria-hidden="true"></em>
          </button>
          <div v-show="openGroup === g.id" class="ai-nav-sub">
            <button
              v-for="item in g.items"
              :key="item[0]"
              type="button"
              :class="{ on: section === item[0] }"
              @click="goSection(item[0])"
            >
              {{ uiLabel(item[1]) }}
              <i v-if="item[0] === 'pending-story' && pendingStory.length">{{
                pendingStory.length
              }}</i>
            </button>
          </div>
        </div>
      </nav>
      <div class="ai-main">
        <p class="ai-crumb">{{ uiLabel(currentGroup?.label) }} / {{ uiLabel(currentItem?.[1]) }}</p>
        <h2>{{ uiLabel(currentItem?.[1]) }}</h2>
    <details v-if="gm && section === 'pending-story'" class="room-card">
      <summary>{{ controlText('ai.pendingStory') }}</summary>
      <p class="muted">{{ controlText('ai.storyResultHelp') }}</p>
      <div
        v-for="ev in pendingStory"
        :key="ev.id"
        class="room-card"
      >
        <p>{{ ev.text }}</p>
        <div class="room-row">
          <button
            :disabled="busy"
            @click="
              emit('command', {
                kind: 'npc-story-confirm',
                eventId: ev.id,
                approve: true,
                reason: 'GM 已确认剧情事实',
              })
            "
          >
            {{ controlText('ai.confirmFact') }}</button
          ><button
            class="subtle"
            :disabled="busy"
            @click="
              emit('command', {
                kind: 'npc-story-confirm',
                eventId: ev.id,
                approve: false,
                reason: 'GM 不认可该剧情结果',
              })
            "
          >
            {{ controlText('ai.rejectResult') }}
          </button>
        </div>
      </div>
    </details>
    <NpcMemoryPanel v-if="gm && section === 'npc-memory'" :view="view" :busy="busy" @command="emit('command', $event)" />
    <NpcKnowledgePanel v-if="gm && section === 'npc-knowledge'" :view="view" :busy="busy" @command="emit('command', $event)" />
    <NpcSpatialPanel v-if="gm && section === 'npc-spatial'" :view="view" :busy="busy" @command="emit('command', $event)" />
    <NpcDiagnosticsPanel v-if="gm && section === 'npc-diagnostics'" :view="view" :busy="busy" @command="emit('command', $event)" />
    <div v-if="gm && section === 'npc-diagnostics'" class="room-card"><button type="button" :disabled="busy" @click="emit('knowledgeReport')">{{ controlText('ai.knowledgeReport') }}</button><small>{{ controlText('ai.knowledgeReportHelp') }}</small></div>
    <ModelProfiles
      v-if="gm && section === 'model-profiles'"
      :profiles="view.ai.modelProfiles ?? []"
      :settings="view.ai.settings"
      :busy="busy"
      @command="emit('command', $event)"
    />
    <details v-if="gm && section === 'model-service'" class="room-card">
      <summary>{{ controlText('ai.modelConfig') }}</summary>
      <form class="ai-form" autocomplete="off" @submit.prevent="configure">
        <label
          >{{ controlText('ai.baseUrl') }}<input
            v-model="model.baseUrl"
            type="url"
            required
            maxlength="1000" /></label
        ><label
          >{{ controlText('game.modelName') }}<input
            v-model="model.model"
            required
            maxlength="120"
            :placeholder="controlText('ai.modelPlaceholder')" /></label
        ><label
          >{{ controlText('ai.apiKey') }}<input
            v-model="model.apiKey"
            type="password"
            autocomplete="new-password"
            maxlength="4096"
            :placeholder="view.ai.model.hasKey ? controlText('expressionOne.keySavedOnBackend') : controlText('expressionOne.noKeyYet')" /></label
        ><label class="check"><input v-model="model.clearKey" type="checkbox" />{{ controlText('ai.clearKey') }}</label
        ><ModelTokenField
          v-model="model.contextBudgetTokens"
          :label="controlText('confirmation.totalContextBudgetConservativeTokens')"
          :default-value="32768"
        />
        <label
          >{{ controlText('ai.timeout') }}<input
            v-model.number="model.timeoutSeconds"
            type="number"
            min="5"
            max="120" /></label
        ><ModelTokenField
          v-model="model.maxOutputTokens"
          :label="controlText('confirmation.outputTokenLimit')"
          :unlimited-label="controlText('confirmation.useProviderDefault')"
        />
        <label
          >{{ controlText('game.tokenParameter') }}<select v-model="model.tokenParameter">
            <option value="max_completion_tokens">max_completion_tokens</option>
            <option value="max_tokens">{{ controlText('ai.maxTokens') }}</option>
          </select></label
        ><label class="check"
          ><input v-model="model.jsonMode" type="checkbox" />{{ controlText('game.jsonMode') }}</label
        >
        <p class="ai-wide muted">
          {{ controlText('ai.providerHelp') }}
        </p>
        <div class="room-row ai-wide">
          <button :disabled="busy">{{ controlText('domain.modelConfig') }}</button
          ><button type="button" class="subtle" :disabled="busy" @click="clearModel">
            {{ controlText('domain.clearModel') }}
          </button>
        </div>
      </form>
    </details>
    <details v-if="gm && section === 'narration-settings'" class="room-card">
      <summary>{{ controlText('domain.legacyNarration') }}</summary>
      <form
        class="ai-form"
        @submit.prevent="
          emit('command', {
            kind: 'map',
            command: { type: 'ai-settings', settings: clone(settings) },
          })
        "
      >
        <label class="check"
          ><input v-model="settings.enabled" type="checkbox" />{{ controlText('domain.narrationCollection') }}</label
        ><label
          >{{ controlText('domain.generationGrain') }}<select v-model="settings.mode">
            <option value="turn">{{ controlText('domain.wholeTurn') }}</option>
            <option value="action">{{ controlText('domain.wholeAction') }}</option>
            <option value="manual">{{ controlText('domain.onlyGm') }}</option>
          </select></label
        ><label>{{ controlText('domain.style') }}<textarea v-model="settings.style" maxlength="2000" /></label
        ><label
          >{{ controlText('domain.publicBackground') }}<textarea
            v-model="settings.background"
            maxlength="2000"
          /></label
        ><label>{{ controlText('language.room') }}<select v-model="settings.contentLocale"><option :value="undefined">{{ controlText('language.legacy') }}</option><option value="zh-CN">{{ controlText('domain.chinese') }}</option><option value="en">English</option></select></label>
        <p class="muted ai-wide">{{ controlText('language.future') }}</p>
        <label v-if="settings.contentLocale === undefined">{{ controlText('language.legacyRule') }}<input v-model="settings.language" maxlength="80" /></label
        ><label
          >{{ controlText('domain.suggestedLength') }}<input
            v-model.number="settings.maxCharacters"
            type="number"
            min="80"
            max="2000" /></label
        ><ModelTokenField
          v-model="settings.tokensPerHour"
          :label="controlText('domain.tokensBudget')"
          :default-value="100000"
        /><label class="check"
          ><input v-model="settings.includeNumbers" type="checkbox" />{{ controlText('domain.narrationNumbers') }}</label
        ><label class="check"
          ><input v-model="settings.privateNarration" type="checkbox" />{{ controlText('domain.privateNarration') }}</label
        ><label class="check"
          ><input v-model="settings.autoPublish" type="checkbox" />{{ controlText('ai.autoNarration') }}</label
        ><label class="check"
          ><input
            v-model="settings.narrationDirectPublish"
            type="checkbox"
          />{{ controlText('ai.priorityNarration') }}</label
        >
        <p class="ai-wide muted">
          {{ controlText('ai.autoNarrationHelp') }}
        </p>
        <label
          >{{ controlText('ai.proactiveLimit') }}<input
            v-model.number="settings.activitySpeakers"
            type="number"
            min="1"
            max="2"
        /></label>
        <div class="ai-wide">
          <strong>{{ controlText('ai.genericPortrait') }}</strong
          ><PortraitPicker
            :portrait="settings.npcPortrait"
            name="NPC通用头像"
            :disabled="busy"
            @change="settings.npcPortrait = $event"
          />
        </div>
        <button :disabled="busy">{{ controlText('ai.saveNarration') }}</button>
      </form>
    </details>
    <TextStyleSettings v-if="gm && section === 'text-rules'" v-model="settings.textStyle" :busy="busy" @save="emit('command',{kind:'map',command:{type:'ai-settings',settings:clone(settings)}})" />
    <NarrationSkills
      v-if="gm && section === 'narration-skills'"
      :settings="view.ai.settings"
      :scenes="view.world?.adventures[0]?.scenes ?? []"
      :scene-id="view.scene?.id ?? null"
      :busy="busy"
      @save="emit('command', { kind: 'map', command: { type: 'ai-settings', settings: $event } })"
      @test="emit('command', { kind: 'narration-skill-test' })"
    />
    <NpcEditor
      v-if="gm && section === 'npc-editor'"
      :view="view"
      :busy="busy"
      :submit-command="submitCommand"
      @command="emit('command', $event)"
      @navigate="emit('navigate', $event)"
    />
    <details v-if="gm && section === 'npc-proactive'" class="room-card">
      <summary>{{ controlText('ai.proactivePanel') }}</summary>
      <div class="ai-form">
        <label
          >{{ controlText('game.activeNpc') }}<select v-model="proactiveNpc" :aria-label="controlText('game.activeNpc')">
            <option value="">{{ controlText('ai.chooseImportant') }}</option>
            <option
              v-for="n in view.ai.npcs.filter(
                (n) => n.npcType === 'important' && n.sceneId === view.scene?.id,
              )"
              :key="n.id"
              :value="n.id"
            >
              {{ localizedEntryName(n) }}
            </option>
          </select></label
        ><label
          >{{ controlText('ai.talkTarget') }}<select v-model="proactiveCharacter">
            <option
              v-for="c in view.characters.filter(
                (c) => !view.world?.characters.find((role) => role.id === c.id)?.npcOwnerId,
              )"
              :key="c.id"
              :value="c.id"
            >
              {{ localizedEntryName(c) }}
            </option>
          </select></label
        ><label>{{ controlText('ai.proactiveBasis') }}<textarea v-model="proactiveReason" maxlength="2000" /></label
        ><label
          >{{ controlText('ai.proactiveAudience') }}<select v-model="proactiveVisibility">
            <option value="public">{{ controlText('game.publicTalk') }}</option>
            <option value="personal">{{ controlText('ai.personalTalk') }}</option>
          </select></label
        >
      </div>
      <button
        :disabled="busy || !proactiveNpc || !proactiveCharacter || !proactiveReason.trim()"
        @click="
          emit('command', {
            kind: 'npc-proactive',
            npcId: proactiveNpc,
            characterId: proactiveCharacter,
            reason: proactiveReason,
            visibility: proactiveVisibility,
          })
        "
      >
        {{ controlText('ai.startProactive') }}
      </button>
    </details>
    <form v-if="section === 'npc-talk'" class="room-card" @submit.prevent="talk">
      <h3>{{ controlText('ai.talkWithNpc') }}</h3>
      <div class="ai-form">
        <label
          >{{ controlText('ai.talkCharacter') }}<select v-model="characterId">
            <option
              v-for="c in view.ownCharacters.filter((c) => !c.npcOwnerId)"
              :key="c.id"
              :value="c.id"
            >
              {{ localizedEntryName(c.build) }}
            </option>
          </select></label
        ><label
          >NPC<select v-model="npcId" aria-label="NPC">
            <option value="">{{ controlText('game.npc') }}</option>
            <option
              v-for="n in view.ai.npcs.filter((n) => n.sceneId === view.scene?.id)"
              :key="n.id"
              :value="n.id"
            >
              {{ localizedEntryName(n) }}
            </option>
          </select></label
        ><label>{{ controlText('ai.spokenText') }}<textarea v-model="message" maxlength="2000" required /></label
        ><label>{{ controlText('ai.socialGoal') }}<textarea v-model="goal" maxlength="2000" /></label
        ><label
          >{{ controlText('game.sight') }}<select v-model="visibility" :aria-label="controlText('game.sight')">
            <option value="public">{{ controlText('game.publicTalk') }}</option>
            <option value="personal">{{ controlText('ai.personalGm') }}</option>
          </select></label
        >
      </div>
      <button :disabled="busy || !npcId || !characterId || !message.trim()">
        {{ controlText('ai.submitTalk') }}
      </button>
    </form>
    <div v-if="section === 'narration-log'" class="room-card room-row">
      <label>{{ controlText('ai.taskSearch') }}<input v-model="jobSearch" :placeholder="controlText('ai.taskSearchPlaceholder')" /></label
      ><label
        >{{ controlText('ai.dialogueCategory') }}<select v-model="dialogueFilter">
          <option value="all">{{ controlText('controls.all') }}</option>
          <option value="automatic">{{ controlText('ai.autoClassify') }}</option>
          <option value="manual">{{ controlText('ai.gmPublish') }}</option>
          <option value="review">{{ controlText('ai.awaitingReview') }}</option>
        </select></label
      >
      <label
        >{{ controlText('ai.taskType') }}<select v-model="kind">
          <option value="all">{{ controlText('controls.all') }}</option>
          <option value="narration">{{ controlText('controls.narration') }}</option>
          <option value="npc">{{ controlText('ai.npcSocial') }}</option>
        </select></label
      ><label class="check"><input v-model="historical" type="checkbox" />{{ controlText('ai.oldBranches') }}</label
      ><template v-if="gm"
        ><span>{{ controlText('quantity.recordCount', {p0:(controlText('ai.pendingBroadcasts')),p1:(view.ai.buffered)}) }}</span
        ><button
          class="subtle"
          :disabled="busy || !view.ai.buffered"
          @click="emit('command', { kind: 'narration-request', summary: false })"
        >
          {{ controlText('ai.generateResolved') }}</button
        ><button
          class="subtle"
          :disabled="busy"
          @click="emit('command', { kind: 'narration-request', summary: true })"
        >
          {{ controlText('ai.generateRound') }}
        </button></template
      >
    </div>
    <AiJobCard
      v-if="section === 'narration-log'"
      v-for="job in jobs"
      :key="job.id"
      :job="job"
      :view="view"
      :busy="busy"
      :submit-command="submitCommand"
      @command="emit('command', $event)"
      @navigate="emit('navigate', $event)"
    />
    <p v-if="section === 'narration-log' && !jobs.length" class="room-card muted">{{ controlText('ai.noTasks') }}</p>
      </div>
    </div>
  </section>
</template>
<style>
.ai-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.ai-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
  margin: 14px 0;
  min-width: 0;
}
.ai-form label,
.ai-job > label {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.ai-form .check,
.ai-job .check {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-form input,
.ai-form select,
.ai-form textarea,
.ai-job textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.ai-form .check input,
.ai-job .check input {
  width: auto;
}
.ai-wide {
  grid-column: 1/-1;
}
.ai-form fieldset {
  min-width: 0;
}
.ai-form fieldset > .check {
  display: inline-flex;
  margin: 8px 12px 8px 0;
}
.ai-job small {
  font-size: 13px;
  color: var(--muted);
}
.ai-prose {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ai-job details {
  overflow-wrap: anywhere;
}
.ai-job h3 {
  overflow-wrap: anywhere;
}
.ai-job textarea {
  resize: vertical;
}
@media (max-width: 540px) {
  .ai-form {
    grid-template-columns: minmax(0, 1fr);
  }
  .ai-panel .room-row {
    flex-wrap: wrap;
  }
}
</style>
