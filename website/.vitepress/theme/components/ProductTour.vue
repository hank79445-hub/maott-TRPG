<script setup lang="ts">
import { withBase } from 'vitepress'
const sections = [
  [
    '从一张角色卡出发',
    '角色、资源与随身物品在一起。读清当前状态，再决定下一次行动。',
    'character-desktop.png',
    '角色与背包实机界面',
    '/guide/player/character-sheet',
  ],
  [
    '在场景里采取行动',
    '移动、调查、使用容器，或打开法术参数。把意图交给GM，再看见已确认的结果。',
    'scene-desktop.png',
    '公开地图和行动工具',
    '/guide/player/explore',
  ],
  [
    '把每一轮战斗看清楚',
    '跟进先攻与当前回合，选择真实目标。行动预算、反应与专注参与同一条结算流程。',
    'battle-desktop.png',
    '合成战斗的先攻与行动界面',
    '/guide/player/combat',
  ],
  [
    '把准备好的故事带给玩家',
    '用四段开场介绍背景和起源，给每位玩家保留自己的身份阅读空间。每个人决定何时翻页。',
    'opening-mobile.png',
    '手机上的四段开场阅读器',
    '/guide/gm/opening',
  ],
]
</script>
<template>
  <section class="home-section tour">
    <div class="tour-heading">
      <p class="home-kicker">一场冒险的四个切面</p>
      <h2 class="home-title">看见它如何一起工作。</h2>
    </div>
    <article
      v-for="([title, text, img, alt, link], i) in sections"
      :key="img"
      class="tour-row"
      :class="{ reverse: i % 2 }"
    >
      <div class="tour-copy">
        <span class="tour-number">{{ String(i + 1).padStart(2, '0') }}</span>
        <h3>{{ title }}</h3>
        <p>{{ text }}</p>
        <a class="home-link" :href="withBase(link + '.html')">阅读相关教程 →</a>
      </div>
      <figure :class="{ 'phone-frame': img.includes('mobile') }">
        <img
          :src="withBase('/media/' + img)"
          :alt="alt"
          :width="img.includes('mobile') ? 390 : 1440"
          :height="1000"
          loading="lazy"
        />
        <figcaption>公开版合成样本 · {{ alt }}</figcaption>
      </figure>
    </article>
  </section>
</template>
<style scoped>
.tour-heading {
  margin-bottom: 40px;
}
.tour-row {
  display: grid;
  grid-template-columns: 4fr 6fr;
  gap: 56px;
  align-items: center;
  margin-bottom: 64px;
}
.tour-row.reverse .tour-copy {
  order: 2;
}
.tour-row.reverse figure {
  order: 1;
}
.tour-copy h3 {
  font-size: 29px;
  line-height: 1.45;
  margin: 12px 0 18px;
}
.tour-copy p {
  font-size: 17px;
  line-height: 1.9;
  margin-bottom: 24px;
}
.tour-number {
  font: italic 32px Georgia;
  color: var(--gold);
}
figure {
  margin: 0;
  padding: 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  min-width: 0;
}
figure img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 7px;
}
figcaption {
  font-size: 12px;
  color: var(--muted);
  padding: 12px 8px 4px;
}
.phone-frame {
  max-width: 280px;
  justify-self: center;
  max-height: 580px;
  overflow: hidden;
}
.phone-frame img {
  max-height: 510px;
  object-fit: contain;
}
.tour-row:last-child {
  margin-bottom: 0;
}
@media (max-width: 767px) {
  .tour-row {
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 48px;
  }
  .tour-row.reverse .tour-copy,
  .tour-row.reverse figure {
    order: initial;
  }
  .tour-copy h3 {
    font-size: 25px;
  }
  .tour-copy p {
    font-size: 16px;
  }
  .tour-number {
    font-size: 26px;
  }
}
</style>
