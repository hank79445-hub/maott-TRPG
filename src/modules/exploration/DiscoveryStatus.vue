<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global
import { computed } from 'vue'
import type { RoomView, RoomCommand } from '../../online/protocol'
const props = defineProps<{ view: RoomView; characterId: string; busy: boolean }>()
const emit = defineEmits<{ command: [RoomCommand] }>()
const pending = computed(
  () =>
    props.view.scene?.discovery?.attempts.filter(
      (x) => x.characterId === props.characterId && x.status === 'pending',
    ) ?? [],
)
const routes = computed(
  () =>
    props.view.scene?.discovery?.routes.filter((x) => x.characterId === props.characterId) ?? [],
)
</script>
<template>
  <section
    v-if="pending.length || routes.length"
    :aria-label="controlText('field.environmentalPerceptionAndPausedRoute')"
    class="discovery-status"
  >
    <p v-if="pending.length">
      {{ controlText('field.observingTheEnvironmentWaitingForCheckResult') }}<span v-if="view.dice?.mode === 'manual'">{{ controlText('operations.gmPhysicalDiceInputAlias122') }}</span>。
    </p>
    <p v-else>{{ controlText('operations.observationResolvedContinueOrCancelTheUntraveledRoute') }}</p>
    <div v-for="r in routes" :key="r.id">
      <button
        :disabled="busy || pending.length > 0"
        @click="
          emit('command', {
            kind: 'map',
            command: { type: 'discovery-continue', sceneId: view.scene!.id, routeId: r.id },
          })
        "
      >{{ controlText('quantity.continueRoute', {p0:(r.steps)}) }}</button
      ><button
        :disabled="busy || pending.length > 0"
        @click="
          emit('command', {
            kind: 'map',
            command: { type: 'discovery-cancel-route', sceneId: view.scene!.id, routeId: r.id },
          })
        "
      >
        {{ controlText('operations.cancelRemainingRoute') }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.discovery-status {
  border: 1px solid var(--muted);
  background: #edf1f3;
  border-radius: 6px;
  padding: 0.45rem;
  font-size: 0.85rem;
}
.discovery-status p {
  margin: 0.3rem 0;
}
.discovery-status div {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
</style>
