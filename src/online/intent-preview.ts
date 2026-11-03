import { DEFENSE_NAMES } from '../core/combat-types'
import { automaticDamageItem } from '../core/combat-items'
import { sameDefenseWindow } from './reaction-window'
import { isZoneSpell } from '../core/ongoing-spells'
import { METAMAGIC_NAMES, metamagicCost, validateMetamagic } from '../core/metamagic'
import { manualFeatures } from '../core/manual-growth'
import { rulePowers } from '../core/phb-powers'
import { hasSubclass, alwaysPrepared } from '../core/growth-rules'
import type { Intent, RoomView } from './protocol'
import type { Environment } from '../core/combat-types'
import { growthCandidate, growthIssues } from '../core/growth'
import { derived, getChoices, catalogue } from '../core/engine'
import { srd } from '../content/srd'
import {
  runtimeState,
  castSlotLevel,
  availableSlots,
  runtimeDerived,
  runtimeSpells,
  resources,
  MODE_NAMES,
  findItem,
  type RuntimeCommand,
} from '../core/runtime'
import { attackOptions, combatStats, spellEffect } from '../core/combat-rules'
import { attackCategory, mapEnvironment, occupied, inside, blocked, distance } from '../core/map'
import { sightLine } from '../core/map-spatial'
import { areaEnvironment, spellAreaSpec, type AreaSpec } from '../core/map-area'
import type { MapCombatOptions } from '../core/map-types'
import {
  ATTACK_COSTS,
  ACTION_NAMES,
  COST_NAMES,
  spellCost,
  spellTargets,
  featureSelf,
} from './combat-controls'

