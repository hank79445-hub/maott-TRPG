<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { computed, ref } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { SceneEffectAction } from '../../persistence/scene-effects-schema'
const props = defineProps<{
  view: RoomView
  busy: boolean
  actorId: string
  point: { x: number; y: number; height: number }
}>()
const emit = defineEmits<{ action: [SceneEffectAction] }>()
const angle = ref(0),
  remoteDistance = ref<number>(),
  triggerId = ref(''),
  triggerEvent = ref<'touch' | 'open' | 'uncover' | 'speak' | 'gm'>('gm'),
  text = ref('')
const gm = computed(() => props.view.self.role === 'gm'),
  all = computed(
    () =>
      props.view.world?.adventures[0]?.sceneEffects?.regions.filter(
        (e) => e.status === 'active' && e.sceneId === props.view.scene?.id,
      ) ?? [],
  ),
  rows = computed(
    () =>
      props.view.scene?.sceneEffects?.regions.filter(
        (e) =>
          [
            'gust-of-wind',
            'moonbeam',
            'cloud-of-daggers',
            'flaming-sphere',
            'call-lightning',
            'conjure-animals',
            'tiny-hut',
          ].includes(e.spellId) &&
          (gm.value || e.sourceId === props.actorId),
      ) ?? [],
  )
