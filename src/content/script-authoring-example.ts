import { authoringSchema, type Authoring } from '../persistence/script-authoring-schema'
/** Independent original sample; no live room or published adventure data. */
export function authoringExample(): Authoring {
  const scenes = [
    {
      key: 'cells',
      name: '潮汐囚室',
      intro: '潮水敲击石壁，囚笼旁的机关仍闪着微光。',
      points: [
        {
          key: 'cage',
          name: '解救学者',
          x: 8,
          y: 5,
          rescueNpc: 'scholar',
          text: '学者从开启的牢笼中走出。',
          check: { skill: 'investigation', dc: 10 },
          success: '牢笼打开，学者向救援者点头致谢。',
          failure: '锁扣没有松开，需要另寻办法。',
        },
        {
          key: 'exit',
          kind: 'exit',
          name: '前往回廊',
          x: 17,
          y: 12,
          exit: { scene: 'gallery', point: 'back' },
        },
      ],
    },
    {
      key: 'gallery',
      name: '守卫回廊',
      intro: '回廊尽头传来脚步声，警铃旁露着一根断线。',
      points: [
        {
          key: 'back',
          kind: 'exit',
          name: '返回囚室',
          x: 1,
          y: 12,
          exit: { scene: 'cells', point: 'exit' },
        },

        {
          key: 'bell',
          name: '警铃开关',
          x: 9,
          y: 7,
          arrivalGroup: 'reinforcements',
          success: '警铃响起，两名守卫从预设位置现身。',
        },
        {
          key: 'alarm-wire',
          name: '拆除警铃断线',
          x: 10,
          y: 7,
          check: { skill: 'sleightOfHand', dc: 12 },
          failureArrivalGroup: 'reinforcements',
          success: '断线被稳稳夹住，没有发出声响。',
          failure: '断线弹回，警铃响起，港卫应声现身。',
        },
        {
          key: 'exit',
          kind: 'exit',
          name: '前往码头',
          x: 17,
          y: 12,
          exit: { scene: 'dock', point: 'back' },
        },
      ],
    },
    {
      key: 'dock',
      name: '雾港码头',
      intro: '雾气中只有一艘尚未解缆的小艇。',
      points: [
        {
          key: 'back',
          kind: 'exit',
          name: '返回回廊',
          x: 1,
          y: 12,
          exit: { scene: 'gallery', point: 'exit' },
        },
        {
          key: 'fight',
          name: '冲突触发点',
          x: 10,
          y: 8,
          battle: 'dock-battle',
          text: 'GM核对参战者、阵营与先攻后开始冲突。',
        },
        {
          key: 'boat',
          name: '乘船逃离',
          x: 16,
          y: 10,
          success: '众人解开船缆，驶向雾中。冒险以逃离告终。',
        },
        {
          key: 'stay',
          name: '留下守望',
          x: 7,
          y: 10,
          success: '众人选择留守码头，等待下一次潮汐。冒险以留守告终。',
        },
      ],
    },
  ].map((s) => ({
    ...s,
    environment: s.key === 'dock' ? 'outdoor' : 'indoor',
    boundaryWalls: s.key === 'dock' ? 'explicit-only' : 'auto-enclose',
    description: s.intro,
    width: 20,
    height: 16,
    landing: { x: 2, y: 2 },
    floors: [{ x: 1, y: 1, width: 18, height: 14 }],
    ground: [],
  }))
  for (const [i, scene] of scenes.entries())
    Object.assign(scene, {
      art: {
        publicName: ['海底石室', '石砌回廊', '雾中码头'][i],
        description: [
          '潮湿的石砌囚室，粗石墙面附着少量海藻。中央为开放活动区，靠墙布置铁笼与控制台，通道保持清晰。',
          '狭长的海港守卫回廊，磨损石砖上有盐渍，墙边留有木凳和挂灯，中央通道畅通。',
          '临水的木石码头，雾气笼罩远处水面，靠岸停泊一艘空小艇，地面铺设系缆绳与木桩。',
        ][i],
        materials: i === 2 ? '潮湿木板、石阶与粗麻绳' : '粗石、铁栏与青铜',
        lighting: '暖色壁灯与冷色环境光，地板和出口边界清晰',
      },
    })
  Object.assign(scenes[0]!.points[0]!, {
    appearance: {
      label: '铁笼控制台',
      description: '低矮石台上嵌着一根青铜拉杆，金属表面有磨损',
      width: 1,
      height: 1,
      rotation: 0,
      visibility: 'public',
    },
  })
  Object.assign(
    scenes[1]!.points.find((p) => p.key === 'bell')!,
    {
      appearance: {
        label: '铜铃与拉绳',
        description: '墙边支架上悬挂一只铜铃，粗绳垂向地面',
        width: 1,
        height: 1,
        rotation: 90,
        visibility: 'public',
      },
    },
  )
  return authoringSchema.parse({
    format: 'trpg-authoring',
    version: 1,
    title: '雾港脱困',
    level: 2,
    players: 4,
    start: 'cells',
    opening: '潮汐将至。找到同伴，穿过守卫回廊，决定雾港的命运。',
    scenes,
    npcs: [
      {
        key: 'scholar',
        name: '被囚学者伊莲',
        scene: 'cells',
        x: 8,
        y: 4,
        template: 'srd-guard',
        type: 'important',
        side: 'neutral',
        knowledge: '知道回廊通向码头。',
        secret: '曾为港口的走私者绘制航线。',
        description: '疲惫但警觉的学者。',
        dialogue: '先帮我打开牢笼吧。',
      },
      {
        key: 'keeper',
        name: '守港人洛恩',
        scene: 'dock',
        x: 14,
        y: 6,
        template: 'srd-guard',
        type: 'important',
        side: 'neutral',
        knowledge: '码头有两条去路。',
        description: '守在雾港的老水手。',
        dialogue: '要走，还是留下？由你们决定。',
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        key: 'guard-' + (i + 1),
        name: '港卫' + (i + 1),
        scene: ['cells', 'gallery', 'dock'][Math.floor(i / 2)],
        x: i % 2 ? 12 : 5,
        y: 6,
        template: 'srd-guard',
        dialogue: '止步。',
      })),
    ],
    arrivals: [
      {
        key: 'reinforcements',
        scene: 'gallery',
        name: '警铃增援',
        npcs: ['guard-3', 'guard-4'],
        battleMode: 'start',
        intro: '两名港卫应警铃现身。',
      },
    ],
    battles: [
      {
        key: 'dock-battle',
        scene: 'dock',
        name: '码头冲突',
        npcs: ['guard-5', 'guard-6'],
        intro: '港卫阻住去路。',
      },
    ],
    broadcasts: [
      {
        title: '主持人提示',
        text: '逃离与留守为可选结局，确认队伍选择后触发对应互动；两者不应同时作为本团结局。',
        audience: 'gm',
        trigger: 'manual',
      },
    ],
  })
}

