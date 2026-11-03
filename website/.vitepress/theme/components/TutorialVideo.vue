<script setup lang="ts">
import { withBase } from 'vitepress'
defineProps<{ src: string; poster: string; caption: string }>()
</script>
<template>
  <figure class="tutorial-video">
    <video controls preload="none" playsinline :poster="withBase(poster)" :aria-label="caption">
      <source :src="withBase(src)" type="video/webm" />
      请阅读视频下方的文字步骤。
    </video>
    <figcaption>{{ caption }} · 可暂停播放，下方提供完整文字步骤。</figcaption>
  </figure>
</template>
<style scoped>
.tutorial-video {
  margin: 24px 0;
}
.tutorial-video video {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
}
.tutorial-video figcaption {
  font-size: 14px;
  color: var(--ink);
  line-height: 1.6;
}
</style>
