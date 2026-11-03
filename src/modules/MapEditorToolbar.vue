<script setup lang="ts">
import {uiLabel} from './ui-label'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import type { MapPanelTool } from './map-editor-tools'
import { EDITOR_TOOL_NAMES } from './map-editor-tools'
defineProps<{
  mode: string
  tool: MapPanelTool
  busy: boolean
  zoom: number
  gridLocked: boolean
  showNames: boolean
  quickMode?: string
  designOnly?: boolean
}>()
const emit = defineEmits<{
  choose: [tool: MapPanelTool]
  setup: [kind: 'place' | 'relocate' | 'config']
  names: []
  zoom: [delta: number]
  cancel: []
  fit: []
}>()
function choose(event: MouseEvent, id: MapPanelTool) {
  emit('choose', id)
  closeMenu(event)
}
function setup(event: MouseEvent, id: 'config' | 'place' | 'relocate') {
  emit('setup', id)
  closeMenu(event)
}
function closeMenu(event: MouseEvent) {
  const menu = (event.currentTarget as HTMLElement).closest('details')
  if (menu) menu.open = false
}
</script>
<template>
  <nav class="editor-tool-groups" :aria-label="controlText('mapExperience.mapTools')">
    <div class="editor-basic">
      <strong v-if="quickMode" class="gm-tool-active" role="status">{{
        quickMode === 'relocate' ? controlText('mapExperience.relocating') : controlText('mapExperience.placingNpc')
      }}</strong
      ><button v-if="quickMode" :disabled="busy" @click="emit('cancel')">{{ controlText('mapExperience.exitQuick') }}</button>
      <button
        v-for="id in ['select', 'measure', 'sight'] as const"
        :key="id"
        :disabled="busy"
        :aria-pressed="tool === id"
        @click="choose($event, id)"
      >
        {{ uiLabel(EDITOR_TOOL_NAMES[id]) }}
      </button>
      <details v-if="mode !== 'preview'" class="editor-tool-menu">
        <summary>{{ controlText('domain.drawPlace') }}</summary>
        <div class="editor-tool-options">
          <button
            v-for="id in (mode === 'edit'
              ? ['move', 'path', 'rect', 'brush', 'point', 'wall', 'door', 'annotation', 'grid']
              : ['move', 'path']) as MapPanelTool[]"
            :key="id"
            :disabled="busy || (id === 'grid' && gridLocked)"
            :aria-pressed="tool === id"
            @click="choose($event, id)"
          >
            {{ uiLabel(EDITOR_TOOL_NAMES[id]) }}
          </button>
        </div>
      </details>
      <details v-if="mode !== 'preview'" class="editor-tool-menu">
        <summary>{{ controlText('domain.sceneConfig') }}</summary>
        <div class="editor-tool-options">
          <button :disabled="busy" @click="setup($event, 'config')">{{ controlText('mapExperience.groupsAndItems') }}</button>
          <button v-if="!designOnly" :disabled="busy" @click="setup($event, 'place')">
            {{ controlText('mapExperience.placeNpc') }}
          </button>
          <button v-if="!designOnly" :disabled="busy" @click="setup($event, 'relocate')">
            {{ controlText('mapExperience.relocate') }}
          </button>
        </div>
      </details>
      <button :disabled="busy" :aria-pressed="showNames" @click="emit('names')">
        {{ showNames ? controlText('controls.hideNames') : controlText('controls.showNames') }}
      </button>
    </div>
    <div class="editor-view-tools">
      <slot name="quality" /><button
        :disabled="busy"
        :aria-label="controlText('mapExperience.zoomOut')"
        @click="emit('zoom', -0.1)"
      >
        −</button
      ><span>{{ Math.round(zoom * 100) }}%</span
      ><button :disabled="busy" :aria-label="controlText('mapExperience.zoomIn')" @click="emit('zoom', 0.1)">＋</button
      ><button :disabled="busy" @click="emit('fit')">{{ controlText('controls.fit') }}</button>
    </div>
  </nav>
</template>
<style scoped>
.editor-tool-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid var(--line);
}
.editor-basic,
.editor-view-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.editor-view-tools {
  margin-left: auto;
}
button,
summary {
  min-height: 44px;
  font-size: 12px;
  padding: 8px;
  border-radius: 6px;
}
button[aria-pressed='true'] {
  background: var(--accent-soft);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.editor-tool-menu {
  position: relative;
}
summary {
  cursor: pointer;
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  background: var(--surface);
}
.editor-tool-options {
  position: absolute;
  z-index: 8;
  top: 100%;
  left: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
  width: min(280px, 80vw);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 5px 16px #0002;
}
@media (max-width: 650px) {
  .editor-view-tools {
    margin-left: 0;
  }
  .editor-tool-options {
    position: static;
    width: auto;
  }
}
</style>
