<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import { computed, ref, watch } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { Catalogue } from '../../core/engine'
import type { MapCommand } from '../../core/map-types'
import type { ExplorationCommand } from '../../core/exploration-types'
import { explorationStats,explorationActor } from '../../core/exploration'
import { zoneAlive } from '../../core/ongoing-spells'
const props = defineProps<{ view: RoomView; content: Catalogue; busy: boolean }>()
const npcConcentrations=computed(()=>{const w=props.view.world,s=w?.adventures.flatMap(a=>a.scenes).find(s=>s.id===props.view.scene?.id);return w?s?.tokens.filter(t=>!t.characterId&&explorationActor(w,t).npc?.concentration?.pendingDC)??[]:[]})
const emit = defineEmits<{ command: [command: MapCommand] }>()
const roster = ref<string[]>([]),
  notes = ref<Record<string, string>>({})
const zonePositions = ref<Record<string, { x: number; y: number }>>({})
const x = computed(() => props.view.exploration),
  a = computed(() => props.view.world?.adventures[0]),
  scene = computed(() => props.view.scene)
const eligible = computed(
  () =>
    scene.value?.tokens.filter(
      (t) =>
        (t.characterId && a.value?.party.includes(t.characterId)) ||
        t.companionKey ||
        (t.npcId &&
          a.value?.ai?.npcs.some(
            (n) => n.id === t.npcId && n.enabled,
          )),
    ) ?? [],
)
watch(
  () => [x.value?.roundId, x.value?.members.map((m) => m.tokenId).join('|')].join(':'),
  () => (roster.value = x.value?.members.map((m) => m.tokenId) ?? []),
  { immediate: true },
)
function send(command: ExplorationCommand) {
  if (scene.value) emit('command', { type: 'explore', sceneId: scene.value.id, command })
}
const zones = computed(
  () =>
    props.view.world?.encounters.filter(
      (e) =>
        e.phase === 'ended' &&
        e.pending?.mode === 'zone' &&
        x.value?.triggers.some((t) => t.encounterId === e.id),
    ) ?? [],
)
const tokenName = (id: string) => scene.value?.tokens.find((t) => t.id === id)?.name ?? '已离场单位'
const remaining = (id: string, used: number, dash: number) => {
  const t = scene.value?.tokens.find((t) => t.id === id),
    w = props.view.world
  return Math.max(0, (t && w ? explorationStats(w, t, props.content).speed : 0) + dash - used)
}
const movableZones = computed(
  () =>
    props.view.world?.encounters
      .filter((e) => e.phase === 'ended' && e.session?.sceneId === scene.value?.id)
      .flatMap((e) =>
        (e.zones ?? []).flatMap((z) => {
          const c = props.view.world?.characters.find(
              (c) => c.id === e.actors.find((a) => a.id === z.sourceId)?.characterId,
            ),
            t = scene.value?.tokens.find((t) => t.characterId === c?.id)
          return z.spellId === 'cloud-of-daggers' && z.template && zoneAlive(z, c) && t
            ? [{ zone: z, tokenId: t.id, name: c!.build.name }]
            : []
        }),
      ) ?? [],
)
watch(
  movableZones,
  (rows) => {
    for (const { zone } of rows)
      zonePositions.value[zone.id] ??= { x: zone.template!.x, y: zone.template!.y }
  },
  { immediate: true },
)
</script>
<template>
  <section v-if="scene" class="room-card exploration-gm" :aria-label="controlText('field.gmExplorationRoundControls')">
    <div class="room-row">
      <h3>{{ controlText('operations.partyExplorationRounds') }}</h3>
      <span>{{
        x?.status === 'active'
          ? controlText('inlineSummary.roundFreePartyOrder',{p0:(x.round)})
          : x?.status === 'paused'
            ? controlText('expressionOne.pausedBudgetRetained')
            : controlText('controls.explore')
      }}</span>
    </div>
    <p class="muted">{{ controlText('workspace.aCompletedPartyRoundAdvances6SecondsPausing') }}</p>
    <div class="room-row">
      <button
        :disabled="busy || view.encounter?.phase === 'active'"
        @click="send({ operation: 'toggle', enabled: x?.status !== 'active' })"
      >
        {{
          x?.status === 'active'
            ? controlText('expressionOne.pauseExplorationRounds')
            : x?.status === 'paused'
              ? controlText('expressionOne.resumeExplorationRounds')
              : controlText('domain.startExploration')
        }}</button
      ><template v-if="x && x.status !== 'closed'"
        ><button
          class="secondary"
          :disabled="busy"
          @click="send({ operation: 'finish', close: false })"
        >
          {{ controlText('operations.gmFinishesAndAdvancesToNextRound') }}</button
        ><button
          class="secondary"
          :disabled="busy"
          @click="send({ operation: 'finish', close: true })"
        >
          {{ controlText('operations.finishExplorationRoundSceneTransferCombat') }}
        </button></template
      >
    </div>
    <details v-if="x && x.status !== 'closed'">
      <summary>{{ controlText('operations.explorationRosterAndIndividualBudgets') }}</summary>
      <div class="exploration-roster">
        <label v-for="t in eligible" :key="t.id" class="check"
          ><input v-model="roster" :value="t.id" type="checkbox" />{{ localizedEntryName(t) }}</label
        >
      </div>
      <button
        :disabled="busy || !roster.length"
        @click="send({ operation: 'roster', tokenIds: roster })"
      >
        {{ controlText('operations.confirmCurrentRoundRosterChangesRetainSpentBudget') }}
      </button>
      <div v-for="m in x.members" :key="m.tokenId" class="exploration-member">
        <strong>{{ tokenName(m.tokenId) }}</strong
        ><span
          >{{ controlText('quantity.actionBudget', {p0:(m.ended ? controlText('expressionOne.ended') : controlText('expressionOne.canAct')),p1:(remaining(m.tokenId, m.movement, m.dash)),p2:(m.action ? controlText('controls.enabledState') : controlText('controls.usedState')),p3:(m.bonus ? controlText('controls.enabledState') : controlText('controls.usedState')),p4:(m.reaction ? controlText('controls.enabledState') : controlText('controls.usedState'))}) }}</span
        ><button
          :disabled="busy || m.ended || x.status !== 'active'"
          @click="send({ operation: 'end', tokenId: m.tokenId, roundId: x.roundId })"
        >
          {{ controlText('operations.gmEndsThisCharacterSTurn') }}
        </button>
      </div>
    </details>
    <div v-for="t in npcConcentrations" :key="t.id" class="exploration-member">
      <strong>{{ controlText('quantity.pendingConcentration', {p0:(localizedEntryName(t))}) }}</strong>
      <button :disabled="busy" @click="send({operation:'concentration',tokenId:t.id})">{{ controlText('operations.resolveNpcConcentrationSave') }}</button>
    </div>
    <details v-if="movableZones.length">
      <summary>{{ controlText('operations.moveOngoingSpellArea') }}</summary>
      <p class="muted">
        {{ controlText('operations.moveCloudOfDaggersUpTo30Ft') }}
      </p>
      <div v-for="row in movableZones" :key="row.zone.id" class="exploration-member">
        <strong>{{ localizedEntryName(row) }} · {{ localizedEntryName(row.zone) }}</strong
        ><label
          >{{ controlText('field.areaDestinationX') }}<input
            v-model.number="zonePositions[row.zone.id]!.x"
            type="number"
            min="0"
            :max="scene.grid.columns - 1" /></label
        ><label
          >{{ controlText('field.areaDestinationY') }}<input
            v-model.number="zonePositions[row.zone.id]!.y"
            type="number"
            min="0"
            :max="scene.grid.rows - 1" /></label
        ><label>{{ controlText('field.areaMovementRuling') }}<input v-model="notes[row.zone.id]" maxlength="2000" /></label
        ><button
          :disabled="busy || !notes[row.zone.id]?.trim()"
          @click="
            send({
              operation: 'zone-move',
              tokenId: row.tokenId,
              zoneId: row.zone.id,
              to: zonePositions[row.zone.id]!,
              confirmed: true,
              note: notes[row.zone.id]!,
            })
          "
        >
          {{ controlText('operations.confirmAreaMovement') }}
        </button>
      </div>
    </details>
    <section v-if="x?.triggers.some((t) => !t.resolved)" :aria-label="controlText('field.explorationAreaAwaitingAdjudication')">
      <h4>{{ controlText('operations.ongoingAreaTriggerCandidates') }}</h4>
      <p class="muted">{{ controlText('workspace.verifyActualCoverageHeightAndSpellTimingJumping') }}</p>
      <div
        v-for="t in x.triggers.filter((t) => !t.resolved)"
        :key="t.id"
        class="exploration-member"
      >
        <strong
          >{{ tokenName(t.tokenId) }} ·
          {{
            t.phase === 'start' ? controlText('expressionOne.turnStart') : t.phase === 'end' ? controlText('expressionOne.turnEnd') : controlText('expressionOne.enterTouchArea')
          }}</strong
        ><span>{{
          localizedEntryName(view.world?.encounters
            .find((e) => e.id === t.encounterId)
            ?.zones?.find((z) => z.id === t.sourceId)) ?? controlText('expressionOne.areaEnded')
        }}</span
        ><label>{{ controlText('field.coverageTimingAndCheckRuling') }}<input v-model="notes[t.id]" maxlength="2000" /></label>
        <div class="room-row">
          <button
            :disabled="busy || !notes[t.id]?.trim()"
            @click="send({ operation: 'zone-roll', triggerId: t.id, note: notes[t.id]! })"
          >
            {{ controlText('operations.confirmTriggerAndGenerateSavesDamage') }}</button
          ><button
            class="secondary"
            :disabled="busy || !notes[t.id]?.trim()"
            @click="send({ operation: 'trigger', triggerId: t.id, note: notes[t.id]! })"
          >
            {{ controlText('operations.recordNoTriggerSeparatelyAdjudicated') }}
          </button>
        </div>
      </div>
    </section>
    <div v-for="e in zones" :key="e.id" class="exploration-member">
      <strong>{{ controlText('quantity.pendingDamage', {p0:(localizedEntryName(e.pending))}) }}</strong
      ><span
        >{{ e.pending?.damage.map((d) => d.roll.total + ' ' + d.type).join('；') }} ·
        {{
          e.pending?.targets
            .map(
              (t) =>
                (e.actors.find((a) => a.id === t.id)?.characterId
                  ? localizedEntryName(view.world?.characters.find(
                      (c) => c.id === e.actors.find((a) => a.id === t.id)?.characterId,
                    )?.build)
                  : '单位') +
                '：' +
                (t.roll ? '豁免 ' + t.roll.total + (t.hit ? ' 失败' : ' 成功') : '直接伤害'),
            )
            .join('；')
        }}</span
      ><button :disabled="busy" @click="send({ operation: 'zone-resolve', encounterId: e.id })">
        {{ controlText('operations.confirmThisAreaSDamage') }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.exploration-gm {
  margin-bottom: 16px;
}
.exploration-gm .room-row {
  gap: 8px;
  flex-wrap: wrap;
}
.exploration-roster {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0;
}
.exploration-member {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--muted);
  border-radius: 10px;
  margin-top: 10px;
}
.exploration-gm button {
  min-height: 44px;
}
</style>
