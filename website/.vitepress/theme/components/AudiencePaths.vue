<script setup lang="ts">
import { withBase } from 'vitepress'
const paths = [
  ['01', '我是玩家', '加入已有房间，准备好角色，迈出冒险的第一步。', '/start/player'],
  ['02', '我是GM', '邀请团员，组织场景，确认每一次行动的后果。', '/start/gm'],
  ['03', '我想写剧本', '把场景、NPC与事件整理成能再次开团的故事。', '/start/creator'],
  ['04', '我要自行部署', '在自己的环境中运行，管理访问、数据与更新。', '/start/host'],
]
</script>
<template>
  <section class="home-section" aria-labelledby="paths-title">
    <p class="home-kicker">选一条适合你的路径</p>
    <h2 id="paths-title" class="home-title">从你的角色开始。</h2>
    <div class="paths">
      <a
        v-for="[n, title, text, href] in paths"
        :key="href"
        class="home-card path"
        :href="withBase(href + '.html')"
        ><span class="path-number">{{ n }}</span>
        <h3>{{ title }}</h3>
        <p>{{ text }}</p>
        <span class="home-link">开始这条路径 →</span></a
      >
    </div>
  </section>
</template>
<style scoped>
.paths {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.path {
  display: flex;
  flex-direction: column;
  color: var(--ink);
  text-decoration: none;
}
.path-number {
  font: italic 24px Georgia;
  color: var(--gold);
  margin-bottom: 18px;
}
.path p {
  flex: 1;
  margin: 0 0 20px;
}
.path .home-link {
  font-size: 14px;
}
.path:hover {
  border-color: var(--accent);
  background: var(--button-hover);
}
@media (max-width: 1023px) {
  .paths {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 599px) {
  .paths {
    grid-template-columns: 1fr;
  }
  .path-number {
    margin-bottom: 10px;
  }
}
</style>
