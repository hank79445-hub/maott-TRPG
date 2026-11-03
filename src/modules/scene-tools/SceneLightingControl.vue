<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RoomView, RoomCommand } from '../../online/protocol'
import { v22Text } from './v22-labels'
const props = defineProps<{ view: RoomView; busy: boolean; sceneId?: string }>()
const emit = defineEmits<{ command: [value: RoomCommand] }>()
const scene = computed(() =>
  props.view.world?.adventures[0]?.scenes.find(
    (s) => s.id === (props.sceneId || props.view.world?.adventures[0]?.activeSceneId),
  ),
)
const facts = computed(() =>
  props.view.world?.adventures[0]?.m3?.environments.find((f) => f.sceneId === scene.value?.id),
)
const light = ref<'bright' | 'dim' | 'dark' | 'magical-darkness'>('bright')
watch(
  () => [scene.value?.id, facts.value?.light],
  () => {
    light.value = facts.value?.light ?? 'bright'
  },
  { immediate: true },
)
function save() {
  if (!scene.value) return
  emit('command', {
    kind: 'm3-spatial',
    action: {
      operation: 'environment',
      facts: {
        ...(facts.value ?? { floorHeight: 0, openSky: true }),
        sceneId: scene.value.id,
        light: light.value,
      },
    },
  })
}
</script>
<template>
  <section v-if="view.self.role === 'gm'" class="rail-card overall-lighting">
    <label
      >{{ v22Text('lighting')
      }}<select v-model="light" :disabled="busy">
        <option value="bright">{{ v22Text('bright') }}</option>
        <option value="dim">{{ v22Text('dim') }}</option>
        <option value="dark">{{ v22Text('dark') }}</option>
        <option v-if="facts?.light === 'magical-darkness'" value="magical-darkness">
          {{ v22Text('magical') }}
        </option>
      </select></label
    >
    <p class="rail-note">{{ v22Text('lightHelp') }}</p>
    <button :disabled="busy || !scene" @click="save">{{ v22Text('save') }}</button>
  </section>
</template>
<style scoped>
.overall-lighting label {
  display: grid;
  gap: 6px;
}
.overall-lighting select {
  max-width: 100%;
  min-width: 0;
}
</style>
