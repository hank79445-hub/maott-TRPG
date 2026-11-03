<script setup lang="ts">
import { withBase } from 'vitepress'
const features = [
  ['角色与背包', '从七步建卡开始，把生命、资源、穿戴与随身物品放在清楚的位置。', 'characters'],
  ['地图与探索', '在场景中移动、交互与取放物品，让位置和可见范围参与冒险。', 'scenes'],
  ['战斗辅助', '名单、先攻、行动、反应与目标，每一轮都有可以跟进的顺序。', 'combat'],
  ['GM审核与广播', '玩家提出行动，GM确认后果；公开消息与个人身份各有边界。', 'gm'],
  ['剧本创作与复用', '组织场景、NPC与事件，保存版本，让同一个故事再次开团。', 'scripts'],
  ['可选AI与NPC', '按需接入旁白与对话辅助，把发布、行动与规则裁定留给GM。', 'ai-npc'],
]
</script>
<template>
  <section class="home-section">
    <p class="home-kicker">准备、开团、继续冒险</p>
    <h2 class="home-title">把需要的工具连起来。</h2>
    <p class="home-lead">
      少一些来回切换，多一些对这张桌子的关注。公开版内置SRD内容，复杂效果与故事后果保留GM裁定。
    </p>
    <div class="features">
      <article v-for="([name, text, id], i) in features" :key="id" class="home-card">
        <span class="feature-number">{{ String(i + 1).padStart(2, '0') }}</span>
        <h3>{{ name }}</h3>
        <p>{{ text }}</p>
        <a class="home-link" :href="withBase('/features/' + id + '.html')">了解这一功能 →</a>
      </article>
    </div>
  </section>
</template>
<style scoped>
.features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.feature-number {
  font-size: 12px;
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: var(--accent-soft);
  border-radius: 8px;
  margin-bottom: 18px;
}
.home-card p {
  margin: 0 0 20px;
}
.home-link {
  font-size: 14px;
}
@media (max-width: 959px) {
  .features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 599px) {
  .features {
    grid-template-columns: 1fr;
  }
}
</style>
