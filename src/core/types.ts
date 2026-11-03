export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]
export const ABILITY_NAMES: Record<Ability, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力',
}
export const SKILLS: Record<string, { name: string; ability: Ability }> = {
  acrobatics: { name: '杂技', ability: 'dex' },
  animalHandling: { name: '驯兽', ability: 'wis' },
  arcana: { name: '奥秘', ability: 'int' },
  athletics: { name: '运动', ability: 'str' },
  deception: { name: '欺瞒', ability: 'cha' },
  history: { name: '历史', ability: 'int' },
  insight: { name: '洞悉', ability: 'wis' },
  intimidation: { name: '威吓', ability: 'cha' },
  investigation: { name: '调查', ability: 'int' },
  medicine: { name: '医药', ability: 'wis' },
  nature: { name: '自然', ability: 'int' },
  perception: { name: '察觉', ability: 'wis' },
  performance: { name: '表演', ability: 'cha' },
  persuasion: { name: '游说', ability: 'cha' },
  religion: { name: '宗教', ability: 'int' },
  sleightOfHand: { name: '巧手', ability: 'dex' },
  stealth: { name: '隐匿', ability: 'dex' },
  survival: { name: '生存', ability: 'wis' },
}
export interface Source {
  pack: string
  version: string
  page: number
  url?: string
  edition?: '2024' | 'custom'
  chapter?: string
  errata?: string
}
export interface Entry {
  id: string
  name: string
  english: string
  summary: string
  source: Source
  aliases?: string[]
}
export interface Spell extends Entry {
  level: number
  school: string
  lists: string[]
  ritual: boolean
  concentration: boolean
  castingTime: string
  range: string
  components: string
  duration: string
  description: string
}
export interface Item extends Entry {
  spellUse?: import('../persistence/item-spell-schema').ItemSpellDefinition
  kind: 'weapon' | 'armor' | 'shield' | 'gear' | 'tool' | 'pack'
  cost: number
  weight: number
  category?: string
  damage?: string
  damageType?: string
  properties?: string[]
  mastery?: string
  ac?: number
  dexCap?: number
  strength?: number
  stealthDisadvantage?: boolean
  contents?: { itemId: string; quantity: number }[]
  wearSlot?: WearSlot
  holdable?: boolean
  inventoryTag?: InventoryTag
}
export const WEAR_SLOTS = [
  'head',
  'cloak',
  'armor',
  'clothing',
  'hands',
  'feet',
  'accessories',
] as const
export type WearSlot = (typeof WEAR_SLOTS)[number]
export const EQUIPMENT_SLOTS = [...WEAR_SLOTS, 'main-hand', 'off-hand'] as const
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number]
export type Grip = 'one-handed' | 'two-handed'
export const INVENTORY_TAGS = [
  'weapons',
  'armor',
  'consumables',
  'tools',
  'materials',
  'containers',
  'misc',
] as const
export type InventoryTag = (typeof INVENTORY_TAGS)[number]
export interface EquipmentOption {
  label: string
  gp: number
  items: { itemId: string; quantity: number }[]
  choices?: { id: string; label: string; count: number; options: string[] }[]
}
export interface Class extends Entry {
  hitDie: number
  primary: Ability[]
  saves: Ability[]
  skillCount: number
  skills: string[]
  armor: string[]
  weapons: string[]
  features: string[]
  equipment: EquipmentOption[]
  spellAbility?: Ability
  cantrips?: number
  prepared?: number
  spellbook?: number
  slots?: number
  masteryCount?: number
  resource?: string
}
export interface Background extends Entry {
  abilities: Ability[]
  skills: string[]
  tool: string
  feat: string
  equipment: EquipmentOption[]
}
export interface Species extends Entry {
  speed: number
  sizes: string[]
  features: string[]
}
export interface Feat extends Entry {
  category: 'origin' | 'style' | 'general' | 'epic'
  minLevel: number
  repeatable?: boolean
  abilityIncrease?: { abilities: Ability[]; points: 1 | 2; maximum: 20 }
  prerequisite?: {
    abilities?: Partial<Record<Ability, number>>
    anyAbility?: { abilities: Ability[]; minimum: number }
    armor?: string[]
    feature?: 'fighting-style' | 'spellcasting'
    classes?: string[]
  }
  mechanic?: string
}
export interface Subclass extends Entry {
  classId: string
  minLevel: number
  features: { level: number; name: string; summary: string }[]
  spellGrants?: { level: number; ids: string[]; ability: 'int' | 'wis' | 'cha' }[]
}
export interface Pack {
  formatVersion?: 2
  id: string
  version: string
  name: string
  attribution: string
  classes: Class[]
  backgrounds: Background[]
  species: Species[]
  feats: Feat[]
  spells: Spell[]
  items: Item[]
  subclasses?: Subclass[]
}
export interface InventoryItem {
  spellEnchantments?:ActiveEffect[]
  specialWeapon?: SpecialWeapon
  consumable?: {
    kind: 'chef-treat' | 'poisoner-dose' | 'goodberry'
    clockSourceId?:string
    castId?:string
    value: number
    expiresAt?: number
    dc?: number
  }
  instanceId: string
  itemId: string
  quantity: number
  source: string
  equipped: boolean
  note: string
  containerId?: string | null
  equipmentSlot?: EquipmentSlot | null
  grip?: Grip | null
  uses?: number
  craftedBy?: string
  craftedAt?: number
}
export interface Adjustment {
  id: string
  field: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'hp' | 'ac'
  amount: number
  reason: string
}
export interface RollRecord {
  dice: number[][]
  totals: number[]
  at: string
}
export interface Build {
  npcPresentation?: { publicClass: boolean; publicSpecies: boolean; apparentSpecies?: string }
  growth?: GrowthRecord[]
  classId: string
  backgroundId: string
  speciesId: string
  method: 'array' | 'point' | 'roll'
  scores: Record<Ability, number>
  boosts: Record<Ability, number>
  rolls: RollRecord | null
  choices: Record<string, string[]>
  classEquipment: number
  backgroundEquipment: number
  equipmentChoices: Record<string, string[]>
  purchases: { itemId: string; quantity: number }[]
  equipped: string[]
  name: string
  alignment: string
  appearance: string
  story: string
  adjustments: Adjustment[]
  customItems: Item[]
}
export interface Character {
  npcOwnerId?: string
  purpose?: 'player' | 'npc' | 'shared'
  schemaVersion: 1
  level: number
  id: string
  revision: number
  status: 'draft' | 'complete'
  packs: { id: string; version: string }[]
  build: Build
  inventory: InventoryItem[]
  coins: number
  createdAt: string
  updatedAt: string
  runtime: RuntimeState | null
  journal?: RuntimeEvent[]
  portrait?: string | null
}
export const PORTRAIT_MAX_LENGTH = 180000
export const PORTRAIT_PATTERN = /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/
// Optional fields keep phase-1 archives readable. Operations normalize them once.
export interface RuntimeState {
  lastCastKey?: string
  itemCasts?: import('../persistence/item-spell-schema').ItemCastReceipt[]
  resistanceUsedTurn?: string | null
  grapples?: { targetId: string; encounterId: string; hand: 'main-hand' | 'off-hand' }[]
  mounted?: boolean
  advanced?: {
    ward: number | null
    portents: number[]
    surges?: {
      id: string
      roll: number
      subRolls: number[]
      detail: string
      startedAt: number
      endsAt: number
      settled: boolean
    }[]
    lastCheck: {
      id: string
      kind: 'skill' | 'save' | 'initiative' | 'ability'
      key: string
      total: number
      dc: number | null
      proficient: boolean
      attempted: boolean
      autoFail: boolean
    } | null
  }
  revelation?: { mode: 'wings' | 'radiance' | 'shroud'; endsAt: number } | null
  lastRest?: {
    kind: 'short' | 'long'
    endedAt: number
    crafted: boolean
    sang: boolean
    usedHitDice?: boolean
    fed?: boolean
    led?: boolean
  } | null
  knownBeasts?: string[]
  wildShape?: { formId: string; endsAt: number; equipment: 'merge' } | null
  hp: number
  temporaryHp: number
  resources: Record<string, number>
  createdSlots?: Record<string, number>
  conditions: string[]
  version?: 2
  exhaustion?: number
  hitDice?: number
  death?: { successes: number; failures: number; stable: boolean; dead: boolean }
  concentration?: {
    castId?: string
    spellId: string
    source: string
    castingKey?: string
    castingMode?: string
    extended?: boolean
    pendingDC: number | null
    endsAt?: number | null
  } | null
  rage?: boolean
  innateSorcery?: boolean
  heroicInspiration?: boolean
  restSpellChoices?: Record<string, string[]>
  preparedSpells?: string[] | null
  hours?: number
  prayerHealingSinceLongRest?:boolean
  nourishedUntil?:number
  lastLongRestEnd?: number | null
  effectEnds?: { rage: number | null; innateSorcery: number | null }
  effects?: ActiveEffect[]
}
export interface SpecialWeapon {
  templateId: string
  version: 1
  name: string
  description: string
  attackBonus: number
  damageBonus: number
  extraDamage: { formula: string; type: import('./combat-types').DamageType }[]
}
export interface ActiveEffect {
  m5AppliedHour?:number
  m5AppliedTick?:number
  protectedTypes?: string[]
  protectedSourceIds?: string[]
  m3?: import('./m3-spatial').M3EffectState
  sourceCreatureType?: string
  wardingBond?: { targetId: string }
  castId?: string
  spellId?: string
  spellLevel?: number
  hpBonus?: number
  acFloor?: number
  damageImmunities?: import('./combat-types').DamageType[]
  damageResistances?: import('./combat-types').DamageType[]
  conditionImmunities?: string[]
  flatSaveBonus?: number
  saveAdvantage?: Ability[]
  savePurposeAdvantage?: string[]
  checkAdvantage?: Ability
  maximizeHealing?: boolean
  deathSaveAdvantage?: boolean
  curse?: boolean
  supportChoice?: string
  spellDc?:number
  resistanceUsedTurn?: string
  clockSourceId?: string
  sleepStage?: 'drowsy' | 'asleep'
  speedZero?: boolean
  repeatAfterTick?: number
  conditions?: string[]
  socialTargetId?: string
  visibility?: 'public' | 'owner' | 'gm'
  grapple?: { hand: 'main-hand' | 'off-hand'; dc: number; range: number }
  charmSources?: string[]
  weapon?: { instanceId: string; bonus: number; dice?: string; damageType?: string }
  repeatSave?: { ability: Ability; dc: number }
  maintainedTick?: number
  fearContext?: {contextId?:string;tick:number;noSafeRoute:boolean;sourceVisible:boolean;movementResolved:boolean}
  directiveComplete?:boolean
  control?:{region?:{sceneId:string;template:import('./map-types').MapTemplate};dc:number;targets:string[];text:string;lastTick?:number;turnKey?:string;maintenanceKey?:string;trials?:{targetId:string;success:boolean}[];result?:boolean;inside?:boolean}
  endDamage?: {dice:string;damageType:import('./combat-types').DamageType}
  startDamage?: { dice: string; damageType: string; dc: number }
  variant?: 'valor'
  rollOverride?: number
  rollFloor?: number
  id: string
  key: string
  name: string
  sourceId: string
  page: number
  concentration: boolean
  expiresAt: number | null
  encounterId: string
  phase: 'start' | 'end'
  condition?: string
  ability?: Ability
  endsAt?: number
  acBonus?: number
  acBase?: number
  speedPenalty?: number
  speedBonus?: number
  attackAdvantage?: boolean
  attackDisadvantage?: boolean
  attackDie?: number
  saveDie?: number
  blocksHealing?: boolean
  noReaction?: boolean
  note: string
}
export type Runtime = Required<RuntimeState>
export interface RuntimeSnapshot {
  growth?: GrowthRecord[]
  choices?: Record<string, string[]>
  level?: number
  runtime: RuntimeState | null
  inventory: InventoryItem[]
  coins: number
}
export interface GrowthRecord {
  selectionVersion?: 2
  beforeSpellChoices?: Record<string, string[]>
  beforeChoices: Record<string, string[]>
  level: number
  hpMethod: 'fixed' | 'roll'
  hp: number
  choices: Record<string, string[]>
  abilityIncreases: Partial<Record<Ability, number>>
  at: string
  reason: string
}
export interface GrowthRequest {
  expectedRevision: number
  targetLevel: number
  hpMethod: 'fixed' | 'roll'
  choices: Record<string, string[]>
  abilityIncreases: Partial<Record<Ability, number>>
  confirmed: boolean
  reason: string
}
export interface RuntimeEvent {
  id: string
  at: string
  revision: number
  kind: string
  detail: string
  before: RuntimeSnapshot | null
  undone: boolean
}
export interface ChoiceOption {
  id: string
  name: string
  detail?: string
}
export interface Choice {
  id: string
  label: string
  source: string
  count: number
  options: ChoiceOption[]
  step: number
  kind?: 'spell'
  hint?: string
  ability?: Ability
  usage?: string
}
export interface Issue {
  step: number
  message: string
  key: string
}
export const SRD_SOURCE: Source = {
  pack: 'srd-5.2.1',
  version: '5.2.1',
  page: 19,
  url: 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf',
}
