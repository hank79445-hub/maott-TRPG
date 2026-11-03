<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { computed, ref, watch } from 'vue'
import type { RoomCommand, RoomView } from '../online/protocol'
import {
  defaultSpatialPolicy,
  type NpcSpatialCommand,
  type SpatialProposal,
  type NpcSpatialTask,
} from '../persistence/npc-spatial-schema'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
const props = defineProps<{ view: RoomView; busy: boolean; quickReview?: boolean }>()
const emit = defineEmits<{ command: [RoomCommand] }>()
const ai = computed(() => props.view.world?.adventures[0]?.ai)
const npcs = computed(() => ai.value?.npcs.filter((n) => n.npcType === 'important') ?? [])
const npcId = ref(''),
  x = ref(0),
  y = ref(0),
  pointId = ref(''),
  operation = ref<'use' | 'toggle' | 'claim' | 'check'>('use'),
  itemIds = ref<string[]>([]),
  confirmItemCosts = ref(false)
const policy = ref(defaultSpatialPolicy()),
  confirmed = ref(false)
const npc = computed(() => npcs.value.find((n) => n.id === npcId.value))
watch(
  () => [npc.value?.id, JSON.stringify(npc.value?.spatialPolicy)],
  () => {
    policy.value = JSON.parse(JSON.stringify(npc.value?.spatialPolicy ?? defaultSpatialPolicy()))
    confirmed.value = false
  },
  { immediate: true },
)
watch(
  npcs,
  (rows) => {
    if (!rows.some((n) => n.id === npcId.value)) npcId.value = rows[0]?.id ?? ''
  },
  { immediate: true },
)
const report = computed(() =>
  props.view.npcSpatial?.npcId === npcId.value ? props.view.npcSpatial.observation : undefined,
)
const tasks = computed(() =>
  (ai.value?.spatialState?.tasks ?? [])
    .filter((t) =>
      props.quickReview ? !['completed', 'canceled'].includes(t.status) : t.npcId === npcId.value,
    )
    .slice(-20)
    .reverse(),
)
const plans = computed(() =>
  props.view.ai.jobs
    .filter(
      (j) =>
        j.spatialPlanning &&
        (!npcId.value || j.npcId === npcId.value) &&
        !['published', 'canceled'].includes(j.status),
    )
    .slice(-5),
)
const exits = computed(
  () =>
    props.view.world?.adventures[0]?.scenes.flatMap((s) =>
      s.points
        .filter((p) => p.kind === 'exit')
        .map((p) => ({ sceneId: s.id, pointId: p.id, label: s.name + ' · ' + p.name })),
    ) ?? [],
)
const point = computed(() => report.value?.points.find((p) => p.id === pointId.value))
const cat = computed(() => catalogue([srd, ...(props.view.world?.packs ?? [])]))
function target(t: NpcSpatialTask) {
  return props.view.world?.adventures[0]?.scenes
    .find((s) => s.id === t.sceneId)
    ?.points.find((p) => p.id === t.proposal.pointId)
}
function itemName(id: string) {
  return cat.value.items.find((i) => i.id === id)?.name ?? id
}
watch(npcId, () => {
  pointId.value = ''
  itemIds.value = []
  confirmItemCosts.value = false
})
watch(pointId, () => {
  itemIds.value = []
  confirmItemCosts.value = false
  operation.value =
    point.value?.kind === 'door'
      ? 'toggle'
      : point.value?.operations.includes('check')
        ? 'check'
        : 'use'
})
function command(c: NpcSpatialCommand) {
  emit('command', { kind: 'npc-spatial', command: c })
}
function propose(proposal: SpatialProposal) {
  if (report.value)
    command({
      operation: 'propose',
      npcId: npcId.value,
      receipt: crypto.randomUUID(),
      observation: report.value.version,
      proposal,
    })
}
function exitKnown(k: { sceneId: string; pointId: string }) {
  return policy.value.knownExits.some((v) => v.sceneId === k.sceneId && v.pointId === k.pointId)
}
function toggleExit(k: { sceneId: string; pointId: string }) {
  policy.value.knownExits = exitKnown(k)
    ? policy.value.knownExits.filter((v) => v.sceneId !== k.sceneId || v.pointId !== k.pointId)
    : [...policy.value.knownExits, { sceneId: k.sceneId, pointId: k.pointId }]
}
const names = {
  review: '待GM批准',
  ready: '待推进',
  paused: '已暂停',
  completed: '已完成',
  canceled: '已取消',
}
</script>

