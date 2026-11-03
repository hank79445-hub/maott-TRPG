<script setup lang="ts">
import {displayFeedback} from '../feedback-presentation'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
import type { RoomView, RoomCommand } from '../../online/protocol'
import type { SceneEffectAction } from '../../persistence/scene-effects-schema'
import { catalogue } from '../../core/engine'
import { srd } from '../../content/srd'
import {
  resolutionAbilities,
  shieldCandidates,
  shieldModes,
} from '../../core/combat-resolution-options'
import type { CombatCommand } from '../../core/combat-types'
const props = defineProps<{ view: RoomView; busy: boolean }>(),
  emit = defineEmits<{ command: [RoomCommand] }>()
const pathText = ref<Record<string, string>>({}),
  ruling=ref<Record<string,string>>({}),
  safe = ref<Record<string, boolean>>({}),
  reactions = ref<Record<string, boolean>>({}),
  error = ref('')
const adventure = computed(() => props.view.world?.adventures[0]),
  cat = computed(() => catalogue([srd, ...(props.view.world?.packs ?? [])])),
  events = computed(() =>
    (adventure.value?.sceneEffects?.m5?.resolutions ?? []).filter(
      (r) => r.status === 'pending' || (r.status === 'resolved' && !!r.frame),
    ),
  ),
  moves = computed(() =>
    (adventure.value?.sceneEffects?.m5?.outcomes ?? []).filter(
      (r) => r.status === 'pending' && r.targetId,
    ),
  ),
  name = (id: string) =>
    props.view.scene?.tokens.find((t) => [t.id, t.actorId, t.characterId, t.npcId].includes(id))
      ?.name ?? '实际人物'
const concentration = (event: (typeof events.value)[number]) =>
  frame(event)?.actors.filter((a) =>
    a.characterId
      ? props.view.world?.characters.find((c) => c.id === a.characterId)?.runtime?.concentration
          ?.pendingDC
      : a.npc?.concentration?.pendingDC,
  ) ?? []
const frame = (event: (typeof events.value)[number]) =>
  event.encounterId
    ? props.view.world?.encounters.find((e) => e.id === event.encounterId)
    : event.frame
