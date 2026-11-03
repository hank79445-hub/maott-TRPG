import type { MapScene, MapTemplate, MapToken, Position, MapCombatOptions } from './map-types'
import type { Environment } from './combat-types'
import type { Spell } from './types'
import { rayCover, strongerCover, COVER_NAMES, type Cover } from './map-spatial'
const EPS = 1e-7
export const TEMPLATE_NAMES: Record<MapTemplate['shape'], string> = {
  circle: '圆形（旧模板）',
  square: '方形地面',
  cone: '锥形',
  line: '线形',
  sphere: '球形（平面）',
  cube: '立方体（平面）',
  cylinder: '柱形（平面）',
  emanation: '发散区域（平面）',
}
export const templateCenter = (t: MapTemplate) => ({
  x: t.x + (t.shape === 'emanation' ? (t.originSpan ?? 1) / 2 : 0.5),
  y: t.y + (t.shape === 'emanation' ? (t.originSpan ?? 1) / 2 : 0.5),
})
export function templateOrigin(grid: MapScene['grid'], t: MapTemplate): Position {
  if (t.origin) return t.origin
  const c = templateCenter(t)
  if (t.shape === 'cube' && t.originRule !== 'center') {
    const d = t.size / grid.feet / 2,
      angle = (t.angle * Math.PI) / 180
    return { x: c.x - d * Math.cos(angle), y: c.y - d * Math.sin(angle) }
  }
  return c
}
export function shapeContains(grid: MapScene['grid'], t: MapTemplate, cell: Position) {
  const origin = templateOrigin(grid, t),
    p = { x: cell.x + 0.5, y: cell.y + 0.5 },
    center = ['square', 'cube'].includes(t.shape) ? templateCenter(t) : origin,
    dx = (p.x - center.x) * grid.feet,
    dy = (p.y - center.y) * grid.feet,
    angle = (t.angle * Math.PI) / 180,
    along = dx * Math.cos(angle) + dy * Math.sin(angle),
    across = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle))
  const atOrigin = Math.hypot(p.x - origin.x, p.y - origin.y) < EPS
  const include =
    t.includeOrigin ??
    (t.propagation === undefined
      ? true
      : ['circle', 'square', 'sphere', 'cylinder'].includes(t.shape) ||
        (t.shape === 'cube' && t.originRule === 'center'))
  if (atOrigin && !include) return false
  if (t.shape === 'emanation') {
    const span = t.originSpan ?? 1,
      inBody = p.x > t.x && p.x < t.x + span && p.y > t.y && p.y < t.y + span
    if (inBody) return include
    const gapX = Math.max(t.x - p.x, p.x - t.x - span, 0),
      gapY = Math.max(t.y - p.y, p.y - t.y - span, 0)
    return Math.hypot(gapX, gapY) * grid.feet <= t.size + EPS
  }
  if (['circle', 'sphere', 'cylinder'].includes(t.shape))
    return dx * dx + dy * dy <= t.size ** 2 + EPS
  if (['square', 'cube'].includes(t.shape))
    return Math.abs(along) <= t.size / 2 + EPS && across <= t.size / 2 + EPS
  if (t.shape === 'line')
    return along >= -EPS && along <= t.size + EPS && across <= t.width / 2 + EPS
  return along >= -EPS && along <= t.size + EPS && across <= along / 2 + EPS
}
export function validateTemplate(scene: MapScene) {
  const t = scene.template
  if (!t) return
  if (
    ![t.x, t.y, t.size, t.angle, t.width].every(Number.isFinite) ||
    !Number.isInteger(t.x) ||
    !Number.isInteger(t.y) ||
    t.x < 0 ||
    t.y < 0 ||
    t.x >= scene.grid.columns ||
    t.y >= scene.grid.rows ||
    t.size <= 0 ||
    t.size > 1000 ||
    t.width <= 0 ||
    t.width > 1000 ||
    Math.abs(t.angle) > 360
  )
    throw new Error('请填写有效的范围定位、尺寸与角度')
  if (t.origin && ![t.origin.x, t.origin.y].every(Number.isFinite))
    throw new Error('请填写有效范围原点')
  const o = templateOrigin(scene.grid, t)
  if (t.propagation === 'straight' && ['square', 'emanation'].includes(t.shape)) {
    const center = templateCenter(t)
    if (Math.hypot(o.x - center.x, o.y - center.y) > EPS)
      throw new Error('方形地面／发散范围的原点必须匹配其中心或来源')
  }
  if (
    (t.origin || t.propagation === 'straight') &&
    (o.x < 0 || o.y < 0 || o.x > scene.grid.columns || o.y > scene.grid.rows)
  )
    throw new Error('范围原点超出地图')
  if (t.propagation === 'manual' && !t.note?.trim()) throw new Error('手动范围传播请填写 GM 依据')
  if (
    t.propagation === 'straight' &&
    t.shape === 'cube' &&
    t.originRule === 'center' &&
    Math.hypot(o.x - templateCenter(t).x, o.y - templateCenter(t).y) > EPS
  )
    throw new Error('此立方体法术指定中心原点')
  if (t.propagation === 'straight' && t.shape === 'cube' && t.originRule !== 'center') {
    const c = templateCenter(t),
      angle = (t.angle * Math.PI) / 180,
      dx = (o.x - c.x) * scene.grid.feet,
      dy = (o.y - c.y) * scene.grid.feet,
      a = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)),
      b = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)),
      h = t.size / 2
    if (a > h + EPS || b > h + EPS || Math.abs(Math.max(a, b) - h) > EPS)
      throw new Error('立方体范围原点必须位于一个面上')
  }
}
export interface AreaTarget {
  token: MapToken
  inside: boolean
  blocked: boolean
  eligible: boolean
  cover: Cover
}
export function areaTargets(scene: MapScene, t = scene.template): AreaTarget[] {
  if (!t) return []
  const origin = templateOrigin(scene.grid, t),
    origins =
      t.shape === 'emanation'
        ? Array.from({ length: (t.originSpan ?? 1) ** 2 }, (_, i) => ({
            x: t.x + (i % (t.originSpan ?? 1)) + 0.5,
            y: t.y + Math.floor(i / (t.originSpan ?? 1)) + 0.5,
          }))
        : [origin]
  return scene.tokens.map((token) => {
    const cells = Array.from({ length: token.span ** 2 }, (_, i) => ({
      x: token.x + (i % token.span),
      y: token.y + Math.floor(i / token.span),
    })).filter((cell) => shapeContains(scene.grid, t, cell))
    let cover: Cover = 'total'
    coverage: for (const cell of cells)
      for (const origin of origins) {
        const ray =
          t.propagation === 'straight'
            ? rayCover(scene, origin, { x: cell.x + 0.5, y: cell.y + 0.5 }).degree
            : 'none'
        if (
          ['none', 'half', 'three-quarters', 'total'].indexOf(ray) <
          ['none', 'half', 'three-quarters', 'total'].indexOf(cover)
        )
          cover = ray
        // No later occupied cell can improve on an unobstructed confirmed ray.
        if (cover === 'none') break coverage
      }
    const inside = cells.length > 0,
      blocked = inside && cover === 'total'
    return { token, inside, blocked, eligible: inside && !blocked, cover: inside ? cover : 'none' }
  })
}
export interface AreaSpec {
  originRule?: 'face' | 'center'
  shape: MapTemplate['shape']
  size: number
  width?: number
  self: boolean
  range: number
}
const recipes: Record<string, Pick<AreaSpec, 'shape' | 'size' | 'width'>> = {
  'acid-splash': { shape: 'sphere', size: 5 },
  'burning-hands': { shape: 'cone', size: 15 },
  thunderwave: { shape: 'cube', size: 15 },
  'faerie-fire': { shape: 'cube', size: 20 },
  entangle: { shape: 'square', size: 20 },
  'color-spray': { shape: 'cone', size: 15 },
  fear:{shape:'cone',size:30},
  slow:{shape:'cube',size:40},
  'calm-emotions':{shape:'sphere',size:20},
  'zone-of-truth':{shape:'sphere',size:15},
  sleep: { shape: 'sphere', size: 5 },
  grease: { shape: 'square', size: 10 },
  fireball: { shape: 'sphere', size: 20 },
  'lightning-bolt': { shape: 'line', size: 100, width: 5 },
  shatter: { shape: 'sphere', size: 10 },
  'hypnotic-pattern': { shape: 'cube', size: 30 },
  web: { shape: 'cube', size: 20 },
  moonbeam: { shape: 'cylinder', size: 5 },
  'spirit-guardians': { shape: 'emanation', size: 15 },
  thunderclap: { shape: 'emanation', size: 5 },
  'word-of-radiance': { shape: 'emanation', size: 5 },
  'arms-of-hadar': { shape: 'emanation', size: 10 },
  'conjure-barrage': { shape: 'cone', size: 60 },
  'cloud-of-daggers': { shape: 'cube', size: 5 },
  'hunger-of-hadar': { shape: 'sphere', size: 20 },
  'cordon-of-arrows': { shape: 'sphere', size: 30 },
}
export function spellAreaSpec(spell: Pick<Spell, 'id' | 'range'>): AreaSpec | null {
  const recipe = recipes[spell.id]
  if (!recipe) return null
  return {
    ...recipe,
    ...(spell.id === 'cloud-of-daggers' ? { originRule: 'center' as const } : {}),
    self: /^Self/i.test(spell.range) || spell.id === 'cordon-of-arrows',
    range: Number(spell.range.match(/(\d+) feet/)?.[1] ?? 0),
  }
}
export function makeAreaTemplate(
  grid: MapScene['grid'],
  from: MapToken,
  spec: AreaSpec,
): MapTemplate {
  const t: MapTemplate = {
    x: from.x,
    y: from.y,
    shape: spec.shape,
    size: spec.size,
    width: spec.width ?? 5,
    angle: 0,
    propagation: 'straight',
    ...(spec.originRule ? { originRule: spec.originRule } : {}),
    includeOrigin: ['sphere', 'cylinder'].includes(spec.shape) || spec.originRule === 'center',
    originSpan: spec.shape === 'emanation' ? from.span : 1,
    note: '',
  }
  if (spec.shape === 'cube' && spec.self) {
    t.x = from.x + Math.ceil(spec.size / grid.feet / 2)
    t.y = from.y
  }
  return t
}
export function areaEnvironment(
  scene: MapScene,
  from: MapToken,
  to: MapToken,
  base: Environment,
  options: MapCombatOptions | undefined,
  spec: AreaSpec | null,
  gmBase = base,
): Environment {
  const t = options?.template ?? scene.template
  if (!t || t.propagation !== 'straight' || options?.area === false) return base
  const originDistance = validateSpellArea(scene, from, t, spec, options)
  if (spec?.self && t.includeOrigin === false && from.id === to.id)
    throw new Error('此范围未包含来源自身，不能将施法者作为范围目标')
  const target = areaTargets(scene, t).find((r) => r.token.id === to.id)
  if (!target?.inside) throw new Error('所选目标不在当前范围模板内')
  if (target.blocked) throw new Error('目标与范围原点之间被完全掩护截断')
  const cover = options?.cover === false ? gmBase.cover : strongerCover(gmBase.cover, target.cover)
  const origin = templateOrigin(scene.grid, t)
  return {
    ...base,
    distance: spec!.self ? 0 : originDistance,
    cover,
    spatial: `${base.spatial ?? ''}；范围 ${TEMPLATE_NAMES[t.shape]} ${t.size} 尺，原点 (${origin.x},${origin.y})；${COVER_NAMES[target.cover]}；传播畅通，最终覆盖仍需 GM 确认`,
  }
}
/** Shared origin validation: also usable before any target is selected. */
export function validateSpellArea(
  scene: MapScene,
  from: MapToken,
  t: MapTemplate,
  spec: AreaSpec | null,
  options?: MapCombatOptions,
): number {
  if (t.propagation !== 'straight')
    throw new Error('法术范围预览需要直线传播模板；特殊传播请由 GM 裁定')
  if (!spec) throw new Error('此范围效果尚无已核对的模板规格；请由 GM 关闭范围自动检查并填写依据')
  validateTemplate({ ...scene, template: t })
  if (t.shape === 'cube' && (t.originRule ?? 'face') !== (spec.originRule ?? 'face'))
    throw new Error('范围原点规则与法术不符；匕首之云使用中心，通常立方体使用面')
  const equivalent = (a: MapTemplate['shape'], b: MapTemplate['shape']) =>
    a === b || [a, b].every((s) => ['sphere', 'circle'].includes(s))
  if (
    !equivalent(t.shape, spec.shape) ||
    Math.abs(t.size - spec.size) > EPS ||
    (spec.width !== undefined && Math.abs(t.width - spec.width) > EPS)
  )
    throw new Error('当前范围模板的形状／尺寸与效果不符；请按法术或特性重新配置')
  const origin = templateOrigin(scene.grid, t),
    centers = Array.from({ length: from.span ** 2 }, (_, i) => ({
      x: from.x + (i % from.span) + 0.5,
      y: from.y + Math.floor(i / from.span) + 0.5,
    })),
    originDistance = Math.min(
      ...centers.map(
        (p) => Math.max(Math.abs(p.x - origin.x), Math.abs(p.y - origin.y)) * scene.grid.feet,
      ),
    )
  if (
    spec.self &&
    (origin.x < from.x - EPS ||
      origin.y < from.y - EPS ||
      origin.x > from.x + from.span + EPS ||
      origin.y > from.y + from.span + EPS)
  )
    throw new Error('自身范围的原点必须位于行动者占格内或边缘')
  if (
    t.shape === 'emanation' &&
    spec.self &&
    (t.x !== from.x || t.y !== from.y || (t.originSpan ?? 1) !== from.span)
  )
    throw new Error('发散范围的来源占格必须匹配行动者')
  if (!spec.self && originDistance > spec.range + EPS) throw new Error('范围原点超出施放距离')
  if (
    options?.obstacles !== false &&
    centers.every((p) => rayCover(scene, p, origin).degree === 'total')
  )
    throw new Error('范围原点与施法者之间存在实体阻挡；请将原点调整至障碍近侧或由 GM 记录特殊裁定')
  return originDistance
}
