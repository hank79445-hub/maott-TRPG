<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import type { PublicScene, RoomView } from '../online/protocol'
const props = defineProps<{
  scene: Pick<PublicScene, 'id' | 'name'> & Partial<PublicScene>
  encounter?: RoomView['encounter']
  exploration?: RoomView['exploration']
  busy: boolean
  inToolbar?: boolean
  gm?: boolean
}>()
const names = defineModel<boolean>('names', { default: true })
const emit = defineEmits<{
  focus: [id: string]
  talk: [id: string]
  visibility: [tokenId: string, effectId: string, visibility: 'public' | 'owner' | 'gm']
}>()
</script>
<template>
  <div class="room-scene-header" :class="{ 'in-toolbar': inToolbar }">
    <div class="room-scene-meta">
      <div class="room-scene-title">
        <h2>{{ localizedEntryName(scene) }}</h2>
        <span v-if="encounter?.phase === 'active'">{{ controlText('room.combatRound',{round:encounter.round}) }}</span>
        <span v-else-if="exploration?.sceneId === scene.id && exploration.status !== 'closed'"
          >{{ controlText('room.explorationRound',{round:exploration.round}) }} {{ exploration.status === 'paused' ? controlText('room.paused') : '' }}</span
        >
        <span v-else>{{ controlText('room.exploring') }}</span>
      </div>
      <label class="check"><input v-model="names" type="checkbox" />{{ controlText('domain.showNames') }}</label>
    </div>
  </div>
</template>
<style scoped>
.room-scene-header {
  min-width: 0;
}
.room-scene-header.in-toolbar {
  display: contents;
}
.room-scene-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1 1 280px;
  min-width: 0;
  gap: 12px;
}
.room-scene-title {
  min-width: 0;
}
.room-scene-title h2 {
  margin: 0;
  font-size: 19px;
  overflow-wrap: anywhere;
  white-space: normal;
}
.room-scene-title > span {
  font-size: 13px;
  color: var(--muted);
}
.room-scene-meta > .check {
  font-size: 12px;
  max-width: 190px;
  flex-shrink: 0;
  margin: 0;
}
.room-scene-header:not(.in-toolbar) .room-scene-meta {
  margin-bottom: 8px;
}
@media (max-width: 760px) {
  .room-scene-meta {
    flex-basis: 100%;
  }
  .room-scene-meta > .check {
    max-width: 160px;
  }
}
</style>
