<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { computed, ref } from 'vue'
import { questSchema, type Quest } from '../persistence/quest-schema'
import { questDesignSchema } from '../persistence/script-design-schema'
import QuestStepsEditor from './QuestStepsEditor.vue'
import QuestProgressReport from './QuestProgressReport.vue'
import type { RoomView } from '../online/protocol'
const props = defineProps<{
  quests: Quest[]
  gm: boolean
  busy?: boolean
  designOnly?: boolean
  roomView?: RoomView
  characters?: { id: string; name: string }[]
  npcs?: { id: string; name: string }[]
  scenes?: {
    id: string
    name: string
    points?: { id: string; name: string }[]
    arrivalGroups?: { id: string; name: string }[]
  }[]
}>()
const emit = defineEmits<{
  save: [quest: Quest]
  stepReview: [questId: string, suggestionId: string, approve: boolean]
}>()
const fresh = () => questSchema.parse({ id: crypto.randomUUID(), title: '新的目标' })
const draft = ref<Quest>(fresh()),
  tracked = ref('')
const current = computed(
  () =>
    props.quests.find((q) => q.id === tracked.value) ??
    props.quests.find((q) => q.current) ??
    props.quests.find((q) => (q.status ?? q.initialStatus) === 'active'),
)
const main = computed(() => props.quests.find((q) => q.main))
const currentStep = computed(
  () =>
    current.value?.steps?.find(
      (s) =>
        s.id === current.value?.pinnedStepId &&
        s.visibility === 'public' &&
        (s.status ?? s.initialStatus) === 'active',
    ) ??
    current.value?.steps?.find(
      (s) => s.visibility === 'public' && (s.status ?? s.initialStatus) === 'active',
    ),
)
const names = { inactive: '未开始', active: '进行中', completed: '已完成', failed: '已失败' }
function edit(id: string) {
  draft.value = JSON.parse(JSON.stringify(props.quests.find((q) => q.id === id) ?? fresh()))
}
</script>
<template>
  <section class="quest-panel" :aria-label="controlText('interactionField.questGuidance')" v-if="gm || quests.length">
    <div class="quest-summary">
      <strong v-if="currentStep">{{ controlText('liveSummary.currentObjective', {p0:(currentStep.title)}) }}</strong
      ><span v-if="currentStep?.description">{{ currentStep.description }}</span>
      <strong v-if="main">{{ controlText('liveSummary.mainGoal', {p0:(main.title)}) }}</strong
      ><span v-if="current"
        >{{ controlText('inventory.current') }}{{ current.title }} · {{ uiLabel(names[current.status ?? current.initialStatus]) }}</span
      >
    </div>
    <details>
      <summary>{{ gm ? controlText('domain.taskGuide') : controlText('expressionThree.viewObjectivesTrackSideQuests') }}</summary>
      <label
        >{{ controlText('interactionField.iAmTracking') }}<select v-model="tracked">
          <option value="">{{ controlText('workspace.followGmSCurrentObjective') }}</option>
          <option v-for="q in quests" :key="q.id" :value="q.id">
            {{ q.title }} · {{ uiLabel(names[q.status ?? q.initialStatus]) }}
          </option>
        </select></label
      >
      <p v-if="current">{{ current.description }}</p>
      <QuestProgressReport v-if="gm && !designOnly && current && roomView" :quest="current" :view="roomView" />
      <template v-if="current"
        ><p
          v-for="s in current.steps?.filter((s) => gm || s.visibility === 'public') ?? []"
          :key="s.id"
        >
          {{ s.title }} · {{ uiLabel(names[s.status ?? s.initialStatus]) }}
        </p>
        <template v-if="gm && !designOnly"
          ><article
            v-for="r in current.stepSuggestions?.filter((r) => r.status === 'pending') ?? []"
            :key="r.id"
          >
            <p>{{ controlText('liveSummary.suggestedCompletionConfirmedEvent', {p0:(current.steps?.find((s) => s.id === r.stepId)?.title),p1:(r.eventId)}) }}</p>
            <button :disabled="busy" @click="emit('stepReview', current.id, r.id, true)">{{ controlText('workspace.confirmObjectiveCompletion') }}</button
            ><button :disabled="busy" @click="emit('stepReview', current.id, r.id, false)">
              {{ controlText('domain.notComplete') }}
            </button>
          </article></template
        ></template
      >
      <fieldset v-if="gm" :disabled="busy">
        <label
          >{{ controlText('interactionField.editObjective') }}<select @change="edit(($event.target as HTMLSelectElement).value)">
            <option value="">{{ controlText('game.create') }}</option>
            <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.title }}</option>
          </select></label
        >
        <label>{{ controlText('workbench.titleLabel') }}<input v-model="draft.title" maxlength="120" /></label>
        <QuestStepsEditor v-model="draft" :scenes="scenes" :npcs="npcs" :runtime="!designOnly" />
        <label>{{ controlText('interactionField.chapter') }}<input v-model="draft.chapter" maxlength="120" /></label>
        <label>{{ controlText('interactionField.objectiveDescription') }}<textarea v-model="draft.description" maxlength="2000" /></label>
        <details>
          <summary>{{ controlText('workspace.gmCompletionCriteriaAndAlternativeRoutes') }}</summary>
          <template v-if="draft.gmDesign">
            <label v-for="n in npcs ?? []" :key="n.id" class="check"
              ><input v-model="draft.gmDesign.npcIds" type="checkbox" :value="n.id" />{{ controlText('interactionField.linkedCharacter') }}{{
                localizedEntryName(n)
              }}</label
            >
            <button v-if="draft.gmDesign.npcIds.length" @click="draft.gmDesign.npcIds = []">{{ controlText('workspace.clearQuestLinkedCharacter') }}</button>
            <label>{{ controlText('interactionField.completionCriteria') }}<textarea v-model="draft.gmDesign.completion" maxlength="2000" /></label>
            <label
              >{{ controlText('interactionField.failureAlternativeRoute') }}<textarea v-model="draft.gmDesign.alternatives" maxlength="2000" />
            </label>
            <label>{{ controlText('interactionField.gmOnlyNotes') }}<textarea v-model="draft.gmDesign.notes" maxlength="2000" /></label>
          </template>
          <button v-else @click="draft.gmDesign = questDesignSchema.parse({})">{{ controlText('workspace.addGmDesign') }}</button>
        </details>
        <label
          >{{ controlText('interactionField.initialGameState') }}<select v-model="draft.initialStatus">
            <option v-for="(name, key) in names" :key="key" :value="key">{{ uiLabel(name) }}</option>
          </select></label
        >
        <label
          >{{ controlText('interactionField.currentGameState') }}<select
            :value="draft.status ?? draft.initialStatus"
            @change="draft.status = ($event.target as HTMLSelectElement).value as Quest['status']"
          >
            <option v-for="(name, key) in names" :key="key" :value="key">{{ uiLabel(name) }}</option>
          </select></label
        >
        <label
          >{{ controlText('game.sight') }}<select v-model="draft.visibility">
            <option value="public">{{ controlText('workspace.publicToParty') }}</option>
            <option value="personal">{{ controlText('domain.specifiedCharacter') }}</option>
            <option value="hidden">{{ controlText('game.gmHidden') }}</option>
          </select></label
        >
        <div v-if="draft.visibility === 'personal'">
          <label v-for="c in characters ?? []" :key="c.id"
            ><input v-model="draft.characterIds" type="checkbox" :value="c.id" />{{ localizedEntryName(c) }}</label
          >
        </div>
        <label
          >{{ controlText('domain.linkedScene') }}<select v-model="draft.sceneId" @change="draft.pointId = null">
            <option :value="null">{{ controlText('controls.none') }}</option>
            <option v-for="s in scenes ?? []" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
          </select></label
        >
        <label v-if="draft.sceneId"
          >{{ controlText('domain.linkedPoint') }}<MapFieldPicker kind="point"><select v-model="draft.pointId">
            <option :value="null">{{ controlText('controls.none') }}</option>
            <option
              v-for="p in scenes?.find((s) => s.id === draft.sceneId)?.points ?? []"
              :key="p.id"
              :value="p.id"
            >
              {{ localizedEntryName(p) }}
            </option>
          </select></MapFieldPicker></label
        >
        <label><input v-model="draft.main" type="checkbox" />{{ controlText('interactionField.partyMainGoal') }}</label
        ><label><input v-model="draft.current" type="checkbox" />{{ controlText('interactionField.partyCurrentObjective') }}</label>
        <button
          :disabled="
            !draft.title.trim() || (draft.visibility === 'personal' && !draft.characterIds.length)
          "
          @click="emit('save', JSON.parse(JSON.stringify(draft)))"
        >{{ controlText('workspace.saveQuest') }}</button>
        <button @click="draft = fresh()">{{ controlText('workspace.createObjective') }}</button
        ><small>{{ controlText('workspace.recordsObjectiveStateOnlyDoesNotAutomaticallyGrant') }}</small>
      </fieldset>
    </details>
  </section>
</template>
<style scoped>
.quest-panel {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px;
  margin: 8px 0;
}
.quest-summary {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.quest-panel fieldset {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.quest-panel label {
  display: flex;
  gap: 5px;
  flex-direction: column;
}
.quest-panel button {
  min-height: 44px;
}
.quest-panel p {
  white-space: pre-wrap;
}
</style>
