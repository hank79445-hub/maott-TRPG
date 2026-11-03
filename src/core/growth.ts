import { growthBaseline, growthSpellSnapshot, modernGrowthChoiceIssues, growthSnapshotIssues, type GrowthBaseline } from './growth-choice-policy'
import { pinRuleSources } from './rule-sources'
import type { Character, GrowthRequest, GrowthRecord } from './types'
import { ABILITIES } from './types'
import { clone, derived, getChoices, validate, type Catalogue } from './engine'
import { levelOf, alwaysPrepared, hasSubclass, savantSchool } from './growth-rules'
import { resources, runtimeState, validateInventory, validateRuntimeArchive } from './runtime'
import { featBoost, beforeFeatBoost, partialCaster } from './advanced-rules'
import { prerequisiteIssues } from './rule-options'

export function growthCandidate(
  c: Character,
  request: GrowthRequest,
  cat: Catalogue,
  hp?: number,
  context?: { legacy?: boolean; baseline?: GrowthBaseline },
): Character {
  const next = clone(c),
    cl = cat.classes.find((x) => x.id === c.build.classId)!
  const record: GrowthRecord = {
    level: request.targetLevel,
    hpMethod: request.hpMethod,
    hp: hp ?? Math.floor(cl.hitDie / 2) + 1,
    choices: clone(request.choices),
    beforeChoices: clone(c.build.choices),
    ...(!context?.legacy ? { selectionVersion: 2 as const, beforeSpellChoices: context?.baseline ? Object.fromEntries(Object.entries(context.baseline).filter(([key]) => ['class-spells','class-cantrips','tome-cantrips','tome-rituals'].includes(key))) : growthSpellSnapshot(c) } : {}),
    abilityIncreases: clone(request.abilityIncreases),
    at: new Date().toISOString(),
    reason: request.reason,
  }
  next.build.growth = [...(next.build.growth ?? []), record]
  next.build.choices = clone(request.choices)
  next.level = levelOf(next.build)
  return next
}
export function growthIssues(c: Character, request: GrowthRequest, cat: Catalogue, context?: { legacy?: boolean; baseline?: GrowthBaseline }): string[] {
  const issues: string[] = []
  if (c.status !== 'complete') issues.push('请先完成一级建角')
  if (c.level !== levelOf(c.build) || c.level >= 5 || request.targetLevel !== c.level + 1)
    issues.push('只能逐级提升至 5 级，等级必须与成长记录一致')
  if (c.revision !== request.expectedRevision) issues.push('角色已变化，请重新准备升级')
  if (!request.confirmed || !request.reason.trim()) issues.push('请确认升级条件并填写升级依据')
  if (c.runtime?.concentration) issues.push('升级前请结束专注，避免更换准备法术与持续来源冲突')
  if (issues.length) return issues
  const next = growthCandidate(c, request, cat),
    l = next.level
  if (!context?.legacy) issues.push(...modernGrowthChoiceIssues(c, next, cat, context?.baseline ?? growthBaseline(c)))
  const mutable = [
    'class-cantrips',
    'class-spells',
    'spellbook',
    'invocation',
    'style',
    'mastery',
    'metamagic',
    'land',
    'pact-weapon',
    'warrior-cantrips',
    'tome-cantrips',
    'tome-rituals',
    'feat-mastery',
    'feat-ritual-spells',
  ]
  for (const key of Object.keys(c.build.choices))
    if (
      !mutable.includes(key) &&
      !key.startsWith('mi-') &&
      !key.startsWith('skilled-lesson-') &&
      JSON.stringify(request.choices[key]) !== JSON.stringify(c.build.choices[key])
    )
      issues.push('已获得的初始或成长选择须保留：' + key)
  const allowed = new Set(getChoices(next.build, cat).map((n) => n.id))
  if (
    (c.build.choices['feat-ritual-spells'] ?? []).some(
      (id) => !request.choices['feat-ritual-spells']?.includes(id),
    )
  )
    issues.push('仪式施法者已获得法术须保留，熟练增长时只增加')
  for (const key of Object.keys(request.choices))
    if (!allowed.has(key) && request.choices[key]?.length)
      issues.push('未知或当前不可用的选择：' + key)
  const priorChoices = context?.legacy ? c.build.choices : context?.baseline ?? growthBaseline(c)
  for (const key of ['class-cantrips', 'invocation', 'metamagic'])
    if ((priorChoices[key] ?? []).filter((id) => !request.choices[key]?.includes(id)).length > 1)
      issues.push('每次升级最多替换一项：' + key)
  for (const src of [
    'background',
    'human',
    'growth',
    ...Object.keys(c.build.choices)
      .filter((k) => k.startsWith('mi-lesson-') && k.endsWith('-ability'))
      .map((k) => k.slice(3, -8)),
  ]) {
    const keys = ['mi-' + src + '-cantrips', 'mi-' + src + '-spell']
    if (
      keys.reduce(
        (n, key) =>
          n +
          (c.build.choices[key] ?? []).filter((id) => !request.choices[key]?.includes(id)).length,
        0,
      ) > 1
    )
      issues.push('魔法学徒每次升级最多更换一个法术')
    for (const suffix of ['list', 'ability'])
      if (
        c.build.choices['mi-' + src + '-' + suffix] &&
        JSON.stringify(request.choices['mi-' + src + '-' + suffix]) !==
          JSON.stringify(c.build.choices['mi-' + src + '-' + suffix])
      )
        issues.push('魔法学徒来源与属性须保留')
  }
  if (['bard', 'sorcerer', 'warlock'].includes(c.build.classId) || partialCaster(next.build)) {
    const free = alwaysPrepared(next.build, cat.subclasses).map((s) => s.id)
    if (
      (c.build.choices['class-spells'] ?? []).filter(
        (id) => !request.choices['class-spells']?.includes(id) && !free.includes(id),
      ).length > 1
    )
      issues.push('此职业升级最多替换一个原准备法术')
  }
  if (c.build.classId === 'wizard') {
    const old = c.build.choices.spellbook ?? [],
      current = request.choices.spellbook ?? [],
      added = current.filter((id) => !old.includes(id))
    if (old.some((id) => !current.includes(id))) issues.push('升级必须保留原法术书')
    if (
      l === 3 &&
      savantSchool(next.build) &&
      added.filter((id) => cat.spells.find((s) => s.id === id)?.school === savantSchool(next.build))
        .length < 2
    )
      issues.push('学派学者：三级额外加入两个对应学派法术')
    if (
      l === 5 &&
      savantSchool(next.build) &&
      added.filter((id) =>
        cat.spells.some(
          (s) => s.id === id && s.school === savantSchool(next.build) && (context?.legacy ? s.level === 3 : s.level >= 1 && s.level <= 3),
        ),
      ).length < 1
    )
      issues.push(context?.legacy ? '学派学者：获得三环位时额外加入一个三环对应学派法术' : '学派学者：五级额外加入1道对应学派的一至三环法术')
  }
  const points = Object.values(request.abilityIncreases).reduce((n, x) => n + (x ?? 0), 0)
  const feat = request.choices['growth-feat']?.[0]
  const boost = featBoost(next.build, cat)
  if (l === 4 && boost) {
    if (points !== boost.points) issues.push(`此专长须恰好分配 ${boost.points} 点属性提升`)
    const d = derived(next.build, cat, next.inventory)
    if (
      ABILITIES.some(
        (a) =>
          request.abilityIncreases[a] &&
          (!boost.abilities.includes(a) || d.scores[a] > boost.maximum),
      )
    )
      issues.push('专长属性提升须使用允许的属性，且不能超过 20')
    const definition = cat.feats.find((f) => f.id === feat)
    if (definition)
      issues.push(
        ...prerequisiteIssues(beforeFeatBoost(next.build), definition, [{ classes: cat.classes }]),
      )
    if (
      feat === 'resilient' &&
      ABILITIES.some(
        (a) =>
          request.abilityIncreases[a] &&
          cat.classes.find((cl) => cl.id === c.build.classId)?.saves.includes(a),
      )
    )
      issues.push('强健身心须选择尚无豁免熟练的属性')
  } else if (points) issues.push('本次升级没有属性提升，不能增加属性')
  const lists = Object.entries(request.choices)
    .filter(([key]) => key.startsWith('mi-') && key.endsWith('-list'))
    .flatMap(([, v]) => v)
  const bgFeat = cat.backgrounds.find((b) => b.id === c.build.backgroundId)?.feat ?? ''
  if (bgFeat.startsWith('magic-initiate-')) lists.push(bgFeat.slice(15))
  for (const inv of request.choices.invocation ?? [])
    if (inv.startsWith('lessons:magic-initiate-')) lists.push(inv.slice(23))
  if (new Set(lists).size !== lists.length) issues.push('魔法学徒的法术列表不能重复')
  const original = [bgFeat, ...(c.build.choices['human-feat'] ?? []), feat]
  if (
    (request.choices.invocation ?? [])
      .filter((i) => i.startsWith('lessons:'))
      .map((i) => i.slice(8))
      .some((f) => f !== 'skilled' && !f.startsWith('magic-initiate') && original.includes(f))
  )
    issues.push('先人教诲不能重复获得不可重复的专长')
  if (
    (request.choices.invocation ?? []).filter((i) => i.startsWith('lessons:magic-initiate-'))
      .length > 1
  )
    issues.push('先人教诲的重复选择必须是不同起源专长，不能多次选魔法学徒')
  for (const key of Object.keys(c.build.choices).filter((k) => k.startsWith('skilled-lesson-')))
    if (
      request.choices.invocation?.includes('lessons:' + key.slice(15)) &&
      JSON.stringify(c.build.choices[key]) !== JSON.stringify(request.choices[key])
    )
      issues.push('保留先人教诲时不能更换熟习的技能或工具')
  issues.push(...validate(next.build, cat, { existingCharacter: true }).map((i) => i.message))
  return [...new Set(issues)]
}
export function validateGrowthArchive(c: Character, cat: Catalogue) {
  if (c.level !== levelOf(c.build) || c.level < 1 || c.level > 5)
    throw new Error('等级与成长记录不一致')
  const steps = c.build.growth ?? []
  if (!steps.length) return
  let replay = clone(c)
  replay.level = 1
  replay.build.growth = []
  replay.build.choices = clone(steps[0]!.beforeChoices)
  replay.runtime = null
  if (validate(replay.build, cat, { existingCharacter: true }).length)
    throw new Error('成长记录的一级构筑不合法')
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!,
      cl = cat.classes.find((x) => x.id === c.build.classId)!
    if (
      step.level !== i + 2 ||
      !Number.isInteger(step.hp) ||
      step.hp < 1 ||
      step.hp > cl.hitDie ||
      (step.hpMethod === 'fixed' && step.hp !== Math.floor(cl.hitDie / 2) + 1)
    )
      throw new Error('成长顺序或生命骰记录不合法')
    if (JSON.stringify(step.beforeChoices) !== JSON.stringify(replay.build.choices))
      throw new Error('成长记录前后选择不一致')
    const request: GrowthRequest = {
      ...step,
      expectedRevision: replay.revision,
      targetLevel: step.level,
      confirmed: true,
    }
    if (step.selectionVersion === 2 && !step.beforeSpellChoices) throw Error('成长记录缺少实际法术基线')
    if (step.selectionVersion === 2) { const invalid = growthSnapshotIssues(replay, step.beforeSpellChoices!, cat); if (invalid.length) throw Error(invalid.join('；')) }
    const context = { legacy: step.selectionVersion !== 2, baseline: step.selectionVersion === 2 ? { ...replay.build.choices, ...step.beforeSpellChoices } : undefined }
    const issues = growthIssues(replay, request, cat, context)
    if (issues.length) throw new Error('成长记录不合法：' + issues.join('；'))
    replay = growthCandidate(replay, request, cat, step.hp, context)
  }
  if (JSON.stringify(steps.at(-1)!.choices) !== JSON.stringify(c.build.choices))
    throw new Error('成长选择与当前构筑不一致')
}
export function applyLevelUp(
  c: Character,
  cat: Catalogue,
  request: GrowthRequest,
  dice: (s: number) => number,
): Character {
  const errors = growthIssues(c, request, cat)
  if (errors.length) throw new Error(errors.join('；'))
  const sides = cat.classes.find((x) => x.id === c.build.classId)!.hitDie,
    hp = request.hpMethod === 'roll' ? dice(sides) : Math.floor(sides / 2) + 1
  if (!Number.isInteger(hp) || hp < 1 || hp > sides) throw new Error('无效升级生命骰')
  const next = growthCandidate(c, request, cat, hp),
    old = runtimeState(c, cat),
    defs = resources(c, cat),
    newDefs = resources(next, cat)
  next.runtime = clone(old)
  next.runtime.hp = old.hp
  next.runtime.hitDice = Math.min(next.level, old.hitDice + 1)
  next.runtime.preparedSpells = request.choices['class-spells'] ? [...request.choices['class-spells']!] : null
  delete next.runtime.restSpellChoices
  if (next.level === 3 && hasSubclass(next.build, 'assassin'))
    for (const itemId of ['disguise-kit', 'poisoner-kit'])
      next.inventory.push({
        instanceId: crypto.randomUUID(),
        itemId,
        quantity: 1,
        source: '刺客工具 · 三级授予',
        equipped: false,
        note: '只在三级升级时授予一次',
        containerId: null,
      })
  if (next.level === 3 && hasSubclass(next.build, 'stars'))
    next.inventory.push({
      instanceId: crypto.randomUUID(),
      itemId: 'star-map',
      quantity: 1,
      source: '星辰结社 · 星图',
      equipped: false,
      note: '持握后获得星图赠法',
      containerId: null,
    })
  next.runtime.resources = Object.fromEntries(
    newDefs.map((d) => [
      d.id,
      Math.max(0, (old.resources[d.id] ?? 0) + d.max - (defs.find((x) => x.id === d.id)?.max ?? 0)),
    ]),
  )
  if (c.build.classId === 'warlock') {
    const oldPact = defs.find((d) => d.id.startsWith('slots')),
      newPact = newDefs.find((d) => d.id.startsWith('slots'))
    if (oldPact && newPact)
      next.runtime.resources[newPact.id] = Math.max(
        0,
        newPact.max - (oldPact.max - old.resources[oldPact.id]!),
      )
  }
  next.journal = (next.journal ?? []).map((e) => ({ ...e, before: null }))
  next.revision++
  next.updatedAt = new Date().toISOString()
  next.journal.push({
    id: crypto.randomUUID(),
    at: next.updatedAt,
    revision: next.revision,
    kind: 'level-up',
    detail: `提升至 ${next.level} 级；生命骰 ${request.hpMethod === 'roll' ? '掷骰' : '固定'} ${hp}；最大 HP ${derived(c.build, cat, c.inventory).hp} → ${derived(next.build, cat, next.inventory).hp}；当前 HP 保留 ${old.hp}；${request.reason}`,
    before: {
      runtime: clone(c.runtime),
      inventory: clone(c.inventory),
      coins: c.coins,
      growth: clone(c.build.growth ?? []),
      choices: clone(c.build.choices),
      level: c.level,
    },
    undone: false,
  })
  next.journal = next.journal.slice(-60)
  validateInventory(next, cat)
  validateRuntimeArchive(next, cat)
  pinRuleSources(next, cat)
  return next
}
