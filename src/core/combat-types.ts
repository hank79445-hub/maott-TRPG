import type { Ability, ActiveEffect, Character, RuntimeSnapshot } from './types'
import type { RuntimeCommand } from './runtime'

export const DEFENSE_NAMES = {
  uncanny: '诡异闪避',
  deflect: '偏转攻击',
  stone: '石之坚韧',
} as const
export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]
export const DAMAGE_NAMES: Record<DamageType, string> = {
  acid: '强酸',
  bludgeoning: '钝击',
  cold: '寒冷',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '黯蚀',
  piercing: '穿刺',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  slashing: '挥砍',
  thunder: '雷鸣',
}
export interface NpcAttack {
  unarmed?:boolean
  projectile?: 'ordinary'|'massive'|'energy'
  ability?:Ability
  extraDamage?: { formula: string; type: DamageType; when?: 'advantage' | 'charge' }[]
  proneMaxSize?: 'medium' | 'large'
  proneRequiresCharge?: boolean
  advantageWhileGrappling?: boolean
  effectNote?: string
  manualOnly?: boolean
  id: string
  name: string
  bonus: number
  damage: string
  damageType: DamageType
  reach: number
  range: number
  longRange: number
  kind?: 'weapon' | 'thrown' | 'spell'
}
export interface CombatNpc {
  equipment?:import('./spell-weapon-riders').NpcEquipment[]
  prayerHealingSinceLongRest?:boolean
  resistanceUsedTurn?: string | null
  abilities?: import('./npc-abilities').NpcMonsterAbility[]
  resources?: import('./npc-abilities').NpcResourcePool[]
  spellcasting?: { ability: Ability; dc: number; attackBonus: number; level?:number }
  concentration?: { spellId: string; castId?:string; clockSourceId?:string; endsAt?:number; pendingDC?: number; expiresAt?: number; encounterId?: string }
  magicResistance?: boolean
  authorityAura?: boolean
  shape?: 'imp' | 'rat' | 'raven' | 'spider'
  templateMetadata?: import('./npc-template-types').NpcTemplateMetadata
  multiattackChoice?: { count: number; attackIds: string[] }
  nimbleEscape?: boolean
  bloodiedFury?: boolean
  undeadFortitude?: boolean
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'
  multiattack?: string[]
  packTactics?: boolean
  creatureType?:
    'humanoid' | 'beast' | 'monstrosity' | 'celestial' | 'fey' | 'fiend' | 'undead' | 'giant' | 'other'
  name: string
  ac: number
  maxHp: number
  hp: number
  temporaryHp: number
  speed: number
  scores: Record<Ability, number>
  saves: Record<Ability, number>
  initiativeBonus: number
  attacks: NpcAttack[]
  resistances: DamageType[]
  vulnerabilities: DamageType[]
  immunities: DamageType[]
  conditionImmunities: string[]
  conditions: string[]
  effects: ActiveEffect[]
  dead: boolean
  source: string
}
export interface TurnBudget {
  npcMultiattackOptions?: string[]
  groundTrail?: import('./map-types').Position[]
  npcMultiattackLeft?: string[]
  lastAttack?: {
    targetDown?: boolean
    targetId: string
    weaponId: string | null
    unarmed: boolean
    ranged: boolean
    type: DamageType
    critical: boolean
    hit: boolean
    damaged: boolean
    tick: number
    token: string
  }
  lastSpell?: { id: string; school: string; slot: number; token: string }
  levelSpellCast?: boolean
  quickenedCast?: boolean
  flurryLeft?: number
  deathSaveDone: boolean
  objectInteraction: boolean
  action: boolean
  manualUsed?: string[]
  attacksLeft?: number
  surgeUsed?: boolean
  surgeAction?: boolean
  bonus: boolean
  reaction: boolean
  movement: number
  dash: number
  lightWeapon: string | null
  lightWeapons?: string[]
  lightUsed: boolean
  nickUsed: boolean
  cleaveUsed: boolean
  sneakUsed: boolean
  savageUsed: boolean
  loading: string[]
}
export interface Combatant {
  npcId?: string
  companion?: {
    instanceId?:string
    castId?:string
    sourceEntityId?:string
    ownerId: string
    source: 'wild-companion' | 'spell-summon' | 'primal-companion' | 'wild-surge'
    surgeId?: string
    expiresHour?: number
    spellId?: string
    castingAbility?: Ability
    ownerLevel?: number
    slotLevel?: number
    form?: string
    controllerExpired?:boolean
      worldManaged?:boolean
    controlledMount?:boolean
    commandText?:string
    commandedTick?: number
    deathAt?: number | null
    reviveAt?: number | null
    expiresAfterRest: number | null
    dismissed: boolean
  }
  id: string
  characterId: string | null
  npc: CombatNpc | null
  side: 'party' | 'enemy' | 'neutral'
  initiative: number | null
  initiativeRoll?: D20Result
  surprised: boolean
  turn: TurnBudget
}
export interface Environment {
  windWallMiss?: boolean
  npcChargeConfirmed?: boolean
  npcGrappleConfirmed?: boolean
  crusaderActive?: boolean
  protectionActive?: boolean
  distance: number
  cover: 'none' | 'half' | 'three-quarters' | 'total'
  attackerHears?:boolean
  attackerSees: boolean
  targetSees: boolean
  nearbyEnemy: boolean
  advantage: boolean
  disadvantage: boolean
  fearVisible: boolean
  targetLocationConfirmed: boolean
  areaConfirmed: boolean
  note: string
  attackAdvantages?: string[]
  spatial?: string
}
export interface D20Result {
  dice: number[]
  chosen: number
  bonus: number
  bonusDice: number[]
  total: number
  mode: 'normal' | 'advantage' | 'disadvantage'
  reasons: string[]
  autoFail: boolean
}
export interface DamageReroll {
  index: number
  from: number
  to: number
  reason: 'tavern-brawler' | 'healer'
}
export interface DamageRoll {
  rerolls?: DamageReroll[]
  formula: string
  dice: number[]
  flat: number
  total: number
}
export interface DamagePart {
  type: DamageType
  roll: DamageRoll
}
export interface AttackSpec {
  projectile?: 'ordinary'|'massive'|'energy'
  abilityKnown?:boolean
  damageBonus?: number
  extraDamage?: { formula: string; type: DamageType; when?: 'advantage' | 'charge' }[]
  proneMaxSize?: 'medium' | 'large'
  proneRequiresCharge?: boolean
  advantageWhileGrappling?: boolean
  effectNote?: string
  id: string
  name: string
  bonus: number
  ability: Ability
  modifier: number
  damage: string
  type: DamageType
  ranged: boolean
  reach: number
  range: number
  longRange: number
  weaponId: string | null
  instanceId: string | null
  properties: string[]
  mastery: string | null
  page: number
}
export interface PendingTarget {
  hitSpellDamage?: DamagePart[]
  mirror?: { effectId:string; rolls:number[]; destroyed:boolean }
  sanctuaryBlocked?:boolean
  acBonus?: number
  damageOverride?: DamagePart[]
  interceptions?: { sourceId: string; reduction: number; kind?: string }[]
  defense?: { kind: 'uncanny' | 'deflect' | 'stone'; reduction: number }
  id: string
  env: Environment
  roll: D20Result | null
  hit: boolean
  critical: boolean
  ac: number
}
export interface PendingAction {
  concentrationSave?: {actorId:string;spellId:string;castId?:string;dc:number}
  iceBurst?:import('./m5a-spells').IceBurst
  m5Area?:import('./map-types').MapTemplate
  attackLocked?:boolean
  m5EffectId?:string
  notCasting?:boolean
  summonDraftId?:string
  sceneEffectCastId?:string
  areaTargets?:string[]
  areaEnvironments?:Record<string,Environment>
  gmChoice?:import('../persistence/gm-spell-choice-schema').GmSpellChoice
  attackWindowId?:string
  m3WorldId?:string
  reactionFrame?: { kind:'shield'|'counterspell'; dc?:number; env?:Environment }
  zoneCreation?:PersistentZone
  zoneAmmo?:{instanceId:string;count:number}
  enfeeblementReduced?:boolean
  controlRegion?:{sceneId:string;template:import('./map-types').MapTemplate}
  castingId?:string
  sanctuaryFailures?:string[]
  sanctuaryPassed?:string[]
  dispelZoneId?:string
  utilityId?: string
  m3Choice?: import('./m3-spells').M3CastChoice
  supportChoice?: string
  controlChoices?:Record<string,string>
  controlTargets?:string[]
  controlText?:string
  afterWeapon?: WeaponHandling['after']
  unarmed?: {
    kind: 'grapple' | 'prone' | 'push'
    hand: 'main-hand' | 'off-hand'
    range: number
    pushTo?: { x: number; y: number }
  }
  boundWeaponId?: string
  bonusDamage?: DamagePart[]
  damageRolled?: boolean
  resolutionDraft?: string[]
  damageChoices?: { savage: boolean; tavernReroll: boolean }
  damageAlways?: boolean
  id?: string
  metamagic?: {
    option: string
    protectedIds: string[]
    heightenedId: string
    damageType: DamageType
  }
  triggered?: string[]
  kind: 'attack' | 'save' | 'automatic' | 'manual'
  actorId: string
  name: string
  page: number
  spellId: string | null
  itemReceipt?: {receiptId:string;item:import('./types').InventoryItem}
  slotReceipt?: {resourceId:string;created:boolean}
  sourceKey?: string
  slotLevel?: number
  attack: AttackSpec | null
  targets: PendingTarget[]
  damage: DamagePart[]
  save: Ability | null
  dc: number | null
  half: boolean
  effectKey: string | null
  modifier: number
  mode: string
  notes: string[]
  sneak: boolean
  mastery: boolean
  startedAt: number
}
export interface PersistentZone {
  castId?:string
  explorationTriggered?: string[]
  template?: import('./map-types').MapTemplate
  id: string
  sourceId: string
  spellId:
    'moonbeam' | 'spirit-guardians' | 'cloud-of-daggers' | 'hunger-of-hadar' | 'cordon-of-arrows'
  createdTick?: number
  ammunition?: number
  phaseTriggered?: Record<string, Partial<Record<'start' | 'end' | 'enter', number>>>
  name: string
  dc: number
  slotLevel: number
  damageType: DamageType
  expiresHour: number
  excludedIds: string[]
  triggered: Record<string, number>
  note: string
}
export interface EncounterState {
  attackWindows?: import('./spell-attack-windows').HitSpellWindow[]
  attackParents?: PendingAction[]
  reactionParents?: PendingAction[]
  session?: {
    adventureId: string
    sceneId: string
    preparedAt: string
    startedAt: string | null
    intro?: string
    introPlayed?: boolean
    canceled?: boolean
  }
  zones?: PersistentZone[]
  id: string
  name: string
  version: 1
  phase: 'setup' | 'active' | 'ended'
  round: number
  tick: number
  current: number
  actors: Combatant[]
  pending: PendingAction | null
  slotSpent: string[]
  lastDamage: { actorId: string; sourceId: string; tick: number } | null
}
export interface CombatSnapshot {
  encounter: EncounterState
  characters: Record<
    string,
    { state: RuntimeSnapshot; revision: number; journal: Character['journal'] }
  >
}
export interface CombatEvent {
  damageResults?: { actorId: string; pendingId: string | null; damage: number; types: string;damageReceived?:number;receivedTypes?:Partial<Record<DamageType,number>>;typeAmounts?:Partial<Record<DamageType,number>> }[]
  outcomes?: {
    actorId: string
    kind: 'save' | 'concentration' | 'death-save' | 'check'
    total: number
    success: boolean
  }[]
  id: string
  at: string
  kind: string
  detail: string
  before: CombatSnapshot | null
  revisions: Record<string, number>
  undone: boolean
}
export interface Encounter extends EncounterState {
  log: CombatEvent[]
}
export interface WeaponHandling {
  before: Extract<RuntimeCommand, { type: 'equip' }>[]
  after: Extract<RuntimeCommand, { type: 'equip' }>[]
}
export type CombatCommand =
 | {type:'familiar-strike';actorId:string;ownerId:string;targetId:string;receipt:string;env:Environment}
 | {type:'effect-action-cost';actorId:string;cost:'action'|'bonus';magic:boolean}
 | {type:'m5-strike';actorId:string;targetIds:string[];spellId:string;effectId:string;cost:'action'|'bonus'|'none';kind:'attack'|'save'|'automatic';formula:string;damageType:DamageType;ability:Ability;modifier:number;attackBonus:number;dc:number;save?:Ability;half:boolean;envs:Record<string,Environment>}
 | {type:'escape-vines';actorId:string;targetId:string;effectId:string;env:Environment;note:string}
 | {type:'transfer-mark';actorId:string;effectId:string;targetId:string;env:Environment;note:string}
 | {type:'hit-spell';actorId:string;targetId:string;attackId:string;key:string;mode:string;note:string;areaTargets?:string[];areaEnvironments?:Record<string,Environment>}
 | {type:'scene-flame';actorId:string;targetId:string;key:string;env:Environment}

  | {type:'control-ruling';actorId:string;effectId:string;operation:'crown-target'|'illusion-study'|'illusion-damage'|'truth-presence'|'activity-complete'|'witness-harm'|'duel-distance';targetId?:string;inside:boolean;confirmed:boolean;note:string}
  | {type:'command-complete';actorId:string;effectId:string;confirmed:boolean;note:string}
  | {type:'sanctuary-retarget';actorId:string;targetIndex:number;targetId:string;env:Environment}
  | {type:'fear-context';actorId:string;effectId:string;noSafeRoute:boolean;sourceVisible:boolean;movementResolved:boolean;confirmed:boolean;note:string}
  | {
      type: 'unarmed'
      actorId: string
      targetId: string
      kind: 'grapple' | 'prone' | 'push'
      save: 'str' | 'dex'
      hand: 'main-hand' | 'off-hand'
      cost: 'action' | 'martial' | 'flurry' | 'opportunity' | 'agile'
      env: Environment
      pushTo?: { x: number; y: number }
      handling?: WeaponHandling
    }
  | { type: 'grapple-release'; actorId: string; targetId: string }
  | {
      type: 'grapple-escape'
      actorId: string
      sourceId: string
      skill: 'athletics' | 'acrobatics'
      env: Environment
    }
  | {
      type: 'npc-ability'
      summonDraftId?:string
  sceneEffectCastId?:string
  areaTargets?:string[]
  areaEnvironments?:Record<string,Environment>
  gmChoice?:import('../persistence/gm-spell-choice-schema').GmSpellChoice
  attackWindowId?:string
  m3WorldId?:string
      dispelZoneId?:string
      m3Choice?: import('./m3-spells').M3CastChoice
  supportChoice?: string
  controlChoices?:Record<string,string>
  controlTargets?:string[]
  controlText?:string
      willing?: boolean
      actorId: string
      abilityId: string
      weaponId?:string
      damageType?:DamageType
      targetIds: string[]
      env: Environment
      targetEnvironments?: Record<string, Environment>
      confirmed: boolean
      note: string
      shape?: 'imp' | 'rat' | 'raven' | 'spider'
    }
  | {
      type: 'npc-reaction'
      env?:Environment
      actorId: string
      abilityId: string
      targetIndex: number
      confirmed: boolean
      note: string
    }
  | {
      type: 'npc-resource-restore'
      actorId: string
      recovery: 'day' | 'manual'
      resourceId?: string
      note: string
    }
  | { type: 'npc-concentration'; actorId: string; end?: boolean }
  | {
      type: 'social-check'
      actorId: string
      skill: string
      dc: number
      advantage: boolean
      disadvantage: boolean
      fearVisible?: boolean
      cost: 'action' | 'none'
      note: string
    }
  | { type: 'resolution-draft'; pendingId: string; keys: string[] }
  | { type: 'damage-roll'; actorId: string; savage?: boolean; tavernReroll?: boolean }
  | { type: 'add-character'; characterId: string; side: Combatant['side'] }
  | { type: 'add-npc'; npc: CombatNpc; side: Combatant['side'] }
  | { type: 'remove-actor'; actorId: string }
  | { type: 'initiative'; actorId: string; value: number | null; surprised: boolean }
  | { type: 'roll-initiative' }
  | { type: 'initiative-reroll'; actorId: string }
  | { type: 'initiative-swap'; actorId: string; targetId: string }
  | { type: 'order'; ids: string[] }
  | { type: 'start' }
  | { type: 'next' }
  | { type: 'end-turn'; actorId: string; encounterId: string; expectedTick: number }
  | { type: 'end' }
  | { type: 'undo' }
  | { type: 'interact'; actorId: string; cost: 'free' | 'action' | 'bonus'; note: string }
  | { type: 'wake'; actorId: string; targetId: string; env: Environment; note: string }
  | {
      type: 'item-use'
      actorId: string
      targetId: string
      instanceId: string
      env: Environment
      note: string
      manualCost?: 'action' | 'bonus' | 'free'
    }
  | {
      type: 'move'
      mode?:import('./m3-spatial').MovementMode
      actorId: string
      distance: number
      difficult: boolean
      extraCost?: number
      stand: boolean
      note: string
    }
  | {
      type: 'action'
      actorId: string
      cost?: 'action' | 'bonus' | 'haste'
      action:
        | 'dash'
        | 'disengage'
        | 'dodge'
        | 'help'
        | 'ready'
        | 'magic'
        | 'utilize'
        | 'extinguish'
        | 'hide'
        | 'search'
        | 'study'
        | 'influence'
      note: string
    }
  | {
      type: 'attack'
      handling?: WeaponHandling
      actorId: string
      targetId: string
      attackId: string
      env: Environment
      cost:
        | 'action'
        | 'haste'
        | 'light'
        | 'nick'
        | 'cleave'
        | 'martial'
        | 'flurry'
        | 'opportunity'
        | 'dual'
        | 'pole'
        | 'hew'
        | 'war-priest'
        | 'psychic'
        | 'star'
        | 'agile'
      sneak: boolean
      mastery: boolean
      gmReason?: string
    }
  | {
      type: 'cast'
      summonDraftId?:string
  sceneEffectCastId?:string
  areaTargets?:string[]
  areaEnvironments?:Record<string,Environment>
  gmChoice?:import('../persistence/gm-spell-choice-schema').GmSpellChoice
  attackWindowId?:string
  m3WorldId?:string
      dispelZoneId?:string
      m3Choice?: import('./m3-spells').M3CastChoice
  supportChoice?: string
  controlChoices?:Record<string,string>
  controlTargets?:string[]
  controlText?:string
      willing?: boolean
      actorId: string
      key: string
      mode: string
      targets: string[]
      env: Environment
      requirementsConfirmed: boolean
      hitDice?: number
      ammunition?: { instanceId: string; count: number }
      wildCheck?: boolean
      summonForm?: string
      targetEnvironments?: Record<string, Environment>
      damageType: DamageType
      weaponId?: string
      triggerConfirmed?: boolean
      metamagic?: {
        option: string
        protectedIds: string[]
        heightenedId: string
        damageType: DamageType
      }
      excludedIds?: string[]
    }
  | {
      type: 'resolve'
      nonlethal: boolean
      nonlethalTargetIds?: string[]
      savage: boolean
      uncanny?: boolean
      deflect?: boolean
      defenseTargetId?: string
      stone: boolean
      stoneTargetId?: string
      relentless: boolean
      relentlessTargetId?: string
      relentlessTargetIds?: string[]
      pushConfirmed: boolean
      pushDestinations?: {targetId:string;x:number;y:number}[]
      tavernReroll?: boolean
      healerReroll?: boolean
      revelationBonus?: boolean
      revelationTargetId?: string
      manual?: {
        repeatSave?: Ability
        acBonus?: number
        speedPenalty?: number
        damage: number
        damageType: DamageType
        heal: number
        condition: string
        rounds: number
        note: string
      }
    }
  | {
      type: 'reaction-shield'
      actorId: string
      key: string
      mode: string
      requirementsConfirmed: boolean
    }
  | {
      type:'reaction-counterspell'
      actorId:string
      targetId:string
      key:string
      mode:string
      requirementsConfirmed:boolean
      env:Environment
    }
  | {
      type: 'reaction-defense'
      actorId: string
      targetIndex: number
      kind: 'uncanny' | 'deflect' | 'stone'
    }
  | {
      type: 'spell-reroll'
      actorId: string
      kind: 'seeking' | 'empowered'
      targetIndex: number
      diceIndices: number[]
    }
  | { type: 'trigger-feature'; actorId: string; targetIndex: number; id: 'stun'; note: string }
  | { type: 'beast-forms'; actorId: string; ids: string[]; note: string }
  | { type: 'wild-shape'; actorId: string; formId: string; note: string }
  | {
      type: 'wild-companion'
      actorId: string
      formId: string
      mode: 'wild-shape' | 'slot' | 'slot-2' | 'slot-3'
      note: string
    }
  | { type: 'dismiss-companion'; actorId: string; targetId: string; note: string }
  | {
      type: 'zone-trigger'
      actorId: string
      zoneId: string
      targetId: string
      env: Environment
      phase?: 'created' | 'enter' | 'start' | 'end' | 'moved'
      note: string
    }
  | { type: 'zone-end'; actorId: string; zoneId: string; note: string }
  | { type: 'zone-move'; actorId: string; zoneId: string; distance: number; note: string }
  | { type: 'maintain-spell'; actorId: string; note: string }
  | {
      type: 'surge-npc'
      actorId: string
      surgeId: string
      npc: CombatNpc
      note: string
      destination?: { x: number; y: number }
    }
  | {
      type: 'companion-power'
      actorId: string
      targetId: string
      kind: 'fey-step' | 'putrid-aura'
      env: Environment
      note: string
      destination?: { x: number; y: number }
    }
  | { type: 'concentration'; actorId: string }
  | { type: 'concentration-roll'; actorId:string }
  | { type: 'death-save'; actorId: string; lucky?: boolean }
  | {
      type: 'inventory'
      actorId: string
      command: RuntimeCommand
      cost: 'free' | 'action' | 'bonus'
      requirementsConfirmed: boolean
      note: string
    }
  | {
      type: 'save'
      actorId: string
      ability: Ability
      dc: number
      env: Environment
      purpose: 'normal' | 'concentration' | 'poison' | 'charm' | 'fear'
      note: string
    }
  | { type: 'inspiration'; actorId: string; targetIndex: number; kind: 'bardic' | 'heroic' }
  | {
      type: 'adjudicate'
      actorId: string
      targetIds: string[]
      damage: number
      damageType: DamageType
      heal: number
      condition: string
      active: boolean
      rounds: number
      cost: 'action' | 'bonus' | 'reaction' | 'none'
      note: string
    }
  | {
      type: 'feature'
      actorId: string
      id: string
      targetId: string
      amount: number
      purify?: boolean
      kitId?: string
      triggerActorId?: string
      rule?: { entry: number; count: number; choice?: string }
      env: Environment
      note: string
      targets?: string[]
      targetEnvironments?: Record<string, Environment>
    }
  | { type: 'convert'; actorId: string; command: Extract<RuntimeCommand, { type: 'recover' }> }
  | { type: 'runtime'; actorId: string; command: RuntimeCommand; reason: string }
  | { type: 'end-effect'; actorId: string; effectId: string; reason: string }
  | { type: 'end-concentration'; actorId: string }
