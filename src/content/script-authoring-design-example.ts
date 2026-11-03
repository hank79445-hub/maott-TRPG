import { authoringExample } from './script-authoring-example'
import { parseAuthoringValue } from '../persistence/script-authoring-schema'
export function authoringDesignExample(mode: 'milestone' | 'xp' = 'milestone') {
  const s = authoringExample()
  s.npcs[0]!.importanceRole = 'companion'
  s.npcs[0]!.publicSpeechStyle = '简短、警觉。身世不详时生硬地说：无可奉告。'
  s.npcs[0]!.gmDesign = {
    role: '可招募的学者',
    motivation: '希望离开囚室',
    joinConditions: '救出后由GM确认加入',
    leaveConditions: '队伍危及无辜时由GM决定',
    personalGoal: '寻找遗失手稿',
    alternatives: '拒绝同行时由码头联系人提供替代线索',
  }
  s.npcs[1]!.importanceRole = 'resident'
  s.npcs[1]!.publicSpeechStyle = '慢条斯理，只说亲眼见过的事。'
  s.npcs.push(
    {
      ...s.npcs[1]!,
      key: 'clerk',
      name: '码头抄录员',
      x: 9,
      y: 5,
      knowledge: '知道码头小艇的位置。',
    },
    {
      ...s.npcs[1]!,
      key: 'medic',
      name: '回廊医者',
      scene: 'gallery',
      x: 8,
      y: 4,
      knowledge: '知道附近安全的休息处。',
    },
  )
  for (const n of s.npcs.filter((n) => n.type === 'ordinary')) {
    n.fixedReplies = [
      { key: 'greeting', text: '止步。说你的来意。' },
      { key: 'warning', text: '潮水快涨了，别在这里磨蹭。' },
    ]
    n.fixedReplyMode = 'end'
    n.fixedReplyEnd = '该说的都说完了。'
  }
  s.quests = [
    {
      key: 'escape',
      title: '离开雾港',
      chapter: '第一章',
      description: '寻找离开雾港的安全路线。',
      initialStatus: 'active',
      visibility: 'public',
      main: true,
      current: true,
      scene: 'cells',
      gmDesign: {
        completion: 'GM确认队伍成功乘船',
        alternatives: '学者拒绝同行时可找抄录员；无法乘船可转向陆路',
        notes: '不自动发奖',
        npcIds: ['scholar', 'clerk'],
      },
    },
  ]
  s.growthGuide = {
    mode,
    players: 4,
    startLevel: 2,
    endLevel: 3,
    hours: 4,
    steps: [
      {
        title: '完成雾港逃离',
        chapter: '第一章',
        sceneId: 'dock',
        questId: 'escape',
        kind: mode === 'xp' ? 'quest' : 'milestone',
        suggestedLevel: mode === 'milestone' ? 3 : undefined,
        ...(mode === 'xp' ? { xp: 400, allocation: 'team-total' as const } : {}),
        sourceKind: 'gm',
        source: 'GM自定示例，不是官方奖励数值',
        reason: '战斗、潜行、交涉解决同一阻碍均算完成；不重复计算',
        challengeKey: 'escape-harbour',
      },
    ],
  }
  return parseAuthoringValue(s)
}
