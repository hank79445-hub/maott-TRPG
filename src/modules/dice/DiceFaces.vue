<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import type { DieFace } from '../../core/dice-source'
import { percentileFaces } from './dice-presentation'
defineProps<{ rolls: DieFace[]; animate?: boolean }>()
</script>
<template>
  <div class="dice-faces" :class="{ 'is-rolling': animate }" :aria-label="controlText('domain.rawDice')">
    <div
      v-for="(d, i) in rolls.slice(0, 12)"
      :key="i"
      class="number-die"
      :aria-label="controlText('inlineSummary.dieD',{p0:(i + 1),p1:(d.sides),p2:(d.value)})"
    >
      <span class="die-kind">d{{ d.sides }}</span
      ><strong>{{ d.value }}</strong
      ><small v-if="d.sides === 100">{{ percentileFaces(d.value).join('＋') }}</small>
    </div>
    <span v-if="rolls.length > 12" class="more-dice">{{ controlText('quantity.moreDice', {p0:(rolls.length - 12)}) }}</span>
  </div>
</template>
<style scoped>
.dice-faces {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.number-die {
  display: grid;
  justify-items: center;
  align-content: center;
  width: 64px;
  min-height: 72px;
  border: 2px solid var(--accent);
  border-radius: 12px;
  background: linear-gradient(145deg, var(--panel), var(--surface));
  box-shadow: 2px 4px 0 var(--line);
  color: var(--ink);
}
.number-die strong {
  font-size: 30px;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.die-kind {
  font-size: 12px;
  font-weight: 700;
}
.number-die small {
  font-size: 11px;
}
.more-dice {
  align-self: center;
}
.is-rolling .number-die {
  animation: dice-settle 1.3s ease-out both;
  transform-origin: 50% 65%;
}
@keyframes dice-settle {
  0% {
    transform: translateY(-12px) rotate(-12deg) scale(0.9);
  }
  35% {
    transform: translateY(2px) rotate(8deg);
  }
  65% {
    transform: translateY(-3px) rotate(-4deg);
  }
  100% {
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-rolling .number-die {
    animation: none;
  }
}
@media (max-width: 600px) {
  .number-die {
    width: 52px;
    min-height: 64px;
  }
  .number-die strong {
    font-size: 27px;
  }
}
</style>
