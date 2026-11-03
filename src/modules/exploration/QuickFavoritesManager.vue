<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { entryDisplayName as localizedEntryName } from '../runtime-presentation'
import {
  quickActionBoard,
  type QuickAction,
  type QuickActionBoard,
} from '../../persistence/quick-actions-schema'
import { quickBoards, quickText, type QuickActionRow } from './quick-action-labels'
const props = defineProps<{ rows: QuickActionRow[]; busy: boolean; storageScope?: string }>()
const magicOpen = ref(false)
const storageKey = () => 'trpg-quick-magic-management:' + (props.storageScope ?? 'browser')
function saveOpen(value: boolean) { magicOpen.value = value; try { localStorage.setItem(storageKey(), String(value)) } catch { /* Optional local preference. */ } }
watch([()=>props.storageScope,()=>props.rows.filter(r=>quickActionBoard(r.entry)==='magic').map(r=>r.entry.kind+':'+r.entry.key).join('|')],(next,old)=>{
  if(!old || next[0]!==old[0]) { try { magicOpen.value=localStorage.getItem(storageKey())==='true' } catch { magicOpen.value=false } }
  else if((next[1] ?? '').split('|').some(key=>key && !(old[1] ?? '').split('|').includes(key))) saveOpen(true)
},{immediate:true})
const emit = defineEmits<{
  board: [entry: QuickAction, board: QuickActionBoard]
  reorder: [entry: QuickAction, direction: -1 | 1]
  remove: [entry: QuickAction]
}>()
const groups = computed(() =>
  quickBoards.map((board) => ({
    board,
    rows: props.rows.filter((row) => quickActionBoard(row.entry) === board),
  })),
)
</script>
<template>
  <div class="quick-favorites-manager" :aria-label="quickText('manage')">
    <component :is="group.board === 'magic' ? 'details' : 'section'" v-for="group in groups.filter((group) => group.rows.length)" :key="group.board" :open="group.board === 'magic' ? magicOpen : undefined" @toggle="group.board === 'magic' && saveOpen(($event.target as HTMLDetailsElement).open)">
      <component :is="group.board === 'magic' ? 'summary' : 'h4'">{{ quickText(group.board) }}<span v-if="group.board === 'magic'"> · {{ group.rows.length }}</span></component>
      <article v-for="(row, index) in group.rows" :key="row.entry.kind + ':' + row.entry.key">
        <strong>{{ localizedEntryName(row) }}</strong>
        <small v-if="!row.available" role="status">{{
          row.detail || quickText('unavailableSource')
        }}</small>
        <label
          >{{ quickText('board') }}
          <select
            :value="quickActionBoard(row.entry)"
            :disabled="busy"
            @change="
              emit(
                'board',
                row.entry,
                ($event.target as HTMLSelectElement).value as QuickActionBoard,
              )
            "
          >
            <option v-for="board in quickBoards" :key="board" :value="board">
              {{ quickText(board) }}
            </option>
          </select>
        </label>
        <div class="favorite-tools">
          <button :disabled="busy || index === 0" @click="emit('reorder', row.entry, -1)">
            {{ quickText('up') }}
          </button>
          <button
            :disabled="busy || index === group.rows.length - 1"
            @click="emit('reorder', row.entry, 1)"
          >
            {{ quickText('down') }}
          </button>
          <button :disabled="busy" @click="emit('remove', row.entry)">
            {{ quickText('remove') }}
          </button>
        </div>
      </article>
    </component>
  </div>
</template>
<style scoped>
.quick-favorites-manager {
  min-width: 0;
}
article {
  display: grid;
  gap: 6px;
  border-top: 1px solid var(--line);
  padding: 8px 0;
  min-width: 0;
}
strong,
small {
  overflow-wrap: anywhere;
}
.favorite-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
label,
select {
  min-width: 0;
  max-width: 100%;
}
h4 {
  margin: 8px 0;
  font-size: 13px;
}
@media (pointer: coarse) {
  button,
  select {
    min-height: 44px;
  }
}
</style>
