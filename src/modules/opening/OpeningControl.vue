<script setup lang="ts">
import { computed, ref, watch, shallowRef } from 'vue'
import { clone } from '../../core/engine'
import type { RoomView, RoomCommand } from '../../online/protocol'
import { emptyOpeningPresentation } from '../../persistence/opening-reading-schema'
import OpeningConfigEditor from './OpeningConfigEditor.vue'
import { openingText, openingPageTitles } from './opening-labels'
const props = defineProps<{
  view: RoomView
  busy: boolean
  submit: (command: RoomCommand) => Promise<boolean>
}>()
const presentation = computed(() => props.view.world?.adventures[0]?.openingPresentation),
  draft = ref(emptyOpeningPresentation()),
  preview = shallowRef(false),
  target = shallowRef(''),
  templateId = shallowRef('')
watch(
  () => JSON.stringify([props.view.id, presentation.value]),
  () => {
    draft.value = clone(presentation.value ?? emptyOpeningPresentation())
  },
  { immediate: true },
)
const characters = computed(
  () =>
    props.view.world?.characters
      .filter((c) => props.view.world!.adventures[0]!.party.includes(c.id))
      .map((c) => ({ id: c.id, name: c.build.name })) ?? [],
)
const templates = computed(
  () =>
    props.view.world?.adventures[0]?.broadcast?.templates.filter(
      (t) => t.trigger === 'story' && t.enabled && ['public', 'party'].includes(t.audience.kind),
    ) ?? [],
)
const ready = computed(
  () =>
    !!draft.value.opening.trim() && !!draft.value.background.trim() && !!draft.value.origin.trim(),
)
const previewPages = computed(() => [
  draft.value.opening,
  draft.value.background,
  draft.value.identities
    .map((i) => (characters.value.find((c) => c.id === i.characterId)?.name ?? '') + '\n' + i.text)
    .join('\n\n'),
  draft.value.origin,
])
async function start() {
  await props.submit({
    kind: 'opening',
    operation: 'start',
    presentation: clone(draft.value),
    targets: target.value ? [target.value] : [],
  })
}
</script>
<template>
  <section class="rail-card opening-control">
    <h3>{{ openingText('title') }}</h3>
    <details>
      <summary>{{ openingText('configure') }}</summary>
      <label v-if="templates.length"
        >{{ openingText('template')
        }}<select
          v-model="templateId"
          @change="
            draft.opening = templates.find((t) => t.id === templateId)?.text ?? draft.opening
          "
        >
          <option value="">—</option>
          <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select></label
      >
      <OpeningConfigEditor v-model="draft" :characters="characters" :disabled="busy" />
      <p class="rail-note">{{ openingText('saved') }}</p>
      <button
        :disabled="busy"
        @click="submit({ kind: 'opening', operation: 'configure', presentation: clone(draft) })"
      >
        {{ openingText('save') }}</button
      ><button @click="preview = !preview">{{ openingText('preview') }}</button>
      <div v-if="preview" class="opening-preview">
        <section v-for="(title, i) in openingPageTitles()" :key="title">
          <h4>{{ title }}</h4>
          <p>{{ previewPages[i] || openingText('empty') }}</p>
        </section>
      </div>
    </details>
    <p v-if="!ready" class="rail-note">{{ openingText('missing') }}</p>
    <label
      ><select v-model="target" :disabled="busy">
        <option value="">{{ openingText('all') }}</option>
        <option
          v-for="m in view.members.filter((m) => m.role === 'player' && !m.revoked)"
          :key="m.id"
          :value="m.id"
        >
          {{ m.nickname }}
        </option>
      </select></label
    >
    <button :disabled="busy || !ready" @click="start">
      {{ view.openingReading ? openingText('replay') : openingText('start') }}
    </button>
    <details v-if="view.openingReading?.participants">
      <summary>{{ openingText('progress') }}</summary>
      <p v-for="p in view.openingReading.participants" :key="p.id">
        {{ p.name }} ·
        {{
          p.complete
            ? openingText('complete')
            : p.page < 0
              ? openingText('notStarted')
              : p.page + 1 + '/4'
        }}
      </p>
    </details>
  </section>
</template>
<style scoped>
.opening-control {
  min-width: 0;
}
.opening-control select {
  max-width: 100%;
  min-width: 0;
}
.opening-control details > * {
  margin-top: 8px;
}
.opening-preview p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 280px;
  overflow: auto;
}
</style>
