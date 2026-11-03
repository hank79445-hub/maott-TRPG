<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { useTemplateRef } from 'vue'
defineProps<{ connected: boolean; busy: boolean }>()
const emit = defineEmits<{ save: []; restore: [file: File] }>()
const picker = useTemplateRef<HTMLInputElement>('picker')
function selected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('restore', file)
  input.value = ''
}
</script>
<template>
  <details class="room-card identity-panel">
    <summary>{{ controlText('adjudication.backupEntryMyRoomIdentity') }}</summary>
    <p class="muted">
      {{ controlText('adjudication.afterChangingAddressesLogIntoTheTestAccount') }}
    </p>
    <div class="room-row">
      <button type="button" class="subtle" :disabled="busy || !connected" @click="emit('save')">
        {{ controlText('adjudication.saveMyRoomIdentity') }}
      </button>
      <button type="button" class="subtle" :disabled="busy" @click="picker?.click()">
        {{ controlText('adjudication.restoreMyRoomIdentity') }}
      </button>
    </div>
    <input
      ref="picker"
      type="file"
      class="identity-file"
      accept="application/json,.json"
      hidden
      :aria-label="controlText('interactionField.chooseMyRoomIdentityFile')"
      @change="selected"
    />
  </details>
</template>
<style scoped>
.identity-panel {
  margin-bottom: 1rem;
}
.identity-panel summary {
  cursor: pointer;
  min-height: 44px;
  display: list-item;
  align-content: center;
}
.identity-panel button {
  min-height: 44px;
}
.identity-file {
  display: none;
}
</style>
