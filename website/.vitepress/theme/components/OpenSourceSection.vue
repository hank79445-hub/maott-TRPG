<script setup lang="ts">
import { withBase } from 'vitepress'
</script>
<template>
  <section class="home-section">
    <div class="ai-panel home-card">
      <div>
        <p class="home-kicker">需要时再接入AI</p>
        <h2 class="home-title">让辅助参与，<br />让GM做决定。</h2>
      </div>
      <div>
        <p>
          旁白、NPC对话与行为建议，各自保留权限和审核边界。模型和QQ都可选；不配置它们，也能完成真人GM的纯Web冒险。
        </p>
        <div class="flow" aria-label="玩家或NPC提出意图，GM审核，确认后公开结果">
          <span>提出意图</span><b aria-hidden="true">→</b><span>GM审核</span
          ><b aria-hidden="true">→</b><span>确认结果</span>
        </div>
        <a class="home-link" :href="withBase('/features/ai-npc.html')">了解AI与NPC的边界 →</a>
      </div>
    </div>
  </section>
  <section class="home-section deploy">
    <p class="home-kicker">开源，也留给你自己的空间</p>
    <h2 class="home-title">自己部署，和自己的团员使用。</h2>
    <p class="home-lead">
      从公开源码开始，按步骤准备环境、启动服务和邀请团员。程序采用MIT许可，规则与素材注明各自来源。
    </p>
    <ol class="deploy-steps">
      <li>
        <span>01</span>
        <h3>获取公开版</h3>
        <p>固定版本，阅读支持范围与安装要求。</p>
      </li>
      <li>
        <span>02</span>
        <h3>启动并检查</h3>
        <p>完成本机运行，再按需配置网络访问。</p>
      </li>
      <li>
        <span>03</span>
        <h3>邀请团员</h3>
        <p>导入原创示例，分配角色，开始一场小冒险。</p>
      </li>
    </ol>
    <div class="home-actions">
      <a class="home-action" :href="withBase('/deploy/requirements.html')">查看部署教程 →</a
      ><a class="home-action secondary" :href="withBase('/examples/')">获取原创示例</a>
    </div>
  </section>
</template>
<style scoped>
.ai-panel {
  display: grid;
  grid-template-columns: 4fr 6fr;
  gap: 48px;
  padding: 36px;
}
.ai-panel p {
  font-size: 17px;
  line-height: 1.9;
}
.ai-panel .home-title {
  margin: 0;
}
.flow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 24px 0;
}
.flow span {
  background: var(--accent-soft);
  border: 1px solid var(--line);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
}
.flow b {
  font-weight: 400;
  color: var(--gold);
}
.deploy-steps {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}
.deploy-steps li {
  border-top: 1px solid var(--line);
  padding-top: 24px;
}
.deploy-steps span {
  font: italic 26px Georgia;
  color: var(--gold);
}
.deploy-steps h3 {
  font-size: 22px;
  margin: 12px 0;
}
.deploy-steps p {
  font-size: 16px;
  line-height: 1.8;
}
@media (max-width: 767px) {
  .ai-panel {
    grid-template-columns: 1fr;
    gap: 18px;
    padding: 22px;
  }
  .ai-panel p {
    font-size: 16px;
  }
  .deploy-steps {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .deploy-steps li {
    padding-top: 18px;
  }
}
</style>
