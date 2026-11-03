import type { SceneArtDocument } from './scene-art-projection'
import { rgbPng } from './authoring-map-image'

export const BEAUTIFICATION_LIGHTING_RULE = '不得自行添加灯具或发光物体，只保留资料列出的光源外观（整体光照亮度）。'
export const BEAUTIFICATION_LIGHTING_RULE_EN = 'Do not independently add lamps or glowing objects. Retain only the light-source appearances listed in the supplied material, including its overall lighting brightness.'
export const BASE_RENDERER_VERSION = 1
function baseSize(doc: SceneArtDocument) {
  const cell = Math.min(64, Math.floor(2560 / Math.max(doc.canvas.columns, doc.canvas.rows)))
  return { width: doc.canvas.columns * cell, height: doc.canvas.rows * cell }
}
export function beautificationMaterial(doc: SceneArtDocument) {
  return {
    format: 'trpg-scene-beautification',
    version: 1,
    purpose: 'beautify',
    lightingConstraint: doc.brief.contentLocale === 'en' ? BEAUTIFICATION_LIGHTING_RULE_EN : BEAUTIFICATION_LIGHTING_RULE,
    environment: doc.environment ?? 'unspecified',
    boundaryWalls: doc.boundaryWalls ?? 'legacy',
    strength: doc.policy.beautifyStrength ?? 'conservative',
    seed: doc.policy.seed ?? 1,
    rendererVersion: BASE_RENDERER_VERSION,
    doorArtwork: doc.policy.doorArtwork ?? 'hidden',
    ...baseSize(doc),
    brief: doc.brief,
    objects: doc.geometry.objects.map(({ label, description }, i) =>
      doc.doorObjectIndexes?.includes(i)
        ? { label: '门洞／通行开口', description: '此处为建筑开口，不是独立家具；保留可通行空间。' }
        : { label, description },
    ),
    limitations:
      '简化程序底图；对象为基础形状，不承诺完整素材或写实效果。以图片确定当前布局，人工核对外观。',
  }
}
export function beautificationPrompt(doc: SceneArtDocument) {
  const m = beautificationMaterial(doc),
    b = m.brief
  if (b.contentLocale === 'en') return `Edit the attached base-map.png; do not create a new composition. Preserve the exact overhead view, ${m.width}×${m.height} canvas, building footprints, wall and door openings, object positions, routes and connections.
Scene: ${b.publicName}. ${b.description}
Environment: ${m.environment}. Outdoor terrain may extend to the image edges; never add perimeter walls simply because the canvas ends. Preserve only buildings and walls shown in the base image.
Do not add characters, NPCs, text, numbers, grids or editor markings. Do not block passages, close openings or change key objects.
${m.strength === 'enriched' ? 'Enrich materials, ground texture, wear, vegetation and small nonblocking decorations; preserve all key structures.' : 'Conservative enhancement: materials, wear and subtle decoration, preserving shapes and positions.'}
Composition: ${b.composition ?? ''}
Style: ${b.style}
Materials: ${b.materials}
Overall lighting brightness: ${b.lighting}
Do not independently add lamps or glowing objects. Retain only the light-source appearances listed in the supplied material, including its overall lighting brightness. Do not invent candles, torches, luminous plants or magical glows. Mood and decoration instructions do not authorize additional light sources.
Decorations: ${b.decorations}
Exclude: ${b.exclusions}
Door appearance: ${m.doorArtwork}. Openings are architectural passages, not furniture. Never place cabinets, pillars, icons, door swing arcs or labels over them.
Object appearances: ${JSON.stringify(m.objects)}
Return only the background image without construction lines. If the layout cannot be preserved, explain the limitation for GM review rather than claiming exact compliance.`
  return `编辑附带的base-map.png，而不是另起构图。保持正上方俯视、原画幅${m.width}×${m.height}；底图提供已确定的布局，以这张底图为准。
场景：${b.publicName}；${b.description}
环境类型：${m.environment}。${m.environment === 'outdoor' || m.environment === 'mixed' ? '室外地表自然延伸到边缘；不要沿画布边界添加围墙。混合场景仅保留底图中明确存在的建筑墙门。' : '保留明确存在的墙门；不要因画布边界额外补墙。'}
保留建筑占地、真实墙门开口、主要物体位置、通路及互相连接。不能新增阻路建筑、封门、改变机关位置或添加人物、NPC、文字、数字、网格、编辑标记。图中装饰不自动获得玩法功能。
${m.strength === 'enriched' ? '适度丰富：增加地表层次、植物、碎石、生活杂物及材质细节，但不堵通路、不增减关键结构。' : '保守美化：以材质、磨损、细微装饰和均匀光照为主，尽量不改动轮廓。'}
构图与连接：${b.composition ?? ''}
风格：${b.style}
材质：${b.materials}
整体光照亮度：${b.lighting}
${BEAUTIFICATION_LIGHTING_RULE}未列出的壁灯、蜡烛、火把、发光植物及魔法光效均不得添加；整体明暗氛围不构成新增实体光源的许可。此约束优先于装饰扩展要求。
装饰：${b.decorations}
排除：${b.exclusions}
门位显示：${m.doorArtwork}。底图中的通行缺口表示门洞，不是独立物体；禁止在门洞上放置箱柜、立柱或堵塞道路。不要补绘门位图标、开启弧线或文字。
主要对象外观：${JSON.stringify(m.objects)}
仅返回背景图片。不要烘焙辅助线；保留必要对象。若无法保留结构请说明，由GM决定重做或校准。`
}

