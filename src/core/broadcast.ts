const explorationActionMessageKeys={"surge":"exploration.action.surge","dash":"exploration.action.dash","dodge":"exploration.action.dodge","disengage":"exploration.action.disengage","stand":"exploration.action.stand","utilize":"exploration.action.utilize","hide":"exploration.action.hide","search":"exploration.action.search","study":"exploration.action.study","influence":"exploration.action.influence","help":"exploration.action.help","ready":"exploration.action.ready","reaction":"exploration.action.reaction","wind":"exploration.action.wind","wind-focus":"exploration.action.wind-focus","cunning-dash":"exploration.action.cunning-dash","cunning-disengage":"exploration.action.cunning-disengage","cunning-hide":"exploration.action.cunning-hide"} as const
import {systemMessage} from '../shared/localization/system-messages'
import { BROADCAST_LIMIT } from './configuration-limits'
import { combatStats } from './combat-rules'
import { clone, catalogue } from './engine'
import { srd } from '../content/srd'
import type { Adventure, MapCommand, MapWorld, MapScene } from './map-types'
import type {
  BroadcastAudience,
  BroadcastEvent,
  BroadcastJournal,
  BroadcastSettings,
  BroadcastTemplate,
} from './broadcast-types'
import { broadcastSettingsSchema } from '../persistence/broadcast-schema'
import { DEFENSE_NAMES } from './combat-types'

export const publicAudience = (): BroadcastAudience => ({ kind: 'public', characterIds: [] })
export const gmAudience = (): BroadcastAudience => ({ kind: 'gm', characterIds: [] })
export const newBroadcastSettings = (): BroadcastSettings => ({
  templates: [],
  played: [],
  storyStarted: false,
})
export const newBroadcastJournal = (): BroadcastJournal => ({
  version: 1,
  branchId: crypto.randomUUID(),
  nextSequence: 1,
  events: [],
})
export function broadcasts(a: Adventure) {
  a.broadcast ??= newBroadcastSettings()
  a.broadcastLog ??= newBroadcastJournal()
  return { settings: a.broadcast, journal: a.broadcastLog }
}
export function newBroadcastTemplate(): BroadcastTemplate {
  return {
    id: crypto.randomUUID(),
    title: '新的广播',
    text: '',
    enabled: true,
    narration: 'direct',
    trigger: 'manual',
    sceneId: null,
    targetId: null,
    policy: 'manual',
    eventType: 'point.check',
    result: 'any',
    cooldownSeconds: 60,
    audience: publicAudience(),
  }
}
export function renderBroadcast(
  text: string,
  vars: Record<string, string | number | boolean | null>,
) {
  const missing: string[] = []
  const rendered = text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, key: string) => {
    if (!Object.hasOwn(vars, key) || vars[key] === null) {
      missing.push(key)
      return `［缺少变量：${key}］`
    }
    return String(vars[key])
  })
  return { text: rendered.slice(0, 6000), missing: [...new Set(missing)] }
}
export function validateBroadcasts(a: Adventure, world?: MapWorld) {
  if (!a.broadcast) return
  broadcastSettingsSchema.parse(a.broadcast)
  const t = a.broadcast.templates
  if (
    new Set(t.map((x) => x.id)).size !== t.length ||
    new Set(a.broadcast.played.map((x) => x.templateId)).size !== a.broadcast.played.length
  )
    throw new Error('广播模板或播放标记 ID 重复')
  if (a.broadcast.played.some((x) => !t.some((y) => y.id === x.templateId)))
    throw new Error('播放标记引用未知模板')
  for (const x of t) {
    const s = a.scenes.find((s) => s.id === x.sceneId)
    if (
      world &&
      x.audience.kind === 'personal' &&
      x.audience.characterIds.some((id) => !world.characters.some((c) => c.id === id))
    )
      throw new Error('广播接收角色不存在')
    if (x.trigger === 'event' && !x.eventType) throw new Error('请选择结算事件类型')
    if (['scene', 'point', 'region', 'wall'].includes(x.trigger) && !s)
      throw new Error('广播需要有效场景')
    if (x.sceneId && !s) throw new Error('广播场景不存在')
    if (
      (x.trigger === 'point' ||
        (x.trigger === 'event' && x.eventType === 'point.result' && x.targetId)) &&
      !s?.points.some((p) => p.id === x.targetId)
    )
      throw new Error('广播互动点不存在')
    if (x.trigger === 'region' && !s?.regions.some((p) => p.id === x.targetId))
      throw new Error('广播区域不存在')
    if (x.trigger === 'wall' && !s?.walls?.some((p) => p.id === x.targetId && p.kind === 'door'))
      throw new Error('广播门段不存在')
    if (x.audience.characterIds.some((id) => !a.party.includes(id)) && x.audience.kind === 'party')
      throw new Error('队伍广播接收角色不在队伍')
  }
}
type EventInput = Pick<BroadcastEvent, 'category' | 'type' | 'title' | 'text'> &
  Partial<
    Pick<
      BroadcastEvent,
      'sceneId' | 'phase' | 'facts' | 'audience' | 'causeId' | 'supersedes' | 'narration' | 'message'
    >
  >
