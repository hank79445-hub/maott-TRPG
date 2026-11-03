import { defineConfig } from 'vitepress'
const siteBase = process.env.MAOTT_SITE_BASE || '/'
const siteOrigin = process.env.MAOTT_SITE_ORIGIN || 'https://maott1.cn'
export default defineConfig({
  lang: 'zh-CN',
  title: '猫团团-TRPG',
  description: 'maott-TRPG：角色、地图、战斗与故事，一起开团的网页工具。开源自部署、真人GM主持。',
  base: siteBase,
  cleanUrls: false,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: siteBase + 'media/brand.svg' }],
    ['meta', { name: 'theme-color', content: '#2c6b66' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
  ],
  sitemap: { hostname: new URL(siteBase, siteOrigin).href },
  transformHead({ pageData }) {
    const pagePath = pageData.relativePath
      .replace(/\.md$/, '.html')
      .replace(/(?:^|\/)index\.html$/, (s) => (s.startsWith('/') ? '/' : ''))
    const canonical = new URL(siteBase + pagePath, siteOrigin).href
    const title = pageData.title ? pageData.title + ' · 猫团团-TRPG' : '猫团团-TRPG'
    return [
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { property: 'og:title', content: title }],
      [
        'meta',
        {
          property: 'og:description',
          content: pageData.description || '角色、地图、战斗与故事，一起开团的网页工具。',
        },
      ],
      [
        'meta',
        {
          property: 'og:image',
          content: new URL(siteBase + 'media/scene-desktop.png', siteOrigin).href,
        },
      ],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ]
  },
  themeConfig: {
    logo: '/media/brand.svg',
    siteTitle: '猫团团-TRPG',
    nav: [
      { text: '功能介绍', link: '/features/' },
      { text: '快速上手', link: '/start/' },
      { text: '使用教程', link: '/guide/' },
      { text: '示例与资源', link: '/examples/' },
      { text: '更新', link: '/changelog' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/hank79445-hub/maott-TRPG' }],
    search: {
      provider: 'local',
      options: {
        miniSearch: {
          options: {
            tokenize: (text: string) =>
              Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(text))
                .filter((part) => part.isWordLike)
                .map((part) => part.segment.toLowerCase()),
          },
        },
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索教程', buttonAriaLabel: '搜索教程' },
              modal: {
                displayDetails: '显示详细结果',
                resetButtonTitle: '清除搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有找到结果，试试“容器”“加入”或“GM审核”。',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '回车选择',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '向上',
                  navigateDownKeyAriaLabel: '向下',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc关闭',
                },
              },
            },
          },
        },
      },
    },
    sidebar: {
      '/guide/': sidebar(),
      '/deploy/': [{ text: '自行部署', items: deployItems() }],
      '/features/': [
        {
          text: '了解功能',
          items: [
            { text: '功能总览', link: '/features/' },
            ...[
              'characters|角色与背包',
              'scenes|场景与探索',
              'combat|战斗与规则辅助',
              'gm|GM与协作',
              'scripts|剧本创作',
              'ai-npc|AI与NPC',
              'integrations|外部接入',
            ].map((s) => {
              const [id, text] = s.split('|')
              return { text, link: '/features/' + id }
            }),
          ],
        },
      ],
      '/about/': [
        {
          text: '项目',
          items: [
            { text: '关于猫团团', link: '/about/' },
            { text: '支持范围', link: '/about/status' },
            { text: '许可与来源', link: '/about/license' },
          ],
        },
      ],
    },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    sidebarMenuLabel: '章节导航',
    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换浅色',
    darkModeSwitchTitle: '切换深色',
    lastUpdated: { text: '更新于', formatOptions: { dateStyle: 'medium' } },
    footer: {
      message: '原创程序 MIT · 规则、依赖及素材按各自来源许可',
      copyright: 'maott-TRPG · 由每一场冒险继续书写',
    },
  },
})
function deployItems() {
  return [
    'requirements|环境要求',
    'install|获取与安装',
    'run|启动与关闭',
    'network|本机、同网与公网',
    'accounts|账号与权限',
    'data|数据与备份',
    'update|更新与回退',
    'troubleshooting|启动排错',
  ].map((s) => {
    const [id, text] = s.split('|')
    return { text, link: '/deploy/' + id }
  })
}
function sidebar() {
  return [
    {
      text: '从这里开始',
      items: [
        { text: '教程中心', link: '/guide/' },
        { text: '选择上手路径', link: '/start/' },
      ],
    },
    ...[
      [
        '玩家',
        'player',
        'join|加入房间',
        'create-character|七步创建角色',
        'control|使用自己的角色',
        'character-sheet|角色与资源',
        'inventory|背包与装备',
        'explore|地图移动与行动',
        'containers|宝箱与容器取放',
        'spells|法术、卷轴与收藏',
        'combat|战斗中的玩家操作',
        'messages|消息与NPC互动',
        'preferences|手机、布局与恢复',
      ],
      [
        'GM',
        'gm',
        'prepare|准备第一次开团',
        'members|成员、队伍与入场',
        'scenes|配置场景与地图',
        'points|互动点与容器',
        'visibility|光照与可见性',
        'opening|四段开场阅读',
        'review|审核玩家行动',
        'battle-start|开始战斗',
        'battle-resolution|战斗与法术结算',
        'npc|管理NPC',
        'broadcasts|广播与消息',
        'save-restore|保存与会话衔接',
      ],
      [
        '剧本创作者',
        'creator',
        'new-script|构思与结构',
        'maps|场景与美术',
        'actors|NPC、物品与遭遇',
        'story-flow|条件、事件与广播',
        'opening|角色位与开场',
        'versions|版本与导入导出',
        'generation|可选模型创作',
      ],
      [
        '可选进阶',
        'advanced',
        'models|模型与用量',
        'npc-knowledge|人设、知识与记忆',
        'npc-dialogue|NPC对话与互谈',
        'assisted-review|AI辅助审核',
        'qq|QQ接入',
        'content|自定义内容与缺依赖',
      ],
    ].map(([text, group, ...entries]) => ({
      text,
      collapsed: true,
      items: entries.map((s) => {
        const [id, title] = s.split('|')
        return { text: title, link: '/guide/' + group + '/' + id }
      }),
    })),
    { text: '部署与维护', collapsed: true, items: deployItems() },
    {
      text: '查找帮助',
      items: [
        { text: '常见问题', link: '/help/' },
        { text: '支持范围', link: '/about/status' },
        { text: '更新记录', link: '/changelog' },
      ],
    },
  ]
}
