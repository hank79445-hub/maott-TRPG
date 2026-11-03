import {defaultTextStyle,sanitizeStyleText} from './model-text-style'
import { NPC_LIMIT } from './configuration-limits'
import { validateNarrationSkills } from './narration-skills'
import { clone, newCharacter, type Catalogue } from './engine'
import { validateInventory } from './runtime'
import type { Adventure, MapWorld } from './map-types'
import type { AdventureAi, AiSettings, AiJournal, NpcProfile, AiMapCommand } from './ai-types'
import { NPC_BEHAVIORS, DIALOGUE_CATEGORIES } from './ai-types'
import { adventureAiSchema } from '../persistence/ai-schema'
import { occupied, inside, blocked } from './map'
import { rollDamage } from './combat-rules'
import { newActivityTemplate } from './npc-activity'
export function recommendedNpcActivity(): NpcProfile['activity'] {
  return {
    scope: 'party',
    publishMode: 'review',
    enabled: true,
    events: ['scene.enter', 'point.result', 'target.resolved', 'gm.mark'],
    characterIds: [],
    range: 30,
    cooldownSeconds: 300,
    maxPerScene: 3,
    allowDuringCombat: false,
    templates: (
      [
        'rescued',
        'aided',
        'critical',
        'wounded',
        'downed',
        'recovered',
        'danger',
        'goal',
        'scene',
        'interaction',
      ] as const
    ).map(newActivityTemplate),
  }
}
export const defaultAiSettings = (): AiSettings => ({
  textStyle:defaultTextStyle(),
  enabled: false,
  mode: 'turn',
  autoPublish: false,
  privateNarration: false,
  style: '清晰、连贯，细节适度；不添加规则后果。',
  background: '',
  language: '中文',
  maxCharacters: 400,
  includeNumbers: false,
  requestsPerHour: null,
  tokensPerHour: null,
  qqDialogueReview: {
    enabled: true,
    paused: false,
    categories: [...DIALOGUE_CATEGORIES],
    revision: 0,
    policyVersion: 14,
  },
})
export const defaultAdventureAi = (): AdventureAi => ({ settings: defaultAiSettings(), npcs: [] })
export const newAiJournal = (branchId: string, cursor = 0): AiJournal => ({
  version: 1,
  branchId,
  cursor,
  buffered: [],
  nextSequence: 1,
  jobs: [],
  usage: [],
})
export const newNpcProfile = (
  sceneId: string,
  npcType: NpcProfile['npcType'] = 'important',
): NpcProfile => ({
  turnMode: npcType === 'ordinary' ? 'automatic' : 'plan',
  followParty: false,
  initialMemories: [],
  affinityEnabled: false,
  initialRelations: [],
  tacticalInput: false,
  npcType,
  publicDialogue: '',
  publicKnowledge: [],
  controller: npcType === 'ordinary' ? 'gm' : 'model',
  characterId: null,
  body: null,
  side: 'enemy',
  dialogue: [],
  abilities: [],
  combatPolicy: {
    strategy: 'nearest',
    attackIds: [],
    guardRadius: 10,
    protectCharacterId: null,
    retreatPercent: 25,
    planOnTurn: true,
  },
  activity:
    npcType === 'important'
      ? recommendedNpcActivity()
      : {
          scope: 'party',
          publishMode: 'review',
          templates: [],
          enabled: false,
          events: ['scene.enter'],
          characterIds: [],
          range: 30,
          cooldownSeconds: 300,
          maxPerScene: 3,
          allowDuringCombat: false,
        },
  id: crypto.randomUUID(),
  revision: 0,
  name: '新的 NPC',
  sceneId,
  actorId: null,
  position: { x: 0, y: 0 },
  hidden: false,
  enabled: true,
  description: '',
  personality: '谨慎、简洁',
  goals: '',
  strategy: '依照已确认事实回应，重大行为提交 GM 审核。',
  knowledge: '',
  secrets: [],
  revealedIds: [],
  urgingCooldowns: [],
  privateNote: '',
  fallbackReply: '我听到了你的请求。此事请主持人确认。',
  attitude: 'indifferent',
  behaviorState: 'none',
  autoDialogue: false,
  dialogueReview: npcType === 'important' ? { mode: 'inherit', categories: [] } : undefined,
  allowed: [...NPC_BEHAVIORS],
  preauthorization: {
    trade: false,
    revealIds: [],
    characterIds: [],
    maxQuantity: 1,
    maxDiscountGP: 0,
    maxValueGP: 0,
    remaining: 0,
    expiresAt: null,
  },
  stock: [],
  coins: 0,
  memory: [],
})
export function aiState(a: Adventure) {
  a.ai ??= defaultAdventureAi()
  return a.ai
}
export function validateAdventureAi(
  a: Pick<Adventure, 'ai' | 'scenes'>,
  world: MapWorld,
  cat: Catalogue,
  roleIds: string[] = [],
) {
  if (!a.ai) return
  adventureAiSchema.parse(a.ai)
  const design=a.ai.knowledgeDesign
  if(design){if(new Set(design.factions.map(f=>f.id)).size!==design.factions.length||new Set(design.templates.map(t=>t.id)).size!==design.templates.length)throw Error('组织或知识模板ID重复')}
  for(const faction of design?.factions??[])if(new Set(faction.policies?.map(p=>p.id)).size!==(faction.policies?.length??0)||(faction.policies??[]).some(p=>!a.scenes.some(s=>s.id===p.sceneId&&s.points.some(point=>point.id===p.pointId))))throw Error('声望策略编号重复或互动点引用无效')
  for(const n of a.ai.npcs){const p=n.knowledgeProfile;if(p&&(p.factionId&&!design?.factions.some(f=>f.id===p.factionId)||p.templateIds.some(id=>!design?.templates.some(t=>t.id===id))))throw Error('NPC组织或知识模板引用无效');if(p?.lockedAttitude&&!p.lockReason.trim())throw Error('锁定态度须填写理由')}
  validateNarrationSkills(
    a.ai.settings,
    a.scenes.map((s) => s.id),
  )
  if (new Set((a.ai.templates ?? []).map((t) => t.id)).size !== (a.ai.templates ?? []).length)
    throw Error('NPC 模板 ID 重复')
  for (const body of [
    ...a.ai.npcs.flatMap((n) => (n.body ? [n.body] : [])),
    ...(a.ai.templates ?? []).map((t) => t.body),
  ])
    for (const attack of body.attacks) {
      rollDamage(attack.damage, () => 1)
      for (const part of attack.extraDamage ?? []) rollDamage(part.formula, () => 1)
    }
  if (new Set(a.ai.npcs.map((n) => n.id)).size !== a.ai.npcs.length) throw Error('NPC ID 重复')
  for (const n of a.ai.npcs) {
    if (n.followParty && n.npcType === 'ordinary') throw Error('普通 NPC 只能驻留所属场景')
    if (
      (n.npcType === 'important' && n.turnMode === 'automatic') ||
      (n.npcType === 'ordinary' && n.turnMode === 'plan')
    )
      throw Error('回合执行方式与 NPC 类型不匹配')
    const scene = a.scenes.find((s) => s.id === n.sceneId)
    if (!scene || n.position.x >= scene.grid.columns || n.position.y >= scene.grid.rows)
      throw Error('NPC 场景或位置无效')
    if (n.actorId) {
      const actor = world.encounters.flatMap((e) => e.actors).find((a) => a.id === n.actorId)
      if (
        !actor ||
        actor.companion ||
        (n.characterId ? actor.characterId !== n.characterId : !actor.npc || actor.characterId)
      )
        throw Error('NPC 战斗行动者与角色数据不一致')
    }
    if (
      n.characterId &&
      (n.npcType !== 'important' ||
        !world.characters.some((c) => c.id === n.characterId && c.status === 'complete'))
    )
      throw Error('重要 NPC 角色卡不存在')
    if (
      new Set((n.activity.templates ?? []).map((t) => t.id)).size !==
      (n.activity.templates ?? []).length
    )
      throw Error('NPC 回应模板编号重复')
    for (const t of n.activity.templates ?? []) {
      if (t.sceneId && !a.scenes.some((s) => s.id === t.sceneId)) throw Error('NPC 回应场景不存在')
      if (
        t.pointId &&
        !a.scenes.some(
          (s) => (!t.sceneId || s.id === t.sceneId) && s.points.some((p) => p.id === t.pointId),
        )
      )
        throw Error('NPC 回应互动点不存在')
    }
    const playerRef = (id: string) =>
      roleIds.includes(id) || world.characters.some((c) => c.id === id && !c.npcOwnerId)
    for(const k of n.spatialPolicy?.knownExits??[])if(!a.scenes.find(s=>s.id===k.sceneId)?.points.some(p=>p.id===k.pointId&&p.kind==='exit'))throw Error('NPC已知出口引用不存在')
    if (
      (n.initialMemories ?? []).some(
        (m) =>
          (m.visibility === 'personal' && !m.characterId) ||
          (m.characterId && !playerRef(m.characterId)),
      ) ||
      (n.initialRelations ?? []).some((r) => !playerRef(r.characterId))
    )
      throw Error('初始记忆／关系须关联实际玩家或剧本角色位')
    if (
      new Set((n.initialMemories ?? []).map((m) => m.id)).size !==
        (n.initialMemories ?? []).length ||
      new Set((n.initialRelations ?? []).map((r) => r.characterId)).size !==
        (n.initialRelations ?? []).length
    )
      throw Error('初始记忆／关系编号重复')
    if (n.npcType === 'ordinary' && n.body && n.body.attacks.length > 8)
      throw Error('普通 NPC 最多配置 8 种攻击手段')
    if (
      (n.activity.scope !== 'party' &&
        n.activity.characterIds.some(
          (id) => !world.characters.some((c) => c.id === id) && !roleIds.includes(id),
        )) ||
      (n.combatPolicy.protectCharacterId &&
        !world.characters.some((c) => c.id === n.combatPolicy.protectCharacterId) &&
        !roleIds.includes(n.combatPolicy.protectCharacterId))
    )
      throw Error('NPC 活动或保护角色不存在')
    if (
      new Set(n.dialogue.map((d) => d.id)).size !== n.dialogue.length ||
      new Set(n.abilities.map((d) => d.id)).size !== n.abilities.length
    )
      throw Error('NPC 台词或能力 ID 重复')
    if (
      new Set(n.stock.map((s) => s.id??s.itemId)).size !== n.stock.length ||
      new Set(n.secrets.map((s) => s.id)).size !== n.secrets.length
    )
      throw Error('NPC 库存或秘密 ID 重复')
    for(const stock of n.stock)if(stock.inventoryState){const item=stock.inventoryState;if(item.itemId!==stock.itemId||item.quantity!==Math.max(1,stock.quantity)||item.equipped||item.containerId)throw Error('商店实例物品与库存不一致');validateInventory({...newCharacter(),inventory:[item]},cat)}
    if(n.merchantPolicy&&[...n.merchantPolicy.buyItems,...n.merchantPolicy.blockedItems].some(id=>!cat.items.some(i=>i.id===id)))throw Error('商店策略引用未知物品')
    if (n.stock.some((s) => !cat.items.some((i) => i.id === s.itemId && i.kind !== 'pack')))
      throw Error('NPC 库存包含未知物品')
    if (new Set(n.fixedReplies?.map((r) => r.id)).size !== (n.fixedReplies?.length ?? 0))
      throw Error('固定台词ID重复')
    if (
      new Set(n.consumables?.map((r) => r.id)).size !== (n.consumables?.length ?? 0) ||
      n.consumables?.some((r) => !cat.items.some((i) => i.id === r.itemId && i.kind !== 'pack'))
    )
      throw Error('NPC自身消耗品编号重复或物品无效')
    if (n.preauthorization.revealIds.some((id) => !n.secrets.some((s) => s.id === id)))
      throw Error('预授权线索不存在')
    if (n.preauthorization.characterIds.some((id) => !world.characters.some((c) => c.id === id)))
      throw Error('预授权角色不存在')
    if (n.revealedIds.some((id) => !n.secrets.some((s) => s.id === id)))
      throw Error('已公开线索不存在')
    if (n.stock.some((s) => Math.abs(s.priceGP * 100 - Math.round(s.priceGP * 100)) > 1e-8))
      throw Error('NPC 单价最多两位小数')
  }
}
export function applyAiMap(a: Adventure, world: MapWorld, cat: Catalogue, command: AiMapCommand) {
  const state = aiState(a)
  if (command.type === 'npc-template') {
    if (!command.template.id.startsWith('custom-')) throw Error('自定义模板 ID 必须以 custom- 开头')
    state.templates ??= []
    const index = state.templates.findIndex((t) => t.id === command.template.id)
    if (index < 0 && state.templates.length >= 30) throw Error('最多保存 30 份自定义 NPC 模板')
    const value = clone(command.template)
    if (index < 0) state.templates.push(value)
    else state.templates[index] = value
  } else if (command.type === 'npc-template-delete') {
    state.templates = state.templates?.filter((t) => t.id !== command.templateId)
  } else if (command.type === 'npc-party-scope') {
    if (
      new Set(command.npcIds).size !== command.npcIds.length ||
      command.npcIds.some((id) => !state.npcs.some((n) => n.id === id && n.npcType === 'important'))
    )
      throw Error('请选择已有的重要 NPC，不可重复')
    for (const n of state.npcs.filter((n) => command.npcIds.includes(n.id))) {
      n.activity.scope = 'party'
      n.activity.characterIds = []
      n.revision++
    }
  } else if (command.type === 'ai-settings') {
    const prior = state.settings.enabled
    const priorPolicy = state.settings.qqDialogueReview,priorStyle=state.settings.textStyle
    state.settings = clone(command.settings)
    if(state.settings.textStyle){state.settings.textStyle.customRules=sanitizeStyleText(state.settings.textStyle.customRules).text;state.settings.textStyle.revision=(priorStyle?.revision??0)+1}
    if (state.settings.qqDialogueReview)
      state.settings.qqDialogueReview.revision = (priorPolicy?.revision ?? 0) + 1
    if (!prior && command.settings.enabled) {
      a.aiLog ??= newAiJournal(a.broadcastLog?.branchId ?? 'legacy')
      a.aiLog.cursor = (a.broadcastLog?.nextSequence ?? 1) - 1
      a.aiLog.buffered = []
    }
  } else if (command.type === 'npc-delete') {
    state.npcs = state.npcs.filter((n) => n.id !== command.npcId)
  } else {
    const prior = state.npcs.find((n) => n.id === command.profile.id),
      profile = clone(command.profile)
    profile.memory = clone(prior?.memory ?? [])
    if(prior)profile.knowledgeProfile=prior.knowledgeProfile?clone(prior.knowledgeProfile):undefined
    profile.arrivalOrigin = profile.initiallyAbsent
      ? prior?.appeared
        ? clone(prior.arrivalOrigin ?? { sceneId: prior.sceneId, ...prior.position })
        : { sceneId: profile.sceneId, ...profile.position }
      : undefined
    profile.appeared = prior?.appeared
    if (!profile.initiallyAbsent) delete profile.appeared
    profile.experiences = clone(prior?.experiences ?? [])
    profile.experienceOmitted = prior?.experienceOmitted ?? 0
    profile.relations = clone(
      prior?.relations ?? (prior ? prior.initialRelations : profile.initialRelations) ?? [],
    )
    if (prior?.turnHold) profile.turnHold = clone(prior.turnHold)
    else delete profile.turnHold
    if (prior && profile.revision !== prior.revision) throw Error('NPC 配置已更新，请刷新后编辑')
    if (profile.characterId !== (prior?.characterId ?? null))
      throw Error('角色卡关联请使用 GM 的复制入口')
    if (
      prior &&
      (prior.sceneId !== profile.sceneId ||
        prior.position.x !== profile.position.x ||
        prior.position.y !== profile.position.y) &&
      world.encounters.some(
        (e) => e.phase === 'active' && e.actors.some((t) => t.id === prior.actorId),
      )
    )
      throw Error('NPC 正在战斗中，不能通过配置更换场景或位置；请使用战斗移动')
    if (profile.characterId && profile.npcType === 'ordinary')
      throw Error('使用完整角色卡的 NPC 必须保持重要 NPC 类型')
    if (profile.followParty && profile.npcType !== 'important')
      throw Error('普通 NPC 驻留所属场景，不能加入伴随名单')
    if (profile.followParty && profile.importanceRole === 'resident')
      throw Error('驻场NPC不能随队；请先设为可随队并由GM确认')
    if (
      !prior ||
      prior.sceneId !== profile.sceneId ||
      prior.position.x !== profile.position.x ||
      prior.position.y !== profile.position.y
    )
      profile.guardOrigin = { sceneId: profile.sceneId, ...profile.position }
    if (
      prior &&
      prior.sceneId === profile.sceneId &&
      (prior.position.x !== profile.position.x || prior.position.y !== profile.position.y)
    ) {
      const s = a.scenes.find((s) => s.id === profile.sceneId)!,
        token = s.tokens.find((t) => t.npcId === profile.id)
      if (token) {
        if (
          !occupied({ ...token, ...profile.position }).every(
            (p) =>
              inside(s, p) &&
              !blocked(s, p) &&
              !s.tokens.some(
                (t) => t.id !== token.id && occupied(t).some((o) => o.x === p.x && o.y === p.y),
              ),
          )
        )
          throw Error('NPC 配置位置被阻挡或超出网格')
        Object.assign(token, profile.position)
      }
    }
    if (prior && prior.body?.size !== profile.body?.size) {
      const s = a.scenes.find((s) => s.id === profile.sceneId)!,
        token = s.tokens.find((t) => t.npcId === profile.id)
      if (token) {
        const span =
          profile.body?.size === 'large'
            ? 2
            : profile.body?.size === 'huge'
              ? 3
              : profile.body?.size === 'gargantuan'
                ? 4
                : 1
        if (
          !occupied({ ...token, span }).every(
            (p) =>
              inside(s, p) &&
              !blocked(s, p) &&
              !s.tokens.some(
                (t) => t.id !== token.id && occupied(t).some((o) => o.x === p.x && o.y === p.y),
              ),
          )
        )
          throw Error('此位置容不下新的 NPC 体型，请先调整配置落点')
        token.span = span
      }
    }
    if (!prior && state.npcs.length >= NPC_LIMIT) throw Error(`最多 ${NPC_LIMIT} 位 NPC`)
    profile.revision = (prior?.revision ?? 0) + 1
    profile.memory = clone(prior?.memory ?? [])
    profile.revealedIds = clone(prior?.revealedIds ?? []).filter((id) =>
      profile.secrets.some((s) => s.id === id),
    )
    profile.urgingCooldowns = clone(prior?.urgingCooldowns ?? [])
    if (profile.characterId) {
      const character = world.characters.find((c) => c.id === profile.characterId)!
      if (character.build.name !== profile.name) {
        character.build.name = profile.name
        character.revision++
      }
    }
    if (profile.body) profile.body.name = profile.name
    const actor = world.encounters.flatMap((e) => e.actors).find((t) => t.id === profile.actorId)
    const actorEncounter = world.encounters.find((e) =>
      e.actors.some((t) => t.id === profile.actorId),
    )
    if (actor?.npc && actorEncounter?.phase === 'ended' && profile.body && prior?.body) {
      // Apply explicit GM edits only. Unchanged template fields must not overwrite live damage/effects.
      for (const field of Object.keys(profile.body) as (keyof typeof profile.body)[]) {
        if (JSON.stringify(profile.body[field]) !== JSON.stringify(prior.body[field]))
          Object.assign(actor.npc, { [field]: clone(profile.body[field]) })
      }
      profile.body = clone(actor.npc)
    }
    if (actor?.npc) actor.npc.name = profile.name
    if (
      profile.actorId &&
      state.npcs.some((n) => n.id !== profile.id && n.actorId === profile.actorId)
    )
      throw Error('行动者已关联另一位 NPC')
    if (prior) state.npcs[state.npcs.indexOf(prior)] = profile
    else state.npcs.push(profile)
  }
  validateAdventureAi(a, world, cat)
}
