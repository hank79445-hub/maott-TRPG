<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, watch } from 'vue'
import { attackMethods, type AttackCost, type AttackMethodContext } from '../core/attack-methods'
const props = defineProps<{ context: AttackMethodContext | null; busy?: boolean }>()
const cost = defineModel<AttackCost>({ required: true })
const available = defineModel<boolean>('available', { default: false })
const emit = defineEmits<{ activateFlurry: [] }>()
const methods = computed(() => (props.context ? attackMethods(props.context) : []))
const selected = computed(() => methods.value.find((m) => m.cost === cost.value))
watch(
  methods,
  (list) => {
    const legal = list.filter((m) => m.enabled && m.cost !== 'opportunity')
    if (
      !list.some((m) => m.cost === cost.value) ||
      (!list.find((m) => m.cost === cost.value)?.enabled && legal.length === 1)
    )
      cost.value = legal.length === 1 ? legal[0]!.cost : (list[0]?.cost ?? 'action')
  },
  { immediate: true },
)
watch(
  selected,
  (value) => {
    available.value = !!value?.enabled
  },
  { immediate: true },
)
</script>
<template>
  <div class="attack-method-picker">
    <label
      >{{ controlText('game.attackCost') }}<select v-model="cost" :aria-label="controlText('game.attackCost')" :disabled="busy">
        <option v-for="m in methods" :key="m.cost" :value="m.cost" :disabled="!m.enabled">
          {{ m.label
          }}{{ m.enabled ? (m.remaining > 1 ? controlText('expressionOne.remaining') + m.remaining : '') : ' · ' + m.reason }}
        </option>
      </select></label
    >
    <small v-if="selected && !selected.enabled" role="status">{{ selected.reason }}</small>
    <button
      v-if="methods.some((m) => m.activation)"
      type="button"
      :disabled="busy"
      @click="emit('activateFlurry')"
    >
      {{ controlText('operations.useFlurryOfBlowsBonusAction1Focus') }}
    </button>
  </div>
</template>
<style scoped>
.attack-method-picker {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}
.attack-method-picker label {
  display: grid;
  gap: 0.25rem;
}
.attack-method-picker select {
  width: 100%;
  min-width: 0;
}
.attack-method-picker small {
  color: var(--muted, #596970);
  overflow-wrap: anywhere;
}
.attack-method-picker button {
  text-align: left;
}
</style>
