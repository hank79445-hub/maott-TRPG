<script setup lang="ts">
import { withBase } from 'vitepress'
import MediaZoom from './MediaZoom.vue'
</script>
<template>
  <section class="hero home-section">
    <div class="hero-copy">
      <p class="home-kicker">maott-TRPG / 一起开团</p>
      <h1>把角色、地图、<br class="desktop-break" />战斗与故事，<br />放在同一张桌上。</h1>
      <p class="hero-description">
        猫团团-TRPG，为玩家、主持人与剧本创作者准备的网页跑团工具。让准备、探索与每一次行动彼此衔接，由真人GM掌握故事的方向。
      </p>
      <div class="home-actions">
        <a class="home-action" :href="withBase('/start/')"
          >快速上手 <span aria-hidden="true">→</span></a
        ><a
          class="home-action secondary"
          href="https://github.com/hank79445-hub/maott-TRPG"
          >GitHub源码</a
        >
      </div>
      <ul class="hero-tags" aria-label="项目特点">
        <li>开源自部署</li>
        <li>真人GM主持</li>
        <li>桌面与手机</li>
      </ul>
    </div>
    <figure class="hero-preview">
      <div class="preview-top">
        <span class="preview-dot" aria-hidden="true"></span> 暮灯驿站 · 一场小冒险
        <span class="preview-tag">公开版演示</span>
      </div>
      <MediaZoom
        src="/media/scene-desktop.png"
        alt="合成示例的玩家场景，左侧行动工具、中央地图与右侧消息相连"
        :width="1440"
        :height="1000"
        priority
      />
      <figcaption>
        <span class="preview-index">01</span> 从一张角色卡，到一整个冒险。<a
          :href="withBase('/examples/')"
          >认识示例剧本 ↗</a
        >
      </figcaption>
    </figure>
  </section>
</template>
<style scoped>
.hero {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  align-items: center;
  gap: 48px;
  padding-top: 76px;
  position: relative;
}
.hero h1 {
  font-size: clamp(34px, 3.7vw, 54px);
  line-height: 1.25;
  letter-spacing: -0.025em;
  margin: 0 0 24px;
  font-weight: 600;
}
.hero-description {
  font-size: 17px;
  line-height: 1.9;
  max-width: 460px;
  margin-bottom: 28px;
}
.hero-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  list-style: none;
  padding: 0;
  margin: 24px 0 0;
}
.hero-tags li {
  font-size: 12px;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 4px 10px;
  color: var(--ink);
}
.hero-preview {
  min-width: 0;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  margin: 0;
  box-shadow: 0 20px 60px #173b2d0b;
  transform: rotate(-1deg);
  overflow: hidden;
}
.preview-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 15px 16px;
  font-size: 12px;
  border-bottom: 1px solid var(--line);
}
.preview-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}
.preview-tag {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}
.hero-preview img {
  display: block;
  width: 100%;
  height: auto;
}
.hero-preview figcaption {
  padding: 16px;
  font-size: 13px;
  line-height: 1.7;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.hero-preview figcaption a {
  color: var(--accent);
  margin-left: auto;
  text-decoration: underline;
}
.preview-index {
  color: var(--gold);
  font: italic 20px Georgia;
}
@media (max-width: 959px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 32px;
    padding-top: 44px;
  }
  .hero-description {
    max-width: 650px;
  }
  .hero-preview {
    transform: none;
    max-width: 760px;
  }
  .hero h1 {
    font-size: 44px;
  }
  .desktop-break {
    display: none;
  }
}
@media (max-width: 767px) {
  .hero {
    padding-top: 36px;
  }
  .hero h1 {
    font-size: 34px;
  }
  .hero-description {
    font-size: 16px;
  }
  .preview-top {
    padding: 12px;
  }
  .preview-tag {
    display: none;
  }
  .hero-preview figcaption {
    padding: 12px;
  }
}
</style>
