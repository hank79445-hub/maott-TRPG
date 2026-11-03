import type { SceneGeometry } from '../persistence/scene-effects-schema'
export interface ScenePoint {
  x: number
  y: number
  height: number
  layer?: import('./m3-spatial').SpaceLayer
  anchorId?: string
}
const eps = 1e-7
export const sceneCenter = (g: SceneGeometry): ScenePoint => ({
  x: g.x + g.originSpan / 2,
  y: g.y + g.originSpan / 2,
  height: g.height,
})
export function geometryContains(g: SceneGeometry, p: ScenePoint, feet: number) {
  const c = sceneCenter(g),
    dx = (p.x - c.x) * feet,
    dy = (p.y - c.y) * feet,
    dz = p.height - c.height
  if (
    g.cuts?.some(
      (v) =>
        p.x >= v.x &&
        p.x <= v.x + v.width / feet &&
        p.y >= v.y &&
        p.y <= v.y + v.depth / feet &&
        p.height >= v.height &&
        p.height <= v.height + v.heightFeet,
    )
  )
    return false
  if (g.shape === 'sphere') return dx * dx + dy * dy + dz * dz <= g.size * g.size + eps
  if (g.shape === 'cylinder')
    return dx * dx + dy * dy <= g.size * g.size + eps && dz >= -eps && dz <= g.heightFeet + eps
  if (g.shape === 'emanation') {
    const x = Math.max(g.x - p.x, p.x - g.x - g.originSpan, 0) * feet,
      y = Math.max(g.y - p.y, p.y - g.y - g.originSpan, 0) * feet
    return x * x + y * y + dz * dz <= g.size * g.size + eps
  }
  const a = (g.angle * Math.PI) / 180,
    along = dx * Math.cos(a) + dy * Math.sin(a),
    across = -dx * Math.sin(a) + dy * Math.cos(a)
  if (g.shape === 'square' || g.shape === 'cube')
    return (
      // Grid-square bounds are half-open: a 10ft side on 5ft cells occupies
      // 2×2 cells, not 3×3 merely because both boundary centres were counted.
      along >= -g.size / 2 - eps &&
      along < g.size / 2 - eps &&
      across >= -g.size / 2 - eps &&
      across < g.size / 2 - eps &&
      (g.shape === 'square'
        ? Math.abs(dz) <= eps
        : dz >= -eps && dz <= (g.heightFeet || g.size) + eps)
    )
  if (g.shape === 'line')
    return (
      along >= -eps &&
      along <= g.size + eps &&
      Math.abs(across) <= g.width / 2 + eps &&
      dz >= -eps &&
      dz <= g.heightFeet + eps
    )
  return (g.points ?? []).slice(1).some((b, i) => {
    const a = g.points![i]!,
      x = (b.x - a.x) * feet,
      y = (b.y - a.y) * feet,
      len = x * x + y * y,
      t = len
        ? Math.max(0, Math.min(1, ((p.x - a.x) * feet * x + (p.y - a.y) * feet * y) / len))
        : 0
    return (
      Math.hypot((p.x - a.x) * feet - t * x, (p.y - a.y) * feet - t * y) <= g.width / 2 &&
      p.height >= a.height &&
      p.height <= a.height + g.heightFeet
    )
  })
}
/** Split at analytic surface intersections, then test intervals. No step size can
 * skip a thin wall/cut or a volume tangent at a long distance. */
