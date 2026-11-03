import { ZodError } from 'zod'

/** No model values, arbitrary key names, provider content or credentials enter diagnostics. */
export function modelOutputError(error: unknown): string {
  if (!(error instanceof ZodError)) return error instanceof Error ? error.message : '模型结果无效'
  const fields = new Set([
    'publicDialogue',
    'text',
    'proposal',
    'kind',
    'reason',
    'plan',
    'reviewRequired',
    'dialogueCategory',
    'publicSourceIds',
    'affinityChange',
    'delta',
    'targetId',
    'attackId',
    'summon','form','materialId','corpseIds','maintainIds','creatureType',
    'destination',
    'x',
    'y',
    'itemId',
    'quantity',
    'priceGP',
    'factId',
    'detail',
    'abilityId',
    'targets',
    'amount',
    'action',
    'damageType',
    'eventIds',
    'claims',
    'eventId',
    'damage',
    'hit',
    'dead',
  ])
  const typeNames: Record<string, string> = {
    string: '文本',
    object: '对象',
    array: '数组',
    boolean: '布尔值',
    number: '数值',
  }
  const details = error.issues.slice(0, 6).map((issue) => {
    let location = ''
    for (const part of issue.path) {
      if (typeof part === 'number') location += `[${part}]`
      else
        location += (location ? '.' : '') + (fields.has(String(part)) ? String(part) : '其他字段')
    }
    location ||= '根对象'
    let explanation: string
    switch (issue.code) {
      case 'invalid_type':
        explanation = `缺少或类型错误，须为${typeNames[issue.expected] ?? '约定类型'}`
        break
      case 'unrecognized_keys':
        explanation = `存在未允许的字段（${issue.keys.length}项）`
        break
      case 'too_big':
        explanation = '长度、数量或数值超过允许上限'
        break
      case 'too_small':
        explanation = '不能为空或低于允许下限'
        break
      default:
        explanation = '值不在允许范围或不符合约定'
    }
    return `${location}：${explanation}`
  })
  return (
    '模型输出字段不符合约定：' +
    details.join('；') +
    (error.issues.length > 6 ? '；其余字段错误已省略' : '')
  )
}

export const npcOutputContractPrompt =
  '输出格式示例（普通对话，无行为）：{"text":"我是这里的守卫。","proposal":{"kind":"none"},"reason":"普通身份介绍，无行动提议。","plan":[],"reviewRequired":false}。' +
  'text与reason必须是文本，text非空且最多2000字，reason最多2000字；proposal必须是对象，不能是字符串或null。' +
  'plan只表示可审核的游戏行动对象数组，不是思考过程、台词、说明文字或字符串数组。普通问候、身份介绍及无行为对话返回plan:[]；普通对话没有后续行动时不要编造六步计划。' +
  '有行为时每一步使用与proposal相同的对象结构；例如移动步骤为{"kind":"move","destination":{"x":1,"y":2}}（此例只说明结构，实际坐标必须来自本次输入的合法位置）。' +
  '根对象只允许text、segments、proposal、reason、plan、reviewRequired、affinityChange、dialogueCategory、publicSourceIds、checkSuggestion、publicDialogue；segments可选，数组元素{kind:"speech"或"action",text:"片段"}，按顺序连接必须与text一致；reason与reviewRequired放根对象，不放proposal内。' +
  '召唤能力仅在本次提供真实来源时可使用proposal.summon:{form,materialId,corpseIds?,maintainIds?,creatureType?}及destination{x,y}；这些是现有材料／遗骸引用，不授予新物品、职业、控制或身份。普通对话省略summon。'+
  '仅purpose=combat时可选publicDialogue:{text,segments?,publicSourceIds,dialogueCategory,reviewRequired}，表示独立公开发言候选；text根字段仍是GM规划说明，不可公开；不能在对白中宣告未结算命中、伤害或移动。普通对话省略publicDialogue。'+
  '可选字段不适用时省略，不能用null、空字符串或文字“无”占位；plan可为空数组。reviewRequired须为true或false，不用字符串。' +
  'affinityChange仅在输入启用好感度且确有建议时返回，否则省略。只输出JSON对象，不输出Markdown代码块或JSON前后的解释。'
