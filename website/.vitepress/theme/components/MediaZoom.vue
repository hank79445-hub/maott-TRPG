<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { withBase } from 'vitepress'
defineProps<{ src: string; alt: string; width: number; height: number; priority?: boolean }>()
const modal = useTemplateRef<HTMLDialogElement>('modal'),
  opener = useTemplateRef<HTMLButtonElement>('opener')
function close() {
  modal.value?.close()
  opener.value?.focus()
}
</script>
<template>
  <button ref="opener" class="media-zoom" :aria-label="'放大：' + alt" @click="modal?.showModal()">
    <img
      :src="withBase(src)"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'auto'"
    /><span class="zoom-caption">查看大图 ↗</span></button
  ><Teleport to="body"
    ><dialog
      ref="modal"
      class="media-dialog"
      :aria-label="alt"
      @cancel.prevent="close"
      @keydown.tab.prevent
    >
      <button autofocus @click="close">关闭大图 · Esc</button
      ><img :src="withBase(src)" :alt="alt" :width="width" :height="height" />
      <p>{{ alt }}</p>
    </dialog></Teleport
  >
</template>
<style scoped>
.media-zoom {
  display: block;
  position: relative;
  width: 100%;
  background: var(--panel);
  cursor: zoom-in;
  padding: 0;
  text-align: inherit;
}
.media-zoom img {
  width: 100%;
  height: auto;
  display: block;
}
.zoom-caption {
  position: absolute;
  right: 10px;
  bottom: 10px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
}
.media-dialog {
  width: min(1400px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  padding: 14px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  border-radius: 12px;
}
.media-dialog::backdrop {
  background: #000a;
}
.media-dialog > button {
  display: block;
  margin: 0 0 12px auto;
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--line);
  background: var(--button-bg);
  border-radius: 8px;
}
.media-dialog img {
  max-height: calc(100dvh - 160px);
  max-width: 100%;
  width: auto;
  height: auto;
  display: block;
  margin: auto;
  object-fit: contain;
}
.media-dialog p {
  font-size: 14px;
  margin: 12px 0 0;
}
</style>