function send(action: SceneEffectAction) {
  emit('command', { kind: 'scene-effect', action })
}
function respond(eventId: string, c: CombatCommand) {
  if (!('actorId' in c)) return
  const base = {
    operation: 'm5-response' as const,
    eventId,
    actorId: c.actorId,
    key: '',
    mode: '',
    targetIndex: 0,
    defense: 'uncanny' as const,
    note: 'GM确认实际后续反应，保留原来源和费用',
  }
  if (c.type === 'reaction-shield') send({ ...base, response: 'shield', key: c.key, mode: c.mode })
  if (c.type === 'npc-reaction')
    send({ ...base, response: 'npc', key: c.abilityId, targetIndex: c.targetIndex })
  if (c.type === 'reaction-defense')
    send({ ...base, response: 'defense', targetIndex: c.targetIndex, defense: c.kind })
}
function move(id: string, skip = false) {
  try {
    const path = (pathText.value[id] ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const nums = s.split(',').map(Number)
        if (nums.length < 2 || nums.length > 3 || nums.some((n) => !Number.isFinite(n)))
          throw Error('路线请写成X,Y,高度；多个落点用英文分号分隔')
        return { x: nums[0]!, y: nums[1]!, height: nums[2] ?? 0 }
      })
    error.value = ''
    send({
      operation: 'm5-move',
      eventId: id,
      path,
      skip,
      reactionsConfirmed: !!reactions.value[id],
      safeRouteConfirmed: !!safe.value[id],
      note: 'GM确认实际路线、阻挡、区域及借机后果',
    })
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>
<template>
  <div v-if="view.self.role === 'gm' && (events.length || moves.length)" class="m5-review">
    <article v-for="event in events" :key="event.id">
      <strong
        >{{ controlText('progressSummary.actualFollowUpResolution', {p0:(localizedEntryName(adventure?.sceneEffects?.regions.find((e) => e.id === event.effectId)))}) }}</strong
      >
      <p>{{ name(event.actorId) }} → {{ event.targets.map((t) => name(t.id)).join('、') }}</p>
      <template v-if="frame(event)"
        ><p v-for="t in frame(event)?.pending?.targets ?? []" :key="t.id">
          {{ name(t.id) }}：{{
            t.roll ? controlText('inlineSummary.dTotal',{p0:(t.roll.dice.join('/')),p1:(t.roll.total)}) : controlText('expressionThree.automaticDamage')
          }}
          · {{ t.hit ? controlText('expressionThree.hitFailedSave') : controlText('expressionFour.missSuccessfulSave') }}
        </p>
        <p v-for="part in frame(event)?.pending?.damage ?? []" :key="part.type">
          {{ part.type }}：{{ part.roll.formula }} [{{ part.roll.dice.join(', ') }}]
          {{ part.roll.total }}
        </p>
        <div class="m5-review-actions">
          <template
            v-for="choice in resolutionAbilities(
              frame(event)!,
              view.world?.characters ?? [],
              cat,
            ).filter(
              (c) => c.command && ['npc-reaction', 'reaction-defense'].includes(c.command.type),
            )"
            :key="choice.key"
            ><button
              :disabled="busy || !!choice.reason"
              :title="choice.reason"
              @click="respond(event.id, choice.command!)"
            >
              {{ localizedEntryName(choice) }}{{ choice.reason ? ' · ' + choice.reason : '' }}
            </button></template
          >
          <template
            v-for="candidate in shieldCandidates(frame(event)!, view.world?.characters ?? [], cat)"
            :key="candidate.actor.id"
            ><template
              v-for="grant in shieldModes(candidate.actor, view.world?.characters ?? [], cat)"
              :key="grant.key"
              ><button
                v-for="mode in grant.modes"
                :key="mode"
                :disabled="busy || !!candidate.reason"
                :title="candidate.reason"
                @click="
                  respond(event.id, {
                    type: 'reaction-shield',
                    actorId: candidate.actor.id,
                    key: grant.key,
                    mode,
                    requirementsConfirmed: true,
                  })
                "
              >
                {{ controlText('progressSummary.shield', {p0:(name(candidate.actor.id)),p1:(mode)}) }}
              </button></template
            ></template
          >
          <button
            v-if="frame(event)?.pending?.reactionFrame"
            :disabled="busy"
            @click="
              send({
                operation: 'm5-response',
                eventId: event.id,
                actorId: frame(event)!.pending!.actorId,
                response: 'confirm-reaction',
                key: '',
                mode: '',
                targetIndex: 0,
                defense: 'uncanny',
                note: 'GM最终确认原反应施法',
              })
            "
          >
            {{ controlText('adjudication.confirmReactionAndReturnToOriginalAttack') }}
          </button>
          <button
            v-if="event.status === 'pending'"
            :disabled="busy || !!frame(event)?.pending?.reactionFrame"
            @click="
              send({
                operation: 'm5-resolve',
                eventId: event.id,
                note: 'GM最终确认伤害与法术后果，保留原骰组及费用',
              })
            "
          >
            {{ controlText('adjudication.confirmDamageAndSpellConsequences') }}
          </button>
          <button
            v-for="actor in concentration(event)"
            :key="'concentration:' + actor.id"
            :disabled="busy"
            @click="
              send({
                operation: 'm5-response',
                eventId: event.id,
                actorId: actor.id,
                response: 'concentration',
                key: '',
                mode: '',
                targetIndex: 0,
                defense: 'uncanny',
                note: 'GM处理本次实际伤害导致的专注豁免',
              })
            "
          >
            {{ controlText('progressSummary.concentrationSave', {p0:(name(actor.characterId ?? actor.npcId ?? actor.id))}) }}</button>
        </div>
      </template>
      <p class="muted">
        {{ controlText('adjudication.keepsOriginalSpellSlotsActionsAndDiceRepeated') }}
      </p>
      <details v-if="event.status==='pending'"><summary>{{ controlText('adjudication.terminateInvalidFollowUp') }}</summary><label>{{ controlText('interactionField.gmReason') }}<input v-model="ruling[event.id]" :placeholder="controlText('interactionField.recordTerminationReasonOriginalCostsAreNotRefunded')"></label><button :disabled="busy||!ruling[event.id]?.trim()" @click="send({operation:'m5-close',eventId:event.id,kind:'resolution',disposition:'canceled',note:ruling[event.id]!})">{{ controlText('adjudication.terminateUnresolvedFollowUpRetainCosts') }}</button></details>
    </article>
    <article v-for="event in moves" :key="event.id">
      <strong
        >{{ name(event.targetId!) }} ·
        {{ event.kind === 'pull' ? controlText('expressionFour.optionalPull') : event.kind === 'flee' ? controlText('expressionFour.moveAwayAsReaction') : controlText('operations.pushAway') }}
        {{ event.feet }}{{ controlText('game.feet') }}</strong
      >
      <p>{{ controlText('progressSummary.movedFtOrigin', {p0:(event.travel),p1:(event.from.x),p2:(event.from.y)}) }}</p>
      <label
        >{{ controlText('interactionField.cellByCellRouteXYHeightBlank') }}<input
          v-model="pathText[event.id]"
          placeholder="6,4,0;7,4,0" /></label
      ><template v-if="event.kind === 'flee'"
        ><label
          ><input
            v-model="safe[event.id]"
            type="checkbox"
          />{{ controlText('interactionField.safeRouteVerifiedToMoveAsFarAway') }}</label
        ><label
          ><input
            v-model="reactions[event.id]"
            type="checkbox"
          />{{ controlText('interactionField.requiredOpportunityAttacksAndTheirResolutionConfirmed') }}</label
        ></template
      >
      <div class="m5-review-actions">
        <button :disabled="busy" @click="move(event.id)">{{ controlText('adjudication.executeContinueActualDisplacement') }}</button
        ><button v-if="event.kind === 'pull'" :disabled="busy" @click="move(event.id, true)">
          {{ controlText('adjudication.declineThisPull') }}
        </button>
      </div>
      <details><summary>{{ controlText('adjudication.gmHandlesComplexRoutesInvalidConsequences') }}</summary><label>{{ controlText('interactionField.actualHandlingRecord') }}<input v-model="ruling[event.id]" :placeholder="controlText('interactionField.handleComplexRoutesWithExistingMapToolsFirst')"></label><div class="m5-review-actions"><button :disabled="busy||!ruling[event.id]?.trim()" @click="send({operation:'m5-close',eventId:event.id,kind:'movement',disposition:'manual-completed',note:ruling[event.id]!})">{{ controlText('adjudication.recordAsGmHandled') }}</button><button :disabled="busy||!ruling[event.id]?.trim()" @click="send({operation:'m5-close',eventId:event.id,kind:'movement',disposition:'canceled',note:ruling[event.id]!})">{{ controlText('adjudication.cancelInvalidConsequenceKeepOriginalDamage') }}</button></div><p class="muted">{{ controlText('adjudication.recordsTakeoverResultsOnlyDoesNotAutomaticallyMove') }}</p></details>
    </article>
    <p v-if="error" role="alert">{{ displayFeedback(error,'error') }}</p>
  </div>
</template>
<style scoped>
.m5-review {
  min-width: 0;
}
.m5-review article {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.6rem;
  margin: 0.5rem 0;
  overflow-wrap: anywhere;
}
.m5-review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.m5-review label {
  display: grid;
  gap: 0.25rem;
  margin: 0.4rem 0;
}
.m5-review label:has(input[type='checkbox']) {
  display: flex;
  align-items: center;
}
.m5-review input:not([type='checkbox']) {
  width: 100%;
  min-width: 0;
}
@media (max-width: 600px) {
  .m5-review button {
    min-height: 44px;
  }
}
</style>
