<script setup lang="ts">


import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import type { preflightAuthoring } from '../../core/authoring-preflight'
import {computed} from 'vue'
import {presentAuthoringProblem} from '../../shared/localization/authoring'
import {formatSystemText} from '../../shared/localization/system-messages'
const props=defineProps<{ report: ReturnType<typeof preflightAuthoring> }>()
const presented=computed(()=>props.report.issues.map(source=>({source,display:presentAuthoringProblem(source,controlI18n.global.locale.value)})))
defineEmits<{ repair: [target: string]; download: [] }>()
</script>
<template>
  <section class="preflight" :aria-label="controlText('workbench.validation')">
    <h3>{{ report.ready ? controlText('domain.valid') : controlText('workbench.repairCount',{count:report.issues.length}) }}</h3>
    <p v-if="report.blocked">{{ formatSystemText(controlI18n.global.locale.value,'authoring.blocked') }}</p>
    <button @click="$emit('download')">{{controlText('workbench.validationDownload')}}</button>
    <article v-for="({source:p,display}, i) in presented" :key="i">
      <strong>{{ display.stage }} · {{ display.name }}</strong>
      <p>{{ display.message }}</p>
      <details v-if="display.original"><summary>{{controlText('workbench.originalDiagnostic')}}</summary><p>{{display.original}}</p></details>
      <code>{{ p.path }}</code>
      <details>
        <summary>{{controlText('workbench.validationValues')}}</summary>
        <pre>{{
          JSON.stringify(
            { code: p.code, actual: p.actual, expected: p.expected, allowed: p.allowed },
            null,
            2,
          )
        }}</pre>
      </details>
      <p>{{ display.hint }}</p>
      <button v-if="p.target !== 'document'" @click="$emit('repair', p.target)">{{controlText('workbench.repairObject')}}</button>
    </article>
  </section>
</template>
<style scoped>
.preflight article {
  border: 1px solid var(--button-border);
  border-radius: 8px;
  padding: 10px;
  margin-top: 8px;
}
.preflight pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 240px;
  overflow: auto;
}
.preflight code {
  overflow-wrap: anywhere;
}
.preflight button {
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  min-height: 36px;
}
@media (pointer: coarse) {
  .preflight button {
    min-height: 44px;
  }
}
</style>