/** White-listed art only: no editor screenshot, labels, tokens or gameplay metadata. */
export function renderBeautificationBase(doc: SceneArtDocument) {
  const { width, height } = baseSize(doc)
  const cell = width / doc.canvas.columns,
    raw = new Uint8Array((width * 3 + 1) * height),
    floor = new Set(doc.geometry.floor),
    natural = doc.environment === 'outdoor' || doc.environment === 'mixed',
    high = new Set(
      doc.geometry.terrain.filter((t) => t.tags.includes('high')).flatMap((t) => t.cells),
    ),
    seed = doc.policy.seed ?? 1
  const noise = (x: number, y: number) => {
    let n = Math.imul(x + seed, 374761393) ^ Math.imul(y, 668265263)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const pixel = (x: number, y: number, c: number[]) => {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < width && y < height)
      raw.set(
        c.map((v) => Math.max(0, Math.min(255, Math.round(v)))),
        y * (width * 3 + 1) + 1 + x * 3,
      )
  }
  const colors = new Uint8Array(doc.canvas.columns * doc.canvas.rows * 3)
  for (let y = 0; y < doc.canvas.rows; y++)
    for (let x = 0; x < doc.canvas.columns; x++) {
      const key = `${x},${y}`,
        walk = floor.has(key),
        elevation = high.has(key) ? 12 : 0
      const base = natural
        ? walk
          ? [130, 138, 102]
          : [105, 119, 88]
        : walk
          ? [181, 172, 151]
          : [111, 111, 103]
      colors.set(
        base.map((n) => n + elevation),
        (y * doc.canvas.columns + x) * 3,
      )
    }
  const coarseWidth = Math.ceil(width / 19),
    coarse = new Float32Array(coarseWidth * Math.ceil(height / 19))
  for (let i = 0; i < coarse.length; i++)
    coarse[i] = (noise(i % coarseWidth, Math.floor(i / coarseWidth)) - 0.5) * 16
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 3 + 1) + 1 + x * 3,
        base = (Math.floor(y / cell) * doc.canvas.columns + Math.floor(x / cell)) * 3,
        n = noise(x, y),
        texture = (n - 0.5) * 18 + coarse[Math.floor(y / 19) * coarseWidth + Math.floor(x / 19)]!
      raw[offset] = Math.round(colors[base]! + texture)
      raw[offset + 1] = Math.round(colors[base + 1]! + texture)
      raw[offset + 2] = Math.round(colors[base + 2]! + texture)
      if (natural && n > 0.997) {
        raw[offset] = 159
        raw[offset + 1] = 154
        raw[offset + 2] = 118
      }
    }
  // Real wall segments only. Open doors keep a clear opening.
  for (const w of doc.geometry.walls) {
    if (w.kind === 'door' && (doc.policy.doorArtwork ?? 'hidden') === 'hidden') continue
    if (w.open) continue
    const ax = w.a.x * cell,
      ay = w.a.y * cell,
      bx = w.b.x * cell,
      by = w.b.y * cell,
      steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))))
    for (let i = 0; i <= steps; i++)
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const edge = Math.abs(dx) === 4 || Math.abs(dy) === 4,
            c =
              w.kind === 'door'
                ? doc.policy.doorArtwork === 'subtle'
                  ? [169, 163, 146]
                  : [119, 81, 49]
                : edge
                  ? [77, 77, 71]
                  : [153, 148, 132]
          pixel(ax + ((bx - ax) * i) / steps + dx, ay + ((by - ay) * i) / steps + dy, c)
        }
  }
  for (const [objectIndex, o] of doc.geometry.objects.entries()) {
    if (
      doc.doorObjectIndexes?.includes(objectIndex) &&
      (doc.policy.doorArtwork ?? 'hidden') !== 'full'
    )
      continue
    const cx = (o.x + o.width / 2) * cell,
      cy = (o.y + o.height / 2) * cell,
      angle = (-o.rotation * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle),
      hw = o.width * cell * 0.42,
      hh = o.height * cell * 0.42,
      radius = Math.ceil(Math.hypot(hw, hh)) + 4,
      wooden = /木|箱|桌|柜|台|杆/.test(o.label + o.description)
    for (let y = -radius; y <= radius; y++)
      for (let x = -radius; x <= radius; x++) {
        const u = x * c - y * s,
          v = x * s + y * c
        if (Math.abs(u) > hw || Math.abs(v) > hh) continue
        const border = Math.abs(u) > hw - 3 || Math.abs(v) > hh - 3,
          shade = (noise(Math.round(cx + x), Math.round(cy + y)) - 0.5) * 12,
          color = wooden
            ? border
              ? [78, 58, 38]
              : [150, 113, 70]
            : border
              ? [98, 98, 86]
              : [166, 159, 133]
        pixel(
          cx + x,
          cy + y,
          color.map((n) => n + shade),
        )
      }
  }
  return rgbPng(width, height, raw)
}
