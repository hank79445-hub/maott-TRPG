<script setup lang="ts">
import {uiLabel} from './ui-label'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { onBeforeUnmount, ref } from 'vue'
import { connectEmbed, sealRelay } from '../online/sealchat'
import { api } from '../online/client'
const props = defineProps<{ roomId: string }>()
const config = window.__SEALCHAT_EMBED_CONFIG__,
  query = new URLSearchParams(location.search)
const host = ref(config?.hostOrigin ?? query.get('hostOrigin') ?? ''),
  sdk = ref(config?.sdkUrl ?? query.get('sdkUrl') ?? ''),
  token = ref(''),
  status = ref('未连接'),
  connecting = ref(false),
  contextName = ref('')
let relay: ReturnType<typeof sealRelay> | null = null
async function connect() {
  if (connecting.value) return
  connecting.value = true
  relay?.close()
  relay = null
  try {
    const client = await connectEmbed(host.value, sdk.value)
    try {
      relay = sealRelay(
        client,
        props.roomId,
        token.value,
        api,
        (message) => (status.value = message),
      )
      const context = await client.context.get(),
        state = await client.connection.getState()
      contextName.value =
        (context.currentUser?.displayName ?? '成员') + ' · 频道 ' + context.channel.id
      status.value = 'SealChat 已连接：' + state.state
      token.value = ''
    } catch (e) {
      client.close()
      throw e
    }
  } catch (e) {
    status.value = e instanceof Error ? e.message : String(e)
  } finally {
    connecting.value = false
  }
}
function disconnect() {
  relay?.close()
  relay = null
  status.value = '已断开'
  contextName.value = ''
}
onBeforeUnmount(disconnect)
</script>
<template>
  <div class="room-environment">
    <h3>{{ controlText('resourceFlow.sealchatEmbedIntentHandoff') }}</h3>
    <p>
      {{ controlText('remainingField.openThisToolThroughChannelIformAndUse') }}
      <code>trpg.intent.v1</code> {{ controlText('remainingField.eventsEachSuggestionIsHandedOffWithA') }}
    </p>
    <div class="room-row">
      <label
        >{{ controlText('remainingField.sealchatHostOrigin') }}<input v-model="host" placeholder="https://chat.example.com" /></label
      ><label
        >{{ controlText('remainingField.instanceSdkUrl') }}<input
          v-model="sdk"
          placeholder="https://chat.example.com/api/v1/channel-embed-sdk.js" /></label
      ><label>{{ controlText('remainingField.limitedAiToken') }}<input v-model="token" type="password" autocomplete="off" /></label
      ><button class="secondary" :disabled="connecting || !host || !sdk || !token" @click="connect">
        {{ controlText('resourceFlow.connectEmbedSdk') }}</button
      ><button class="subtle" @click="disconnect">{{ controlText('resourceFlow.disconnectSealchat') }}</button>
    </div>
    <p role="status">{{ uiLabel(status) }}</p>
    <p v-if="contextName" class="muted">{{ contextName }}</p>
  </div>
</template>