<template>
  <details v-if="view.self.role === 'gm'" class="room-card npc-spatial-panel" :open="quickReview">
    <summary>{{ controlText('knowledge.spatialAgent') }}{{ quickReview ? controlText('expressionTwo.taskReviewAndAdvancement') : '' }}</summary>
    <template v-if="!quickReview">
      <label
        >{{ controlText('domain.importantNpc') }}<select v-model="npcId" :aria-label="controlText('knowledge.spatialNpc')">
          <option value="">{{ controlText('game.choose') }}</option>
          <option v-for="n in npcs" :key="n.id" :value="n.id">{{ localizedEntryName(n) }}</option>
        </select></label
      >
      <template v-if="npc">
        <fieldset :disabled="busy">
          <legend>{{ controlText('knowledge.spatialPolicy') }}</legend>
          <div class="spatial-row">
            <label class="check"
              ><input v-model="policy.enabled" type="checkbox" />{{ controlText('knowledge.enableSpatial') }}</label
            ><label class="check"
              ><input v-model="policy.compactInput" type="checkbox" />{{ controlText('knowledge.compactInput') }}</label
            >
          </div>
          <div class="spatial-row">
            <label class="check"
              ><input v-model="policy.autoPlan" type="checkbox" />{{ controlText('knowledge.goalPlanning') }}</label
            ><label
              >{{ controlText('knowledge.planningLimit') }}<input
                v-model.number="policy.plansPerScene"
                type="number"
                min="1"
                max="6"
            /></label>
          </div>
          <div class="spatial-row">
            <label class="check"
              ><input v-model="policy.autoMove" type="checkbox" />{{ controlText('knowledge.safeMove') }}</label
            ><label class="check"
              ><input v-model="policy.independentTravel" type="checkbox" />{{ controlText('knowledge.independentTravel') }}</label
            ><label
              >{{ controlText('knowledge.taskSteps') }}<input v-model.number="policy.maxSteps" type="number" min="1" max="24"
            /></label>
          </div>
          <label
            >{{ controlText('knowledge.explorationGoal') }}<textarea
              v-model="policy.goal"
              maxlength="500"
              rows="2"
              :placeholder="controlText('knowledge.goalPlaceholder')"
            />
          </label>
          <details>
            <summary>{{ controlText('liveSummary.knownExit', {p0:(policy.knownExits.length),p1:(controlText('knowledge.knownExitGm'))}) }}</summary>
            <div class="spatial-exits">
              <label v-for="k in exits" :key="k.sceneId + k.pointId" class="check"
                ><input type="checkbox" :checked="exitKnown(k)" @change="toggleExit(k)" />{{
                  k.label
                }}</label
              >
            </div>
          </details>
          <label class="check"
            ><input
              v-model="confirmed"
              type="checkbox"
            />{{ controlText('knowledge.confirmSpatial') }}</label
          >
          <details><summary>{{ controlText('knowledge.practicalSpatial') }}</summary>
            <button type="button" @click="policy.practical??={enabled:false,pointIds:[],operations:['use','toggle','check'],travel:false,itemLimits:[],resourceLimits:[]}">{{ controlText('knowledge.authorizationScope') }}</button>
            <template v-if="policy.practical">
              <label><input v-model="policy.practical.enabled" type="checkbox">{{ controlText('knowledge.autoSelectedPoints') }}</label>
              <label>{{ controlText('game.point') }}<MapFieldPicker kind="point"><select v-model="policy.practical.pointIds" multiple><option v-for="p in view.world?.adventures[0]?.scenes.find(s=>s.id===npc?.sceneId)?.points??[]" :key="p.id" :value="p.id">{{localizedEntryName(p)}}</option></select></MapFieldPicker></label>
              <label v-for="operation in (['use','toggle','check','claim'] as const)" :key="operation"><input v-model="policy.practical.operations" type="checkbox" :value="operation">{{({use:controlText('domain.use'),toggle:controlText('domain.toggle'),check:controlText('domain.check'),claim:controlText('domain.claim')})[operation]}}</label>
              <label><input v-model="policy.practical.travel" type="checkbox">{{ controlText('knowledge.autoTravel') }}</label>
              <div v-for="(limit,index) in policy.practical.itemLimits" :key="index"><label>{{ controlText('knowledge.itemLimit') }}<select v-model="limit.itemId"><option v-for="item in catalogue([srd,...(view.world?.packs??[])]).items" :key="item.id" :value="item.id">{{localizedEntryName(item)}}</option></select><input v-model.number="limit.quantity" type="number" min="1" max="1000"></label><button type="button" @click="policy.practical.itemLimits.splice(index,1)">{{ controlText('knowledge.removeItemLimit') }}</button></div>
              <button type="button" @click="policy.practical.itemLimits.push({itemId:'torch',quantity:1})">{{ controlText('knowledge.addItemLimit') }}</button>
              <div v-for="(limit,index) in policy.practical.resourceLimits" :key="'resource'+index"><label>{{ controlText('knowledge.resourceId') }}<input v-model="limit.id" maxlength="120"></label><label>{{ controlText('knowledge.singleLimit') }}<input v-model.number="limit.amount" type="number" min="1" max="100"></label><button type="button" @click="policy.practical.resourceLimits.splice(index,1)">{{ controlText('knowledge.removeResourceLimit') }}</button></div>
              <button type="button" @click="policy.practical.resourceLimits.push({id:'',amount:1})">{{ controlText('knowledge.addResourceLimit') }}</button>
              <p class="muted">{{ controlText('knowledge.resourcePermissionHelp') }}</p>
            </template>
          </details>
          <button
            type="button"
            :disabled="!confirmed"
            @click="command({ operation: 'configure', npcId, policy })"
          >
            {{ controlText('knowledge.saveSpatial') }}
          </button>
        </fieldset>
        <div class="spatial-row">
          <button
            type="button"
            :disabled="busy || !npc.spatialPolicy?.enabled"
            @click="command({ operation: 'observe', npcId })"
          >
            {{ controlText('knowledge.refreshObservation') }}</button
          ><button
            type="button"
            :disabled="busy || !npc.spatialPolicy?.enabled"
            @click="command({ operation: 'plan', npcId })"
          >
            {{ controlText('knowledge.generateGoalPlan') }}
          </button>
        </div>
        <p class="muted">
          {{ controlText('knowledge.spatialExecutionHelp') }}
        </p>
        <details>
          <summary>{{ controlText('knowledge.mcpKey') }}</summary>
          <label
            >{{ controlText('knowledge.bindingNoToken') }}<textarea
              readonly
              rows="4"
              :value="
                JSON.stringify(
                  { roomId: view.id, npcId, branchId: view.broadcast.branchId },
                  null,
                  2,
                )
              "
            />
          </label>
          <p class="muted">{{ controlText('knowledge.adapterHelp') }}</p>
        </details>
        <p v-if="report && !report.available">{{ controlText('knowledge.noBody') }}</p>
        <div v-if="report?.available" class="spatial-observation">
          <p>{{ controlText('liveSummary.positionPerceptibleCharactersInteractionsLastSeen', {p0:(report.own?.x),p1:(report.own?.y),p2:(report.units.length),p3:(report.points.length),p4:(report.lastSeen.length)}) }}
          </p>
          <div class="spatial-row">
            <label>X<input v-model.number="x" type="number" min="0" max="79" /></label
            ><label>Y<input v-model.number="y" type="number" min="0" max="79" /></label
            ><button
              type="button"
              :disabled="busy"
              @click="propose({ kind: 'move', destination: { x, y } })"
            >
              {{ controlText('knowledge.proposeDestination') }}
            </button>
          </div>
          <div class="spatial-row">
            <label
              >{{ controlText('knowledge.visiblePoints') }}<MapFieldPicker kind="point"><select v-model="pointId">
                <option value="">{{ controlText('game.chooseTarget') }}</option>
                <option v-for="p in report.points" :key="p.id" :value="p.id">
                  {{ localizedEntryName(p) }} · {{ p.distance }}{{ controlText('game.feet') }}
                </option>
              </select></MapFieldPicker></label
            ><label
              >{{ controlText('game.operation') }}<select v-model="operation">
                <option value="use">{{ controlText('controls.use') }}</option>
                <option value="toggle">{{ controlText('controls.toggle') }}</option>
                <option value="check">{{ controlText('controls.check') }}</option>
                <option value="claim">{{ controlText('controls.claim') }}</option>
              </select></label
            ><button
              type="button"
              :disabled="busy || !point || point.kind === 'exit'"
              @click="
                propose({
                  kind: 'interact',
                  pointId,
                  operation,
                  itemIds: [...new Set(itemIds)],
                  confirmItemCosts,
                })
              "
            >
              {{ controlText('knowledge.proposeInteraction') }}</button
            ><button
              type="button"
              :disabled="busy || point?.kind !== 'exit'"
              @click="
                propose({
                  kind: 'travel',
                  pointId,
                  operation,
                  itemIds: [...new Set(itemIds)],
                  confirmItemCosts,
                })
              "
            >
              {{ controlText('knowledge.proposeExit') }}
            </button>
          </div>
          <details v-if="report.own?.supplies.items.length">
            <summary>{{ controlText('knowledge.availableOwnItems') }}</summary>
            <label v-for="item in report.own.supplies.items" :key="item.id" class="check"
              ><input v-model="itemIds" type="checkbox" :value="item.itemId" />{{ localizedEntryName(item) }} ×{{
                item.quantity
              }}</label
            ><label class="check"
              ><input
                v-model="confirmItemCosts"
                type="checkbox"
              />{{ controlText('knowledge.confirmItemCost') }}</label
            >
          </details>
          <p v-if="report.own?.supplies.truncated" class="muted">
            {{ controlText('knowledge.itemSummaryLimit') }}
          </p>
          <details>
            <summary>{{ controlText('knowledge.observationDetails') }}</summary>
            <p v-for="u in report.units" :key="u.id">{{ localizedEntryName(u) }}（{{ u.x }},{{ u.y }}）</p>
            <p v-for="p in report.points" :key="p.id">
              {{ localizedEntryName(p) }}（{{ p.x }},{{ p.y }}） · {{ p.state }}
            </p>
            <p v-for="s in report.lastSeen" :key="s.id">
              {{ controlText('liveSummary.lastSeenAtNotCurrentlyPerceptible', {p0:(localizedEntryName(s)),p1:(s.x),p2:(s.y)}) }}</p>
          </details>
        </div>
        <div v-for="j in plans" :key="j.id" class="spatial-task">
          <strong>{{ controlText('liveSummary.privateExplorationPlan', {p0:(j.status)}) }}</strong>
          <p>{{ j.error || j.reason || controlText('expressionTwo.waitingForModelTarget') }}</p>
          <button
            type="button"
            :disabled="busy"
            @click="command({ operation: 'cancel-plan', jobId: j.id })"
          >
            {{ controlText('knowledge.cancelPlan') }}
          </button>
        </div>
      </template>
    </template>
    <article v-for="t in tasks" :key="t.id" class="spatial-task">
      <strong>{{ localizedEntryName(npcs.find((n) => n.id === t.npcId)) }} · {{ uiLabel(names[t.status]) }}</strong>
      <p v-if="t.proposal.kind === 'move'">{{ controlText('liveSummary.moveToTraveledStepsFtBudgetFt', {p0:(t.proposal.destination?.x),p1:(t.proposal.destination?.y),p2:(t.steps),p3:(t.spentFeet),p4:(t.maxFeet)}) }}</p>
      <template v-else
        ><p>
          {{ t.proposal.kind === 'interact' ? controlText('domain.interaction') : controlText('expressionTwo.independentTravel') }} ·
          {{ localizedEntryName(target(t)) ?? controlText('expressionTwo.targetChanged') }} · {{ t.proposal.operation ?? controlText('expressionTwo.throughExit') }}
        </p>
        <p v-if="target(t)?.check">{{ controlText('liveSummary.checkDc', {p0:(target(t)?.check?.id),p1:(target(t)?.check?.dc)}) }}
        </p>
        <p v-if="t.proposal.itemIds?.length">{{ controlText('liveSummary.selectedItems', {p0:(t.proposal.itemIds.map(itemName).join('、')),p1:(t.proposal.confirmItemCosts ? controlText('expressionTwo.possibleConsumptionConfirmed') : controlText('expressionTwo.consumptionUnconfirmed'))}) }}
        </p>
        <p v-for="r in target(t)?.itemUse?.requirements ?? []" :key="r.itemId">{{ controlText('liveSummary.condition', {p0:(itemName(r.itemId)),p1:(r.quantity),p2:({ possess: controlText('finalField.possess'), use: controlText('finalField.notConsumedOnUse'), attempt: controlText('authoringFlow.consumeOnAttempt'), success: controlText('finalField.consumedOnSuccess') }[
              r.mode
            ])}) }}
        </p></template
      >
      <p>{{ t.reason }}</p>
      <p v-if="t.outcome">{{ controlText('liveSummary.confirmedResult', {p0:(t.outcome.success === false
            ? controlText('expressionTwo.checkFailed')
            : t.outcome.success === true
              ? controlText('controls.success')
              : controlText('expressionTwo.flowHandledVerifyTargetState')),p1:(t.outcome.state ? ' · ' + t.outcome.state : '')}) }}
      </p>
      <div v-if="!['completed', 'canceled'].includes(t.status)" class="spatial-row">
        <button
          v-if="!t.approved"
          type="button"
          :disabled="busy"
          @click="command({ operation: 'approve', taskId: t.id })"
        >
          {{ controlText('knowledge.approveTask') }}</button
        ><button
          v-if="t.status === 'paused' && t.approved"
          type="button"
          :disabled="busy"
          @click="command({ operation: 'resume', taskId: t.id })"
        >
          {{ controlText('domain.restore') }}</button
        ><button
          v-if="t.status === 'ready'"
          type="button"
          :disabled="busy"
          @click="command({ operation: 'advance', taskId: t.id })"
        >
          {{ t.proposal.kind === 'move' ? controlText('expressionTwo.advanceOneStep') : controlText('expressionTwo.executeApprovedAction') }}</button
        ><button
          v-if="t.status === 'ready'"
          type="button"
          :disabled="busy"
          @click="command({ operation: 'pause', taskId: t.id })"
        >
          {{ controlText('controls.pause') }}</button
        ><button
          type="button"
          :disabled="busy"
          @click="command({ operation: 'cancel', taskId: t.id })"
        >
          {{ controlText('knowledge.cancelTask') }}
        </button>
      </div>
    </article>
    <p v-if="!tasks.length" class="muted">{{ controlText('knowledge.noSpatialTasks') }}</p>
  </details>
