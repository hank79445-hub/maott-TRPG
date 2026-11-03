<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
const props = defineProps<{
  rows: { kind: string; id: string; reason: string }[]
  names: Record<string, string>
}>()
const groups = computed(() =>
  [
    { label: '新团待授权确认', rows: props.rows.filter((r) => r.kind === 'practical-policy') },
    {
      label: '角色位未绑定',
      rows: props.rows.filter((r) => r.kind !== 'practical-policy' && /角色位/.test(r.reason)),
    },
    {
      label: '其他停用原因',
      rows: props.rows.filter((r) => r.kind !== 'practical-policy' && !/角色位/.test(r.reason)),
    },
  ].filter((g) => g.rows.length),
)
</script>
<template>
  <section :aria-label="controlText('remainingField.gameStartConfigurationAdjustments')">
    <template v-for="g in groups" :key="g.label"
      ><h3>{{ g.label }}</h3>
      <ul>
        <li v-for="(r, i) in g.rows" :key="i">
          <strong>{{ names[r.id] ?? controlText('expressionFour.configurationItem') }}</strong> · {{ r.reason }}
          <details>
            <summary>{{ controlText('domain.technicalDetails') }}</summary>
            {{ r.kind }} · {{ r.id }}
          </details>
        </li>
      </ul></template
    >
    <p v-if="!rows.length">{{ controlText('authoringFlow.noConfigurationNeedsDisabling') }}</p>
  </section>
</template>
