<script setup lang="ts">
import EquipmentGlyph from '../EquipmentGlyph.vue'
withDefaults(
  defineProps<{
    name: string
    tag?: string
    chosen?: boolean
    disabled?: boolean
    clickable?: boolean
  }>(),
  { tag: 'misc' },
)
const emit = defineEmits<{ activate: [] }>()
</script>
<template>
  <div class="trade-item" :class="{ chosen, blocked: disabled }">
    <component
      :is="clickable ? 'button' : 'div'"
      class="item-main"
      :type="clickable ? 'button' : undefined"
      :disabled="clickable ? disabled : undefined"
      :aria-label="clickable ? name : undefined"
      @click="clickable && emit('activate')"
    >
      <svg v-if="tag === 'coins'" class="item-glyph" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" stroke-width="2" />
        <path
          d="M18 9h-4a5 5 0 0 0 0 10h4v-5h-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        />
      </svg>
      <EquipmentGlyph v-else class="item-glyph" :name="tag" />
      <span class="item-copy"
        ><strong>{{ name }}</strong
        ><slot name="details"
      /></span>
    </component>
    <slot name="quantity" />
  </div>
</template>
<style scoped>
.trade-item {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 8px;
  border-radius: 7px;
  margin: 6px 0;
  min-width: 0;
}
.trade-item.chosen {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.item-main {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  min-width: 0;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  font: inherit;
}
button.item-main {
  cursor: pointer;
}
button.item-main:disabled {
  background: transparent;
  color: var(--muted);
  cursor: not-allowed;
}
.blocked {
  opacity: 0.8;
}
.item-glyph {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: var(--panel);
  border-radius: 5px;
  flex: none;
}
.item-copy {
  display: block;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.item-copy strong {
  display: block;
  font-size: 14px;
}
.item-copy :deep(small) {
  display: block;
  font-size: 12px;
  color: var(--muted);
}
button.item-main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (max-width: 760px) {
  .item-copy strong {
    font-size: 16px;
  }
}
@media (pointer: coarse) {
  button.item-main {
    min-height: 44px;
  }
}
</style>
