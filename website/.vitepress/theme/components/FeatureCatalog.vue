<script setup lang="ts">
import { computed, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { withBase } from 'vitepress'
const role = shallowRef('全部')
const items = [
  {
    id: 'characters',
    title: '角色与背包',
    roles: ['玩家', 'GM'],
    text: '建卡、生命与资源、库存和物品使用。',
  },
  {
    id: 'scenes',
    title: '场景与探索',
    roles: ['玩家', 'GM'],
    text: '地图、移动、互动、容器、光照与可见性。',
  },
  {
    id: 'combat',
    title: '战斗与规则辅助',
    roles: ['玩家', 'GM'],
    text: '名单、先攻、行动、反应与结构化结算。',
  },
  { id: 'gm', title: 'GM与多人协作', roles: ['GM'], text: '成员权限、意图审核、广播和四段开场。' },
  {
    id: 'scripts',
    title: '剧本创作与复用',
    roles: ['创作者', 'GM'],
    text: '场景、NPC、角色位、版本与新实例。',
  },
  { id: 'ai-npc', title: 'AI与NPC', roles: ['GM'], text: '可选模型、知识记忆、对话与审批边界。' },
  {
    id: 'integrations',
    title: '外部接入',
    roles: ['GM'],
    text: '同网入口、受保护公网实例与可选QQ。',
  },
]
const visible = computed(() =>
  role.value === '全部' ? items : items.filter((i) => i.roles.includes(role.value)),
)
function read() {
  const value = new URLSearchParams(location.search).get('role')
  role.value = value && ['玩家', 'GM', '创作者'].includes(value) ? value : '全部'
}
onMounted(() => {
  read()
  window.addEventListener('popstate', read)
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('popstate', read)
})
watch(role, (value) => {
  if (typeof window === 'undefined') return
  const url = new URL(location.href)
  if (value === '全部') url.searchParams.delete('role')
  else url.searchParams.set('role', value)
  if (url.href !== location.href) history.pushState(history.state, '', url)
})
</script>
<template>
  <div class="feature-catalog">
    <div class="filters" aria-label="按角色筛选功能">
      <button
        v-for="r in ['全部', '玩家', 'GM', '创作者']"
        :key="r"
        :aria-pressed="role === r"
        @click="role = r"
      >
        {{ r }}
      </button>
    </div>
    <p class="result-count" role="status">{{ role }} · {{ visible.length }}项功能</p>
    <div class="catalog-cards">
      <article v-for="item in visible" :key="item.id">
        <p class="roles">{{ item.roles.join(' / ') }}</p>
        <h2>{{ item.title }}</h2>
        <p>{{ item.text }}</p>
        <a :href="withBase('/features/' + item.id + '.html')">查看详细介绍 →</a>
      </article>
    </div>
  </div>
</template>
<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 24px 0 12px;
}
.filters button {
  min-height: 44px;
  padding: 8px 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--ink);
}
.filters button[aria-pressed='true'] {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.result-count {
  font-size: 14px;
}
.catalog-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.catalog-cards article {
  padding: 22px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  min-width: 0;
}
.catalog-cards h2 {
  font-size: 23px;
  border: 0;
  margin: 8px 0;
  padding: 0;
}
.catalog-cards .roles {
  font-size: 13px;
  color: var(--muted);
  margin: 0;
}
.catalog-cards a {
  font-weight: 600;
}
@media (max-width: 767px) {
  .catalog-cards {
    grid-template-columns: 1fr;
  }
}
</style>