export function appendBroadcast(a: Adventure, actionId: string, input: EventInput): BroadcastEvent {
  const { journal } = broadcasts(a)
  const event: BroadcastEvent = {
    version: 1,
    narration:
      input.narration ??
      (input.type.startsWith('template.') ||
      input.type.startsWith('scene.') ||
      input.type.startsWith('ai.') ||
      input.type === 'npc.reply'
        ? 'direct'
        : 'generate'),
    id: crypto.randomUUID(),
    roomId: null,
    branchId: journal.branchId,
    sequence: journal.nextSequence++,
    actionId,
    causeId: null,
    worldRevision: a.revision,
    at: new Date().toISOString(),
    sceneId: a.activeSceneId,
    phase: 'confirmed',
    facts: {},
    audience: publicAudience(),
    supersedes: [],
    ...clone(input),
  }
  if (event.audience.kind === 'party') event.audience.characterIds = clone(a.party)
  journal.events.push(event)
  journal.events = journal.events.slice(-5000)
  a.broadcastCursor = event.sequence
  return event
}
function context(
  world: MapWorld,
  a: Adventure,
  scene?: MapScene,
  characterId?: string,
  object?: string,
) {
  return {
    story: a.name,
    scene: scene?.name ?? null,
    actor: world.characters.find((c) => c.id === characterId)?.build.name ?? null,
    object: object ?? null,
  }
}
export function playBroadcast(
  a: Adventure,
  actionId: string,
  template: BroadcastTemplate,
  vars: Record<string, string | number | boolean | null>,
  manual = false,
  replay = false,
  hidden = false,
  causeId: string | null = null,
) {
  const { settings } = broadcasts(a),
    now = new Date(),
    mark = settings.played.find((p) => p.templateId === template.id)
  if (!template.enabled) {
    if (manual) throw new Error('广播模板未启用')
    return
  }
  if (!manual && template.policy === 'manual') return
  if (
    !replay &&
    mark &&
    (template.policy === 'once' ||
      (template.policy === 'cooldown' &&
        now.getTime() - Date.parse(mark.lastAt) < template.cooldownSeconds * 1000))
  ) {
    if (manual) throw new Error('广播已经播放或仍在冷却中；如需再次展示，请使用明确重播')
    return
  }
  const rendered = renderBroadcast(template.text, vars)
  const event = appendBroadcast(a, actionId, {
    category:
      template.trigger === 'point' || template.trigger === 'region' || template.trigger === 'wall'
        ? 'trigger'
        : 'preset',
    type: replay ? 'template.replay' : 'template.play',
    narration: template.narration ?? 'direct',
    title: template.title,
    text: rendered.text,
    sceneId: template.sceneId ?? a.activeSceneId,
    audience: hidden ? gmAudience() : template.audience,
    causeId,
    facts: { templateId: template.id, replay, missingVariables: rendered.missing.join(',') },
  })
  if (mark) {
    mark.count++
    mark.lastAt = now.toISOString()
  } else settings.played.push({ templateId: template.id, count: 1, lastAt: now.toISOString() })
  return event
}
export function applyBroadcastCommand(
  a: Adventure,
  world: MapWorld,
  command: MapCommand,
  actionId: string,
  interactionCheck?:{total:number;success:boolean},
) {
  const { settings } = broadcasts(a)
  if (command.type === 'broadcast-template') {
    const index = settings.templates.findIndex((t) => t.id === command.template.id)
    if (index < 0) {
      if (settings.templates.length >= BROADCAST_LIMIT)
        throw new Error(`最多 ${BROADCAST_LIMIT} 个广播模板`)
      settings.templates.push(clone(command.template))
    } else settings.templates[index] = clone(command.template)
  } else if (command.type === 'broadcast-delete') {
    settings.templates = settings.templates.filter((t) => t.id !== command.templateId)
    settings.played = settings.played.filter((p) => p.templateId !== command.templateId)
  } else if (command.type === 'broadcast-reset') {
    if (!settings.templates.some((t) => t.id === command.templateId))
      throw new Error('广播模板不存在')
    settings.played = settings.played.filter((p) => p.templateId !== command.templateId)
  } else if (command.type === 'broadcast-play') {
    const t = settings.templates.find((t) => t.id === command.templateId)
    if (!t) throw new Error('广播模板不存在')
    const scene = a.scenes.find((s) => s.id === (t.sceneId ?? a.activeSceneId))
    playBroadcast(a, actionId, t, context(world, a, scene), true, command.replay)
  } else if (command.type === 'broadcast-start') {
    if (settings.storyStarted) throw new Error('故事已开始；开场白可通过模板重播')
    settings.storyStarted = true
    const e = appendBroadcast(a, actionId, {
      category: 'progress',
      type: 'story.start',
      message:systemMessage('story.start',{story:a.name}),
      title: '故事开始',
      text: `${a.name}的故事开始。`,
      facts: { story: a.name },
    })
    for (const t of settings.templates.filter((t) => t.trigger === 'story'))
      playBroadcast(
        a,
        actionId,
        t,
        context(
          world,
          a,
          a.scenes.find((s) => s.id === a.activeSceneId),
        ),
        false,
        false,
        false,
        e.id,
      )
  } else if (command.type === 'broadcast-mark') {
    appendBroadcast(a, actionId, {
      category: 'progress',
      type: 'gm.mark',
      title: command.title,
      text: command.text,
      audience: command.audience,
      facts: { adjudicated: true },
    })
  }
  validateBroadcasts(a, world)
}
/** Called before checkpoints are created: playback marks are part of the entry snapshot. */
export function collectMapBroadcasts(
  before: MapWorld,
  world: MapWorld,
  a: Adventure,
  command: MapCommand,
  actionId: string,
  interactionCheck?: {total:number;success:boolean},
) {
  const old = before.adventures.find((x) => x.id === a.id)!,
    { settings, journal } = broadcasts(a)
  for (const event of journal.events)
    if (event.actionId === actionId) event.worldRevision = a.revision
  const scene = a.scenes.find(
      (s) => s.id === ('sceneId' in command ? command.sceneId : a.activeSceneId),
    ),
    oldScene = old.scenes.find((s) => s.id === scene?.id)
  if (
    command.type === 'restore' ||
    command.type === 'battle-reset' ||
    command.type === 'undo' ||
    (command.type === 'combat' && command.command.type === 'undo')
  ) {
    const invalid = journal.events
      .filter((e) => e.sequence > (a.broadcastCursor ?? 0))
      .map((e) => e.id)
    const previousBranch = journal.branchId
    journal.branchId = crypto.randomUUID()
    appendBroadcast(a, actionId, {
      category: 'progress',
      type:
        command.type === 'battle-reset'
          ? 'branch.reset'
          : command.type === 'restore'
            ? 'branch.restore'
            : 'branch.undo',
      phase: 'correction',
      title:
        command.type === 'battle-reset'
          ? '测试战斗整体重置'
          : command.type === 'restore'
            ? '整体读档'
            : '撤销与更正',
      text: 'GM 已恢复先前状态；旧分支后续结果不再作为当前事实，旧文本保留供追溯。',
      message:systemMessage(command.type==='battle-reset'?'branch.reset':command.type==='restore'?'branch.restore':'branch.undo'),
      facts: { previousBranch },
      supersedes: invalid,
    })
    return
  }
  if (command.type.startsWith('broadcast-')) {
    if (command.type === 'broadcast-start' || command.type === 'broadcast-mark')
      fireEventTemplates(a, world, actionId)
    return
  }
  const explore = old.exploration?.status !== 'closed' ? old.exploration : undefined
  const emit = (input: EventInput) =>
    appendBroadcast(a, actionId, {
      ...input,
      facts: {
        ...input.facts,
        ...(explore
          ? {
              turnId: `explore:${explore.id}:${explore.roundId}`,
              explorationId: explore.id,
              round: explore.round,
            }
          : {}),
      },
    })
  if (command.type === 'explore') {
    const cmd = command.command,
      token = 'tokenId' in cmd ? scene?.tokens.find((t) => t.id === cmd.tokenId) : undefined
    const visible = token && !token.hidden
    if (cmd.operation === 'jump' && token) {
      const oldToken = oldScene?.tokens.find((t) => t.id === token.id)
      emit({
        category: 'progress',
        type: 'token.jumped',
        message:systemMessage('token.jumped',{actor:token.name}),
        title: '跳跃完成',
        text: `${token.name}跳跃至新落点。`,
        audience: visible ? publicAudience() : gmAudience(),
        facts: {
          tokenId: token.id,
          fromX: oldToken?.x ?? null,
          fromY: oldToken?.y ?? null,
          toX: token.x,
          toY: token.y,
          mode: cmd.mode,
        },
      })
    } else if (
      cmd.operation === 'action' ||
      cmd.operation === 'jump-cast' ||
      cmd.operation === 'spell-cast'
    )
      emit({
    message: systemMessage(cmd.operation==='action'?explorationActionMessageKeys[cmd.action]:cmd.operation==='jump-cast'?'exploration.cast.jump':'exploration.cast.spell',{actor:token?.name??'角色'}),
        category: 'interaction',
        type: 'exploration.action',
        title: '探索行动',
        text: `${token?.name ?? '角色'}${cmd.operation === 'action' && ['hide', 'search', 'study', 'influence', 'help', 'ready', 'reaction', 'cunning-hide'].includes(cmd.action) ? '登记' : '完成'}${cmd.operation === 'action' ? { surge: '动作如潮', dash: '疾走', dodge: '闪避', disengage: '撤离', stand: '起身', utilize: '利用', hide: '躲藏', search: '搜索', study: '研究', influence: '影响', help: '帮助', ready: '准备', reaction: '反应', wind: '疾步', 'wind-focus': '增强疾步', 'cunning-dash': '灵巧疾走', 'cunning-disengage': '灵巧撤离', 'cunning-hide': '灵巧躲藏' }[cmd.action] : cmd.operation === 'jump-cast' ? '跳跃术施放' : '法术施放'}${cmd.operation === 'action' && ['hide', 'search', 'study', 'influence', 'help', 'ready', 'reaction', 'cunning-hide'].includes(cmd.action) ? '动作；检定与具体效果由 GM 裁定。' : '。'}`,
        audience: visible ? publicAudience() : gmAudience(),
        facts: {
          operation: cmd.operation,
          ...(cmd.operation === 'action' ? { action: cmd.action } : {}),
        },
      })
    else if (cmd.operation === 'zone-move')
      emit({
        category: 'progress',
        type: 'exploration.zone-moved',
        title: '法术区域移动',
        text: `${token?.name ?? '角色'}移动持续法术区域。`,
          message: systemMessage('exploration.zoneMoved',{actor:token?.name??'Character'}),
        audience: visible ? publicAudience() : gmAudience(),
        facts: { operation: cmd.operation },
      })
    else if (cmd.operation === 'zone-resolve') {
      const prior = before.encounters.find((e) => e.id === cmd.encounterId),
        ids = prior?.pending?.targets.map((t) => t.id) ?? [],
        publicResult = ids.every((id) =>
          scene?.tokens.some(
            (t) =>
              (t.actorId === id || t.npcSourceActorId === id || t.characterId === id) && !t.hidden,
          ),
        )
      emit({
        category: 'resolution',
        type: 'exploration.zone-resolved',
        title: '区域结果确认',
        text: '持续区域豁免与伤害已确认。',
          message: systemMessage('exploration.zoneResolved'),
        audience: publicResult ? publicAudience() : gmAudience(),
        facts: { operation: cmd.operation },
      })
      if (scene)
        collectCombatBroadcasts(
          before,
          world,
          a,
          { ...scene, encounterId: cmd.encounterId },
          {
            type: 'resolve',
            nonlethal: false,
            savage: false,
            stone: false,
            relentless: false,
            pushConfirmed: false,
          },
          actionId,
        )
    }
    if (
      explore &&
      (a.exploration?.roundId !== explore.roundId || a.exploration?.status === 'closed')
    )
      emit({
        category: 'progress',
        type: 'exploration.round-ended',
        title: '探索轮结束',
        text: `全队第 ${explore.round} 轮探索已收尾。`,
          message: systemMessage('exploration.roundEnded',{round:explore.round}),
        audience: publicAudience(),
        facts: {
          closedTurnId: `explore:${explore.id}:${explore.roundId}`,
          seconds: explore.acted ? 6 : 0,
        },
      })
    if (['toggle', 'end', 'finish'].includes(cmd.operation))
      for (const t of scene?.tokens ?? []) {
        const current = world.characters.find((c) => c.id === t.characterId)?.runtime ?? t.npcBody,
          prior =
            before.characters.find((c) => c.id === t.characterId)?.runtime ??
            oldScene?.tokens.find((q) => q.id === t.id)?.npcBody
        if (!current || !prior) continue
        if (current.hp !== prior.hp || current.temporaryHp !== prior.temporaryHp)
          emit({
            category: 'resolution',
            type: 'effect.health',
            title: '持续效果生命变化',
            text: `${t.name}的回合持续效果已结算。`,
          message: systemMessage('effect.health',{actor:t.name}),
            audience: t.hidden ? gmAudience() : publicAudience(),
            facts: {
              tokenId: t.id,
              hpChange: current.hp - prior.hp,
              temporaryHpChange: current.temporaryHp - prior.temporaryHp,
            },
          })
        const removed = (prior.effects ?? []).filter(
          (f) => f.condition && !current.effects?.some((next) => next.id === f.id),
        )
        for (const f of removed)
          if (!current.effects?.some((next) => next.condition === f.condition))
            emit({
              category: 'resolution',
              type: 'exploration.condition-ended',
              title: '持续状态结束',
              text: `${t.name}的一项持续状态已结束。`,
          message: systemMessage('effect.conditionEnded',{actor:t.name}),
              audience: t.hidden ? gmAudience() : publicAudience(),
              facts: { tokenId: t.id, condition: f.condition ?? null },
            })
      }
  }
  const fire = (
    trigger: BroadcastTemplate['trigger'],
    targetId: string | null,
    vars: Record<string, string | number | boolean | null>,
    hidden: boolean,
    causeId: string,
  ) => {
    for (const t of settings.templates.filter(
      (t) => t.trigger === trigger && t.sceneId === scene?.id && t.targetId === targetId,
    ))
      playBroadcast(a, actionId, t, vars, false, false, hidden, causeId)
  }
  if (command.type === 'interact') {
    const p = scene?.points.find((p) => p.id === command.pointId),
      prior = oldScene?.points.find((p) => p.id === command.pointId),
      n = a.ai?.npcs.find(n=>n.id===command.npcId),
      c = world.characters.find((c) => c.id === (n?.characterId??command.characterId))
    if (p && (c||n)) {
      const actorName=c?.build.name??n!.name, characterId=c?.id, npcFacts:Record<string,string> = n?{actorNpcId:n.id}:{}
      const nativeResult = !c ? interactionCheck : undefined
      const hidden = !!p.hidden || !!prior?.hidden,
        audience = hidden ? gmAudience() : publicAudience(),
        vars = {...context(world,a,scene,characterId,p.name),actor:actorName}
      const trigger = emit({
        category: 'trigger',
        type: 'point.trigger',
        message:systemMessage('point.trigger',{actor:actorName,object:p.name}),
        sceneId: scene?.id ?? null,
        title: '互动触发',
        text: `${actorName}与${p.name}互动。`,
        audience,
        facts: { characterId: characterId ?? null, ...npcFacts, pointId: p.id, operation: command.operation },
      })
      fire('point', p.id, vars, hidden, trigger.id)
      const check = c?.runtime?.advanced?.lastCheck ?? (nativeResult?{id:actionId,total:nativeResult.total,autoFail:!nativeResult.success}:undefined)
      let causeId = trigger.id
      if (
        command.operation === 'check' &&
        p.check &&
        check &&
        check.id !== before.characters.find((x) => x.id === characterId)?.runtime?.advanced?.lastCheck?.id
      ) {
        const success = !check.autoFail && check.total >= p.check.dc
        const e = emit({
          category: 'resolution',
          type: 'point.check',
          sceneId: scene?.id ?? null,
          title: p.check.kind === 'save' ? '豁免结果' : '检定结果',
          text: `${actorName}的${p.check.kind === 'save' ? '豁免' : '检定'}总值为 ${check.total}，${success ? '成功' : '失败'}。`,
          message: systemMessage(p.check.kind==='save'?(success?'character.save.pass':'character.save.fail'):(success?'character.check.pass':'character.check.fail'),{actor:actorName,total:check.total}),
          audience,
          causeId,
          facts: {
            characterId: characterId ?? null, ...npcFacts,
            kind: p.check.kind,
            key: p.check.id,
            total: check.total,
            success,
          },
        })
        causeId = e.id
      }
      emit({
    message: !p.hidden&&p.revealed?systemMessage('point.result.detail',{object:p.name,detail:p.revealed}):systemMessage('point.result',{object:p.name}),
        category: 'interaction',
        type: 'point.result',
        sceneId: scene?.id ?? null,
        title: '互动结果',
        text: `${p.name}的互动已结算${!p.hidden && p.revealed ? '：' + p.revealed : '。'}`,
        audience,
        causeId,
        facts: {
          pointId: p.id,
          characterId: characterId ?? null, ...npcFacts,
          state: p.state,
          adjudicated: false,
          success:
            command.operation === 'check' &&
            p.check &&
            check &&
            check.id !==
              before.characters.find((x) => x.id === characterId)?.runtime?.advanced?.lastCheck?.id
              ? !check.autoFail && check.total >= p.check.dc
              : (p.kind === 'exit' && !!p.targetSceneId && a.activeSceneId === p.targetSceneId && old.activeSceneId !== a.activeSceneId) ||
                (command.operation === 'claim' && p.kind === 'chest' && !!prior && (prior.loot.length > 0 || prior.coins > 0 || !!prior.containerInventory?.length))
                ? true
                : ['open', 'resolved', 'disarmed'].includes(p.state) &&
                  !['open', 'resolved', 'disarmed'].includes(prior?.state ?? '')
                ? true
                : null,
        },
      })
      const success = ['open', 'resolved', 'disarmed'].includes(p.state)
      const oldCheck = before.characters.find((x) => x.id === characterId)?.runtime?.advanced?.lastCheck
      const checked = command.operation === 'check' && p.check && check && check.id !== oldCheck?.id
      const failed = !!checked && (check!.autoFail || check!.total < p.check!.dc)
      const completed = success && !['open', 'resolved', 'disarmed'].includes(prior?.state ?? '')
      for (const story of p.storyResults ?? []) {
        if (!(story.outcome === 'success' ? completed : failed)) continue
        const n = a.ai?.npcs.find((n) => n.id === story.npcId)
        if (!n || n.sceneId !== scene?.id) continue
        const publicStory = !hidden && !n.hidden
        emit({message:systemMessage(story.requiresGM?'point.story.pending':'point.story'),
          category: 'interaction',
          type: story.requiresGM ? 'point.story.pending' : 'point.story',
          title: story.requiresGM ? '剧情结果待 GM 确认' : '剧情结果',
          text: story.text,
          audience: story.requiresGM || !publicStory ? gmAudience() : publicAudience(),
          causeId,
          facts: {
            pointId: p.id,
            characterId: characterId ?? null, ...npcFacts,
            npcId: n.id,
            storyId: story.id,
            storyType: story.type,
            success: story.outcome === 'success',
            publicStory,
          },
        })
      }
    }
  }
  if (a.activeSceneId !== old.activeSceneId) {
    const entered = a.scenes.find((s) => s.id === a.activeSceneId)
    const e = emit({
      category: 'progress',
      type: entered ? 'scene.enter' : 'scene.leave',
      title: entered ? '进入场景' : '离开场景',
      text: entered ? `队伍进入${entered.name}。` : '队伍离开当前场景。',
          message: entered?systemMessage('scene.enter',{scene:entered.name}):systemMessage('scene.leave'),
      sceneId: entered?.id ?? null,
      facts: { sceneId: entered?.id ?? null },
    })
    if (entered)
      for (const t of settings.templates.filter(
        (t) => t.trigger === 'scene' && t.sceneId === entered.id,
      ))
        playBroadcast(a, actionId, t, context(world, a, entered), false, false, false, e.id)
  }
  if (command.type === 'wall-toggle') {
    const wall = scene?.walls?.find((w) => w.id === command.wallId)
    if (wall) {
      const p = scene?.points.find((p) => p.id === wall.pointId)
      const open = (p?.state ?? wall.state) === 'open'
      const e = emit({
        category: 'interaction',
        type: 'door.change',
        title: '门状态改变',
        text: `${wall.name}已${open ? '打开' : '关闭'}。`,
          message: systemMessage(open?'door.open':'door.close',{object:wall.name}),
        audience: wall.hidden ? gmAudience() : publicAudience(),
        facts: { wallId: wall.id, open },
      })
      fire('wall', wall.id, context(world, a, scene, undefined, wall.name), wall.hidden, e.id)
    }
  }
  if (
    (command.type === 'move' ||
      (command.type === 'explore' && command.command.operation === 'jump')) &&
    scene
  ) {
    const movement = command.type === 'move' ? command : null,
      jump =
        command.type === 'explore' && command.command.operation === 'jump' ? command.command : null
    const token = scene.tokens.find((t) => t.id === (movement?.tokenId ?? jump?.tokenId)),
      prior = oldScene?.tokens.find((t) => t.id === token?.id)
    if (movement && token && prior && (token.x !== prior.x || token.y !== prior.y)) {
      const encounter = world.encounters.find((e) => e.id === scene.encounterId)
      const oldEncounter = before.encounters.find((e) => e.id === scene.encounterId)
      let travelledFeet = 0,
        from = { x: prior.x, y: prior.y }
      for (const step of movement.path) {
        travelledFeet +=
          Math.max(Math.abs(step.x - from.x), Math.abs(step.y - from.y)) * scene.grid.feet
        from = step
      }
      emit({
        category: 'combat',
        type: 'token.moved',
        title: movement.gm ? 'GM 调整位置' : '移动已确认',
        text: `${token.name}${movement.gm ? '的位置由 GM 调整' : '移动'}到 (${token.x}, ${token.y})。`,
          message: systemMessage(movement.gm?'token.gmMove':'token.move',{actor:token.name,x:token.x,y:token.y}),
        audience: token.hidden ? gmAudience() : publicAudience(),
        facts: {
          tokenId: token.id,
          actorId: token.actorId,
          characterId: token.characterId,
          fromX: prior.x,
          fromY: prior.y,
          x: token.x,
          y: token.y,
          adjudicated: movement.gm,
          travelledFeet,
          movementCost: movement.gm
            ? null
            : explore?.status === 'active'
              ? (a.exploration?.members.find((m) => m.tokenId === token.id)?.movement ?? 0) -
                (explore.members.find((m) => m.tokenId === token.id)?.movement ?? 0)
              : (encounter?.actors.find((a) => a.id === token.actorId)?.turn.movement ?? 0) -
                (oldEncounter?.actors.find((a) => a.id === token.actorId)?.turn.movement ?? 0),
          encounterId: encounter?.id ?? null,
          round: encounter?.round ?? null,
          turnId: explore
            ? `explore:${explore.id}:${explore.roundId}`
            : encounter
              ? `${encounter.id}:${encounter.tick}`
              : null,
        },
      })
    }
    if (token && prior)
      for (const region of scene.regions) {
        const overlaps = (p: { x: number; y: number; span: number }) =>
          region.cells.some((cell) => {
            const [x, y] = cell.split(',').map(Number)
            return x! >= p.x && x! < p.x + p.span && y! >= p.y && y! < p.y + p.span
          })
        // Detect entry along the confirmed path, including pass-through, at most once per region per action.
        let inside = overlaps(prior),
          entered = false
        for (const p of movement?.path ?? (token ? [{ x: token.x, y: token.y }] : [])) {
          const next = overlaps({ ...p, span: token.span })
          if (!inside && next) entered = true
          inside = next
        }
        if (entered) {
          const hidden = region.hidden || token.hidden
          const e = emit({
            category: 'trigger',
            type: 'region.enter',
            title: '进入区域',
            text: `${token.name}进入${region.name}。`,
          message: systemMessage('region.enter',{actor:token.name,region:region.name}),
            audience: hidden ? gmAudience() : publicAudience(),
            facts: { regionId: region.id, characterId: token.characterId },
          })
          fire(
            'region',
            region.id,
            context(world, a, scene, token.characterId ?? undefined, region.name),
            hidden,
            e.id,
          )
        }
      }
  }
  if (command.type === 'combat' && scene)
    collectCombatBroadcasts(before, world, a, scene, command.command, actionId)
  else if (
    scene &&
    world.encounters.some((e) => e.id === scene.encounterId && e.phase === 'active')
  )
    collectCombatBroadcasts(before, world, a, scene, { type: 'roll-initiative' }, actionId)
  fireEventTemplates(a, world, actionId)
}
export function fireEventTemplates(a: Adventure, world: MapWorld, actionId: string) {
  const { settings, journal } = broadcasts(a)
  // Snapshot the sources; generated template events never recursively trigger more templates.
  for (const source of journal.events.filter(
    (e) => e.actionId === actionId && !e.type.startsWith('template.') && e.phase !== 'pending',
  )) {
    const scene = a.scenes.find((s) => s.id === source.sceneId),
      actorId = String(source.facts.characterId ?? source.facts.actorId ?? '')
    const actor = world.encounters.flatMap((e) => e.actors).find((a) => a.id === actorId)
    const characterId = world.characters.some((c) => c.id === actorId)
      ? actorId
      : (actor?.characterId ?? undefined)
    const object = scene?.points.find((p) => p.id === source.facts.pointId)?.name ?? source.title
    const success =
      typeof source.facts.success === 'boolean'
        ? source.facts.success
        : typeof source.facts.hit === 'boolean'
          ? source.facts.kind === 'save'
            ? !source.facts.hit
            : source.facts.hit
          : null
    const vars = {
      ...context(world, a, scene, characterId, object),
      actor:
        world.characters.find((c) => c.id === characterId)?.build.name ?? actor?.npc?.name ?? null,
      total: source.facts.total ?? null,
      result: success === null ? '已确认' : success ? '成功' : '失败',
    }
    for (const t of settings.templates.filter(
      (t) =>
        t.trigger === 'event' &&
        t.eventType === source.type &&
        (!t.sceneId || t.sceneId === source.sceneId) &&
        (t.eventType !== 'point.result' || !t.targetId || t.targetId === source.facts.pointId) &&
        ((t.result ?? 'any') === 'any' ||
          (t.result === 'success' && success === true) ||
          (t.result === 'failure' && success === false)),
    )) {
      let audience =
        t.audience.kind === 'party'
          ? { kind: 'party' as const, characterIds: clone(a.party) }
          : clone(t.audience)
      if (source.audience.kind === 'gm') audience = gmAudience()
      else if (source.audience.kind !== 'public' && t.audience.kind !== 'gm') {
        if (t.audience.kind === 'public') audience = clone(source.audience)
        else {
          const requested = t.audience.kind === 'party' ? a.party : t.audience.characterIds
          const ids = source.audience.characterIds.filter((id) => requested.includes(id))
          if (!ids.length) continue
          audience = {
            kind: t.audience.kind === 'personal' ? 'personal' : source.audience.kind,
            characterIds: ids,
          }
        }
      }
      const e = playBroadcast(
        a,
        actionId,
        t,
        vars,
        false,
        false,
        source.audience.kind === 'gm',
        source.id,
      )
      if (!e) continue
      e.category = source.category
      e.phase = source.phase
      e.type = 'template.event'
      e.audience = audience
    }
  }
}
export function collectCombatBroadcasts(
  before: MapWorld,
  world: MapWorld,
  a: Adventure,
  scene: MapScene,
  command: import('./combat-types').CombatCommand,
  actionId: string,
) {
  const e = world.encounters.find((e) => e.id === scene.encounterId),
    prior = before.encounters.find((e) => e.id === scene.encounterId)
  if (!e || !prior) return
  const visible = (id: string) =>
    scene.tokens.some(
      (t) => !t.hidden && (t.actorId === id || t.npcSourceActorId === id || t.characterId === id),
    )
  const actor = 'actorId' in command ? e.actors.find((a) => a.id === command.actorId) : undefined
  const pending = command.type === 'resolve' ? prior.pending : e.pending ?? prior.pending,
    source = e.actors.find((a) => a.id === pending?.actorId)
  const cause = pending?.id
    ? ([...broadcasts(a).journal.events].reverse().find((x) => x.facts.pendingId === pending.id)
        ?.id ?? null)
    : null
  const name = (actor: import('./combat-types').Combatant | undefined) =>
    actor?.characterId
      ? (world.characters.find((c) => c.id === actor.characterId)?.build.name ?? '角色')
      : (actor?.npc?.name ?? '行动者')
  const latest = e.log.at(-1)
  if (latest && latest.id !== prior.log.at(-1)?.id)
    appendBroadcast(a, actionId, {message:systemMessage('audit.combat'),
      category: 'combat',
      type: 'combat.audit',
      title: 'GM 战斗结算明细',
      text: latest.detail.slice(0, 6000),
      audience: gmAudience(),
      facts: { operation: command.type, encounterId: e.id },
    })
  for (const outcome of latest?.outcomes ?? []) {
    const target = e.actors.find((a) => a.id === outcome.actorId)
    const resultKey=outcome.kind==='death-save'?'combat.deathSave':outcome.kind==='concentration'?'combat.concentration':outcome.kind==='check'?'combat.influence':'character.save'
    appendBroadcast(a, actionId, {
      category: 'resolution',
      type: 'combat.' + outcome.kind,
      title:
        outcome.kind === 'death-save'
          ? '死亡豁免'
          : outcome.kind === 'concentration'
            ? '专注豁免'
            : outcome.kind === 'check'
              ? '影响检定结果'
              : '豁免结果',
      text: `${name(target)}的${outcome.kind === 'check' ? '影响检定' : '豁免'}总值为 ${outcome.total}，${outcome.success ? '成功' : '失败'}。`,
      message:systemMessage(`${resultKey}.${outcome.success?'pass':'fail'}`,{actor:name(target),total:outcome.total}),
      audience: visible(outcome.actorId) ? publicAudience() : gmAudience(),
      causeId: cause,
      facts: {
        actorId: outcome.actorId,
        total: outcome.total,
        success: outcome.success,
        kind: outcome.kind,
      },
    })
  }
  for (const now of e.actors) {
    const prev = prior.actors.find((a) => a.id === now.id)
    const r = now.characterId
      ? world.characters.find((c) => c.id === now.characterId)?.runtime
      : now.npc
    const oldR = prev?.characterId
      ? before.characters.find((c) => c.id === prev.characterId)?.runtime
      : prev?.npc
    if (!r || !oldR) continue
    const audience = visible(now.id) ? publicAudience() : gmAudience()
    if (command.type !== 'resolve' && (r.hp !== oldR.hp || r.temporaryHp !== oldR.temporaryHp))
      appendBroadcast(a, actionId, {
        category: 'resolution',
        type: 'effect.health',
        title: '生命变化已确认',
        text: `${name(now)}的生命变化已保存。`,
          message: systemMessage('health.confirmed',{actor:name(now)}),
        audience,
        facts: {
          actorId: now.id,
          characterId: now.characterId ?? null,
          ...(!world.characters.find((c) => c.id === now.characterId)?.npcOwnerId && now.characterId
            ? {
                hpBefore: oldR.hp,
                hpAfter: r.hp,
                maxHp: combatStats(now, world.characters, catalogue([srd, ...world.packs])).maxHp,
              }
            : {}),
          hpChange: r.hp - oldR.hp,
          temporaryHpChange: r.temporaryHp - oldR.temporaryHp,
        },
      })
    const nowDeath = now.characterId
        ? world.characters.find((c) => c.id === now.characterId)?.runtime?.death
        : null,
      oldDeath = prev?.characterId
        ? before.characters.find((c) => c.id === prev.characterId)?.runtime?.death
        : null
    const dead = nowDeath?.dead ?? now.npc?.dead ?? false,
      wasDead = oldDeath?.dead ?? prev?.npc?.dead ?? false
    if (dead !== wasDead || !!nowDeath?.stable !== !!oldDeath?.stable)
      appendBroadcast(a, actionId, {
        category: 'resolution',
        type: 'life.state',
        narration: 'direct',
        title: '生命状态已确认',
        text: `${name(now)}：${dead ? '死亡' : nowDeath?.stable ? '稳定' : wasDead ? '已恢复生命状态' : '稳定状态改变'}。`,
        message:systemMessage(dead?'life.dead':nowDeath?.stable?'life.stable':wasDead?'life.recovered':'life.changed',{actor:name(now)}),
        audience,
        facts: { actorId: now.id, dead, stable: nowDeath?.stable ?? false },
      })
    const nowConc = now.characterId
        ? world.characters.find((c) => c.id === now.characterId)?.runtime?.concentration
        : null,
      oldConc = prev?.characterId
        ? before.characters.find((c) => c.id === prev.characterId)?.runtime?.concentration
        : null
    if (oldConc && !nowConc)
      appendBroadcast(a, actionId, {
        category: 'resolution',
        type: 'concentration.end',
        title: '专注结束',
        text: `${name(now)}的专注已经结束。`,
          message: systemMessage('concentration.end',{actor:name(now)}),
        audience,
        facts: { actorId: now.id },
      })
  }
  const roster = (state: typeof e, tokens: typeof scene.tokens) =>
    state.actors
      .filter((actor) =>
        tokens.some(
          (t) =>
            !t.hidden &&
            (t.actorId === actor.id ||
              t.npcSourceActorId === actor.id ||
              (!!actor.characterId && t.characterId === actor.characterId)),
        ),
      )
      .map((actor) => ({ id: actor.id, name: name(actor), side: actor.side }))
      .sort((a, b) => a.id.localeCompare(b.id))
  const publicRoster = roster(e, scene.tokens)
  const priorTokens =
    before.adventures.find((p) => p.id === a.id)?.scenes.find((p) => p.id === scene.id)?.tokens ??
    []
  const oldRoster = roster(prior, priorTokens)
  const rosterFacts = Object.fromEntries(
    Array.from({ length: Math.max(1, Math.ceil(publicRoster.length / 10)) }, (_, i) => [
      i ? `roster${i + 1}` : 'roster',
      JSON.stringify(publicRoster.slice(i * 10, (i + 1) * 10)),
    ]),
  )
  const fullRosterText = (['party', 'enemy', 'neutral'] as const)
    .map(
      (side) =>
        ({ party: '队伍方', enemy: '敌对方', neutral: '中立方' })[side] +
        '：' +
        (publicRoster
          .filter((r) => r.side === side)
          .map((r) => r.name)
          .join('、') || '无'),
    )
    .join('；')
  const rosterText =
    fullRosterText.length > 5500
      ? fullRosterText.slice(0, 5500) + '（名单较长，完整公开名单请查看Web）'
      : fullRosterText
  const rosterArgs=Object.fromEntries((['party','enemy','neutral'] as const).map(side=>[side,publicRoster.filter(r=>r.side===side).map(r=>r.name)]))
  if (
    e.phase === 'active' &&
    prior.phase === 'active' &&
    JSON.stringify(publicRoster) !== JSON.stringify(oldRoster)
  )
    appendBroadcast(a, actionId, {
      category: 'combat',
      type: 'encounter.roster',
      title: '公开参战名单更新',
      text: rosterText + '。',
      message:systemMessage('encounter.roster',rosterArgs),
      facts: { encounterId: e.id, ...rosterFacts },
    })
  if (e.phase !== prior.phase || e.round !== prior.round || e.current !== prior.current) {
    const current = e.actors[e.current],
      publicCurrent = current && visible(current.id) ? name(current) : '待 GM 确认的行动者'
    const currentVisible=!!current&&visible(current.id),began=e.phase==='active'&&prior.phase!=='active'
    const turnArgs={round:e.round,...(currentVisible?{actor:name(current)}:{})}
    appendBroadcast(a, actionId, {
      category: 'combat',
      type: e.phase !== prior.phase ? 'encounter.' + e.phase : 'turn.change',
      title: e.phase === 'ended' ? '遭遇结束' : e.phase !== prior.phase ? '遭遇开始' : '回合切换',
      text:
        e.phase === 'ended'
          ? '当前遭遇已经结束。'
          : `第 ${e.round} 轮，当前行动者：${publicCurrent}。${e.phase === 'active' && prior.phase !== 'active' ? `战斗：${e.name}。${rosterText}。` : ''}`,
      message:e.phase==='ended'?systemMessage('encounter.ended'):began?systemMessage(currentVisible?'encounter.startedKnown':'encounter.startedUnknown',{...turnArgs,battle:e.name,...rosterArgs}):systemMessage(e.phase!==prior.phase?(currentVisible?'encounter.phaseKnown':'encounter.phaseUnknown'):(currentVisible?'turn.changedKnown':'turn.changedUnknown'),turnArgs),
      facts: {
        encounterId: e.id,
        ...(e.phase === 'active' && prior.phase !== 'active' ? rosterFacts : {}),
        round: e.round,
        phase: e.phase,
        closedTurnId: `${prior.id}:${prior.tick}`,
        turnId: `${e.id}:${e.tick}`,
      },
    })
  }
  if (e.pending && ![prior.pending, ...prior.reactionParents ?? []].some(p => p?.id === e.pending!.id)) {
    appendBroadcast(a, actionId, {
      category: 'combat',
      type: 'action.pending',
      phase: 'pending',
      title: '行动待结算',
      text: `${name(source)}提交${e.pending.name}；等待反应与最终结算。`,
          message: systemMessage('action.pending',{actor:name(source),action:e.pending.name}),
      audience: source && visible(source.id) ? publicAudience() : gmAudience(),
      facts: { pendingId: e.pending.id ?? null, kind: e.pending.kind, actorId: e.pending.actorId },
    })
  }
  if (command.type === 'resolve' && prior.pending && ![e.pending, ...e.reactionParents ?? []].some(p => p?.id === prior.pending!.id)) {
    const publiclyVisible =
      !!source && visible(source.id) && prior.pending.targets.every((t) => visible(t.id))
    appendBroadcast(a, actionId, {
      category: 'resolution',
      type: 'action.resolved',
      title: '行动已结算',
      text: `${name(source)}的${prior.pending.name}已完成最终结算。`,
          message: systemMessage('action.resolved',{actor:name(source),action:prior.pending.name}),
      audience: publiclyVisible ? publicAudience() : gmAudience(),
      causeId: cause,
      facts: {
        pendingId: prior.pending.id ?? null,
        kind: prior.pending.kind,
        adjudicated: prior.pending.kind === 'manual',
      },
    })
    if (!publiclyVisible && source && visible(source.id))
      appendBroadcast(a, actionId, {
        category: 'resolution',
        type: 'action.resolved',
        title: '行动已结算',
        text: `${name(source)}的行动已完成最终结算，部分结果由 GM 管理。`,
          message: systemMessage('action.managed',{actor:name(source)}),
        audience: publicAudience(),
        facts: { pendingId: prior.pending.id ?? null, kind: prior.pending.kind },
      })
    for (const target of prior.pending.targets) {
      if(prior.pending.concentrationSave)continue
      const nowActor = e.actors.find((a) => a.id === target.id),
        oldActor = prior.actors.find((a) => a.id === target.id)
      const r = nowActor?.characterId
        ? world.characters.find((c) => c.id === nowActor.characterId)?.runtime
        : nowActor?.npc
      const oldR = oldActor?.characterId
        ? before.characters.find((c) => c.id === oldActor.characterId)?.runtime
        : oldActor?.npc
      if (!nowActor || !r || !oldR) continue
      const hpChange = r.hp - oldR.hp,
        tempChange = r.temporaryHp - oldR.temporaryHp
      const actualDamage =
        latest?.damageResults?.find(
          (r) => r.actorId === nowActor.id && r.pendingId === (prior.pending!.id ?? null),
        )?.damage ?? 0
      const audience = publiclyVisible && visible(nowActor.id) ? publicAudience() : gmAudience()
      appendBroadcast(a, actionId, {
        category: 'resolution',
        type: 'target.resolved',
        title: '目标结算结果',
        message:systemMessage(prior.pending.kind==='attack'?(target.hit?'target.attackHit':'target.attackMiss'):prior.pending.kind==='save'?(target.hit?'target.saveFail':'target.savePass'):'target.effect',{actor:name(source),action:prior.pending.name,target:name(nowActor),damage:actualDamage,hpDelta:hpChange>0?'+'+hpChange:hpChange,temporary:Math.max(0,-tempChange)}),
        text: `${name(source)}使用${prior.pending.name}对${name(nowActor)}：${prior.pending.kind === 'attack' ? (target.hit ? '命中' : '未命中') : prior.pending.kind === 'save' ? (target.hit ? '豁免失败' : '豁免成功') : '效果已确认'}；实际伤害 ${actualDamage}，生命${hpChange < 0 ? '损失 ' + -hpChange : hpChange > 0 ? '恢复 ' + hpChange : '无变化'}${tempChange < 0 ? '，临时生命吸收 ' + -tempChange : ''}。`,
        audience,
        causeId: cause,
        facts: {
          actorId: nowActor.id,
          characterId: nowActor.characterId ?? null,
          critical: target.critical && target.hit && actualDamage > 0,
          ...(!world.characters.find((c) => c.id === nowActor.characterId)?.npcOwnerId &&
          nowActor.characterId
            ? {
                hpBefore: oldR.hp,
                hpAfter: r.hp,
                maxHp: combatStats(nowActor, world.characters, catalogue([srd, ...world.packs]))
                  .maxHp,
              }
            : {}),
          pendingId: prior.pending.id ?? null,
          kind: prior.pending.kind,
          total: target.roll?.total ?? null,
          hit: target.hit,
          hpChange,
          temporaryHpChange: tempChange,
          sourceId: source?.id ?? null,
          ranged: prior.pending.attack?.ranged ?? false,
          actionName: prior.pending.name,
          damage: actualDamage,
          damageTypes: latest?.damageResults?.find((r) => r.actorId === nowActor.id)?.types ?? '',
        },
      })
    }
    for (const parent of prior.reactionParents ?? []) {
      if ([e.pending, ...e.reactionParents ?? []].some(p => p?.id === parent.id)) continue
      const caster = e.actors.find(actor => actor.id === parent.actorId)
      appendBroadcast(a, actionId, {
        category: 'resolution', type: 'action.resolved', title: '施法已被中断',
        text: name(caster) + '的' + parent.name + '未生效；反制结算已保存。',
          message: systemMessage('action.countered',{actor:name(caster),action:parent.name}),
        audience: caster && visible(caster.id) ? publicAudience() : gmAudience(),
        facts: { pendingId: parent.id ?? null, kind: parent.kind, interrupted: true },
      })
    }
  } else if (
    ['reaction-shield', 'reaction-defense', 'trigger-feature', 'spell-reroll'].includes(
      command.type,
    )
  ) {
    const reactionName =
      command.type === 'reaction-shield'
        ? '护盾术'
        : command.type === 'reaction-defense'
          ? DEFENSE_NAMES[command.kind]
          : command.type === 'trigger-feature'
            ? '震慑打击'
            : command.type === 'spell-reroll'
              ? command.kind === 'seeking'
                ? '追踪法术'
                : '强效法术'
              : '反应／触发'
    appendBroadcast(a, actionId, {
      category: 'combat',
      type: 'reaction.confirmed',
      title: '反应／触发已处理',
      text: `${name(actor)}使用${reactionName}；最终结果以结算为准。`,
          message: systemMessage('reaction.confirmed',{actor:name(actor),action:reactionName}),
      audience: actor && visible(actor.id) ? publicAudience() : gmAudience(),
      causeId: cause,
      facts: {
        pendingId: pending?.id ?? null,
        operation: command.type,
        sourceId: actor?.id ?? null,
        reactionName,
      },
    })
  } else if (
    ![
      'attack',
      'cast',
      'resolve',
      'start',
      'end',
      'next',
      'end-turn',
      'damage-roll',
      'save',
      'death-save',
      'concentration',
    ].includes(command.type)
  ) {
    appendBroadcast(a, actionId, {
      category: ['save', 'death-save', 'concentration', 'zone-trigger', 'adjudicate'].includes(
        command.type,
      )
        ? 'resolution'
        : 'combat',
      type: 'combat.' + command.type,
      title: '战斗操作已保存',
      text: `${actor ? name(actor) : 'GM'}的战斗操作已保存。`,
          message: systemMessage('combat.saved',{actor:actor?name(actor):'GM'}),
      audience: actor && visible(actor.id) ? publicAudience() : gmAudience(),
      facts: { operation: command.type },
    })
  }
  for (const event of broadcasts(a).journal.events.filter((x) => x.actionId === actionId)) {
    event.facts.encounterId = e.id
    event.facts.round ??= prior.phase === 'active' ? prior.round : e.round
    event.facts.turnId ??= `${e.id}:${prior.phase === 'active' ? prior.tick : e.tick}`
  }
}
