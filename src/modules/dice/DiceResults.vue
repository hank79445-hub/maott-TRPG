<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch, onBeforeUnmount } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { DiceRecord } from '../../online/dice-types'
import DiceFaces from './DiceFaces.vue'
import { DAMAGE_NAMES, type DamageType } from '../../core/combat-types'
import { freshDiceRecords } from './dice-presentation'
const props = defineProps<{ view: RoomView; baseline: number }>()
const mode = ref<'all' | 'mine' | 'off'>('all'),
  reduce = ref(false),
  active = ref<DiceRecord | null>(null),
  rolling = ref(false)
const seen = new Set<string>(),
  queue: DiceRecord[] = []
let room = '',
  lastBaseline = -1,
  animationTimer: ReturnType<typeof setTimeout> | undefined,
  hideTimer: ReturnType<typeof setTimeout> | undefined
const damageName = (id: string) => DAMAGE_NAMES[id as DamageType] ?? id
try {
  const saved = localStorage.getItem('trpg-dice-display')
  if (['all', 'mine', 'off'].includes(saved ?? '')) mode.value = saved as typeof mode.value
  reduce.value = localStorage.getItem('trpg-dice-reduce') === 'true'
} catch {}
const mine = (r: DiceRecord) =>
  r.sessionId === props.view.self.id || props.view.self.characterIds.includes(r.characterId ?? '')
const records = computed(() => [...(props.view.dice?.records ?? [])].reverse().slice(0, 20))
const sourceLabel = (r: DiceRecord) =>
  r.mode === 'manual' ? 'GM录入' : r.mode === 'mixed' ? 'GM＋自动' : '自动骰'
function next() {
  if (active.value || !queue.length) return
  active.value = queue.shift()!
  const reduced = reduce.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  rolling.value = !reduced
  animationTimer = setTimeout(
    () => {
      rolling.value = false
    },
    reduced ? 0 : 1400,
  )
  hideTimer = setTimeout(close, 6500)
}
function close() {
  clearTimeout(animationTimer)
  clearTimeout(hideTimer)
  active.value = null
  rolling.value = false
  next()
}
watch(
  () => [props.view.id, props.view.dice?.records, props.baseline] as const,
  ([id, items, baseline]) => {
    const initial = room !== id || baseline !== lastBaseline
    if (initial) {
      room = id
      lastBaseline = baseline
      seen.clear()
      queue.splice(0)
      clearTimeout(animationTimer)
      clearTimeout(hideTimer)
      active.value = null
    }
    const fresh = freshDiceRecords(items ?? [], seen, initial)
    queue.push(...fresh.filter((r) => mode.value !== 'off' && (mode.value !== 'mine' || mine(r))))
    // A burst stays compact; all results remain available in the static list.
    if (queue.length > 5) queue.splice(0, queue.length - 5)
    next()
  },
  { immediate: true },
)
watch([mode, reduce], () => {
  try {
    localStorage.setItem('trpg-dice-display', mode.value)
    localStorage.setItem('trpg-dice-reduce', String(reduce.value))
  } catch {}
  if (mode.value === 'off') {
    queue.splice(0)
    close()
  }
})
onBeforeUnmount(() => {
  clearTimeout(animationTimer)
  clearTimeout(hideTimer)
})
</script>
<template>
  <details class="dice-history">
    <summary>{{ controlText('quantity.diceHistory', {p0:(records.length)}) }}</summary>
    <div class="room-row">
      <label
        >{{ controlText('field.playbackScope') }}<select v-model="mode">
          <option value="all">{{ controlText('operations.allAuthorizedPublicResults') }}</option>
          <option value="mine">{{ controlText('operations.onlyMyResults') }}</option>
          <option value="off">{{ controlText('operations.disableAnimationNotices') }}</option>
        </select></label
      ><label class="check"><input v-model="reduce" type="checkbox" />{{ controlText('field.reduceMotion') }}</label>
    </div>
    <article v-for="r in records" :key="r.id" class="dice-history-row">
      <strong>{{ r.label }} · {{ sourceLabel(r) }}</strong
      ><DiceFaces :rolls="r.rolls" />
      <p v-for="(o, i) in r.outcomes" :key="i" class="dice-total">
        {{ o.damageType ? '[' + damageName(o.damageType) + '] ' : '' }}{{ o.label }} · [{{
          o.dice.join(', ')
        }}] {{ o.chosen !== undefined ? controlText('expressionOne.take') + o.chosen : '' }}
        {{ o.bonus !== undefined ? (o.bonus >= 0 ? '+' : '') + o.bonus : '' }} =
        <strong>{{ o.total }}</strong
        ><small v-if="o.reasons?.length"> · {{ o.reasons.join('；') }}</small>
      </p>
      <details>
        <summary>{{ controlText('operations.fullRawDiceAndResolutionExplanation') }}</summary>
        <p>{{ r.rolls.map((d) => 'd' + d.sides + '=' + d.value).join('，') }}</p>
        <p>{{ r.detail }}</p>
      </details>
    </article>
  </details>
  <Teleport to="body"
    ><aside
      v-if="active"
      class="dice-toast"
      :class="{ 'own-result': mine(active) }"
      role="status"
      aria-live="polite"
      :aria-label="controlText('field.confirmedDiceResult')"
    >
      <div class="dice-toast-head">
        <strong>{{ mine(active) ? controlText('expressionOne.myRolls') : controlText('expressionOne.publicRolls') }} · {{ sourceLabel(active) }}</strong
        ><button class="subtle" :aria-label="controlText('field.closeDiceResult')" @click="close">{{ controlText('controls.close') }}</button>
      </div>
      <DiceFaces :rolls="active.rolls" :animate="rolling" />
      <p v-for="(o, i) in active.outcomes?.slice(0, 5)" :key="i">
        {{ o.damageType ? '[' + damageName(o.damageType) + '] ' : ''
        }}{{ o.chosen !== undefined ? controlText('expressionOne.take') + o.chosen + '，' : ''
        }}{{ o.bonus !== undefined ? controlText('expressionOne.modifier') + (o.bonus >= 0 ? '+' : '') + o.bonus + '，' : ''
        }}<strong>{{ controlText('quantity.total', {p0:(o.total)}) }}</strong>
      </p>
      <button v-if="rolling" class="subtle" @click="rolling = false">{{ controlText('operations.skipAnimation') }}</button
      ><small>{{ controlText('operations.seeDiceResultsAndAnimationForFullSelection') }}</small>
    </aside></Teleport
  >
</template>
<style scoped>
.dice-history {
  margin-block: 8px;
}
.dice-history > summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.dice-history-row {
  padding: 12px;
  border-top: 1px solid #ccd5d4;
  display: grid;
  gap: 8px;
}
.dice-total {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.dice-toast {
  position: fixed;
  top: 150px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1150;
  max-width: min(92vw, 620px);
  max-height: 65vh;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px;
  background: var(--panel);
  box-shadow: 0 6px 26px #0002;
  display: grid;
  gap: 8px;
  color: var(--ink);
}
.dice-toast.own-result {
  border: 2px solid var(--gold);
}
.dice-toast-head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}
.dice-toast p {
  margin: 0;
}
.dice-toast button {
  min-height: 44px;
}
.dice-toast small {
  font-size: 12px;
}
@media (max-width: 600px) {
  .dice-toast {
    top: 148px;
    width: calc(100vw - 40px);
    padding: 10px;
  }
  .dice-toast-head {
    gap: 8px;
  }
}
</style>
