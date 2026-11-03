<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import { computed } from 'vue'
import type { Quest } from '../persistence/quest-schema'
import type { RoomView } from '../online/protocol'
import { questStepEventMatches } from '../core/quest-steps'
const props = defineProps<{ quest: Quest; view: RoomView }>()
const reports = computed(() => {
  if (props.view.self.role !== 'gm') return []
  const quest = props.quest,
    a = props.view.world?.adventures[0],
    branch = props.view.broadcast.branchId
  const settings = props.view.gmReview?.settings
  const automatic =
    !!settings &&
    settings.mode === 'assisted' &&
    !settings.paused &&
    !!settings.practical?.enabled &&
    !!settings.practical.knowledge
  const events = (a?.broadcastLog?.events ?? []).filter((e) => e.branchId === branch)
  return (quest.steps ?? []).map((step) => {
    const state = step.status ?? step.initialStatus,
      reasons: string[] = []
    const scene = a?.scenes.find((s) => s.id === step.sceneId)
    const suggestion = quest.stepSuggestions?.find(
      (r) => r.stepId === step.id && r.branchId === branch && r.status === 'pending',
    )
    const latest = events
      .filter(
        (e) =>
          e.sceneId === step.sceneId &&
          (step.trigger === 'point-success' || step.pointId
            ? e.facts.pointId === step.pointId
            : step.trigger === 'arrival'
              ? e.facts.groupId === step.arrivalGroupId
              : step.trigger === 'scene-enter'
                ? e.type === 'scene.enter'
                : e.type === 'encounter.ended'),
      )
      .at(-1)
    const matched = events.filter((e) => questStepEventMatches(step, e)).at(-1)
    // The server projection already restricts practical tasks to the current branch.
    const task = props.view.practicalReview?.tasks.find(
      (t) => t.phase === 'quest' && t.sourceId === `${quest.id}:${step.id}`,
    )
    if (state !== 'completed' && state !== 'failed') {
      if ((quest.status ?? quest.initialStatus) !== 'active') reasons.push(controlText('projection.parentQuestIsNotActive'))
      if (state !== 'active') reasons.push(controlText('projection.objectiveIsNotActive'))
      const missing = step.afterIds.filter(
        (id) =>
          !quest.steps?.some((s) => s.id === id && (s.status ?? s.initialStatus) === 'completed'),
      )
      if (missing.length)
        reasons.push(
          controlText('projection.prerequisitesIncomplete') +
            missing.map((id) => quest.steps?.find((s) => s.id === id)?.title ?? id).join('、'),
        )
      if (!step.trigger)
        reasons.push(
          step.pointId
            ? controlText('projection.interactionLinkedButInteractionSuccessConfirmedIsNot')
            : controlText('projection.noEventTriggerConfiguredGmManaged'),
        )
      else if (
        !scene ||
        (step.trigger === 'point-success' && !scene.points.some((p) => p.id === step.pointId)) ||
        (step.trigger === 'arrival' &&
          !scene.arrivalGroups?.some((g) => g.id === step.arrivalGroupId))
      )
        reasons.push(controlText('projection.linkedSceneInteractionOrAppearanceGroupIsMissing'))
      if (step.trigger && !suggestion) {
        if (matched)
          reasons.push(
            controlText('projection.retainedRecordsContainAMatchingEventButNo'),
          )
        else if (latest?.type === 'point.result' && latest.facts.success !== true)
          reasons.push(controlText('projection.latestInteractionHasNoConfirmedSuccessViewingUnchanged'))
        else reasons.push(controlText('projection.noMatchingConfirmedSuccessEventInThisBranch'))
      }
      if (suggestion) {
        if (!step.automatic) reasons.push(controlText('projection.suggestionGeneratedAwaitingGmConfirmationInQuickReview'))
        else if (!automatic)
          reasons.push(
            controlText('projection.stepRequestsAutomationButTheRoomKnowledgeQuest'),
          )
        else if (task && ['needs-gm', 'needs-fact', 'canceled', 'stale'].includes(task.status))
          reasons.push(controlText('projection.automaticProgressionIncomplete') + task.reason)
        else reasons.push(controlText('projection.waitingForAuthorizedAutomaticAdvancementEventOwnershipAnd'))
      }
    }
    return {
      id: step.id,
      title: step.title,
      state:
        state === 'completed'
          ? controlText('controls.completed')
          : state === 'failed'
            ? controlText('state.failed')
            : state === 'active'
              ? controlText('state.inProgress')
              : controlText('state.notStarted'),
      source: `${scene?.name ?? controlText('projection.noLinkedScene')} · ${scene?.points.find((p) => p.id === step.pointId)?.name ?? (step.pointId ? controlText('projection.interactionMissing') : controlText('projection.noLinkedInteraction'))}`,
      mode: step.automatic ? controlText('projection.automationConfiguredRoomAuthorizationAndOwnershipStillRequired') : controlText('projection.suggestThenGmConfirms'),
      latest: latest
        ? `${latest.title} · ${latest.phase === 'confirmed' ? controlText('projection.confirmed') : controlText('projection.unconfirmed')}${latest.type === 'point.result' ? (latest.facts.success === true ? controlText('projection.success') : latest.facts.success === false ? controlText('projection.failure') : controlText('projection.successUndetermined')) : ''}`
        : controlText('projection.noRelatedEventsInRetainedRecordsYet'),
      reasons,
    }
  })
})
</script>
<template>
  <details v-if="view.self.role === 'gm'" class="quest-progress-report">
    <summary>{{ controlText('liveSummary.objectiveProgressionDiagnosticsEntries', {p0:(reports.length)}) }}</summary>
    <p class="muted">{{ controlText('workspace.linksIdentifyTheRelevantContentOnlyAutomaticCompletion') }}</p>
    <p v-if="!reports.length">{{ controlText('workspace.noStageObjectivesConfiguredAQuestSTop') }}</p>
    <article v-for="r in reports" :key="r.id">
      <strong>{{ r.title }} · {{ r.state }}</strong>
      <p>{{ r.source }}</p>
      <p>{{ r.mode }}</p>
      <p class="muted">{{ controlText('liveSummary.latestEvent', {p0:(r.latest)}) }}</p>
      <ul v-if="r.reasons.length">
        <li v-for="reason in r.reasons" :key="reason">{{ reason }}</li>
      </ul>
    </article>
  </details>
</template>
<style scoped>
.quest-progress-report {
  margin-block: 12px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.quest-progress-report article {
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-block: 8px;
}
.quest-progress-report p {
  margin-block: 6px;
}
</style>
