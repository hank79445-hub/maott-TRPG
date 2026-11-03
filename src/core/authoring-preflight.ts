import { authoringSchema } from '../persistence/script-authoring-schema'
import { compileAuthoring, type CompiledAuthoring } from './script-authoring'
import { compileAuthorWalls } from './authoring-visual-layout'
import { compileNpcCharacter } from './authoring-character'
import { catalogue, getChoices, equipmentChoices, validate, newCharacter } from './engine'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { growthCandidate } from './growth'
import { choiceFeedback } from './choice-feedback'
import { assertAuthoringBytes } from './configuration-limits'
export interface AuthoringProblem {
  stage: string
  target: string
  name: string
  path: string
  code: string
  message: string
  actual?: unknown
  expected?: unknown
  allowed?: unknown
  hint: string
}
export function preflightAuthoring(input: unknown) {
  const issues: AuthoringProblem[] = [],
    options: { target: string; level: number; nodes: ReturnType<typeof getChoices> }[] = [],
    targets: { value: string; label: string }[] = []
  let compiled: CompiledAuthoring | undefined
  const add = (issue: Omit<AuthoringProblem, 'hint'>) =>
    issues.push({ ...issue, hint: '仅修复该路径，保留其他内容；重检后以正式编译结果为准。' })
  let value = input
  if (typeof input === 'string')
    try {
      assertAuthoringBytes(input)
      value = JSON.parse(input.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1'))
    } catch (e) {
      add({
        stage: 'JSON',
        target: 'document',
        name: '创作JSON',
        path: '$',
        code: 'json',
        message: e instanceof Error ? e.message : 'JSON无效',
      })
    }
  const parsed = issues.length ? undefined : authoringSchema.safeParse(value)
  if (parsed && !parsed.success)
    for (const e of parsed.error.issues) {
      const list =
          value && typeof value === 'object'
            ? (value as Record<string, unknown>)[String(e.path[0])]
            : undefined,
        row = Array.isArray(list) && typeof e.path[1] === 'number' ? list[e.path[1]] : undefined,
        key = row && typeof row === 'object' && typeof row.key === 'string' ? row.key : undefined
      add({
        stage: 'Schema',
        target:
          key && ['npcs', 'scenes'].includes(String(e.path[0]))
            ? `${e.path[0] === 'npcs' ? 'npc' : 'scene'}:${key}`
            : 'document',
        name: '结构字段',
        path: e.path.map(String).join('.'),
        code: e.code,
        message: e.message,
      })
    }
  if (parsed?.success) {
    const s = parsed.data,
      cat = catalogue([...BUILTIN_PACKS, ...(s.itemPacks ?? [])])
    for (const [i, n] of s.npcs.entries()) {
      const target = 'npc:' + n.key
      targets.push({ value: target, label: 'NPC：' + n.name })
      if (!n.character) continue
      const b = n.character.build,
        nodes = [...getChoices(b, cat), ...equipmentChoices(b, cat)]
      options.push({ target, level: 1, nodes })
      const buildIssues = validate(b, cat)
      for (const p of buildIssues) {
        const node = nodes.find((x) => x.id === p.key),
          detail = node
            ? choiceFeedback(
                node,
                (node.step === 4 ? b.equipmentChoices : b.choices)[node.id] ?? [],
              )
            : undefined
        add({
          stage: '一级构建',
          target,
          name: n.name,
          path: `npcs.${i}.character.build.${p.key === 'boosts' ? 'boosts' : 'choices.' + p.key}`,
          code: detail ? 'choice-selection' : p.key,
          message: p.message,
          actual: p.key === 'boosts' ? b.boosts : detail?.actual,
          expected:
            p.key === 'boosts'
              ? {
                  abilities: cat.backgrounds.find((bg) => bg.id === b.backgroundId)?.abilities,
                  distribution: ['+2/+1', '+1/+1/+1'],
                  maximum: 20,
                }
              : detail?.expected,
          allowed: detail?.allowed,
        })
      }
      if (buildIssues.length) continue
      for (let step = 0; step <= n.character.growth.length; step++)
        try {
          const config = compileNpcCharacter(
              { ...n.character, growth: n.character.growth.slice(0, step) },
              n.name,
              'preflight-' + n.key,
              cat,
            ),
            c = { ...newCharacter(), ...config, status: 'complete' as const, runtime: null },
            next = n.character.growth[step]
          if (next) {
            const candidate = growthCandidate(
              c,
              { ...next, expectedRevision: c.revision, confirmed: true, reason: '创作预检' },
              cat,
            )
            options.push({
              target,
              level: next.targetLevel,
              nodes: getChoices(candidate.build, cat),
            })
          }
        } catch (e) {
          add({
            stage: step ? '职业成长' : '一级构建',
            target,
            name: n.name,
            path: step
              ? `npcs.${i}.character.growth.${step - 1}`
              : `npcs.${i}.character.build.choices`,
            code: step ? 'character-growth' : 'character-build',
            message: e instanceof Error ? e.message : String(e),
          })
          break
        }
    }
    for (const [i, scene] of s.scenes.entries()) {
      targets.push({ value: 'scene:' + scene.key, label: '场景：' + scene.name })
      for (const [j, w] of (scene.walls ?? []).entries())
        try {
          compileAuthorWalls(
            { ...scene, walls: [w] },
            [],
            new Map(scene.points.map((p) => [scene.key + '/' + p.key, p.key])),
          )
        } catch (e) {
          add({
            stage: '门墙坐标',
            target: 'scene:' + scene.key,
            name: scene.name,
            path: `scenes.${i}.walls.${j}`,
            code: 'wall-reference-geometry',
            actual: w,
            message: e instanceof Error ? e.message : String(e),
          })
        }
      for (const [j, p] of scene.points.entries())
        if (p.itemUse?.effect === 'open' && !['door', 'chest'].includes(p.kind))
          add({
            stage: '互动语义',
            target: 'scene:' + scene.key,
            name: p.name,
            path: `scenes.${i}.points.${j}.itemUse.effect`,
            code: 'item-open-kind',
            actual: p.kind,
            expected: ['door', 'chest'],
            message: '直接打开只适用门／容器；机关请用prerequisite加显式开门关联',
          })
    }
    if (!issues.length)
      try {
        compiled = compileAuthoring(s)
      } catch (e) {
        add({
          stage: '整体编译',
          target: 'document',
          name: s.title,
          path: '$',
          code: 'compile',
          message: e instanceof Error ? e.message : String(e),
        })
      }
  }
  return {
    ready: !!compiled,
    issues,
    options,
    targets,
    compiled,
    blocked: issues.length ? '依赖失效的后续检查暂无法判断；修复后重新运行。' : '',
  }
}
