<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import ReviewEvidence from './ReviewEvidence.vue'
import TemplateEditor from './TemplateEditor.vue'
import { makeAreaTemplate, spellAreaSpec } from '../core/map-area'
import type { MapScene, MapCombatOptions } from '../core/map-types'
import type { Intent, RoomView, RoomCommand } from '../online/protocol'
import type { Environment } from '../core/combat-types'
import { clone, catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { castSlotLevel, runtimeSpells } from '../core/runtime'
import { spellTargets, featureSelf } from '../online/combat-controls'
import { previewIntent } from '../online/intent-preview'
import RoomEnvironmentFields from './RoomEnvironmentFields.vue'
import NpcDirectiveFields from './NpcDirectiveFields.vue'
import NpcCheckReview from './NpcCheckReview.vue'
import type { NpcDirective } from '../core/ai-types'
import { automaticDamageItem } from '../core/combat-items'
import { findItem } from '../core/runtime'
const props = defineProps<{ view: RoomView; intent: Intent; busy: boolean }>()
const practicalTask=computed(()=>props.view.practicalReview?.tasks.find(t=>t.sourceId===props.intent.id&&['needs-gm','needs-fact'].includes(t.status)))
const practicalReason=computed(()=>practicalTask.value?.reason)
const itemCost = ref<'action' | 'bonus' | 'free'>(props.intent.adjudication?.itemCost ?? 'action')
const manualItem = computed(() => {
  const action = props.intent.action
  if (
    action.kind !== 'map' ||
    action.command.type !== 'combat' ||
    action.command.command.type !== 'item-use'
  )
    return false
  const cmd = action.command.command
  const actor = props.view.world?.encounters
    .find((e) => e.id === props.view.encounter?.id)
    ?.actors.find((a) => a.id === cmd.actorId)
  const c = props.view.world?.characters.find((c) => c.id === actor?.characterId)
  const row = c?.inventory.find((r) => r.instanceId === cmd.instanceId)
  return (
    !!c &&
    !!row &&
    !automaticDamageItem(findItem(c, catalogue([srd, ...props.view.packs]), row.itemId))
  )
})
const reviewIntent = computed(() => {
  const i = clone(props.intent)
  if (
    manualItem.value &&
    i.action.kind === 'map' &&
    i.action.command.type === 'combat' &&
    i.action.command.command.type === 'item-use'
  )
    i.action.command.command.manualCost = itemCost.value
  return i
})
const npcDirective = ref<NpcDirective>(
  clone(props.intent.action.kind === 'npc' ? props.intent.action.directive : { kind: 'none' }),
)
const emit = defineEmits<{ review: [command: RoomCommand] }>()
const npcJob = computed(() =>
  props.intent.action.kind === 'npc'
    ? props.view.ai.jobs.find(
        (j) => j.id === (props.intent.action as { conversationId: string }).conversationId,
      )
    : undefined,
)
const pendingNpcCheck = computed(
  () => !!npcJob.value?.checkSuggestion && !npcJob.value.check?.adjudicated,
)
const gm = computed(() => props.view.self.role === 'gm'),
  b = computed(() =>
    props.intent.action.kind === 'map' && props.intent.action.command.type === 'combat'
      ? props.intent.action.command.command
      : null,
  ),
  targetEditable = computed(() => b.value?.type === 'cast' || b.value?.type === 'feature'),
  encounter = computed(() =>
    props.view.world?.encounters.find((e) => e.id === props.view.encounter?.id),
  ),
  grant = computed(() => {
    if (b.value?.type !== 'cast') return null
    const actorId = b.value.actorId,
      key = b.value.key,
      actor = encounter.value?.actors.find((a) => a.id === actorId),
      c = props.view.world?.characters.find((c) => c.id === actor?.characterId)
    return c
      ? runtimeSpells(c, catalogue([srd, ...props.view.packs])).find((g) => g.key === key)
      : null
  }),
  policy = computed(() =>
    grant.value
      ? spellTargets(
          grant.value.spell,
          grant.value.key,
          props.view.world?.characters.find(
            (c) =>
              c.id ===
              encounter.value?.actors.find(
                (a) => a.id === (b.value && 'actorId' in b.value ? b.value.actorId : ''),
              )?.characterId,
          )?.level ?? 1,
          b.value?.type === 'cast'
            ? (castSlotLevel(b.value.mode) || grant.value.spell.level || 1) +
                (b.value.metamagic?.option === 'twinned' ? 1 : 0)
            : 1,
        )
      : null,
  ),
  multi = computed(() =>
    b.value?.type === 'cast'
      ? (policy.value?.max ?? 1) > 1
      : b.value?.type === 'feature' && b.value.id === 'breath',
  ),
  choices = computed(
    () =>
      props.view.encounter?.actors.filter(
        (a) =>
          props.view.members.find((m) => m.id === props.intent.sessionId)?.role === 'gm' ||
          props.view.scene?.tokens.some((t) => t.actorId === a.id && !t.hidden),
      ) ?? [],
  )
const env = ref(clone(props.view.environment)),
  mapOptions = ref<MapCombatOptions>({
    distance: true,
    highGround: true,
    obstacles: true,
    cover: true,
    area: true,
    reason: '',
  }),
  reviewScene = ref<MapScene | null>(null),
  selected = ref<string[]>([]),
  perTarget = ref<Record<string, Environment>>({}),
  confirmed = ref(false),
  reason = ref('GM 已检查角色、目标及环境条件'),
  dirty = ref(false)
const preview = computed(() =>
    previewIntent(
      props.view,
      reviewIntent.value,
      env.value,
      targetEditable.value ? selected.value : undefined,
      perTarget.value,
      mapOptions.value,
    ),
  ),
  needsConfirmation = computed(() => !!preview.value?.confirmations.length),
  blocked = computed(
    () =>
      pendingNpcCheck.value ||
      !!preview.value?.blockers.length ||
      (needsConfirmation.value && !confirmed.value),
  ),
  selfOnly = computed(
    () => policy.value?.self || (b.value?.type === 'feature' && featureSelf(b.value.id)),
  )
watch(
  () => props.intent.id,
  () => {
    const cmd = b.value
    selected.value =
      props.intent.adjudication?.targets ??
      (cmd?.type === 'cast'
        ? [...cmd.targets]
        : cmd?.type === 'feature'
          ? cmd.targets?.length
            ? [...cmd.targets]
            : [cmd.targetId]
          : [])
    env.value = clone(props.intent.adjudication?.environment ?? props.view.environment)
    if (cmd && 'env' in cmd && cmd.env?.note && !env.value.note) env.value.note = cmd.env.note
    confirmed.value = false
    dirty.value = false
    perTarget.value = clone(props.intent.adjudication?.targetEnvironments ?? {})
    mapOptions.value = {
      distance: true,
      highGround: true,
      obstacles: true,
      cover: true,
      area: true,
      reason: '',
      ...(props.intent.action.kind === 'map' &&
      props.intent.action.command.type === 'combat' &&
      props.intent.action.command.options?.template
        ? { template: clone(props.intent.action.command.options.template) }
        : {}),
      ...props.intent.adjudication?.mapOptions,
    }
    reviewScene.value = clone(
      props.view.world?.adventures[0]?.scenes.find((s) => s.id === props.view.scene?.id) ?? null,
    )
    if (reviewScene.value && mapOptions.value.template)
      reviewScene.value.template = clone(mapOptions.value.template)
  },
  { immediate: true },
)
watch(
  () => reviewScene.value?.template,
  (t) => {
    if (t) mapOptions.value.template = clone(t)
    else delete mapOptions.value.template
    confirmed.value = false
  },
  { deep: true },
)
function buildReviewTemplate() {
  const cmd = b.value,
    scene = reviewScene.value
  if (!scene || !cmd || !('actorId' in cmd)) return
  const from = scene.tokens.find((t) => t.actorId === cmd.actorId),
    spec = grant.value
      ? spellAreaSpec(grant.value.spell)
      : cmd.type === 'feature' && cmd.id === 'breath'
        ? { shape: 'cone' as const, size: 15, range: 0, self: true }
        : null
  if (!from || !spec) return
  const target = scene.tokens.find((t) => t.actorId === selected.value[0])
  scene.template = makeAreaTemplate(scene.grid, spec.self ? from : (target ?? from), spec)
}
watch(
  () => JSON.stringify(props.view.environment),
  () => {
    if (!dirty.value) env.value = clone(props.view.environment)
  },
)
watch(
  () => JSON.stringify(selected.value),
  () => (confirmed.value = false),
)
function review(approve: boolean) {
  emit('review', {
    kind: 'intent-review',
    intentId: props.intent.id,
    approve,
    reason: reason.value.trim(),
    ...(approve
      ? {
          environment: env.value,
          ...(manualItem.value ? { itemCost: itemCost.value } : {}),
          ...(props.intent.action.kind === 'npc'
            ? { npcDirective: clone(npcDirective.value) }
            : {}),
          ...(b.value ? { mapOptions: mapOptions.value } : {}),
          ...(targetEditable.value
            ? {
                targets: selected.value,
                targetEnvironments: Object.fromEntries(
                  Object.entries(perTarget.value).filter(([id]) => selected.value.includes(id)),
                ),
              }
            : {}),
        }
      : {}),
  })
}
function targetOverride(id: string, enabled: boolean) {
  if (enabled) perTarget.value[id] = clone(env.value)
  else delete perTarget.value[id]
  dirty.value = true
}
function environmentChanged() {
  dirty.value = true
  confirmed.value = false
}
const covers = {
  none: '无掩护',
  half: '半掩护',
  'three-quarters': '四分之三掩护',
  total: '完全掩护',
}
</script>
<template>
  <article class="room-intent" :data-intent-id="intent.id">
    <ReviewEvidence
      :view="view"
      :intent-id="intent.id"
      :busy="busy"
      @command="emit('review', $event)"
    />
    <label v-if="gm && intent.status === 'pending' && manualItem"
      >{{ controlText('interactionField.gmItemActionRuling') }}<select v-model="itemCost" @change="environmentChanged">
        <option value="action">{{ controlText('controls.action') }}</option>
        <option value="bonus">{{ controlText('controls.bonus') }}</option>
        <option value="free">{{ controlText('domain.free') }}</option>
      </select></label
    >
    <strong>{{ intent.summary }}</strong
    ><small
      >{{ controlText('progressSummary.worldRevision', {p0:(view.members.find((m) => m.id === intent.sessionId)?.nickname ?? controlText('expressionThree.revokedMember')),p1:(intent.source),p2:(intent.status === 'pending'
          ? controlText('expressionThree.pendingReview')
          : intent.status === 'approved'
            ? controlText('domain.approved')
            : intent.status === 'withdrawn'
              ? controlText('expressionThree.withdrawn')
              : intent.status === 'stale'
                ? controlText('state.stale')
                : controlText('domain.rejected')),p3:(intent.baseWorldRevision)}) }}</small
    >
    <template v-if="gm && npcJob">
      <p>{{ controlText('progressSummary.publishedDialogueThisCardReviewsConsequencesOnly', {p0:(npcJob.text)}) }}</p>
      <p v-if="npcJob.dialogueReview?.audit" class="muted">{{ controlText('progressSummary.dialogueAiReviewAttemptsMsThisResult', {p0:(npcJob.dialogueReview.audit.status === 'passed' ? controlText('controls.approve') : controlText('expressionThree.transferredToManualHandlingOrReferenceOnly')),p1:(npcJob.dialogueReview.audit.reason),p2:(npcJob.dialogueReview.audit.calls),p3:(npcJob.dialogueReview.audit.durationMs ?? '—')}) }}</p>
      <NpcCheckReview
        v-if="pendingNpcCheck && intent.status === 'pending'"
        :job="npcJob"
        :busy="busy"
        @command="emit('review', $event)"
      />
    </template>
    <p v-if="gm&&practicalReason" role="status">{{ controlText('interactionField.automaticHandlingAwaitingVerification') }}{{practicalReason}} <button :disabled="busy" @click="emit('review',{kind:'practical-recheck',taskId:practicalTask!.id})">{{ controlText('adjudication.factsSuppliedRecheckOriginalRequest') }}</button></p>
    <div v-if="gm && preview" class="room-intent-summary">
      <p><strong>{{ controlText('adjudication.actor') }}</strong>{{ preview.actor || controlText('expressionThree.sceneOperation') }}</p>
      <p>
        <strong>{{ controlText('adjudication.actionAndSource') }}</strong>{{ preview.source
        }}<span v-if="preview.page"> · SRD p.{{ preview.page }}</span>
      </p>
      <p><strong>{{ controlText('adjudication.expectedCost') }}</strong>{{ preview.costs.join('；') || controlText('expressionThree.existingRulesAreCheckedDuringExecution') }}</p>
      <ul v-if="preview.targets.length">
        <li v-for="t in preview.targets" :key="t.id">
          {{ controlText('controls.target') }} {{ localizedEntryName(t) }}{{ t.distance === null ? '' : controlText('expressionThree.mapDistance') + t.distance + controlText('expressionOne.ft') }} ·
          {{ uiLabel(covers[t.environment.cover]) }} ·
          {{ t.environment.attackerSees ? controlText('expressionThree.actorCanSeeTarget') : controlText('expressionThree.actorCannotSeeTarget')
          }}{{ t.environment.advantage ? controlText('expressionThree.otherAdvantage') : ''
          }}{{ t.environment.disadvantage ? controlText('expressionThree.otherDisadvantage') : ''
          }}{{ t.environment.nearbyEnemy ? controlText('expressionThree.closeRangeInterference') : ''
          }}{{ t.high.length ? ' · ' + t.high.join('、') : '' }}
        </li>
      </ul>
      <p v-for="n in preview.notes" :key="n" class="muted">{{ n }}</p>
      <div v-if="intent.status === 'pending'">
        <NpcDirectiveFields
          v-if="intent.action.kind === 'npc'"
          v-model="npcDirective"
          :view="view"
          :npc-id="intent.action.npcId"
          @update:model-value="confirmed = false"
        />
        <p v-if="preview.blockers.length" class="room-review-blockers">{{ controlText('progressSummary.currentlyUnavailable', {p0:(preview.blockers.join('；'))}) }}
        </p>
        <template v-if="targetEditable">
          <p v-if="selfOnly">{{ controlText('adjudication.targetIsFixedToSelf') }}</p>
          <template v-else-if="policy?.darts"
            ><label v-for="(_, index) in selected" :key="index"
              >{{ controlText('interactionField.gmMissileOptions') }} {{ index + 1 }} {{ controlText('controls.target') }}<select
                v-model="selected[index]"
                :aria-label="controlText('expressionThree.gmMissileOptions') + (index + 1) + controlText('expressionTwo.target')"
              >
                <option v-for="a in choices" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
              </select></label
            ></template
          >
          <fieldset v-else-if="multi" class="room-targets">
            <legend>{{ controlText('progressSummary.gmFinalTargets', {p0:(selected.length)}) }}</legend>
            <label v-for="a in choices" :key="a.id" class="check"
              ><input v-model="selected" type="checkbox" :value="a.id" />{{ localizedEntryName(a) }}</label
            >
          </fieldset>
          <label v-else
            >{{ controlText('domain.gmFinalTarget') }}<select v-model="selected[0]" :aria-label="controlText('domain.gmFinalTarget')">
              <option v-for="a in choices" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
            </select></label
          >
        </template>
        <details class="room-review-environment" @input="environmentChanged">
          <summary>{{ controlText('adjudication.environmentAndTriggersForThisRuling') }}</summary>
          <p class="muted">
            {{ controlText('adjudication.theMapStillCalculatesDistanceAndHighGround') }}
          </p>
          <RoomEnvironmentFields v-model="env" />
          <template v-if="targetEditable"
            ><section v-for="t in preview.targets" :key="t.id" class="room-target-environment">
              <label class="check"
                ><input
                  type="checkbox"
                  :checked="!!perTarget[t.id]"
                  @change="targetOverride(t.id, ($event.target as HTMLInputElement).checked)"
                />{{ controlText('interactionField.for') }} {{ localizedEntryName(t) }} {{ controlText('interactionField.configureEnvironmentSeparately') }}</label
              ><RoomEnvironmentFields v-if="perTarget[t.id]" v-model="perTarget[t.id]!" /></section
          ></template>
        </details>
        <ul v-if="preview.confirmations.length" class="room-review-requirements">
          <li v-for="n in preview.confirmations" :key="n">{{ n }}</li>
        </ul>
        <label v-if="needsConfirmation" class="check"
          ><input v-model="confirmed" type="checkbox" />{{ controlText('interactionField.rulesConditionsAndFinalTargetsAboveAreVerified') }}</label
        >
        <div v-if="b" class="room-review-environment">
          <label class="check"
            ><input
              v-model="mapOptions.obstacles"
              type="checkbox"
              @change="confirmed = false"
            />{{ controlText('game.wallsSight') }}</label
          >
          <label class="check"
            ><input
              v-model="mapOptions.cover"
              type="checkbox"
              @change="confirmed = false"
            />{{ controlText('game.mapCover') }}</label
          >
          <label class="check"
            ><input
              v-model="mapOptions.area"
              type="checkbox"
              @change="confirmed = false"
            />{{ controlText('interactionField.checkWithStraightLineAreaTemplate') }}</label
          >
          <label
            v-if="!mapOptions.obstacles || mapOptions.cover === false || mapOptions.area === false"
            >{{ controlText('interactionField.wallDoorOverrideReason') }}<textarea
              v-model="mapOptions.reason"
              rows="2"
              maxlength="2000"
              :placeholder="controlText('interactionField.basisForSpecialSensesWallPassingEffectsOr')"
              @input="confirmed = false"
            />
          </label>
        </div>
        <details
          v-if="
            targetEditable &&
            reviewScene &&
            (policy?.area || (b?.type === 'feature' && b.id === 'breath'))
          "
          class="room-review-area"
        >
          <summary>{{ controlText('adjudication.areaOriginAndPropagationRuling') }}</summary>
          <p class="muted">{{ controlText('adjudication.thisTemplateAppliesWithApprovalEditingItsPreview') }}</p>
          <button class="secondary" @click="buildReviewTemplate">{{ controlText('adjudication.createAreaTemplateForThisEffect') }}</button>
          <TemplateEditor
            :scene="reviewScene"
            :cursor="{ x: 1, y: 1 }"
            :busy="busy"
            save-text="应用到本次审核"
            @save="confirmed = false"
          />
        </details>
        <p class="muted">
          {{ controlText('adjudication.thisPreviewsConditionsAndCostsOnlyNoDice') }}
        </p>
        <label>{{ controlText('interactionField.reviewNotes') }}<input v-model="reason" maxlength="2000" /></label>
        <div class="room-row">
          <button
            class="primary"
            :disabled="busy || !reason.trim() || blocked"
            @click="review(true)"
          >
            {{ controlText('adjudication.approveAndExecute') }}</button
          ><button class="secondary" :disabled="busy || !reason.trim()" @click="review(false)">
            {{ controlText('controls.reject') }}</button
          ><button
            v-if="preview.blockers.length"
            class="subtle"
            :disabled="busy"
            @click="reason = preview!.blockers.join('；')"
          >
            {{ controlText('adjudication.copyUnavailabilityReasonsIntoReviewNotes') }}
          </button>
        </div>
      </div>
    </div>
    <p v-if="intent.reason">{{ controlText('progressSummary.rulingNotes', {p0:(intent.reason)}) }}</p>
    <details>
      <summary>{{ controlText('adjudication.viewActionDetails') }}</summary>
      <pre>{{ JSON.stringify(intent.action, null, 2) }}</pre>
    </details>
  </article>
</template>
