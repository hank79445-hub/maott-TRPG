<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import type { CompiledAuthoring } from '../../core/script-authoring'
import type { MapAsset } from '../../core/map-types'
import { MAP_TOTAL_IMAGE_BYTES } from '../../core/map-limits'
const props = defineProps<{ compiled: CompiledAuthoring; assets: MapAsset[] }>()
const metrics = computed(() => [
  ...props.compiled.capacity.metrics,
  {
    path: 'assets',
    label: '图片（含预览）',
    current: props.assets.reduce((n, a) => n + a.blob.size + (a.preview?.blob.size ?? 0), 0),
    maximum: MAP_TOTAL_IMAGE_BYTES,
    bytes: true,
  },
])
const primary = computed(() => metrics.value.filter((m) => !m.path.startsWith('scenes.')))
const sceneMetrics = computed(() => metrics.value.filter((m) => m.path.startsWith('scenes.')))
const important = computed(
  () => props.compiled.source.npcs.filter((n) => n.type === 'important').length,
)
const warnings = computed(() => [
  ...new Set([
    ...props.compiled.capacity.warnings,
    ...metrics.value
      .filter((m) => m.path === 'assets' && m.current >= m.maximum * 0.8)
      .map((m) => `${m.label}已达80%预算`),
  ]),
])
function size(value: number, bytes?: boolean) {
  return bytes ? `${(value / 1024 / 1024).toFixed(2)} MiB` : String(value)
}
</script>
<template>
  <section class="capacity-summary" :aria-label="controlText('remainingField.scriptCapacityPreflight')">
    <strong
      >{{ controlText('progressSummary.capacityPreflightImportantNpcsOrdinaryNpcs', {p0:(important),p1:(compiled.source.npcs.length - important)}) }}</strong
    >
    <div class="capacity-grid">
      <span v-for="m in primary" :key="m.path" :class="{ near: m.current >= m.maximum * 0.8 }"
        >{{ m.label }} {{ size(m.current, m.bytes) }}／{{ size(m.maximum, m.bytes) }}</span
      >
    </div>
    <p class="muted">{{ controlText('progressSummary.broadcastSourcesStoryScenesSuccessFailureManual', {p0:(compiled.capacity.broadcasts.opening),p1:(compiled.capacity.broadcasts.scenes),p2:(compiled.capacity.broadcasts.success),p3:(compiled.capacity.broadcasts.failure),p4:(compiled.capacity.broadcasts.manual)}) }}</p>
    <details>
      <summary>{{ controlText('authoringFlow.viewPerSceneTokenAndWallSegmentBudgets') }}</summary>
      <ul>
        <li v-for="m in sceneMetrics" :key="m.path">
          {{ m.label }}：{{ m.current }}／{{ m.maximum }}
        </li>
      </ul>
    </details>
    <p class="muted">
      {{ controlText('authoringFlow.totalNpcCountIsNotTheNumberPresent') }}
    </p>
    <details v-if="warnings.length">
      <summary>{{ controlText('progressSummary.capacityNotice', {p0:(warnings.length)}) }}</summary>
      <ul>
        <li v-for="w in warnings" :key="w">{{ w }}</li>
      </ul>
    </details>
  </section>
</template>
<style scoped>
.capacity-summary {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  margin: 12px 0;
  overflow-wrap: anywhere;
}
.capacity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  margin: 10px 0;
}
.capacity-grid span {
  padding: 6px;
  border-radius: 6px;
  background: var(--panel);
}
.near {
  outline: 1px solid var(--accent);
}
summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  cursor: pointer;
}
ul {
  max-height: 260px;
  overflow: auto;
  padding-left: 20px;
}
</style>
