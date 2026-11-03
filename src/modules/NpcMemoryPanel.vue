<script setup lang="ts">
import { vNpcAutoHeight } from './npc-auto-height'
import {uiDate} from './locale-format'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
const props = defineProps<{ view: RoomView; busy: boolean }>(),
  emit = defineEmits<{ command: [RoomCommand] }>()
const npcs = computed(
  () => props.view.world?.adventures[0]?.ai?.npcs.filter((n) => n.npcType === 'important') ?? [],
)
const id = ref(''),
  informEvent = ref(''),
  source = ref<'experience' | 'dialogue'>('experience'),
  selected = ref<string[]>([]),
  limit = ref(20),
  confirmed = ref(false),
  character = ref(''),
  score = ref(0),
  reason = ref('GM 已核实关系变化')
const npc = computed(() => npcs.value.find((n) => n.id === id.value)),
  records = computed(() =>
    source.value === 'experience' ? (npc.value?.experiences ?? []) : (npc.value?.memory ?? []),
  )
watch(
  () => npcs.value.map((n) => n.id).join('|'),
  () => {
    if (!npcs.value.some((n) => n.id === id.value)) id.value = npcs.value[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => props.view.characters.map((c) => c.id).join('|'),
  () => {
    if (!props.view.characters.some((c) => c.id === character.value))
      character.value = props.view.characters[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => [id.value, source.value],
  () => {
    selected.value = []
    confirmed.value = false
    limit.value = 20
  },
)
watch(
  () => npc.value?.relations?.find((r) => r.characterId === character.value)?.score ?? 0,
  (v) => (score.value = v),
  { immediate: true },
)
function deleteSelected() {
  if (!npc.value) return
  emit('command', {
    kind: 'npc-memory-delete',
    npcId: npc.value.id,
    source: source.value,
    ids: [...selected.value],
    confirm: true,
  })
  selected.value = []
  confirmed.value = false
}
</script>
<template>
  <details v-npc-auto-height class="room-card runtime-memory" v-if="view.self.role === 'gm'">
    <summary>{{ controlText('configuration.gmNpcRuntimeMemoriesAndRelationships') }}</summary>
    <label
      >{{ controlText('configurationField.memoryNpc') }}<select v-model="id">
        <option value="">{{ controlText('game.choose') }}</option>
        <option v-for="n in npcs" :key="n.id" :value="n.id">{{ localizedEntryName(n) }}</option>
      </select></label
    >
    <template v-if="npc">
      <details>
        <summary>{{ controlText('configuration.tellThisNpcAConfirmedFact') }}</summary>
        <label
          >{{ controlText('game.publicFacts') }}<select v-model="informEvent">
            <option value="">{{ controlText('game.choose') }}</option>
            <option
              v-for="e in view.world?.adventures[0]?.broadcastLog?.events
                .filter(
                  (e) =>
                    e.branchId === view.world?.adventures[0]?.broadcastLog?.branchId &&
                    e.phase === 'confirmed' &&
                    e.audience.kind === 'public',
                )
                .slice(-100) ?? []"
              :key="e.id"
              :value="e.id"
            >
              {{ e.title }} · {{ e.text.slice(0, 100) }}
            </option>
          </select></label
        ><button
          :disabled="busy || !informEvent"
          @click="
            emit('command', { kind: 'npc-inform-event', npcId: npc.id, eventId: informEvent })
          "
        >
          {{ controlText('configuration.confirmDisclosureAndRecordSource') }}
        </button>
      </details>
      <p class="muted">{{ controlText('liveSummary.experiencesConversationsTheModelSelectsWithinBudget', {p0:(npc.experiences?.length ?? 0),p1:(npc.memory.length)}) }}</p>
      <p v-if="npc.experienceOmitted" role="status">{{ controlText('liveSummary.unsavedExperiencesAfterReachingCapacityCleanRecords', {p0:(npc.experienceOmitted)}) }}</p>
      <div class="room-row">
        <button
          type="button"
          :class="{ active: source === 'experience' }"
          @click="source = 'experience'"
        >
          {{ controlText('configuration.confirmedExperiences') }}</button
        ><button
          type="button"
          :class="{ active: source === 'dialogue' }"
          @click="source = 'dialogue'"
        >
          {{ controlText('configuration.publishedDialogue') }}
        </button>
      </div>
      <article v-for="r in records.slice(-limit).reverse()" :key="r.id" class="memory-row">
        <label class="check"
          ><input
            v-model="selected"
            type="checkbox"
            :value="r.id"
            :disabled="busy || (selected.length >= 100 && !selected.includes(r.id))"
          />{{ uiDate(r.at,'datetime') }} ·
          {{ r.visibility === 'public' ? controlText('configurationField.publicKnowledge') : controlText('expressionTwo.personalKnowledge') }}</label
        >
        <p v-if="'text' in r" class="prose">{{ r.text }}</p>
        <template v-else
          ><p class="prose">{{ r.player }}</p>
          <p class="prose">{{ r.reply }}</p></template
        ><button
          v-if="'pinned' in r"
          type="button"
          class="subtle"
          :disabled="busy"
          @click="
            emit('command', {
              kind: 'npc-memory-pin',
              npcId: npc.id,
              memoryId: r.id,
              pinned: !r.pinned,
            })
          "
        >
          {{ r.pinned ? controlText('expressionTwo.unpin') : controlText('expressionTwo.pinAsImportantExperience') }}
        </button>
      </article>
      <button v-if="records.length > limit" type="button" class="subtle" @click="limit += 20">
        {{ controlText('configuration.showMoreRecords') }}
      </button>
      <p class="muted">{{ controlText('liveSummary.entriesClearAtMostPerOperation', {p0:(controlText('game.selected')),p1:(selected.length)}) }}</p>
      <label class="check"
        ><input
          v-model="confirmed"
          type="checkbox"
        />{{ controlText('configurationField.confirmPermanentDeletionOfSelectedRuntimeRecordsIncluding') }}</label
      ><button
        type="button"
        class="subtle"
        :disabled="busy || !confirmed || !selected.length"
        @click="deleteSelected"
      >
        {{ controlText('configuration.deleteSelectedRecords') }}
      </button>
      <details v-if="npc.affinityEnabled">
        <summary>{{ controlText('configuration.currentPersonalAffinityAndPendingSuggestions') }}</summary>
        <div class="memory-grid">
          <label
            >{{ controlText('domain.relationshipTarget') }}<select v-model="character">
              <option v-for="c in view.characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
            </select></label
          ><label
            >{{ controlText('configurationField.currentAffinity') }}<input v-model.number="score" type="number" min="-100" max="100"
          /></label>
        </div>
        <label>{{ controlText('configurationField.relationshipAdjustmentReason') }}<textarea v-model="reason" maxlength="2000" rows="2" /></label
        ><button
          type="button"
          :disabled="busy || !character || !reason.trim()"
          @click="
            emit('command', {
              kind: 'npc-affinity-set',
              npcId: npc.id,
              characterId: character,
              score,
              reason,
            })
          "
        >
          {{ controlText('configuration.gmSavesCurrentRelationship') }}
        </button>
        <article
          v-for="j in view.ai.jobs.filter(
            (j) => j.npcId === npc?.id && !j.historical && j.affinityProposal?.status === 'pending',
          )"
          :key="j.id"
          class="memory-row"
        >
          <p>{{ controlText('liveSummary.modelSuggestion', {p0:(localizedEntryName(view.characters.find((c) => c.id === j.affinityProposal?.characterId))),p1:(j.affinityProposal!.delta >= 0 ? '+' : ''),p2:(j.affinityProposal!.delta),p3:(j.affinityProposal!.reason)}) }}
          </p>
          <p class="muted">{{ controlText('configuration.publishTheFinalDialogueFirstResultsAreLimited') }}</p>
          <div class="room-row">
            <button
              :disabled="busy || j.status !== 'published' || !reason.trim()"
              @click="
                emit('command', { kind: 'npc-affinity-review', jobId: j.id, approve: true, reason })
              "
            >
              {{ controlText('configuration.confirmRelationshipChange') }}</button
            ><button
              class="subtle"
              :disabled="busy || !reason.trim()"
              @click="
                emit('command', {
                  kind: 'npc-affinity-review',
                  jobId: j.id,
                  approve: false,
                  reason,
                })
              "
            >
              {{ controlText('configuration.rejectRelationshipChange') }}
            </button>
          </div>
        </article>
      </details>
      <p v-else class="muted">{{ controlText('configuration.affinityIsDisabledEnableItInNpcInitial') }}</p>
    </template>
  </details>
</template>
<style scoped>
.runtime-memory label {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}
.runtime-memory select,
.runtime-memory input,
.runtime-memory textarea {
  box-sizing: border-box;
  width: 100%;
}
.runtime-memory .check {
  display: flex;
  align-items: center;
}
.runtime-memory .check input {
  width: auto;
}
.memory-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--border, #ddd);
}
.prose {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.memory-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
summary {
  cursor: pointer;
}
.room-row {
  flex-wrap: wrap;
}
@media (max-width: 540px) {
  .memory-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
