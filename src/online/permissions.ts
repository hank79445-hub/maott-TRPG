import type { RuntimeCommand } from '../core/runtime'
export const runtimeNeedsReview = (command: RuntimeCommand) =>
  ![
    'equip',
    'item-remove',
    'item-move',
    'item-note',
    'item-split',
    'portrait-set',
    'check',
    'end-effect',
  ].includes(command.type)

export function runtimeActionName(command: RuntimeCommand) {
  const names: Partial<Record<RuntimeCommand['type'], string>> = {
    mounted: 'GM 确认骑乘状态',
    'special-weapon': 'GM 配置特殊武器',
    advanced: '专长与子职业能力裁定',
    origin: '起源与物种能力',
    damage: '记录伤害',
    heal: '记录治疗',
    temporary: '临时生命值',
    condition: '调整状态',
    'effect-remove': '结束来源效果',
    exhaustion: '调整力竭',
    'death-save': '死亡豁免',
    stabilize: '稳定救治',
    resource: '使用能力资源',
    'resource-set': '调整资源',
    'end-effect': '结束效果',
    inspiration: '调整英雄激励',
    cast: '施放法术',
    'concentration-result': '专注豁免结果',
    'level-up': '角色升级',
    recover: '特性资源转换与恢复',
    rest: command.type === 'rest' && command.kind === 'short' ? '短休' : '长休',
    time: '推进冒险时间',
    coins: '金币收支',
    'item-add': '获得物品',
    undo: '撤销角色操作',
  }
  return names[command.type] ?? '角色操作'
}
