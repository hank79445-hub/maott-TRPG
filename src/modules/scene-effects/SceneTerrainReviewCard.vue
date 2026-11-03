<script setup lang="ts">
import {uiLabel} from '../ui-label'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import type { RoomView, RoomCommand } from '../../online/protocol'
import type { SceneEffects } from '../../persistence/scene-effects-schema'
const props = defineProps<{
  event: SceneEffects['hazards'][number]
  view: RoomView
  busy: boolean
}>()
const emit = defineEmits<{ command: [RoomCommand] }>()
const a = computed(() => props.view.world?.adventures[0]),
  effect = computed(() =>
    a.value?.sceneEffects?.regions.find((e) => e.id === props.event.effectId),
  ),
  target = computed(() =>
    props.view.scene?.tokens.find((t) =>
      [t.id, t.characterId, t.actorId, t.npcId].includes(props.event.entityId),
    ),
  )
const phases = {
  created: '区域出现',
  enter: '实际进入',
  start: '回合初',
  end: '回合末',
  spikes: '荆棘逐5尺伤害',
  moved:'区域移动',strike:'打击',trigger:'装置触发',burn: '燃烧蛛网回合初',
}
const previous = computed(() =>
  a.value?.sceneEffects?.hazards.some(
    (h) =>
      h.entityId === props.event.entityId &&
      h.status === 'pending' &&
      a.value!.sceneEffects!.hazards.indexOf(h) <
        a.value!.sceneEffects!.hazards.findIndex((h) => h.id === props.event.id),
  ),
)
const group = computed(() =>
  (a.value?.sceneEffects?.hazards ?? []).filter(
    (h) =>
      h.entityId === props.event.entityId &&
      h.turnKey === props.event.turnKey &&
      h.status === 'pending',
  ),
)
</script>
<template>
  <article class="terrain-review" v-if="view.self.role === 'gm'">
    <strong>{{ localizedEntryName(effect) ?? controlText('expressionFour.area') }} · {{ localizedEntryName(target) ?? controlText('expressionFour.actualCharacter') }}</strong>
    <p>
      {{ uiLabel(phases[event.phase])
      }}<span v-if="event.phase === 'spikes'">{{ controlText('progressSummary.traveled', {p0:(event.distance),p1:(controlText('game.feet'))}) }}</span
      ><span v-else-if="event.phase !== 'burn'"> · DC {{ event.magic?.dc??effect?.terrain?.dc }}</span>
    </p>
    <p class="muted">
      {{ controlText('authoringFlow.resultsUseActualStateResistancesAndTheRoom') }}
    </p>
    <template v-if="event.magic&&event.magic.decision===undefined&&!event.magic.rolled&&event.phase!=='trigger'"><button :disabled="busy" @click="emit('command',{kind:'scene-effect',action:{operation:'magic-decision',eventId:event.id,apply:true,note:'GM确认原施法者选择此可见目标'}})">{{ controlText('authoringFlow.affectThisTarget') }}</button><button :disabled="busy" @click="emit('command',{kind:'scene-effect',action:{operation:'magic-decision',eventId:event.id,apply:false,note:'明确跳过此目标，本回合不重复申请'}})">{{ controlText('authoringFlow.skipThisTarget') }}</button></template>
    <button v-if="event.magic?.rolled&&event.magic.push&&!event.success" :disabled="busy||previous" @click="emit('command',{kind:'scene-effect',action:{operation:'magic-push',eventId:event.id,note:'确认沿实际风向强制位移，遇到实体障碍／新后果停止'}})">{{ controlText('authoringFlow.resolve15FtForcedMovementAlongWindDirection') }}</button>
    <button v-else
      :disabled="busy || previous || event.status !== 'pending'||!!event.magic&&event.magic.decision===undefined&&event.phase!=='trigger'"
      @click="
        emit('command', {
          kind: 'scene-effect',
          action: { operation: 'hazard', eventId: event.id, note: 'GM确认实际区域触发与原时序' },
        })
      "
    >
      {{ previous ? controlText('expressionFour.handleThisCharacterSEarlierEventFirst') : controlText('expressionFour.resolveAreaConsequences') }}
    </button>
    <button
      v-if="previous"
      :disabled="busy"
      @click="
        emit('command', {
          kind: 'scene-effect',
          action: {
            operation: 'hazard-order',
            eventIds: [event.id, ...group.filter((h) => h.id !== event.id).map((h) => h.id)],
            note: 'GM明确选择同时区域后果的结算顺序',
          },
        })
      "
    >
      {{ controlText('authoringFlow.handleThisEventFirst') }}
    </button>
  </article>
</template>
<style scoped>
.terrain-review {
  border: 1px solid var(--line);
  padding: 10px;
  border-radius: 10px;
  background: var(--surface);
  margin-block: 6px;
}
.terrain-review p {
  margin: 6px 0;
}
.terrain-review button {
  background: var(--accent-soft, var(--surface));
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 7px 10px;
  color: var(--ink);
  min-height: 36px;
}
</style>