export interface IntentPreview {
  actor: string
  source: string
  costs: string[]
  targets: {
    id: string
    name: string
    distance: number | null
    high: string[]
    environment: Environment
  }[]
  blockers: string[]
  confirmations: string[]
  notes: string[]
  page: number | null
}
function recoverySummary(p: IntentPreview, cmd: Extract<RuntimeCommand, { type: 'recover' }>) {
  const names = {
    'magical-cunning': '魔法诡计',
    'font-slot': '灵活施法：创建法术位',
    'font-points': '灵活施法：法术位转术法点',
    'font-inspiration': '激励之源',
    'wild-resurgence': '荒野复苏：恢复荒野形态',
    'wild-slot': '荒野复苏：恢复一环位',
  }
  p.source = names[cmd.id]
  p.costs.push(
    cmd.id === 'font-slot'
      ? '附赠动作；术法点 ×' + [0, 2, 3, 5][cmd.slotLevel]
      : cmd.id === 'magical-cunning'
        ? '1 分钟；特性次数 ×1'
        : cmd.id === 'wild-slot'
          ? '荒野形态 ×1；每长休一次'
          : cmd.slotLevel + ' 环法术位 ×1；无需动作',
  )
  p.notes.push(
    cmd.id === 'font-inspiration'
      ? '恢复一次已消耗的吟游激励'
      : cmd.id === 'font-points'
        ? '恢复 ' + cmd.slotLevel + ' 点术法点，不得超过等级上限'
        : cmd.id === 'font-slot'
          ? '创建 ' + cmd.slotLevel + ' 环临时法术位，长休时消失'
          : '恢复次数与前提按职业规则核对',
  )
  p.confirmations.push('核对等级、资源余量、转换环级和使用次数。')
}
/** Read-only estimate. No reducer, dice, time advancement, or resource writes. Final rules run on approval. */
export function previewIntent(
  view: RoomView,
  intent: Intent,
  environment = view.environment,
  selectedTargets?: string[],
  targetEnvironments: Record<string, Environment> = {},
  mapOptions?: MapCombatOptions,
): IntentPreview | null {
  if (view.self.role !== 'gm' || !view.world) return null
  const world = view.world,
    cat = catalogue([srd, ...world.packs])
  const p: IntentPreview = {
    actor: '',
    source: '',
    costs: [],
    targets: [],
    blockers: [],
    confirmations: [],
    notes: [],
    page: null,
  }
  const member = view.members.find((m) => m.id === intent.sessionId)
  if (!member || member.revoked) p.blockers.push('提交者权限已撤销')
  if (
    intent.status === 'pending' && intent.action.kind!=='scene-effect' &&
    intent.baseWorldRevision !== view.worldRevision &&
    !sameDefenseWindow(
      intent,
      world.encounters.find((e) => e.id === view.encounter?.id),
    )
  )
    p.blockers.push('世界已变化，请拒绝旧意图并重新提交')
  const action = intent.action
  if(action.kind==='scene-effect'){
    p.source='持续场景效果 · '+action.action.operation
    p.notes.push(action.action.note);p.costs.push('审核后按实际来源支付施法／操作费用，不在申请时扣费')
    p.confirmations.push('核对位置、物件、材料、可见性与实际反应窗口。');return p
  }
  if(action.kind==='spatial'){
    const cmd=action.action,id='casterId'in cmd?cmd.casterId:'entityId'in cmd?cmd.entityId:''
    p.actor=world.characters.find(c=>c.id===id)?.build.name??id??''
    p.source='空间／物件操作 · '+cmd.operation
    p.costs.push('按实际来源、动作、法术位／材料和当前移动预算结算；提交申请不扣费')
    p.confirmations.push('GM须核对实际空间、目标、自愿及反应时机；后端重新校验，不因普通聊天改变而重复提交')
    p.notes.push('note'in cmd?cmd.note:'')
    if(cmd.operation==='cast'&&cmd.to)p.notes.push('目的地 ('+cmd.to.x+','+cmd.to.y+')，高度'+cmd.to.height+'尺')
    return p
  }
  if (action.kind === 'npc') {
    const n = world.adventures[0]?.ai?.npcs.find((n) => n.id === action.npcId)
    p.actor = n?.name ?? 'NPC 不存在'
    p.source = 'NPC 提议：' + action.directive.kind
    p.notes.push(JSON.stringify(action.directive))
    const conversation = world.adventures[0]?.aiLog?.jobs.find(
      (j) => j.id === action.conversationId && j.kind === 'npc',
    )
    if (conversation?.kind === 'npc') {
      p.notes.push('交涉目的：' + (conversation.goal || '普通交谈'))
      p.notes.push('回应／审核依据：' + conversation.reason)
      if (conversation.check)
        p.notes.push(
          '已确认交涉：' +
            (conversation.check.total === null ? 'GM 裁定' : conversation.check.total) +
            '；' +
            (conversation.check.success === null
              ? '未检定'
              : conversation.check.success
                ? '成功'
                : '失败'),
        )
    }
    p.costs.push(
      action.directive.kind === 'attack'
        ? '原有攻击行动预算；仍需反应与最终结算'
        : action.directive.kind === 'trade'
          ? '玩家金币与 NPC 库存原子交付'
          : '按原有场景与规则检查',
    )
    p.confirmations.push('核对交涉结果、当前状态、NPC 行为许可与目标；策略不提供额外权限。')
    if (!n?.enabled || n.revision !== action.profileRevision) p.blockers.push('NPC 配置已变化')
    return p
  }
  const controlled = (id: string, actorId = '') => {
    const e = world.encounters.find((e) => e.actors.some((a) => a.id === actorId)),
      companion = e?.actors.find((a) => a.id === actorId)?.companion,
      owner =
        companion && ['spell-summon', 'primal-companion'].includes(companion.source)
          ? e?.actors.find((a) => a.id === companion.ownerId)
          : undefined
    if (owner?.characterId && member?.characterIds.includes(owner.characterId)) return
    if (
      member &&
      member.role !== 'gm' &&
      !member.characterIds.includes(id) &&
      !member.actorIds.includes(actorId)
    )
      p.blockers.push('提交者已失去该角色的操控权')
  }
  if (action.kind === 'runtime' || action.kind === 'give') {
    const id = action.kind === 'runtime' ? action.characterId : action.fromId,
      c = world.characters.find((x) => x.id === id)
    controlled(id)
    p.actor = c?.build.name ?? '角色不存在'
    if (!c) {
      p.blockers.push('角色不存在')
      return p
    }
    if (action.kind === 'give') {
      const item = c.inventory.find((i) => i.instanceId === action.instanceId)
      p.source = `给予 ${item ? (findItem(c, cat, item.itemId)?.name ?? item.itemId) : '缺失物品'} ×${action.quantity}`
      p.costs.push('双方库存原子转移')
      p.notes.push(
        '须同一公开场景且相距不超过 5 尺，不能交接正在装备的物品或装满的容器；战斗中由 GM 裁定。',
      )
      const to = world.characters.find((x) => x.id === action.toId)
      p.targets.push({
        id: action.toId,
        name: to?.build.name ?? '角色不存在',
        distance: null,
        high: [],
        environment,
      })
    } else {
      const cmd = action.command
      const labels: Record<string, string> = {
        check: '检定',
        rest: '休息',
        damage: '记录伤害',
        heal: '记录治疗',
        temporary: '临时生命',
        cast: '施放法术',
        resource: '使用资源',
        'item-add': '添加物品',
        coins: '货币变动',
        condition: '状态调整',
        exhaustion: '力竭调整',
        stabilize: '稳定伤势',
      }
      p.source = labels[cmd.type] ?? cmd.type
      if (cmd.type === 'level-up') {
        p.source = `职业成长 ${c.level} → ${cmd.targetLevel} 级`
        p.blockers.push(...growthIssues(c, cmd, cat))
        if (!p.blockers.length) {
          const next = growthCandidate(c, cmd, cat),
            before = derived(c.build, cat, c.inventory),
            after = derived(next.build, cat, c.inventory)
          p.notes.push(
            `最大 HP ${before.hp} → ${after.hp}${cmd.hpMethod === 'roll' ? '（固定值估算，审批后掷骰）' : ''}；熟练 +${before.pb} → +${after.pb}；当前 HP、库存与旧消耗保留`,
            `升级依据：${cmd.reason}`,
          )
          for (const n of getChoices(next.build, cat))
            if (JSON.stringify(c.build.choices[n.id]) !== JSON.stringify(cmd.choices[n.id]))
              p.notes.push(
                n.label +
                  '：' +
                  (cmd.choices[n.id] ?? [])
                    .map((id) => n.options.find((o) => o.id === id)?.name ?? id)
                    .join('、'),
              )
          p.costs.push('逐级成长；新资源加入，升级不恢复旧消耗')
          p.confirmations.push('确认等级资格、生命骰方式与所有成长选择。')
        }
      }
      if (cmd.type === 'recover') recoverySummary(p, cmd)
      if ('amount' in cmd) p.costs.push(`数值 ${cmd.amount}`)
      if (cmd.type === 'item-add')
        p.source += `：${findItem(c, cat, cmd.itemId)?.name ?? cmd.itemId} ×${cmd.quantity}`
      if (cmd.type === 'origin') {
        p.source = {
          healer: '医疗师战地医师',
          'healing-hands': '治愈之手',
          revelation: '阿斯莫天启',
          'end-revelation': '结束天启',
          craft: '巧匠快速制作',
          musician: '音乐家鼓舞之歌',
          'chef-meal': '大厨短休餐食',
          'inspiring-leader': '领袖之证',
        }[cmd.id]
        p.costs.push(
          cmd.id === 'healer'
            ? '目标生命骰 1 枚、医疗包 1 次；审核后掷骰'
            : cmd.id === 'healing-hands'
              ? '治愈之手长休资源 1 次；审核后掷骰'
              : cmd.id === 'revelation'
                ? '天启长休资源 1 次'
                : cmd.id === 'end-revelation'
                  ? '无需动作'
                  : '一次已完成休息的触发',
        )
        for (const id of cmd.targets)
          p.targets.push({
            id,
            name: world.characters.find((c) => c.id === id)?.build.name ?? '角色不存在',
            distance: null,
            high: [],
            environment,
          })
        p.confirmations.push(
          '接触／听见与盟友、休息完成时机、工具持有、目标生命骰；跨角色结果同笔保存。',
        )
      }
      if (cmd.type === 'rest') {
        p.source = cmd.kind === 'short' ? '短休' : '长休'
        p.confirmations.push('休息时长、活动与中断条件；准备法术和资源恢复按职业规则。')
        if (cmd.kind === 'short' && (cmd.useHitDie || cmd.hitDieRoll !== undefined))
          p.costs.push('生命骰 ×1（审核后服务端掷骰）')
      }
      if (cmd.type === 'check') p.source += `：${cmd.kind} / ${cmd.id}`
      if ('note' in cmd && cmd.note) p.notes.push(cmd.note)
      if (
        world.encounters.some(
          (e) => e.phase === 'active' && e.actors.some((a) => a.characterId === id),
        ) &&
        cmd.type !== 'portrait-set'
      )
        p.blockers.push('角色正在战斗中，请使用战斗命令')
    }
    return p
  }
  if(action.kind==='summon'){const op=action.action;p.source='召唤与伙伴 · '+op.operation;p.notes.push(op.note);p.confirmations.push('真实施法来源、材料、范围、动作、控制期限与当前可感知目标；不授予新职业能力。');if(op.operation==='cast'){p.costs.push('实际法术位／能力池与施法动作；耗材按原术消耗');p.notes.push('形态：'+op.form+'；落点 '+op.position.x+','+op.position.y)}return p}
  if(action.kind==='m1'){p.source='专用法术 · '+action.action.operation;p.confirmations.push('真实材料、目标、遗体资格及自愿；原法术资源与反制阶段保持。');return p}
  if (action.kind === 'container') {
    const container = world.adventures[0]?.scenes.find(s => s.id === action.sceneId)?.points.find(p => p.id === action.pointId)
    const character = world.characters.find(c => c.id === action.characterId)
    p.actor = character?.build.name ?? action.characterId
    p.source = '容器取放 · ' + (action.operation === 'put' ? '放入' : '领取')
    const rowId = action.rowId ?? '', sourceRow = rowId.startsWith('legacy:') ? container?.loot[Number(rowId.slice(7))] : rowId.startsWith('stored:') ? container?.containerInventory?.find(i => i.instanceId === rowId.slice(7)) : character?.inventory.find(i => i.instanceId === rowId.slice(10))
    const itemName = rowId === 'coins' ? '金币（GP）' : cat.items.find(i => i.id === sourceRow?.itemId)?.name ?? sourceRow?.itemId ?? rowId
    p.notes.push((container?.name ?? action.pointId) + ' · ' + (action.operation === 'take-all' ? '全部可领取内容' : `${itemName} × ${action.quantity}`))
    p.costs.push('按当前互动／物品操作预算结算一次')
    p.confirmations.push('角色操控权、可感知容器、实际库存及数量；批准时重新核对容器内容版本。')
    return p
  }
  const command = action.command,
    scene =
      'sceneId' in command
        ? world.adventures[0]?.scenes.find((s) => s.id === command.sceneId)
        : undefined
  if (!scene || scene.id !== world.adventures[0]?.activeSceneId)
    p.blockers.push('请求不属于当前运行场景')
  if (command.type === 'move') {
    const token = scene?.tokens.find((t) => t.id === command.tokenId)
    p.actor = token?.name ?? '棋子不存在'
    controlled(token?.characterId ?? '')
    p.source = '地图移动'
    p.notes.push(`终点 (${command.path.at(-1)?.x}, ${command.path.at(-1)?.y})`)
    p.confirmations.push(
      '路径、地形及借机攻击候选；审核仅确认移动触发处理完毕，不代替借机攻击结算。',
    )
    return p
  }
  if (command.type !== 'combat' || !scene) {
    p.source = command.type
    if (command.type === 'interact') {
      const c = world.characters.find((x) => x.id === command.characterId)
      p.actor = c?.build.name ?? '角色不存在'
      controlled(command.characterId)
      p.source = `互动：${scene?.points.find((x) => x.id === command.pointId)?.name ?? command.pointId} / ${command.operation}`
    }
    return p
  }
  const b = command.command,
    encounter = world.encounters.find((e) => e.id === scene.encounterId),
    actor = 'actorId' in b ? encounter?.actors.find((a) => a.id === b.actorId) : undefined
  if (!actor || !encounter) {
    p.blockers.push('行动者或遭遇不存在')
    return p
  }
  const c = world.characters.find((x) => x.id === actor.characterId),
    stat = combatStats(actor, world.characters, cat),
    r = c ? runtimeState(c, cat) : null
  p.actor = stat.name
  controlled(actor.characterId ?? '', actor.id)
  if (encounter.phase !== 'active') p.blockers.push('遭遇未处于战斗中')
  if (
    encounter.pending &&
    ![
      'reaction-shield',
      'damage-roll',
      'reaction-defense',
      'spell-reroll',
      'trigger-feature',
      'inspiration',
      'end-concentration',
    ].includes(b.type) &&
    !(b.type === 'feature' && (b.id === 'origin/interception' || b.id.startsWith('phb/'))) &&
    !(b.type === 'cast' && b.key.endsWith(':lightning-arrow'))
  )
    p.blockers.push('请先处理当前待结算行动')
  let category: 'weapon' | 'thrown' | 'spell' | null = null,
    ids: string[] = [],
    cost: 'action' | 'bonus' | 'reaction' | null = null,
    range: number | null = null,
    area = false,
    persistentArea = false,
    see = false
  let areaSpec: AreaSpec | null = null
  if (b.type === 'reaction-defense' || b.type === 'trigger-feature' || b.type === 'spell-reroll') {
    const entry = encounter.pending?.targets[b.targetIndex]
    p.source =
      b.type === 'reaction-defense'
        ? '防御反应 · ' + DEFENSE_NAMES[b.kind]
        : b.type === 'trigger-feature'
          ? '震慑打击'
          : (METAMAGIC_NAMES[b.kind] ?? b.kind)
    p.costs.push(
      b.type === 'reaction-defense'
        ? '反应 ×1（获批时消耗）'
        : b.type === 'trigger-feature'
          ? '专注点 ×1；每回合一次'
          : '术法点 ×1；必须使用新掷骰',
    )
    if (!encounter.pending || !entry) p.blockers.push('待结算窗口或目标已不存在')
    else {
      p.targets.push({
        id: entry.id,
        name: combatStats(
          encounter.actors.find((a) => a.id === entry.id)!,
          world.characters,
          cat,
        ).name,
        distance: entry.env.distance,
        high: [],
        environment: entry.env,
      })
      if (b.type === 'reaction-defense') {
        if (entry.id !== actor.id || entry.defense || !actor.turn.reaction)
          p.blockers.push('该目标没有可用防御反应')
        if (b.kind !== 'stone' && (encounter.pending.kind !== 'attack' || !entry.hit))
          p.blockers.push('此反应要求攻击已命中')
        if (
          b.kind === 'uncanny' &&
          (c?.build.classId !== 'rogue' || c.level < 5 || !entry.env.targetSees)
        )
          p.blockers.push('须五级盗贼看见攻击者')
        if (b.kind === 'deflect' && (c?.build.classId !== 'monk' || c.level < 3))
          p.blockers.push('须三级武僧，GM 核对伤害包含物理类型')
      }
      p.confirmations.push(
        '仅影响选定的这一次命中；GM 核对触发条件。偏转至零后的反击仍由 GM 裁定。',
      )
    }
    return p
  }
  if (b.type === 'wild-shape' || b.type === 'wild-companion' || b.type === 'dismiss-companion') {
    p.source =
      b.type === 'wild-shape'
        ? b.formId
          ? '荒野形态 · ' + b.formId
          : '结束荒野形态'
        : b.type === 'wild-companion'
          ? '荒野伙伴 · ' + b.formId
          : '解散荒野伙伴'
    p.costs.push(
      b.type === 'wild-shape'
        ? '附赠动作；变形时荒野形态 ×1'
        : b.type === 'wild-companion'
          ? '魔法动作；' + b.mode + ' ×1'
          : '魔法动作',
    )
    p.confirmations.push(
      '核对兽形、资源、装备融入与放置位置。伙伴不能攻击；独立先攻和棋子由 GM 安排。',
    )
    return p
  }
  if (b.type === 'attack') {
    const spec = attackOptions(actor, world.characters, cat).find((a) => a.id === b.attackId)
    p.source = spec?.name ?? '攻击不可用'
    p.page = spec?.page ?? null
    p.costs.push(ATTACK_COSTS[b.cost])
    cost =
      b.cost === 'opportunity'
        ? 'reaction'
        : ['light', 'martial', 'dual', 'pole', 'hew', 'war-priest', 'psychic', 'star'].includes(
              b.cost,
            )
          ? 'bonus'
          : b.cost === 'action'
            ? 'action'
            : null
    if (!spec) p.blockers.push('当前装备没有该攻击')
    else {
      category = attackCategory(spec, !!actor.npc)
      range = spec.ranged ? spec.longRange : spec.reach
      if (spec.properties.some((x) => x.startsWith('ammunition')))
        p.costs.push('弹药 ×1（执行时检查库存）')
      if (category === 'thrown') p.costs.push('投掷武器 ×1（从当前库存投出）')
    }
    if (b.cost === 'action' && (actor.turn.attacksLeft ?? 0) > 0) {
      cost = null
      p.notes.push('使用本攻击动作剩余的额外攻击')
    }
    ids = [b.targetId]
    if (b.sneak) p.confirmations.push('偷袭的优势或友方近身条件，每回合一次，由规则引擎再次检查。')
    if (b.cost === 'opportunity')
      p.confirmations.push(
        '借机攻击：目标使用移动、动作、附赠动作或反应离开触及，行动者能看见目标。请在环境依据中记录触发。',
      )
    if (b.cost === 'cleave')
      p.confirmations.push('Cleave 后续目标须满足武器精通触发，填写环境依据。')
    if (['opportunity', 'cleave'].includes(b.cost) && !environment.note.trim())
      p.blockers.push('请填写攻击触发依据')
  } else if (b.type === 'item-use') {
    const row = c?.inventory.find((r) => r.instanceId === b.instanceId && r.quantity > 0)
    const item = row && c ? findItem(c, cat, row.itemId) : undefined
    const known = automaticDamageItem(item)
    p.source = '物品使用 · ' + (item?.name ?? '物品已不可用')
    if (!item) p.blockers.push('物品库存已不可用')
    cost = known
      ? (actor.turn.attacksLeft ?? 0) > 0
        ? null
        : 'action'
      : b.manualCost === 'free'
        ? null
        : (b.manualCost ?? 'action')
    ids = [b.targetId]
    range = known ? 20 : null
    see = known
    p.costs.push(
      '消耗物品 ×1；' +
        (known
          ? '攻击动作中的一次攻击'
          : (b.manualCost === 'bonus'
              ? '附赠动作'
              : b.manualCost === 'free'
                ? '无需动作'
                : '动作') + '；GM 按物品原文裁定'),
    )
    p.confirmations.push(
      known
        ? '确认当前可见目标；敏捷豁免 DC=8+敏捷调整值+熟练加值；成功不受伤害。'
        : '物品未自动化；确认动作、射程、目标及效果，再填写手动结算结果。',
    )
    if (b.note) p.notes.push(b.note)
  } else if (b.type === 'cast' || b.type === 'reaction-shield') {
    const grant = c ? runtimeSpells(c, cat).find((g) => g.key === b.key) : null
    if (!grant) p.blockers.push('法术来源已不可用')
    else {
      const s = grant.spell,
        profile = spellEffect(
          s.id,
          c?.level ?? 1,
          (castSlotLevel(b.mode) || s.level || 1) +
            (b.type === 'cast' && b.metamagic?.option === 'twinned' ? 1 : 0),
        ),
        policy = spellTargets(
          s,
          grant.key,
          c?.level ?? 1,
          (castSlotLevel(b.mode) || s.level || 1) +
            (b.type === 'cast' && b.metamagic?.option === 'twinned' ? 1 : 0),
        )
      p.source = `${s.name} / ${s.english} · ${grant.source} · ${MODE_NAMES[b.mode] ?? b.mode}`
      p.page = s.source.page
      cost = b.type === 'cast' && b.metamagic?.option === 'quickened' ? 'bonus' : spellCost(s)
      if (b.type === 'cast' && b.metamagic && c) {
        p.costs.push(
          '超魔法 · ' +
            METAMAGIC_NAMES[b.metamagic.option] +
            '；术法点 ×' +
            metamagicCost(b.metamagic.option),
        )
        try {
          validateMetamagic(c, s, castSlotLevel(b.mode), b.metamagic, selectedTargets ?? b.targets)
        } catch (e) {
          p.blockers.push((e as Error).message)
        }
        if ((r?.resources['sorcery-points'] ?? 0) < metamagicCost(b.metamagic.option))
          p.blockers.push('术法点不足')
      }
      p.costs.push(COST_NAMES[cost])
      area = policy.area
      persistentArea = isZoneSpell(s.id)
      areaSpec = spellAreaSpec(s)
      p.confirmations.push(`成分 ${s.components}；手部、材料、目标与施法条件须满足规则正文。`)
      if (!grant.modes.includes(b.mode)) p.blockers.push('该来源不支持所选施放方式')
      const resource = castSlotLevel(b.mode)
        ? castSlotLevel(b.mode) === 1
          ? 'slots'
          : 'slots-' + castSlotLevel(b.mode)
        : b.mode === 'free'
          ? grant.resource
          : null
      if (resource) {
        p.costs.push(
          `${resources(c!, cat).find((x) => x.id === resource)?.name ?? resource} ×1 · 当前 ${r?.resources[resource] ?? 0}`,
        )
        if (
          !(castSlotLevel(b.mode) && c
            ? availableSlots(c, cat, castSlotLevel(b.mode))
            : r?.resources[resource])
        )
          p.blockers.push('施法资源不足')
      }
      if (castSlotLevel(b.mode) && encounter.slotSpent.includes(actor.id))
        p.blockers.push('同一个回合已经消耗法术位施法')
      if (
        b.mode === 'ritual' ||
        (/minute|hour/i.test(s.castingTime) &&
          !(grant.key.startsWith('chain:') && b.mode === 'at-will'))
      )
        p.blockers.push('仪式或长时间施法须在战斗外进行')
      if (
        r?.wildShape &&
        !(
          c &&
          hasSubclass(c.build, 'moon') &&
          alwaysPrepared(c.build, cat.subclasses).some(
            (g) =>
              g.id === s.id && g.source === cat.subclasses.find((sc) => sc.id === 'moon')?.name,
          )
        )
      )
        p.blockers.push('此荒野形态不能施放此来源法术')
      if (r?.rage || (c && runtimeDerived(c, cat).untrainedArmor))
        p.blockers.push('狂暴或未受训护甲阻止施法')
      if (s.concentration)
        p.notes.push(r?.concentration ? '新专注会结束先前专注及其关联效果。' : '执行后开始专注。')
      if (b.type === 'cast') {
        if (s.id === 'cordon-of-arrows') {
          const row = c?.inventory.find((x) => x.instanceId === b.ammunition?.instanceId),
            count = b.ammunition?.count ?? 0
          if (
            !row ||
            !['arrow', 'bolt'].includes(row.itemId) ||
            count < 1 ||
            count > 4 + 2 * Math.max(0, castSlotLevel(b.mode) - 2) ||
            count > row.quantity
          )
            p.blockers.push('须选择足量的实际非魔法箭矢／弩矢及合法数量')
          p.costs.push('固定并消耗背包弹药 ×' + count)
        }
        if (['magic-weapon', 'elemental-weapon'].includes(s.id)) {
          const target = world.characters.find(
              (c) => c.id === encounter.actors.find((a) => a.id === b.targets[0])?.characterId,
            ),
            row = target?.inventory.find((x) => x.instanceId === b.weaponId)
          if (!target || !row || findItem(target, cat, row.itemId)?.kind !== 'weapon')
            p.blockers.push('必须指定目标角色持有的真实非魔法武器实例')
          else p.notes.push('附魔武器：' + findItem(target, cat, row.itemId)?.name)
        }
        ids = selectedTargets ?? b.targets
        range = Number(
          s.range.match(/(\d+) feet/)?.[1] ?? (s.range === 'Touch' ? 5 : area ? 10000 : 0),
        )
        if (b.metamagic?.option === 'distant') {
          range = s.range === 'Touch' ? 30 : range * 2
          if (areaSpec) areaSpec.range *= 2
        }
        if (!ids.length || ids.length > policy.max || (policy.darts && ids.length !== policy.max))
          p.blockers.push(
            policy.darts
              ? '必须分配本次施放的所有飞弹或射线，可重复同一目标'
              : '目标数量不符合当前处理器',
          )
        if (!policy.darts && new Set(ids).size !== ids.length) p.blockers.push('目标不能重复')
        if (policy.self && ids.some((id) => id !== actor.id)) p.blockers.push('此法术只能选择自身')
        if (s.id === 'shield') p.blockers.push('护盾术请从待结算反应窗口提交')
        if (s.id === 'true-strike') {
          const weapon = attackOptions(actor, world.characters, cat).find(
            (a) => a.id === b.weaponId && a.weaponId,
          )
          if (!weapon) p.blockers.push('True Strike 需要选择当前可用武器')
          else {
            range = weapon.ranged ? weapon.longRange : weapon.reach
            category = attackCategory(weapon)
            p.notes.push('武器：' + weapon.name)
          }
        } else if (profile.kind === 'attack' && s.range !== 'Touch') category = 'spell'
        see = [
          'healing-word',
          'hex',
          'hunter-s-mark',
          'hellish-rebuke',
          'bane',
          'magic-missile',
          'sacred-flame',
          'dissonant-whispers',
          'animal-friendship',
          'charm-person',
          'command',
          'hideous-laughter',
          'floating-disk',
        ].includes(s.id)
        if (cost === 'reaction' || /immediately after/i.test(s.castingTime))
          p.confirmations.push('确认触发时机并填写环境依据。')
        if (
          (cost === 'reaction' || /immediately after/i.test(s.castingTime)) &&
          !environment.note.trim()
        )
          p.blockers.push('请填写施法触发依据')
      } else {
        ids = [actor.id]
        if (
          !encounter.pending?.targets.some(
            (t) =>
              t.id === actor.id &&
              ((encounter.pending!.kind === 'attack' && t.hit) ||
                encounter.pending!.spellId === 'magic-missile'),
          )
        )
          p.blockers.push('护盾术须响应命中的攻击或魔法飞弹')
        p.notes.push('直到下次自己回合开始 AC +5，影响触发攻击并免疫魔法飞弹。')
      }
      if (area) p.confirmations.push('范围模板仅提供候选；GM 检查正文形状、原点、遮挡和最终目标。')
      if (profile.kind === 'manual')
        p.notes.push(
          '复杂效果：资源记账后进入 GM 裁定窗口；' + (profile.note ?? '按法术正文处理。'),
        )
      else if (profile.note) p.notes.push(profile.note)
    }
  } else if (b.type === 'convert') {
    recoverySummary(p, b.command)
  } else if (b.type === 'feature') {
    if (b.id.startsWith('phb/')) {
      const power = c ? rulePowers(c).find((f) => f.id === b.id) : undefined
      p.source = power?.name ?? b.id
      p.page = 0
      ids = b.targets?.length ? b.targets : [b.targetId || actor.id]
      if (!power) p.blockers.push('尚未获得对应专长或子职业能力')
      if (power) {
        cost = power.cost === 'none' ? null : power.cost
        range = power.range
        p.costs.push(
          (cost ? COST_NAMES[cost] : '按触发，无额外动作') +
            (power.resource
              ? '；' +
                power.resource +
                ' ×' +
                (['phb/healing-light', 'phb/warrior-gods'].includes(b.id)
                  ? (b.rule?.count ?? b.amount)
                  : 1)
              : ''),
        )
        p.notes.push(power.detail)
        if (power.resource && (r?.resources[power.resource] ?? 0) < 1)
          p.blockers.push('能力资源不足')
        if (power.timing === 'before-roll' && encounter.pending)
          p.blockers.push('须在检定开始前使用，不能事后补用')
        if (!b.note.trim()) p.blockers.push('请记录具体触发与裁定依据')
        p.confirmations.push('按显示条文核对时机、目标、空间及持续条件；审核前不掷骰、不扣资源。')
      }
    } else if (b.id.startsWith('origin/')) {
      p.source =
        {
          'lucky-own': '幸运点 · 自身检定',
          'lucky-defense': '幸运点 · 攻击劣势',
          interception: '拦截',
          protection: '守护',
          healer: '医疗师战地医师',
          'healing-hands': '治愈之手',
          revelation: '天启',
          'end-revelation': '结束天启',
          radiance: '内耀辉光',
          'grapple-damage': '徒手战斗擒抱伤害',
        }[b.id.slice(7)] ?? b.id
      p.confirmations.push(
        '核对 PHB 2024 触发时机、看到攻击者、5／10 尺距离、目标和资源；幸运／守护必须在触发骰掷出前批准。',
      )
      p.costs.push(
        ['origin/protection', 'origin/interception'].includes(b.id)
          ? '反应 ×1'
          : b.id.includes('lucky')
            ? '幸运点 ×1，不消耗反应'
            : ['origin/healer', 'origin/healing-hands'].includes(b.id)
              ? '动作 ×1（医疗师为操作动作，治愈之手为魔法动作）'
              : b.id === 'origin/revelation'
                ? '附赠动作、天启次数 ×1'
                : '按触发时机，不消耗动作',
      )
      if (b.id === 'origin/interception')
        p.notes.push('命中序号 ' + (b.amount + 1) + '；该具体攻击减伤 1d10＋熟练；审核后掷骰。')
      if (b.id === 'origin/healer')
        p.notes.push('医疗包 1 次＋目标生命骰 1 枚；审核后掷骰，不加目标体质。')
      ids = b.targets?.length ? b.targets : [b.targetId]
      if (b.id === 'origin/interception') {
        const entry = encounter.pending?.targets[b.amount]
        if (
          !entry ||
          !entry.hit ||
          encounter.pending?.kind !== 'attack' ||
          entry.id !== b.targetId ||
          entry.id === actor.id ||
          encounter.pending.actorId === actor.id
        )
          p.blockers.push('拦截须响应另一生物被命中的具体攻击')
        cost = 'reaction'
        range = 5
      } else if (b.id === 'origin/protection') {
        cost = 'reaction'
        range = 5
        const trigger = encounter.actors.find((a) => a.id === b.triggerActorId)
        p.notes.push(
          '宣告攻击者：' +
            (trigger
              ? combatStats(trigger, world.characters, cat).name
              : b.triggerActorId || '当前回合生物'),
        )
      } else if (['origin/healer', 'origin/healing-hands'].includes(b.id)) {
        cost = 'action'
        range = 5
      } else if (b.id === 'origin/revelation') {
        cost = 'bonus'
        range = b.amount === 2 ? 10 : null
        p.notes.push(
          '天启模式：' + (b.amount === 1 ? '内耀辉光' : b.amount === 2 ? '死灵环绕' : '天堂飞翼'),
        )
      } else if (b.id === 'origin/radiance') range = 10
      if (b.id.includes('lucky') && !(r?.resources.lucky ?? 0))
        p.blockers.push('幸运点不足或没有专长')
      p.notes.push(b.note)
    } else {
      const manual = c ? manualFeatures(c).find((f) => f.id === b.id) : null
      if (manual) {
        p.source = manual.name
        p.page = manual.page
        p.costs.push(
          '动作 ' +
            manual.cost +
            (manual.resource ? '；' + manual.resource + ' ×' + manual.amount : ''),
        )
        p.notes.push(manual.detail, '通过后记录资源与动作，并进入 GM 分步结算窗口。')
        p.confirmations.push('核对正文触发、距离、目标、使用次数与效果；不能只凭特性名称执行。')
        if (manual.resource && (r?.resources[manual.resource] ?? 0) < manual.amount)
          p.blockers.push('特性资源不足')
        return p
      }
      const def = c ? resources(c, cat).find((x) => x.id === b.id) : null
      p.source = def?.name ?? b.id
      p.page = def?.page ?? null
      cost =
        b.id === 'action-surge' || (b.id === 'breath' && (actor.turn.attacksLeft ?? 0) > 0)
          ? null
          : b.id === 'breath'
            ? 'action'
            : 'bonus'
      const amount = b.id === 'lay-on-hands' ? (b.purify ? 5 : b.amount) : 1
      p.costs.push(
        `${cost ? COST_NAMES[cost] : '额外动作或本攻击动作中的一次攻击'}；资源 ×${amount} · 当前 ${r?.resources[b.id] ?? 0}`,
      )
      if (!def || (r?.resources[b.id] ?? 0) < amount) p.blockers.push('特性资源不足或不存在')
      ids = selectedTargets ?? (b.targets?.length ? b.targets : [b.targetId])
      if (featureSelf(b.id) && ids.some((id) => id !== actor.id))
        p.blockers.push('此特性请以行动者自身为目标')
      if (b.id === 'bardic-inspiration') {
        range = 60
        if (ids.includes(actor.id)) p.blockers.push('吟游激励须给予另一生物')
        p.confirmations.push('目标必须能看见或听见吟游诗人；看不见时请记录听见的依据。')
      }
      if (b.id === 'lay-on-hands') range = 5
      if (b.id === 'lay-on-hands' && b.purify) p.notes.push('消耗 5 点去除中毒，不同时恢复 HP。')
      if (b.id === 'breath') {
        range = 30
        area = true
        areaSpec = {
          shape: (mapOptions?.template ?? scene.template)?.shape === 'line' ? 'line' : 'cone',
          size: (mapOptions?.template ?? scene.template)?.shape === 'line' ? 30 : 15,
          width: (mapOptions?.template ?? scene.template)?.shape === 'line' ? 5 : undefined,
          self: true,
          range: 0,
        }
        p.confirmations.push('龙裔吐息：15 尺锥形或 30 尺长、5 尺宽线形，逐目标确认覆盖。')
      }
      if (['stonecunning', 'giant-ancestry'].includes(b.id))
        p.confirmations.push('感知或传送的空间效果由 GM 按正文处理并记录依据。')
      if (['stonecunning', 'giant-ancestry'].includes(b.id) && !(environment.note || b.note).trim())
        p.blockers.push('请填写特性的空间裁定依据')
      if (def) p.notes.push(def.detail)
      if (b.note) p.notes.push('玩家说明：' + b.note)
    }
  } else if (b.type === 'companion-power') {
    p.source = b.kind === 'fey-step' ? '妖精灵魄：妖精步伐' : '亡灵灵魄：腐灭灵光'
    cost = b.kind === 'fey-step' ? 'bonus' : null
    ids = [b.targetId]
    if (b.kind === 'putrid-aura') range = 5
    p.costs.push(
      b.kind === 'fey-step'
        ? '附赠动作；可见未占据落点至多三十尺'
        : '目标回合开始；不消耗动作；同一目标本回合一次',
    )
    p.confirmations.push('核对灵魄形态、专注、落点和目标；审批前不会移动或消耗资源。')
    p.notes.push(b.note)
    if (b.kind === 'fey-step') {
      const from = scene.tokens.find((t) => t.actorId === actor.id),
        destination = b.destination
      if (!from || !destination) p.blockers.push('须指定妖精步伐落点')
      else {
        const to = { ...from, ...destination },
          cells = occupied(to)
        p.notes.push(
          `传送落点 (${destination.x},${destination.y})；${distance(scene, from, to)} 尺`,
        )
        if (
          !cells.every((p) => inside(scene, p) && !blocked(scene, p)) ||
          scene.tokens.some(
            (t) =>
              t.id !== from.id &&
              occupied(t).some((p) => cells.some((q) => p.x === q.x && p.y === q.y)),
          )
        )
          p.blockers.push('落点不是合法未占据空间')
        if (distance(scene, from, to) > 30) p.blockers.push('传送落点超过三十尺')
        if (mapOptions?.obstacles !== false && !sightLine(scene, from, to, 'blocksSight').clear)
          p.blockers.push('传送落点不可见')
      }
    }
  } else if (b.type === 'maintain-spell' || b.type === 'zone-move') {
    p.source = b.type === 'maintain-spell' ? '疯狂冠冕：维持控制' : '匕首之云：移动区域'
    cost = 'action'
    p.costs.push('魔法动作')
    p.confirmations.push(
      b.type === 'maintain-spell'
        ? '选择的目标与触及；须在移动前完成规定的近战动作'
        : '区域位置移动至多 30 尺；移动后覆盖名单须另行确认',
    )
    p.notes.push(b.note)
  } else if (b.type === 'action') {
    p.source = ACTION_NAMES[b.action]
    cost = 'action'
    p.costs.push('行动')
    if (b.note) p.notes.push(b.note)
  } else if (b.type === 'inventory') {
    const instanceId = 'instanceId' in b.command ? b.command.instanceId : '',
      item = c?.inventory.find((x) => x.instanceId === instanceId)
    p.source = `背包 ${b.command.type} · ${item && c ? (findItem(c, cat, item.itemId)?.name ?? item.itemId) : ''}`
    cost =
      b.command.type === 'item-remove' && b.command.consume && item?.itemId === 'healing-potion'
        ? 'bonus'
        : b.cost === 'free'
          ? null
          : b.cost
    if (!['item-note', 'portrait-set'].includes(b.command.type)) {
      p.costs.push(COST_NAMES[cost ?? 'free'])
      if (!cost && !actor.turn.objectInteraction) p.blockers.push('免费物品交互已用')
    }
    p.confirmations.push('物品库存、手部位置、穿脱装备和操作用时。药水自动按附赠动作扣除。')
  } else {
    p.source =
      (
        {
          'death-save': '死亡豁免',
          concentration: '专注豁免',
          'end-concentration': '自愿结束专注',
          inspiration: '使用激励',
          'end-effect': '移除效果',
        } as Record<string, string>
      )[b.type] ?? b.type
    p.costs.push('不消耗动作（执行时检查适用条件）')
  }
  if (
    b.type === 'attack' &&
    ((b.cost === 'star' && actor.turn.manualUsed?.includes('star-ready')) ||
      b.cost === 'agile' ||
      (b.cost === 'opportunity' && stat.effects.some((f) => f.key === 'maneuver-commanded')))
  )
    cost = null
  if (
    b.type === 'feature' &&
    ((b.id === 'phb/sea-wave' && actor.turn.manualUsed?.includes('sea-ready')) ||
      (b.id === 'phb/companion-command' && b.rule?.choice === 'replace-attack'))
  )
    cost = null
  if (cost) {
    if (!actor.turn[cost]) p.blockers.push(COST_NAMES[cost] + '已经使用')
    if (
      cost !== 'reaction' &&
      encounter.actors[encounter.current]?.id !== actor.id &&
      !(
        actor.companion?.source === 'primal-companion' &&
        encounter.actors[encounter.current]?.id === actor.companion.ownerId
      )
    )
      p.blockers.push('尚未轮到该行动者的回合')
    if (stat.dead || stat.conditions.includes('incapacitated'))
      p.blockers.push('死亡或失能状态阻止该行动')
  }
  for (const id of [...new Set(ids)]) {
    const target = encounter.actors.find((a) => a.id === id),
      from = scene.tokens.find((t) => t.actorId === actor.id),
      to = scene.tokens.find((t) => t.actorId === id)
    if (!target || !to || !from) {
      p.blockers.push('行动者或目标缺少场景棋子')
      continue
    }
    if (member?.role !== 'gm' && to.hidden) p.blockers.push('提交者不能以隐藏棋子为目标')
    if (
      mapOptions &&
      (!mapOptions.distance ||
        !mapOptions.highGround ||
        mapOptions.obstacles === false ||
        mapOptions.cover === false ||
        mapOptions.area === false) &&
      !mapOptions.reason.trim()
    ) {
      p.blockers.push('覆盖地图条件时请填写 GM 原因')
      continue
    }
    let env: Environment
    const original = targetEnvironments[id] ?? environment
    try {
      env = mapEnvironment(scene, from, to, original, category, mapOptions)
      if (area) {
        const template = mapOptions?.template ?? scene.template
        if (persistentArea && template) {
          const anchor = { ...to, id: 'zone-origin-preview', x: template.x, y: template.y, span: 1 }
          const originTemplate = { ...template, includeOrigin: true }
          env = areaEnvironment(
            { ...scene, template: originTemplate, tokens: [...scene.tokens, anchor] },
            from,
            anchor,
            env,
            {
              distance: true,
              highGround: true,
              reason: '',
              ...mapOptions,
              template: originTemplate,
            },
            areaSpec,
            original,
          )
        } else env = areaEnvironment(scene, from, to, env, mapOptions, areaSpec, original)
      }
    } catch (error) {
      p.blockers.push(`${to.name}：${(error as Error).message}`)
      continue
    }
    if (env.spatial) p.notes.push(env.spatial)
    if (
      b.type === 'feature' &&
      b.id === 'bardic-inspiration' &&
      !env.targetSees &&
      !(env.note || b.note).trim()
    )
      p.blockers.push(`${to.name} 看不见吟游诗人，请填写听见的依据`)
    p.targets.push({
      id,
      name: combatStats(target, world.characters, cat).name,
      distance: env.distance,
      high: env.attackAdvantages ?? [],
      environment: env,
    })
    if (range !== null && id !== actor.id && env.distance > range)
      p.blockers.push(`${to.name} 超出射程／触及（${range} 尺）`)
    if (range !== null && !env.targetLocationConfirmed)
      p.blockers.push(`${to.name} 的位置尚需 GM 确认`)
    if (area && !env.areaConfirmed) p.blockers.push(`${to.name} 的范围覆盖尚未确认`)
    if (range !== null && id !== actor.id && !area && env.cover === 'total')
      p.blockers.push(`${to.name} 在完全掩护后`)
    if (see && !env.attackerSees) p.blockers.push(`${to.name} 须处于施法者视线内`)
  }
  p.blockers = [...new Set(p.blockers)]
  p.confirmations = [...new Set(p.confirmations)]
  return p
}