function operation(effectId: string, kind: 'magic-move' | 'magic-strike') {
  emit('action', {
    operation: kind,
    effectId,
    actorId: props.actorId,
    to: props.point,
    ...(kind === 'magic-move' ? { angle: angle.value } : {}),
    note: '确认当前落点、原施法来源、真实距离与后续动作',
  })
}
function remoteEvents(effectId: string) {
  const state = props.view.world?.adventures[0]?.sceneEffects
  return (
    state?.events.filter(
      (ev) =>
        ev.effectId === effectId &&
        ev.receipt.startsWith(`device:${effectId}:`) &&
        !state.events.some((done) => done.receipt === `mental-delivery:${ev.id}`),
    ) ?? []
  )
}
</script>
<template>
  <details v-if="rows.length || (gm && all.length)" class="magic-operations">
    <summary>{{ controlText('adjudication.persistentAreasMovementDirectionAndDevices') }}</summary>
    <p class="muted">{{ controlText('adjudication.useThePickerAboveForActualDestinationsThe') }}</p>
    <label>{{ controlText('interactionField.windDirectionDegrees') }}<input v-model.number="angle" type="number" min="-360" max="360" /></label>
    <article v-for="e in rows" :key="e.id">
      <strong>{{ localizedEntryName(e) }}</strong
      ><template v-if="e.sourceId === actorId"
        ><template v-if="e.spellId === 'tiny-hut'"
          ><button
            :disabled="busy"
            @click="
              emit('action', {
                operation: 'hut-light',
                effectId: e.id,
                actorId,
                light: 'dim',
                note: '来源调整小屋内部微光',
              })
            "
          >
            {{ controlText('adjudication.dimLightInside') }}</button
          ><button
            :disabled="busy"
            @click="
              emit('action', {
                operation: 'hut-light',
                effectId: e.id,
                actorId,
                light: 'dark',
                note: '来源调整小屋内部黑暗',
              })
            "
          >
            {{ controlText('adjudication.darknessInside') }}
          </button></template
        ><button
          v-else
          :disabled="busy"
          @click="operation(e.id, e.spellId === 'call-lightning' ? 'magic-strike' : 'magic-move')"
        >
          {{
            e.spellId === 'call-lightning'
              ? controlText('expressionFour.magicActionLightningAgain')
              : e.spellId === 'gust-of-wind'
                ? controlText('expressionFour.bonusActionChangeDirection')
                : e.spellId === 'flaming-sphere'
                  ? controlText('expressionFour.bonusActionRollRam')
                  : e.spellId === 'conjure-animals'
                    ? controlText('expressionFour.moveSpiritGroupWithMeThisTurn')
                    : controlText('expressionFour.magicActionMoveArea')
          }}
        </button></template
      >
    </article>
    <template v-if="gm"
      ><article v-for="e in all.filter((e) => e.legacy && !e.magic?.migrated)" :key="e.id">
        <strong>{{ controlText('progressSummary.legacyExecutor', {p0:(localizedEntryName(e))}) }}</strong
        ><button
          :disabled="busy || e.requiresGeometry"
          @click="
            emit('action', {
              operation: 'adopt-zone',
              effectId: e.id,
              note: 'GM确认原窗口完成，移交唯一执行权并保留已触发记录',
            })
          "
        >
          {{ controlText('adjudication.transferExecutionControlDoNotRerollHistory') }}
        </button>
      </article>
      <article v-for="e in all.filter((e) => e.spellId === 'magic-circle')" :key="e.id">
        <strong>{{ controlText('progressSummary.teleportationReview', {p0:(localizedEntryName(e))}) }}</strong
        ><button
          :disabled="busy || !triggerId"
          @click="
            emit('action', {
              operation: 'magic-cross',
              effectId: e.id,
              actorId: triggerId,
              to: point,
              note: 'GM确认真实传送目的地，先处理法阵魅力豁免',
            })
          "
        >
          {{ controlText('authoringFlow.adjudicateTeleportationPassageForSelectedCharacter') }}
        </button>
      </article>
      <label
        >{{ controlText('interactionField.characterTriggeringDevice') }}<select v-model="triggerId">
          <option value="">{{ controlText('authoringFlow.chooseActualCharacter') }}</option>
          <option
            v-for="t in view.scene?.tokens ?? []"
            :key="t.id"
            :value="t.characterId ?? t.npcId ?? t.actorId ?? t.id"
          >
            {{ localizedEntryName(t) }}
          </option>
        </select></label
      ><label
        >{{ controlText('interactionField.confirmedEvent') }}<select v-model="triggerEvent">
          <option value="gm">{{ controlText('authoringFlow.gmConfirmsComplexConditions') }}</option>
          <option value="touch">{{ controlText('adjudication.touch') }}</option>
          <option value="open">{{ controlText('adjudication.open') }}</option>
          <option value="uncover">{{ controlText('adjudication.uncover') }}</option>
          <option value="speak">{{ controlText('authoringFlow.speakPasswordWords') }}</option>
        </select></label
      ><label>{{ controlText('interactionField.originalWordsSpoken') }}<input v-model="text" maxlength="2000" autocomplete="off" /></label>
      <article
        v-for="e in all.filter((e) =>
          ['arcane-lock', 'alarm', 'magic-mouth', 'glyph-of-warding', 'gust-of-wind'].includes(
            e.spellId,
          ),
        )"
        :key="e.id"
      >
        <strong>{{ localizedEntryName(e) }}</strong
        ><button
          v-if="e.spellId === 'gust-of-wind'"
          :disabled="busy"
          @click="
            emit('action', {
              operation: 'wind-flames',
              effectId: e.id,
              note: '核实实际风中暴露和受保护火焰',
            })
          "
        >
          {{ controlText('authoringFlow.handleFlamesInWind') }}</button
        ><button
          v-else
          :disabled="busy || !triggerId"
          @click="
            emit('action', {
              operation: 'magic-trigger',
              effectId: e.id,
              entityId: triggerId,
              event: triggerEvent,
              text,
              note: 'GM确认实际触发事件及感知条件',
            })
          "
        >
          {{ controlText('authoringFlow.checkConfirmTrigger') }}
        </button>
        <template
          v-if="
            e.spellId === 'alarm' &&
            e.magic?.alarm === 'mental' &&
            !view.scene?.tokens.some(
              (t) => (t.characterId ?? t.npcId ?? t.actorId ?? t.id) === e.sourceId,
            )
          "
        >
          <label
            >{{ controlText('interactionField.gmVerifiesDistanceToCasterFt') }}<input
              v-model.number="remoteDistance"
              type="number"
              min="0"
              max="5280"
          /></label>
          <button
            v-for="ev in remoteEvents(e.id)"
            :key="ev.id"
            :disabled="busy || remoteDistance === undefined || !Number.isFinite(remoteDistance)"
            @click="
              emit('action', {
                operation: 'mental-alarm',
                effectId: e.id,
                eventId: ev.id,
                distance: remoteDistance!,
                note: 'GM核实跨场景真实距离后发送本次精神警报',
              })
            "
          >
            {{ controlText('authoringFlow.confirmCrossSceneMentalAlarm') }}
          </button>
        </template>
      </article></template
    >
  </details>
</template>
<style scoped>
.magic-operations article {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px;
  border-bottom: 1px solid var(--line);
}
.magic-operations label {
  display: inline-flex;
  gap: 6px;
  margin: 6px;
  max-width: 100%;
}
.magic-operations select,
.magic-operations input {
  min-width: 0;
  max-width: 100%;
}
</style>