export function geometryRayBreaks(
  g: SceneGeometry,
  from: ScenePoint,
  to: ScenePoint,
  feet: number,
) {
  const ts = [0, 1],
    c = sceneCenter(g),
    v = [(to.x - from.x) * feet, (to.y - from.y) * feet, to.height - from.height],
    w = [(from.x - c.x) * feet, (from.y - c.y) * feet, from.height - c.height]
  const add = (t: number) => {
      if (Number.isFinite(t) && t >= -eps && t <= 1 + eps) ts.push(Math.max(0, Math.min(1, t)))
    },
    plane = (x: number, d: number, k: number) => {
      if (Math.abs(d) > eps) add((k - x) / d)
    },
    roots = (a: number, b: number, c: number) => {
      if (Math.abs(a) < eps) {
        if (Math.abs(b) > eps) add(-c / b)
        return
      }
      const d = b * b - 4 * a * c
      if (d >= -eps) {
        const q = Math.sqrt(Math.max(0, d))
        add((-b - q) / (2 * a))
        add((-b + q) / (2 * a))
      }
    },
    sphere = (x: number, y: number, z: number, r: number, flat = false) => {
      const p = [w[0]! - x, w[1]! - y, flat ? 0 : w[2]! - z],
        d = [v[0]!, v[1]!, flat ? 0 : v[2]!]
      roots(
        d.reduce((n, k) => n + k * k, 0),
        2 * d.reduce((n, k, i) => n + k * p[i]!, 0),
        p.reduce((n, k) => n + k * k, 0) - r * r,
      )
    }
  plane(w[2]!, v[2]!, 0)
  plane(w[2]!, v[2]!, g.heightFeet || g.size)
  if (g.shape === 'sphere') sphere(0, 0, 0, g.size)
  else if (g.shape === 'cylinder') sphere(0, 0, 0, g.size, true)
  else if (g.shape === 'emanation') {
    const low = [(g.x - c.x) * feet, (g.y - c.y) * feet, 0],
      high = [(g.x + g.originSpan - c.x) * feet, (g.y + g.originSpan - c.y) * feet, 0]
    for (let i = 0; i < 2; i++) {
      plane(w[i]!, v[i]!, low[i]!)
      plane(w[i]!, v[i]!, high[i]!)
    }
    const splits = [...ts].sort((a, b) => a - b)
    for (let j = 1; j < splits.length; j++) {
      const mid = (splits[j - 1]! + splits[j]!) / 2,
        p = w.map((x, i) => x + v[i]! * mid),
        d = w.map((x, i) =>
          p[i]! < low[i]!
            ? [x - low[i]!, v[i]!]
            : p[i]! > high[i]!
              ? [x - high[i]!, v[i]!]
              : [0, 0],
        )
      roots(
        d.reduce((n, r) => n + r[1]! * r[1]!, 0),
        2 * d.reduce((n, r) => n + r[0]! * r[1]!, 0),
        d.reduce((n, r) => n + r[0]! * r[0]!, 0) - g.size * g.size,
      )
    }
  } else if (g.shape === 'wall') {
    for (let i = 1; i < (g.points?.length ?? 0); i++) {
      const a = g.points![i - 1]!,
        b = g.points![i]!,
        dx = (b.x - a.x) * feet,
        dy = (b.y - a.y) * feet,
        len = Math.hypot(dx, dy),
        cos = len ? dx / len : 1,
        sin = len ? dy / len : 0,
        px = (from.x - a.x) * feet,
        py = (from.y - a.y) * feet,
        along = px * cos + py * sin,
        across = -px * sin + py * cos,
        da = v[0]! * cos + v[1]! * sin,
        db = -v[0]! * sin + v[1]! * cos
      plane(along, da, 0)
      plane(along, da, len)
      plane(across, db, g.width / 2)
      plane(across, db, -g.width / 2)
      plane(from.height, v[2]!, a.height)
      plane(from.height, v[2]!, a.height + g.heightFeet)
      sphere((a.x - c.x) * feet, (a.y - c.y) * feet, 0, g.width / 2, true)
      sphere((b.x - c.x) * feet, (b.y - c.y) * feet, 0, g.width / 2, true)
    }
  } else {
    const a = (g.angle * Math.PI) / 180,
      co = Math.cos(a),
      si = Math.sin(a),
      x = w[0]! * co + w[1]! * si,
      y = -w[0]! * si + w[1]! * co,
      dx = v[0]! * co + v[1]! * si,
      dy = -v[0]! * si + v[1]! * co
    for (const k of g.shape === 'line' ? [0, g.size] : [-g.size / 2, g.size / 2]) plane(x, dx, k)
    for (const k of g.shape === 'line' ? [-g.width / 2, g.width / 2] : [-g.size / 2, g.size / 2])
      plane(y, dy, k)
  }
  for (const cut of g.cuts ?? []) {
    for (const k of [cut.x, cut.x + cut.width / feet]) plane(from.x, to.x - from.x, k)
    for (const k of [cut.y, cut.y + cut.depth / feet]) plane(from.y, to.y - from.y, k)
    for (const k of [cut.height, cut.height + cut.heightFeet]) plane(from.height, v[2]!, k)
  }
  ts.sort((a, b) => a - b)
  return ts
}
export function volumeRay(g: SceneGeometry, from: ScenePoint, to: ScenePoint, feet: number) {
  const ts = geometryRayBreaks(g, from, to, feet),
    v = [0, 0, to.height - from.height]
  const hit = (t: number) =>
    geometryContains(
      g,
      {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        height: from.height + v[2]! * t,
      },
      feet,
    )
  return ts.some(hit) || ts.slice(1).some((t, i) => hit((t + ts[i]!) / 2))
}
