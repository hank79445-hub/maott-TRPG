<script setup lang="ts">
import { computed } from 'vue'
import { entryDisplayName as localizedEntryName } from '../runtime-presentation'
import { quickActionBoard, type QuickAction } from '../../persistence/quick-actions-schema'
import { quickBoards, quickText, type QuickActionRow } from './quick-action-labels'
const props = defineProps<{ rows: QuickActionRow[]; busy: boolean }>()
const emit = defineEmits<{ select: [entry: QuickAction] }>()
const groups = computed(() =>
  quickBoards.map((board) => ({
    board,
    rows: props.rows.filter((row) => quickActionBoard(row.entry) === board),
  })),
)
</script>
<template>
  <div class="quick-action-sections">
    <section
      v-for="group in groups"
      :key="group.board"
      class="quick-action-section"
      :aria-label="quickText(group.board)"
    >
      <h3>{{ quickText(group.board) }}</h3>
      <div class="map-quick-strip">
        <slot :name="group.board" />
        <button
          v-for="row in group.rows"
          :key="row.entry.kind + ':' + row.entry.key"
          class="secondary"
          :aria-pressed="!!row.selected"
          :disabled="busy || !row.available"
          :title="
            localizedEntryName(row) +
            ' · ' +
            (row.available ? row.detail : quickText('unavailableSource'))
          "
          @click="emit('select', row.entry)"
        >
          {{ localizedEntryName(row)
          }}<small v-if="!row.available"> · {{ quickText('unavailableSource') }}</small>
        </button>
        <span v-if="group.board === 'magic' && !group.rows.length" class="muted">{{
          quickText('empty')
        }}</span>
      </div>
    </section>
    <slot name="manage" />
  </div>
</template>
<style scoped>
.quick-action-sections {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.quick-action-section {
  border-bottom: 1px solid var(--line);
  padding: 4px 0 8px;
  min-width: 0;
}
.quick-action-section h3 {
  font-size: 13px;
  margin: 0 0 6px;
  color: var(--muted);
}
.map-quick-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
button {
  max-width: 100%;
  height: auto !important;
  white-space: normal;
  overflow-wrap: anywhere;
}
button small {
  font-size: 12px;
}
button[aria-pressed='true'] {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
@media (pointer: coarse) {
  button {
    min-height: 44px !important;
  }
}
</style>
