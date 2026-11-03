import { i18n } from '../../app/i18n'
import type { QuickAction } from '../../persistence/quick-actions-schema'
export interface QuickActionRow {
  entry: QuickAction
  name: string
  available: boolean
  detail: string
  selected?: boolean
}
const labels = {
  action: ['行动区', 'Actions'],
  attack: ['武器攻击区', 'Weapon attacks'],
  magic: ['法术／职业特效释放区', 'Spells / class features'],
  board: ['所属板块', 'Section'],
  addBoard: ['添加到板块', 'Add to section'],
  manage: ['管理收藏', 'Manage favorites'],
  up: ['上移', 'Move up'],
  down: ['下移', 'Move down'],
  remove: ['移除收藏', 'Remove favorite'],
  favoriteAttack: ['收藏攻击', 'Favorite attack'],
  chooseAttack: ['选择攻击来源', 'Choose attack source'],
  unavailableAttack: ['攻击来源不可用', 'Attack source unavailable'],
  unavailableSource: ['来源或库存不可用', 'Source or stock unavailable'],
  moreActions: ['更多行动', 'More actions'],
  jump: ['跳跃', 'Jump'],
  details: ['详细参数与范围／多目标', 'Detailed parameters / area / multiple targets'],
  close: ['关闭', 'Close'],
  empty: ['可从收藏入口添加按钮', 'Add buttons through favorites'],
} as const
export function quickText(key: keyof typeof labels) {
  return labels[key][i18n.global.locale.value === 'en' ? 1 : 0]
}
export const quickBoards = ['action', 'attack', 'magic'] as const
