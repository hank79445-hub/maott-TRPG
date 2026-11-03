import type { Item } from '../core/types'
import { SRD_SOURCE } from '../core/types'
const items: Item[] = []
function add(
  id: string,
  name: string,
  english: string,
  kind: Item['kind'],
  cost: number,
  weight: number,
  extra: Partial<Item> = {},
  page = 95,
) {
  items.push({
    id,
    name,
    english,
    kind,
    cost,
    weight,
    summary: english,
    source: { ...SRD_SOURCE, page },
    ...extra,
  })
}
// Costs in GP; ammunition prices and weight below are per piece, not per bundle.
const weapons = [
  ['club', '木棒', 'Club', '1d4', '钝击', 'light', 'Slow', 2, 0.1],
  ['dagger', '匕首', 'Dagger', '1d4', '穿刺', 'finesse,light,thrown20/60', 'Nick', 1, 2],
  ['greatclub', '巨棒', 'Greatclub', '1d8', '钝击', 'two-handed', 'Push', 10, 0.2],
  ['handaxe', '手斧', 'Handaxe', '1d6', '挥砍', 'light,thrown20/60', 'Vex', 2, 5],
  ['javelin', '标枪', 'Javelin', '1d6', '穿刺', 'thrown30/120', 'Slow', 2, 0.5],
  ['light-hammer', '轻锤', 'Light Hammer', '1d4', '钝击', 'light,thrown20/60', 'Nick', 2, 2],
  ['mace', '硬头锤', 'Mace', '1d6', '钝击', '', 'Sap', 4, 5],
  ['quarterstaff', '长棍', 'Quarterstaff', '1d6', '钝击', 'versatile1d8', 'Topple', 4, 0.2],
  ['sickle', '镰刀', 'Sickle', '1d4', '挥砍', 'light', 'Nick', 2, 1],
  ['spear', '矛', 'Spear', '1d6', '穿刺', 'thrown20/60,versatile1d8', 'Sap', 3, 1],
  ['dart', '飞镖', 'Dart', '1d4', '穿刺', 'finesse,thrown20/60', 'Vex', 0.25, 0.05],
  [
    'light-crossbow',
    '轻弩',
    'Light Crossbow',
    '1d8',
    '穿刺',
    'ammunition80/320,loading,two-handed',
    'Slow',
    5,
    25,
  ],
  ['shortbow', '短弓', 'Shortbow', '1d6', '穿刺', 'ammunition80/320,two-handed', 'Vex', 2, 25],
  ['sling', '投石索', 'Sling', '1d4', '钝击', 'ammunition30/120', 'Slow', 0, 0.1],
  ['battleaxe', '战斧', 'Battleaxe', '1d8', '挥砍', 'versatile1d10', 'Topple', 4, 10],
  ['flail', '连枷', 'Flail', '1d8', '钝击', '', 'Sap', 2, 10],
  ['glaive', '长柄刀', 'Glaive', '1d10', '挥砍', 'heavy,reach,two-handed', 'Graze', 6, 20],
  ['greataxe', '巨斧', 'Greataxe', '1d12', '挥砍', 'heavy,two-handed', 'Cleave', 7, 30],
  ['greatsword', '巨剑', 'Greatsword', '2d6', '挥砍', 'heavy,two-handed', 'Graze', 6, 50],
  ['halberd', '戟', 'Halberd', '1d10', '挥砍', 'heavy,reach,two-handed', 'Cleave', 6, 20],
  [
    'lance',
    '骑枪',
    'Lance',
    '1d10',
    '穿刺',
    'heavy,reach,two-handed-unless-mounted',
    'Topple',
    6,
    10,
  ],
  ['longsword', '长剑', 'Longsword', '1d8', '挥砍', 'versatile1d10', 'Sap', 3, 15],
  ['maul', '巨锤', 'Maul', '2d6', '钝击', 'heavy,two-handed', 'Topple', 10, 10],
  ['morningstar', '流星锤', 'Morningstar', '1d8', '穿刺', '', 'Sap', 4, 15],
  ['pike', '长枪', 'Pike', '1d10', '穿刺', 'heavy,reach,two-handed', 'Push', 18, 5],
  ['rapier', '刺剑', 'Rapier', '1d8', '穿刺', 'finesse', 'Vex', 2, 25],
  ['scimitar', '弯刀', 'Scimitar', '1d6', '挥砍', 'finesse,light', 'Nick', 3, 25],
  ['shortsword', '短剑', 'Shortsword', '1d6', '穿刺', 'finesse,light', 'Vex', 2, 10],
  ['trident', '三叉戟', 'Trident', '1d8', '穿刺', 'thrown20/60,versatile1d10', 'Topple', 4, 5],
  ['warhammer', '战锤', 'Warhammer', '1d8', '钝击', 'versatile1d10', 'Push', 5, 15],
  ['war-pick', '战镐', 'War Pick', '1d8', '穿刺', 'versatile1d10', 'Sap', 2, 5],
  ['whip', '鞭', 'Whip', '1d4', '挥砍', 'finesse,reach', 'Slow', 3, 2],
  ['blowgun', '吹箭筒', 'Blowgun', '1', '穿刺', 'ammunition25/100,loading', 'Vex', 1, 10],
  [
    'hand-crossbow',
    '手弩',
    'Hand Crossbow',
    '1d6',
    '穿刺',
    'ammunition30/120,light,loading',
    'Vex',
    3,
    75,
  ],
  [
    'heavy-crossbow',
    '重弩',
    'Heavy Crossbow',
    '1d10',
    '穿刺',
    'ammunition100/400,heavy,loading,two-handed',
    'Push',
    18,
    50,
  ],
  [
    'longbow',
    '长弓',
    'Longbow',
    '1d8',
    '穿刺',
    'ammunition150/600,heavy,two-handed',
    'Slow',
    2,
    50,
  ],
  [
    'musket',
    '火枪',
    'Musket',
    '1d12',
    '穿刺',
    'ammunition40/120,loading,two-handed',
    'Slow',
    10,
    500,
  ],
  ['pistol', '手枪', 'Pistol', '1d10', '穿刺', 'ammunition30/90,loading', 'Vex', 3, 250],
] as const
weapons.forEach((w, i) =>
  add(
    w[0],
    w[1],
    w[2],
    'weapon',
    w[8],
    w[7],
    {
      damage: w[3],
      damageType: w[4],
      properties: w[5].split(',').filter(Boolean),
      mastery: w[6],
      category:
        (i < 14 ? 'simple' : 'martial') +
        '-' +
        ((i >= 10 && i < 14) || i >= 32 ? 'ranged' : 'melee'),
    },
    91,
  ),
)
const armors = [
  ['padded', '布甲', 'Padded', 'light', 11, 99, 8, 5, 0, true],
  ['leather', '皮甲', 'Leather', 'light', 11, 99, 10, 10, 0, false],
  ['studded-leather', '镶钉皮甲', 'Studded Leather', 'light', 12, 99, 13, 45, 0, false],
  ['hide', '兽皮甲', 'Hide', 'medium', 12, 2, 12, 10, 0, false],
  ['chain-shirt', '链甲衫', 'Chain Shirt', 'medium', 13, 2, 20, 50, 0, false],
  ['scale-mail', '鳞甲', 'Scale Mail', 'medium', 14, 2, 45, 50, 0, true],
  ['breastplate', '胸甲', 'Breastplate', 'medium', 14, 2, 20, 400, 0, false],
  ['half-plate', '半身板甲', 'Half Plate', 'medium', 15, 2, 40, 750, 0, true],
  ['ring-mail', '环甲', 'Ring Mail', 'heavy', 14, 0, 40, 30, 0, true],
  ['chain-mail', '链甲', 'Chain Mail', 'heavy', 16, 0, 55, 75, 13, true],
  ['splint', '板条甲', 'Splint', 'heavy', 17, 0, 60, 200, 15, true],
  ['plate', '板甲', 'Plate', 'heavy', 18, 0, 65, 1500, 15, true],
] as const
armors.forEach((a) =>
  add(
    a[0],
    a[1],
    a[2],
    'armor',
    a[7],
    a[6],
    { category: a[3], ac: a[4], dexCap: a[5], strength: a[8], stealthDisadvantage: a[9] },
    92,
  ),
)
add('shield', '盾牌', 'Shield', 'shield', 10, 6, { ac: 2, category: 'shield' }, 92)
const tools = [
  ['alchemist', '炼金工具', 'Alchemist’s Supplies', 50, 8],
  ['brewer', '酿酒工具', 'Brewer’s Supplies', 20, 9],
  ['calligrapher', '书法工具', 'Calligrapher’s Supplies', 10, 5],
  ['carpenter', '木匠工具', 'Carpenter’s Tools', 8, 6],
  ['cartographer', '制图工具', 'Cartographer’s Tools', 15, 6],
  ['cobbler', '鞋匠工具', 'Cobbler’s Tools', 5, 5],
  ['cook', '厨具', 'Cook’s Utensils', 1, 8],
  ['glassblower', '吹玻璃工具', 'Glassblower’s Tools', 30, 5],
  ['jeweler', '珠宝匠工具', 'Jeweler’s Tools', 25, 2],
  ['leatherworker', '皮匠工具', 'Leatherworker’s Tools', 5, 5],
  ['mason', '石匠工具', 'Mason’s Tools', 10, 8],
  ['painter', '画家工具', 'Painter’s Supplies', 10, 5],
  ['potter', '陶工工具', 'Potter’s Tools', 10, 3],
  ['smith', '铁匠工具', 'Smith’s Tools', 20, 8],
  ['tinker', '修补工具', 'Tinker’s Tools', 50, 10],
  ['weaver', '织工工具', 'Weaver’s Tools', 1, 5],
  ['woodcarver', '木雕工具', 'Woodcarver’s Tools', 1, 5],
  ['disguise-kit', '易容工具', 'Disguise Kit', 25, 3],
  ['forgery-kit', '伪造工具', 'Forgery Kit', 15, 5],
  ['herbalism-kit', '草药工具', 'Herbalism Kit', 5, 3],
  ['navigator', '领航工具', 'Navigator’s Tools', 25, 2],
  ['poisoner-kit', '毒药工具', 'Poisoner’s Kit', 50, 2],
  ['thieves-tools', '盗贼工具', 'Thieves’ Tools', 25, 1],
  ['dice-set', '骰子套组', 'Dice', 0.1, 0],
  ['dragonchess', '龙棋', 'Dragonchess', 1, 0],
  ['playing-cards', '纸牌', 'Playing Cards', 0.5, 0],
  ['three-dragon-ante', '三龙牌', 'Three-Dragon Ante', 1, 0],
  ['bagpipes', '风笛', 'Bagpipes', 30, 6],
  ['drum', '鼓', 'Drum', 6, 3],
  ['dulcimer', '扬琴', 'Dulcimer', 25, 10],
  ['flute', '长笛', 'Flute', 2, 1],
  ['horn', '号角', 'Horn', 3, 2],
  ['lute', '鲁特琴', 'Lute', 35, 2],
  ['lyre', '里拉琴', 'Lyre', 30, 2],
  ['pan-flute', '排箫', 'Pan Flute', 12, 2],
  ['shawm', '芦笛', 'Shawm', 2, 1],
  ['viol', '提琴', 'Viol', 30, 1],
] as const
tools.forEach((t, i) =>
  add(
    t[0],
    t[1],
    t[2],
    'tool',
    t[3],
    t[4],
    {
      category:
        i < 17 ? 'artisan' : i >= 27 ? 'instrument' : i >= 23 && i < 27 ? 'gaming' : 'other',
    },
    i < 14 ? 93 : 94,
  ),
)
const gear = [
  ['acid', '强酸', 'Acid', 25, 1],
  ['alchemists-fire', '炽火胶', 'Alchemist’s Fire', 50, 1],
  ['antitoxin', '抗毒剂', 'Antitoxin', 50, 0],
  ['backpack', '背包', 'Backpack', 2, 5],
  ['ball-bearings', '滚珠袋', 'Ball Bearings', 1, 2],
  ['barrel', '桶', 'Barrel', 2, 70],
  ['basket', '篮子', 'Basket', 0.4, 2],
  ['bedroll', '铺盖', 'Bedroll', 1, 7],
  ['bell', '铃铛', 'Bell', 1, 0],
  ['blanket', '毯子', 'Blanket', 0.5, 3],
  ['block-tackle', '滑轮组', 'Block and Tackle', 1, 5],
  ['book', '书', 'Book', 25, 5],
  ['glass-bottle', '玻璃瓶', 'Glass Bottle', 2, 2],
  ['bucket', '水桶', 'Bucket', 0.05, 2],
  ['caltrops', '铁蒺藜袋', 'Caltrops', 1, 2],
  ['candle', '蜡烛', 'Candle', 0.01, 0],
  ['bolt-case', '弩矢盒', 'Crossbow Bolt Case', 1, 1],
  ['scroll-case', '地图卷轴盒', 'Map or Scroll Case', 1, 1],
  ['chain', '链条', 'Chain', 5, 10],
  ['chest', '箱子', 'Chest', 5, 25],
  ['climbers-kit', '攀爬工具', 'Climber’s Kit', 25, 12],
  ['fine-clothes', '华服', 'Fine Clothes', 15, 6],
  ['travel-clothes', '旅行服', 'Traveler’s Clothes', 2, 4],
  ['component-pouch', '材料包', 'Component Pouch', 25, 2],
  ['costume', '戏服', 'Costume', 5, 4],
  ['crowbar', '撬棍', 'Crowbar', 2, 5],
  ['flask', '扁瓶', 'Flask', 0.02, 1],
  ['grappling-hook', '抓钩', 'Grappling Hook', 2, 4],
  ['healers-kit', '医疗包', 'Healer’s Kit', 5, 3],
  ['holy-water', '圣水', 'Holy Water', 25, 1],
  ['hunting-trap', '捕兽夹', 'Hunting Trap', 5, 25],
  ['ink', '墨水', 'Ink', 10, 0],
  ['ink-pen', '墨水笔', 'Ink Pen', 0.02, 0],
  ['jug', '壶', 'Jug', 0.02, 4],
  ['ladder', '梯子', 'Ladder', 0.1, 25],
  ['lamp', '油灯', 'Lamp', 0.5, 1],
  ['bullseye-lantern', '牛眼提灯', 'Bullseye Lantern', 10, 2],
  ['hooded-lantern', '附罩提灯', 'Hooded Lantern', 5, 2],
  ['lock', '锁', 'Lock', 10, 1],
  ['magnifying-glass', '放大镜', 'Magnifying Glass', 100, 0],
  ['manacles', '镣铐', 'Manacles', 2, 6],
  ['map', '地图', 'Map', 1, 0],
  ['mirror', '镜子', 'Mirror', 5, 0.5],
  ['net', '网', 'Net', 1, 3],
  ['oil', '油（瓶）', 'Oil', 0.1, 1],
  ['paper', '纸（张）', 'Paper', 0.2, 0],
  ['parchment', '羊皮纸（张）', 'Parchment', 0.1, 0],
  ['perfume', '香水', 'Perfume', 5, 0],
  ['basic-poison', '基础毒药', 'Basic Poison', 100, 0],
  ['pole', '长杆', 'Pole', 0.05, 7],
  ['iron-pot', '铁锅', 'Iron Pot', 2, 10],
  ['healing-potion', '治疗药水', 'Potion of Healing', 50, 0.5],
  ['pouch', '小包', 'Pouch', 0.5, 1],
  ['quiver', '箭袋', 'Quiver', 1, 1],
  ['portable-ram', '便携撞锤', 'Portable Ram', 4, 35],
  ['rations', '口粮（天）', 'Rations', 0.5, 2],
  ['robe', '长袍', 'Robe', 1, 4],
  ['rope', '绳索（50尺）', 'Rope', 1, 5],
  ['sack', '麻袋', 'Sack', 0.01, 0.5],
  ['shovel', '铲子', 'Shovel', 2, 5],
  ['signal-whistle', '信号哨', 'Signal Whistle', 0.05, 0],
  ['iron-spikes', '铁钉（10枚）', 'Iron Spikes', 1, 5],
  ['spyglass', '望远镜', 'Spyglass', 1000, 1],
  ['string', '细绳（10尺）', 'String', 0.1, 0],
  ['tent', '帐篷', 'Tent', 2, 20],
  ['tinderbox', '火绒盒', 'Tinderbox', 0.5, 1],
  ['torch', '火把', 'Torch', 0.01, 1],
  ['vial', '小瓶', 'Vial', 1, 0],
  ['waterskin', '水袋（满）', 'Waterskin', 0.2, 5],
  ['arrow', '箭（枚）', 'Arrow', 0.05, 0.05],
  ['bolt', '弩矢（枚）', 'Bolt', 0.05, 0.075],
  ['firearm-bullet', '火枪弹（枚）', 'Firearm Bullet', 0.3, 0.2],
  ['sling-bullet', '投石弹（枚）', 'Sling Bullet', 0.002, 0.075],
  ['needle', '吹箭（枚）', 'Needle', 0.02, 0.02],
  ['arcane-crystal', '奥术水晶', 'Arcane Focus: Crystal', 10, 1],
  ['arcane-orb', '奥术法球', 'Arcane Focus: Orb', 20, 3],
  ['arcane-rod', '奥术短杖', 'Arcane Focus: Rod', 10, 2],
  ['arcane-wand', '奥术魔杖', 'Arcane Focus: Wand', 10, 1],
  ['mistletoe', '槲寄生枝', 'Druidic Focus: Mistletoe', 1, 0],
  ['yew-wand', '紫杉魔杖', 'Druidic Focus: Yew Wand', 10, 1],
  ['holy-amulet', '圣徽护符', 'Holy Symbol: Amulet', 5, 1],
  ['holy-emblem', '圣徽纹章', 'Holy Symbol: Emblem', 5, 0],
  ['holy-reliquary', '圣徽圣物匣', 'Holy Symbol: Reliquary', 5, 2],
  ['spellbook', '法术书', 'Spellbook', 50, 3],
] as const
gear.forEach((t) => add(t[0], t[1], t[2], 'gear', t[3], t[4]))
for (const [id, name, en] of [
  ['arcane-staff', '奥术长棍', 'Arcane Focus: Staff'],
  ['druid-staff', '德鲁伊长棍', 'Druidic Focus: Wooden Staff'],
]) {
  add(
    id!,
    name!,
    en!,
    'weapon',
    5,
    4,
    {
      category: 'simple-melee',
      damage: '1d6',
      damageType: '钝击',
      properties: ['versatile1d8'],
      mastery: 'Topple',
    },
    id === 'druid-staff' ? 97 : 96,
  )
}
function pack(
  id: string,
  name: string,
  english: string,
  cost: number,
  weight: number,
  contents: string,
  page: number,
) {
  add(
    id,
    name,
    english,
    'pack',
    cost,
    weight,
    {
      summary: '展开后分别进入初始背包。',
      contents: contents.split(',').map((x) => {
        const [itemId, n] = x.split(':')
        return { itemId: itemId!, quantity: Number(n || 1) }
      }),
    },
    page,
  )
}
pack(
  'burglar-pack',
  '窃贼套组',
  'Burglar’s Pack',
  16,
  42,
  'backpack,ball-bearings,bell,candle:10,crowbar,hooded-lantern,oil:7,rations:5,rope,tinderbox,waterskin',
  96,
)
pack(
  'diplomat-pack',
  '外交官套组',
  'Diplomat’s Pack',
  39,
  39,
  'chest,fine-clothes,ink,ink-pen:5,lamp,scroll-case:2,oil:4,paper:5,parchment:5,perfume,tinderbox',
  97,
)
pack(
  'dungeoneer-pack',
  '地城套组',
  'Dungeoneer’s Pack',
  12,
  55,
  'backpack,caltrops,crowbar,oil:2,rations:10,rope,tinderbox,torch:10,waterskin',
  97,
)
pack(
  'entertainer-pack',
  '艺人套组',
  'Entertainer’s Pack',
  40,
  58.5,
  'backpack,bedroll,bell,bullseye-lantern,costume:3,mirror,oil:8,rations:9,tinderbox,waterskin',
  97,
)
pack(
  'explorer-pack',
  '探索者套组',
  'Explorer’s Pack',
  10,
  55,
  'backpack,bedroll,oil:2,rations:10,rope,tinderbox,torch:10,waterskin',
  97,
)
pack(
  'priest-pack',
  '祭司套组',
  'Priest’s Pack',
  33,
  29,
  'backpack,blanket,holy-water,lamp,rations:7,robe,tinderbox',
  99,
)
pack(
  'scholar-pack',
  '学者套组',
  'Scholar’s Pack',
  40,
  22,
  'backpack,book,ink,ink-pen,lamp,oil:10,parchment:10,tinderbox',
  99,
)
// Presentation metadata never grants a numerical or magical effect.
for (const item of items) {
  if (['robe', 'fine-clothes', 'travel-clothes', 'costume'].includes(item.id))
    item.wearSlot = 'clothing'
  if (item.id === 'holy-amulet') item.wearSlot = 'accessories'
  if (['backpack', 'pouch', 'sack', 'basket', 'chest', 'barrel'].includes(item.id)) {
    item.category = 'container'
    item.inventoryTag = 'containers'
  }
  if (
    [
      'healing-potion',
      'holy-water',
      'basic-poison',
      'rations',
      'oil',
      'torch',
      'candle',
      'arrow',
      'bolt',
      'firearm-bullet',
      'sling-bullet',
      'needle',
    ].includes(item.id)
  )
    item.inventoryTag = 'consumables'
  if (
    item.id.startsWith('arcane-') ||
    item.id.startsWith('holy-') ||
    ['mistletoe', 'yew-wand', 'druid-staff', 'component-pouch', 'spellbook'].includes(item.id)
  )
    item.inventoryTag = 'materials'
  if (
    item.id.startsWith('arcane-') ||
    item.id.startsWith('holy-') ||
    [
      'mistletoe',
      'yew-wand',
      'torch',
      'candle',
      'lamp',
      'bullseye-lantern',
      'hooded-lantern',
      'spellbook',
      'crowbar',
      'rope',
    ].includes(item.id)
  )
    item.holdable = true
}
export default items
