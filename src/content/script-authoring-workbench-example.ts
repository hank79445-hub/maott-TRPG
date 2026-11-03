import { authoringV16Example } from './script-authoring-v16-example'
import characterExamples from './authoring-character-examples.json'
import { authoringCharacterSchema } from '../persistence/authoring-character-schema'
import { authoringSchema, authorSceneSchema } from '../persistence/script-authoring-schema'
import { authoringSceneExample } from '../core/authoring-scene-instructions'
import { catalogue } from '../core/engine'

/** Original synthetic integration example; never derived from a running room. */
export function authoringWorkbenchExample() {
  const source = authoringV16Example(),
    scene = source.scenes[0]!
  source.title = '雾港脱困 · 新系统综合示例'
  const scholar = source.npcs[0]!
  scholar.cardType = 'character'
  scholar.character = authoringCharacterSchema.parse(
    structuredClone(characterExamples.find((c) => c.classId === 'wizard')!.character),
  )
  scholar.publicSpeechStyle = '简短务实；不愿回答时说“无可奉告”，不解释资料限制。'
  scholar.importanceRole='companion'
  scholar.resourceStrategy='balanced'
  scholar.practicalSocial={enabled:false,rules:[{id:'join-after-rescue',goal:'请在脱困后与我们同行',willingness:'judge',skill:'persuasion',dc:15,cost:'none',success:{text:'学者同意以可随队身份同行。',revealIds:[],promise:'我会按约定同行。',operations:[{kind:'follow',join:true}]},failure:{text:'学者暂时拒绝同行。',revealIds:[],promise:''}}]}
  source.knowledgeDesign = {
    factions: [
      {
        id: 'harbor-union',
        name: '港口互助会',
        description: '经营港口补给与救援。',
        hidden: false,
        initialScore: 0,
      },
      {
        id: 'night-charts',
        name: '夜航绘图社',
        description: 'GM设计的秘密组织。',
        hidden: true,
        initialScore: 0,
      },
    ],
    templates: [
      {
        id: 'harbor-weather',
        name: '港口常识',
        version: 1,
        layer: 'region',
        visibility: 'public',
        text: '退潮时码头石阶湿滑，回廊通向码头。',
      },
      {
        id: 'private-route',
        name: '私密航线',
        version: 1,
        layer: 'script',
        visibility: 'private',
        text: 'GM专用：夜航社的旧航线经过北侧暗礁，不属于全体NPC共同知识。',
      },
    ],
  }
  scholar.knowledgeProfile = {
    enabled: true,
    factionId: 'night-charts',
    membership: 'direct',
    hiddenMembership: true,
    backgroundBias: 0,
    lockedAttitude: null,
    lockReason: '',
    templateIds: ['harbor-weather', 'private-route'],
  }
  const merchant = source.npcs[2]!
  merchant.name = '补给商莱恩'
  merchant.side = 'neutral'
  merchant.fixedReplies = [
    { key: 'welcome', text: '火把和绳索都在这里。' },
    { key: 'price', text: '价钱写在货单上，其他的无可奉告。' },
  ]
  merchant.fixedReplyMode = 'end'
  merchant.fixedReplyEnd = '该说的我都说完了。'
  merchant.coinsGP = 25
  const keyId = 'harbor-example/bronze-key'
  merchant.merchantPolicy = {
    enabled: true,
    buy: true,
    buyRate: 0.5,
    buyItems: ['torch', 'rope'],
    blockedItems: [keyId],
    autoPurchase: false,
    zeroPrice: false,
    practical:{enabled:false,scope:'listed',buyback:true,barter:true,negotiation:true,dc:15,cost:'free'},
  }
  merchant.stock = [
    { itemId: 'torch', quantity: 4, priceGP: 0.01 },
    { itemId: 'rope', quantity: 2, priceGP: 1 },
  ]
  merchant.knowledgeProfile = {
    enabled: true,
    factionId: 'harbor-union',
    membership: 'direct',
    hiddenMembership: false,
    backgroundBias: 0,
    lockedAttitude: null,
    lockReason: '',
    templateIds: ['harbor-weather'],
  }
  const baseItem = catalogue().items.find((i) => i.id === 'crowbar')!
  source.itemPacks = [
    {
      id: 'harbor-example',
      version: '1',
      name: 'GM综合示例剧情道具',
      attribution: '原创合成测试示例，GM自定',
      classes: [],
      backgrounds: [],
      species: [],
      feats: [],
      spells: [],
      items: [
        {
          ...structuredClone(baseItem),
          id: keyId,
          name: '青铜钥匙',
          cost: 0,
          source: { ...baseItem.source, pack: 'harbor-example', version: '1' },
        },
      ],
    },
  ]
  scene.ground.push({ key: 'bronze-key', x: 3, y: 4, item: keyId, quantity: 1, hidden: false })
  const chest = scene.points.find((p) => p.key === 'supply-cache')!
  chest.itemUse = {
    match: 'all',
    requirements: [{ itemId: keyId, quantity: 1, mode: 'possess' }],
    effect: 'open',
    fallback: 'gm',
  }
  scene.fog = { mode:'enclosed',enabled: true, shared: true, rangeFeet: 60, initial: [],shading:{level1:.35,level2:.75},areas:[{id:'supply-room',name:'补给间',cells:['11,4','12,4','13,4','11,5','12,5','13,5','11,6','12,6','13,6'],doorIds:['release-door'],initiallyRevealed:false,revealOnOpen:true,manualOnly:false}] }
  scene.spatialSetup = authorSceneSchema.shape.spatialSetup.parse({
    ...structuredClone(authoringSceneExample.spatialSetup),
    light: 'dark',
    openSky: false,
    ceilingHeight: 20,
  })
  scene.effectSetup = authorSceneSchema.shape.effectSetup.parse(
    structuredClone(authoringSceneExample.effectSetup),
  )
  source.scenes[1]!.fog = { enabled: true, shared: false, rangeFeet: 60, initial: ['2,2'] }
  return authoringSchema.parse(source)
}
