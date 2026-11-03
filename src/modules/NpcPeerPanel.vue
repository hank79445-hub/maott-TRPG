<script setup lang="ts">
import { computed, ref } from 'vue'
import { i18n } from '../app/i18n'
const labels: Record<string, string> = {
  NPC间交谈: 'NPC conversations',
  待审核: 'Pending review',
  '提出会话（NPC主动申请也在此审核）':
    'Propose a conversation; NPC proposals are reviewed here too',
  话题: 'Topic',
  提交申请: 'Submit proposal',
  暂停: 'Pause',
  '批准／恢复': 'Approve / resume',
  停止会话: 'Stop conversation',
  插话角色: 'Speaking character',
  插话: 'Interjection',
  插话并暂停NPC接续: 'Speak and pause NPC continuation',
}
const label = (s: string) => (i18n.global.locale.value === 'en' ? (labels[s] ?? s) : s)
const status = (s: string) =>
  i18n.global.locale.value === 'en'
    ? s
    : ({ pending: '待审', active: '交谈中', paused: '暂停', stopped: '已停止' }[s] ?? s)
import type { RoomView, RoomCommand } from '../online/protocol'
const props = defineProps<{ view: RoomView; busy: boolean }>(),
  emit = defineEmits<{ command: [RoomCommand] }>()
const gm = computed(() => props.view.self.role === 'gm'),
  selected = ref<string[]>([]),
  topic = ref(''),
  text = ref(''),
  characterId = ref(''),
  speaker = ref<Record<string, string>>({})
const npcs = computed(() =>
  props.view.ai.npcs.filter((n) => n.npcType === 'important' && n.sceneId === props.view.scene?.id),
)
const sessions = computed(() => props.view.peerSessions ?? [])
const name = (id: string) => props.view.ai.npcs.find((n) => n.id === id)?.name ?? id
</script>
<template>
  <details v-if="gm || sessions.length" class="peer-panel">
    <summary>
      {{ label('NPC间交谈') }} · {{ sessions.filter((s) => s.status === 'pending').length }}
      {{ label('待审核') }}
    </summary>
    <fieldset v-if="gm" :disabled="busy">
      <legend>{{ label('提出会话（NPC主动申请也在此审核）') }}</legend>
      <label v-for="n in npcs" :key="n.id"
        ><input v-model="selected" type="checkbox" :value="n.id" />{{ n.name }}</label
      ><label>{{ label('话题') }}<input v-model="topic" maxlength="2000" /></label
      ><button
        :disabled="selected.length < 2 || selected.length > 4"
        @click="
          emit('command', { kind: 'npc-peer', operation: 'propose', npcIds: selected, text: topic })
        "
      >
        {{ label('提交申请') }}
      </button>
    </fieldset>
    <article v-for="s in sessions" :key="s.id">
      <strong>{{ s.participants.map(name).join('、') }} · {{ status(s.status) }}</strong>
      <p>{{ s.topic }}</p>
      <template v-if="gm"
        ><button
          v-if="s.status === 'active'"
          :disabled="busy"
          @click="emit('command', { kind: 'npc-peer', operation: 'pause', sessionId: s.id })"
        >
          {{ label('暂停') }}</button
        ><button
          v-if="s.status === 'pending' || s.status === 'paused'"
          :disabled="busy"
          @click="emit('command', { kind: 'npc-peer', operation: 'approve', sessionId: s.id })"
        >
          {{ label('批准／恢复') }}</button
        ><button
          v-if="s.status !== 'stopped'"
          :disabled="busy"
          @click="emit('command', { kind: 'npc-peer', operation: 'stop', sessionId: s.id })"
        >
          {{ label('停止会话') }}
        </button></template
      >
      <div v-if="s.status === 'active' || s.status === 'paused'">
        <label
          >{{ label('插话角色')
          }}<select v-model="characterId">
            <option
              v-for="c in view.characters.filter(
                (c) => gm || view.self.characterIds.includes(c.id),
              )"
              :key="c.id"
              :value="c.id"
            >
              {{ c.name }}
            </option>
          </select></label
        ><label>{{ label('插话') }}<textarea v-model="text" maxlength="2000" rows="2" /></label
        ><button
          :disabled="busy || !characterId || !text.trim()"
          @click="
            emit('command', {
              kind: 'npc-peer',
              operation: 'interrupt',
              sessionId: s.id,
              characterId,
              text,
            })
          "
        >
          {{ label('插话并暂停NPC接续') }}
        </button>
      </div>
    </article>
  </details>
</template>
<style scoped>
.peer-panel {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  margin: 8px 0;
}
fieldset,
article {
  padding: 10px;
  margin: 8px 0;
  border: 1px solid var(--line);
}
label {
  display: block;
  margin: 6px 0;
}
button {
  background: var(--button-bg);
  color: var(--ink);
  border: 1px solid var(--button-border);
  border-radius: 6px;
  min-height: 44px;
  padding: 6px 12px;
  margin: 4px;
}
input[type='checkbox'] {
  width: auto;
}
select,
textarea {
  max-width: 100%;
}
</style>
