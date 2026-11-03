<script setup lang="ts">
import { withBase } from 'vitepress'
const faqs = [
  [
    '需要所有玩家安装吗？',
    '玩家使用浏览器访问GM提供的可用房间地址即可。自行部署者负责安装与运行服务；本机、同网和公网访问需要分别配置。',
  ],
  [
    '一定要配置AI吗？',
    '不需要。真人GM可以完成基础开团、探索和战斗流程。AI、NPC模型对话和QQ属于可选接入。',
  ],
  [
    '支持哪些规则和等级？',
    '公共版默认内置SRD5.2.1内容，当前角色成长工作流主要覆盖1–5级单职业。目录存在不代表所有法术后果均可自动结算，请查看支持范围。',
  ],
  [
    'GM与玩家分别做什么？',
    '玩家操作自己的角色并提出行动；GM准备场景、分配权限、审批请求和确认规则与剧情后果。',
  ],
  [
    '数据保存在哪里？',
    '本地角色、房间服务数据和个人剧本库是不同存储。公开教程解释各自的保存、导出和恢复入口。',
  ],
  [
    '手机可以使用吗？',
    '支持响应式界面、工具抽屉和消息阅读。复杂地图配置与大规模GM编辑更适合桌面；手机操作方式另有教程。',
  ],
]
</script>
<template>
  <section class="home-section faq-section">
    <div>
      <p class="home-kicker">在开始之前</p>
      <h2 class="home-title">把常见问题<br />先说清楚。</h2>
      <p class="home-lead">按实际公开版本说明能力，也保留GM需要作决定的位置。</p>
      <a class="home-link" :href="withBase('/about/status.html')">查看当前支持范围 →</a
      ><a class="home-link more-help" :href="withBase('/help/')">浏览全部常见问题 →</a>
    </div>
    <div class="faq-list">
      <details v-for="([q, a], i) in faqs" :id="'faq-' + (i + 1)" :key="q">
        <summary>{{ q }}</summary>
        <p>{{ a }}</p>
      </details>
    </div>
  </section>
  <section class="home-section closing home-card">
    <p class="home-kicker">桌子已经准备好了</p>
    <h2 class="home-title">从一次小冒险开始。</h2>
    <p>选择你的角色，带上自己的故事。</p>
    <a class="home-action" :href="withBase('/start/')">选择上手路径 →</a>
  </section>
</template>
<style scoped>
.faq-section {
  display: grid;
  grid-template-columns: 4fr 6fr;
  gap: 56px;
}
.faq-section .home-lead {
  font-size: 16px;
  line-height: 1.8;
}
.more-help {
  display: block;
  margin-top: 20px;
}
.faq-list {
  border-top: 1px solid var(--line);
}
details {
  border-bottom: 1px solid var(--line);
  padding: 0 0 2px;
}
summary {
  cursor: pointer;
  min-height: 60px;
  padding: 18px 24px 18px 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
}
details p {
  font-size: 16px;
  line-height: 1.85;
  padding: 0 0 20px;
}
.closing {
  text-align: center;
  padding: 44px 24px;
  max-width: 1136px;
}
.closing p {
  line-height: 1.8;
}
.closing .home-action {
  margin-top: 18px;
}
@media (max-width: 767px) {
  .faq-section {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .closing {
    margin-left: 18px;
    margin-right: 18px;
  }
  .faq-section .home-title br {
    display: none;
  }
  summary {
    font-size: 16px;
  }
}
</style>
