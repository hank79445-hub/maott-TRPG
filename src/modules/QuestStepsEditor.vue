<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import type { Quest } from '../persistence/quest-schema'
const quest = defineModel<Quest>({ required: true })
defineProps<{
  scenes?: {
    id: string
    name: string
    points?: { id: string; name: string }[]
    arrivalGroups?: { id: string; name: string }[]
  }[]
  runtime: boolean
  npcs?:{id:string;name:string}[]
}>()
function add() {
  quest.value.steps ??= []
  const previous = quest.value.steps.at(-1)
  quest.value.steps.push({
    id: crypto.randomUUID(),
    title: '新的小目标',
    description: '',
    visibility: previous ? 'hidden' : 'public',
    initialStatus: previous ? 'inactive' : 'active',
    afterIds: previous ? [previous.id] : [],
  })
}
const names = { inactive: '未开始', active: '进行中', completed: '已完成', failed: '已失败' }
function setStatus(step: NonNullable<Quest['steps']>[number], event: Event) {
  step.status = (event.target as HTMLSelectElement).value as typeof step.initialStatus
}
function clearSceneTargets(step: NonNullable<Quest['steps']>[number]) {
  step.pointId = undefined
  step.arrivalGroupId = undefined
}
</script>
<template>
  <details class="quest-steps-editor">
    <summary>{{ controlText('workspace.stageObjectivesAndPrerequisites') }}</summary>
    <label
      >{{ controlText('interactionField.pinnedMapObjective') }}<select v-model="quest.pinnedStepId">
        <option :value="undefined">{{ controlText('workspace.useFirstPublicInProgressStep') }}</option>
        <option v-for="s in quest.steps ?? []" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select></label
    >
    <fieldset v-for="(s, i) in quest.steps ?? []" :key="s.id">
      <legend>{{ i + 1 }} · {{ s.title }}</legend>
      <label>{{ controlText('interactionField.objectiveTitle') }}<input v-model="s.title" maxlength="120" /></label
      ><label>{{ controlText('interactionField.playerGuidance') }}<textarea v-model="s.description" rows="2" maxlength="2000" /></label
      ><label
        >{{ controlText('domain.visibility') }}<select v-model="s.visibility">
          <option value="public">{{ controlText('controls.public') }}</option>
          <option value="hidden">{{ controlText('workspace.hideSubsequentSteps') }}</option>
        </select></label
      ><label
        >{{ controlText('domain.initialState') }}<select v-model="s.initialStatus">
          <option v-for="(name, k) in names" :key="k" :value="k">{{ uiLabel(name) }}</option>
        </select></label
      ><label v-if="runtime"
        >{{ controlText('interactionField.currentGmProgress') }}<select :value="s.status ?? s.initialStatus" @change="setStatus(s, $event)">
          <option v-for="(name, k) in names" :key="k" :value="k">{{ uiLabel(name) }}</option>
        </select></label
      ><label v-for="p in quest.steps?.filter((p) => p.id !== s.id) ?? []" :key="p.id"
        ><input type="checkbox" v-model="s.afterIds" :value="p.id" />{{ controlText('interactionField.prerequisites') }}{{ p.title }}</label
      ><label
        >{{ controlText('domain.linkedScene') }}<select v-model="s.sceneId" @change="clearSceneTargets(s)">
          <option :value="undefined">{{ controlText('workspace.unlinkedAdvanceManually') }}</option>
          <option v-for="a in scenes ?? []" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
        </select></label
      ><label
        >{{ controlText('domain.linkedPoint') }}<MapFieldPicker kind="point"><select v-model="s.pointId">
          <option :value="undefined">{{ controlText('controls.none') }}</option>
          <option
            v-for="p in scenes?.find((a) => a.id === s.sceneId)?.points ?? []"
            :key="p.id"
            :value="p.id"
          >
            {{ localizedEntryName(p) }}
          </option>
        </select></MapFieldPicker></label
      ><label
        >{{ controlText('interactionField.linkedAppearanceGroup') }}<select v-model="s.arrivalGroupId">
          <option :value="undefined">{{ controlText('controls.none') }}</option>
          <option
            v-for="g in scenes?.find((a) => a.id === s.sceneId)?.arrivalGroups ?? []"
            :key="g.id"
            :value="g.id"
          >
            {{ localizedEntryName(g) }}
          </option>
        </select></label
      ><label
        >{{ controlText('interactionField.confirmedEventTrigger') }}<select v-model="s.trigger">
          <option :value="undefined">{{ controlText('workspace.gmManualJudgment') }}</option>
          <option value="point-success">{{ controlText('workspace.interactionSuccessConfirmed') }}</option>
          <option value="scene-enter">{{ controlText('workspace.partyArrivesInScene') }}</option>
          <option value="arrival">{{ controlText('workspace.specifiedNpcGroupAppears') }}</option>
          <option value="battle-ended">{{ controlText('workspace.sceneCombatEnds') }}</option>
        </select></label
      ><label><input v-model="s.automatic" type="checkbox">{{ controlText('interactionField.authorizePracticalPolicyToCompleteThisObjectiveAutomatically') }}</label
      ><label><input v-model="s.activateNext" type="checkbox">{{ controlText('interactionField.afterCompletionActivateSubsequentStepsWhosePrerequisitesAre') }}</label
      ><p class="muted" role="status">{{ s.pointId ? controlText('expressionThree.interactionPointLinked') : controlText('expressionThree.noInteractionPointLinked') }}{{ s.trigger ? controlText('expressionThree.eventTriggerConfigured') : controlText('expressionThree.noTriggerConfiguredALinkAloneDoesNot') }}{{ s.automatic ? controlText('expressionThree.automaticCompletionRequestedTheRoomMustAlsoEnable') : controlText('expressionThree.aMatchingEventCreatesASuggestionForGm') }}</p
      ><label>{{ controlText('domain.eventOwner') }}<select v-model="s.attribution"><option :value="undefined">{{ controlText('game.party') }}</option><option value="party">{{ controlText('game.party') }}</option><option value="proxy">{{ controlText('domain.npcAgent') }}</option><option value="world">{{ controlText('workspace.explicitWorldEvent') }}</option></select></label
      ><label v-if="s.attribution==='proxy'">{{ controlText('domain.agentNpc') }}<select v-model="s.proxyNpcIds" multiple><option v-for="n in npcs??[]" :key="n.id" :value="n.id">{{localizedEntryName(n)}}</option></select></label
      ><label
        >{{ controlText('interactionField.failureAlternativeRouteGm') }}<textarea v-model="s.alternatives" rows="2" maxlength="2000" /></label
      ><label>{{ controlText('interactionField.completionCriteriaNotesGm') }}<textarea v-model="s.gmNote" rows="2" maxlength="2000" /></label
      ><button
        :disabled="
          quest.pinnedStepId === s.id || quest.steps?.some((p) => p.afterIds.includes(s.id))
        "
        :title="controlText('interactionField.removePrerequisiteOrPinnedReferencesFirst')"
        @click="quest.steps?.splice(i, 1)"
      >{{ controlText('workspace.deleteThisObjective') }}</button>
    </fieldset>
    <button :disabled="(quest.steps?.length ?? 0) >= 100" @click="add">{{ controlText('workspace.addStageObjective') }}</button>
    <p>{{ controlText('workspace.recordsProgressOnlyConfirmationDoesNotGrantRewards') }}</p>
  </details>
</template>