</template>

<style scoped>
.npc-spatial-panel {
  min-width: 0;
}
.npc-spatial-panel summary {
  cursor: pointer;
}
.npc-spatial-panel label:not(.check) {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.npc-spatial-panel .check {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  line-height: 1.5;
  height: auto;
  min-height: 44px;
  margin: 0.35rem 0;
}
.npc-spatial-panel .check input {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-top: 0.2rem;
}
.spatial-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.6rem;
  margin: 0.7rem 0;
}
.spatial-row input[type='number'] {
  width: 6rem;
}
.spatial-row select {
  max-width: 100%;
  width: 16rem;
}
.spatial-exits {
  display: grid;
  gap: 0.45rem;
  max-height: 14rem;
  overflow: auto;
}
.spatial-task {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  padding: 0.75rem;
  margin: 0.65rem 0;
}
.spatial-task p {
  margin: 0.4rem 0;
  overflow-wrap: anywhere;
}
fieldset {
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 0.75rem 0;
  padding: 0.75rem;
}
.npc-spatial-panel textarea {
  width: 100%;
  box-sizing: border-box;
}
button {
  min-height: 44px;
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  color: var(--ink);
}
@media (max-width: 600px) {
  .spatial-row select {
    width: 100%;
  }
  .spatial-row > label {
    flex: 1 1 130px;
  }
  .spatial-row > button {
    flex: 1 1 130px;
  }
}
</style>
