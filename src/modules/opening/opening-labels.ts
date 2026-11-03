import { i18n } from '../../app/i18n'
const labels = {
  title: ['开场', 'Opening'],
  configure: ['配置／预览开场', 'Configure / preview opening'],
  save: ['保存开场内容', 'Save opening contents'],
  start: ['开始开场', 'Start opening'],
  replay: ['重播阅读窗口', 'Replay reading'],
  all: ['全部玩家（含后续加入者）', 'All players (including later arrivals)'],
  opening: ['开场广播', 'Opening announcement'],
  background: ['背景介绍', 'Background'],
  identity: ['玩家身份介绍', 'Player identity'],
  origin: ['团本事件起源介绍', 'Origin of events'],
  next: ['下一段 →', 'Next →'],
  previous: ['上一段', 'Previous'],
  finish: ['完成阅读', 'Finish reading'],
  close: ['暂时关闭', 'Close for now'],
  read: ['继续阅读／回看开场', 'Continue / revisit opening'],
  empty: ['此段尚未配置。', 'This section has not been configured.'],
  unassigned: [
    '尚未为你分配本团身份介绍，请联系GM。',
    'Your identity introduction has not been assigned. Contact the GM.',
  ],
  progress: ['玩家阅读进度', 'Player progress'],
  notStarted: ['未开始', 'Not started'],
  complete: ['已完成', 'Completed'],
  missing: [
    '请填写开场广播、背景和事件起源；身份介绍按角色分别配置。',
    'Fill in the announcement, background and origin. Configure identities per character.',
  ],
  saved: [
    '内容保存后供下一轮使用；当前阅读轮次保持不变。',
    'Saved contents apply to the next run. The current run stays unchanged.',
  ],
  template: ['使用指定开场模板', 'Use a selected opening template'],
  preview: ['预览', 'Preview'],
} as const
export type OpeningLabel = keyof typeof labels
export const openingText = (key: OpeningLabel) =>
  labels[key][i18n.global.locale.value === 'en' ? 1 : 0]
export const openingPageTitles = () => [
  openingText('opening'),
  openingText('background'),
  openingText('identity'),
  openingText('origin'),
]
