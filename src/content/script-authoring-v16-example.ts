import { authoringExample } from './script-authoring-example'
import { authoringSchema } from '../persistence/script-authoring-schema'
export function authoringV16Example() {
  const source = authoringExample(),
    s = source.scenes[0]!
  s.points.push({
    key: 'supply-cache',
    kind: 'chest',
    name: '补给箱',
    x: 12,
    y: 5,
    text: '箱中放着旅行用品。',
    hidden: false,
    container: {
      items: [{ itemId: 'torch', quantity: 2 }],
      coins: 10,
      gmNote: '不自动发给全队；由角色领取。',
    },
  })
  s.points.push({
    key: 'release-door',
    kind: 'door',
    name: '释放门',
    x: 10,
    y: 5,
    text: '机关释放了门闩。',
    hidden: false,
  })
  s.points.push({
    key: 'scratch',
    kind: 'clue',
    name: '墙面擦痕',
    x: 6,
    y: 4,
    text: '擦痕指向回廊。',
    hidden: true,
    discovery: { method: 'proximity', range: 20, skill: 'perception', dc: 10 },
  })
  s.links = [
    {
      key: 'release',
      name: '释放机关组',
      color: '#397b9a',
      source: 'cage',
      outcome: 'success',
      effects: [{ point: 'release-door', operation: 'open' }],
    },
  ]
  source.quests = [
    {
      key: 'escape-route',
      title: '找到安全离开的路线',
      chapter: '囚室',
      description: '先观察囚室，再与获救者商议。',
      initialStatus: 'active',
      visibility: 'public',
      main: true,
      current: true,
      pinnedStep: 'rescue',
      steps: [
        {
          key: 'rescue',
          title: '解救被困学者',
          description: '检查囚笼机关。',
          visibility: 'public',
          initialStatus: 'active',
          after: [],
          scene: s.key,
          point: 'cage',
          trigger: 'point-success',
          alternatives: '机关无法解开时，寻找工具或请GM裁定其他方法。',
          gmNote: '确认解救结果后完成。',
        },
        {
          key: 'route',
          title: '检查回廊',
          description: '寻找可用出口。',
          visibility: 'hidden',
          initialStatus: 'inactive',
          after: ['rescue'],
          scene: source.scenes[1]!.key,
          trigger: 'scene-enter',
          alternatives: '询问获救学者，或退回囚室寻找线索。',
        },
      ],
    },
  ]
  return authoringSchema.parse(source)
}
