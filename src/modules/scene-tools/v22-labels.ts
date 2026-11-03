import { i18n } from '../../app/i18n'
const labels = {
  lighting: ['整体光照', 'Overall lighting'],
  bright: ['室外光照（明亮）', 'Outdoor lighting (bright)'],
  dim: ['室内光照（1级黑暗／微光）', 'Indoor lighting (level 1 / dim)'],
  dark: ['完全黑暗（2级黑暗）', 'Complete darkness (level 2)'],
  magical: ['魔法黑暗（现有高级状态）', 'Magical darkness (advanced state)'],
  save: ['保存整体光照', 'Save overall lighting'],
  lightHelp: [
    '光照与露天／天花板设置独立；局部光源仍按规则生效。',
    'Lighting is independent of open sky and ceiling settings. Local lights still follow the rules.',
  ],
  container: ['容器物品', 'Container contents'],
  close: ['关闭', 'Close'],
  takeAll: ['全部领取', 'Take all'],
  take: ['领取', 'Take'],
  put: ['放入', 'Put in'],
  coins: ['金币', 'Gold'],
  loading: ['正在读取容器…', 'Loading container…'],
  unavailable: [
    '容器当前不可访问，请核对位置、开启状态和角色权限。',
    'Container unavailable. Check position, opening state and character permissions.',
  ],
  empty: ['容器为空，可切换到“放入”。', 'This container is empty. Switch to Put in to add items.'],
  noInventory: ['没有可显示的背包物品。', 'No inventory items to display.'],
  done: ['操作已完成，清单已同步。', 'Transfer completed. Contents updated.'],
  failed: [
    '操作未完成，已刷新实际剩余内容；不会自动重试。',
    'Transfer did not complete. Contents refreshed; no automatic retry.',
  ],
  pending: [
    '已提交GM审核，获批后更新物品。',
    'Submitted for GM review. Items update after approval.',
  ],
  amount: ['操作数量', 'Transfer quantity'],
  available: ['可用', 'Available'],
  takeHelp: [
    '点击卡片领取所填数量；默认领取该堆全部。',
    'Click a card to take the entered quantity; the default is the full stack.',
  ],
  putHelp: [
    '点击卡片放入所填数量；默认1件。',
    'Click a card to put in the entered quantity; the default is one.',
  ],
  retry: ['刷新清单', 'Refresh contents'],
} as const
export function v22Text(key: keyof typeof labels) {
  return labels[key][i18n.global.locale.value === 'en' ? 1 : 0]
}
