import { z } from 'zod'
import { artBriefSchema, artZoneSchema, artSizeSchema } from '../persistence/scene-art-schema'
import type { SceneArtDocument } from './scene-art-projection'
import { rgbPng } from './authoring-map-image'
export const ZONES = [
  'northwest',
  'north',
  'northeast',
  'west',
  'center',
  'east',
  'southwest',
  'south',
  'southeast',
] as const
export const ZONE_NAMES = ['西北', '北', '东北', '西', '中央', '东', '西南', '南', '东南']
const object = z.object({
  ref: z.string().regex(/^object-\d+$/),
  doorOpening: z.boolean().optional(),
  label: z.string().max(120),
  description: z.string().max(1000),
})
const common = {
  doorArtwork: z.enum(['hidden', 'subtle', 'full']).optional(),
  format: z.literal('trpg-scene-art'),
  version: z.literal(2),
  policyVersion: z.literal(2),
  aspectRatio: z.string().regex(/^\d+:\d+$/),
  brief: artBriefSchema,
  environment: z.enum(['outdoor', 'indoor', 'mixed']).optional(),
  boundaryWalls: z.enum(['explicit-only', 'auto-enclose']).optional(),
}
const approximate = z
  .object({
    ...common,
    mode: z.literal('approximate'),
    objects: z.array(object.extend({ zone: artZoneSchema, size: artSizeSchema }).strict()).max(100),
  })
  .strict()
const free = z
  .object({ ...common, mode: z.literal('free'), objects: z.array(object.strict()).max(100) })
  .strict()
export const relaxedArtMaterialSchema = z.discriminatedUnion('mode', [approximate, free])
export type RelaxedMaterial = z.infer<typeof relaxedArtMaterialSchema>
export type ArtMaterial =
  | RelaxedMaterial
  | {
      format: 'trpg-scene-art'
      version: 2
      policyVersion: 2
      mode: 'precise'
      aspectRatio: string
      layout: SceneArtDocument
    }
export function artAspectRatio(doc: SceneArtDocument) {
  if (doc.policy.layoutMode === 'free' && doc.policy.aspect && doc.policy.aspect !== 'original')
    return doc.policy.aspect
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  const divisor = gcd(doc.canvas.columns, doc.canvas.rows)
  return `${doc.canvas.columns / divisor}:${doc.canvas.rows / divisor}`
}
export function projectArtMaterial(doc: SceneArtDocument): ArtMaterial {
  const mode = doc.policy.layoutMode ?? 'precise',
    aspectRatio = artAspectRatio(doc)
  if (mode === 'precise')
    return {
      format: 'trpg-scene-art',
      version: 2,
      policyVersion: 2,
      mode,
      aspectRatio,
      layout: doc,
    }
  const occurrences = new Map<string, number>()
  const objects = doc.geometry.objects.map((o, i) => {
    const identity = JSON.stringify([o.label, o.description]),
      occurrence = (occurrences.get(identity) ?? 0) + 1
    occurrences.set(identity, occurrence)
    const base = {
      ref: `object-${String(i + 1).padStart(2, '0')}`,
      label: o.label,
      description: o.description,
      ...(doc.doorObjectIndexes?.includes(i) ? { doorOpening: true } : {}),
    }
    if (mode === 'free') return base
    const override = doc.policy.anchorOverrides?.find(
      (a) => a.label === o.label && a.description === o.description && a.occurrence === occurrence,
    )
    const zone =
      ZONES[
        Math.min(2, Math.floor(((o.y + o.height / 2) / doc.canvas.rows) * 3)) * 3 +
          Math.min(2, Math.floor(((o.x + o.width / 2) / doc.canvas.columns) * 3))
      ]!
    const ratio = (o.width * o.height) / (doc.canvas.columns * doc.canvas.rows)
    return {
      ...base,
      zone: override?.zone ?? zone,
      size: override?.size ?? (ratio <= 0.01 ? 'small' : ratio <= 0.06 ? 'medium' : 'large'),
    }
  })
  return relaxedArtMaterialSchema.parse({
    format: 'trpg-scene-art',
    version: 2,
    policyVersion: 2,
    mode,
    aspectRatio,
    ...(doc.environment ? { environment: doc.environment } : {}),
    ...(doc.boundaryWalls ? { boundaryWalls: doc.boundaryWalls } : {}),
    brief: doc.brief,
    doorArtwork: doc.policy.doorArtwork ?? 'hidden',
    objects,
  })
}
// Only coarse zones and relative sizes enter this rasterizer. It cannot read source geometry.
export function renderCompositionGuide(material: ArtMaterial) {
  if (material.mode !== 'approximate') throw Error('只有大致布局生成分布示意图')
  const [rw, rh] = material.aspectRatio.split(':').map(Number)
  const scale = 640 / Math.max(rw!, rh!),
    width = Math.max(64, Math.round(rw! * scale)),
    height = Math.max(64, Math.round(rh! * scale))
  const raw = new Uint8Array((width * 3 + 1) * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) raw.set([229, 225, 211], y * (width * 3 + 1) + 1 + x * 3)
  const counts = new Map<string, number>()
  const digits = [
    '111101101101111',
    '010110010010111',
    '111001111100111',
    '111001111001111',
    '101101111001001',
    '111100111001111',
    '111100111101111',
    '111001001001001',
    '111101111101111',
    '111101111001111',
  ]
  material.objects.forEach((o, i) => {
    if (o.doorOpening && (material.doorArtwork ?? 'hidden') !== 'full') return
    const index = ZONES.indexOf(o.zone),
      n = counts.get(o.zone) ?? 0
    counts.set(o.zone, n + 1)
    const cx = (((index % 3) + 0.5) / 3 + ((n % 3) - 1) * 0.045) * width
    const cy = ((Math.floor(index / 3) + 0.5) / 3 + ((Math.floor(n / 3) % 3) - 1) * 0.045) * height
    const radius = Math.max(
      8,
      Math.min(width, height) * { small: 0.035, medium: 0.055, large: 0.08 }[o.size],
    )
    for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, cy + radius); y++)
      for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, cx + radius); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2)
          raw.set([155, 117, 75], y * (width * 3 + 1) + 1 + x * 3)
    const label = String(i + 1),
      unit = 2,
      startX = Math.round(cx - ((label.length * 4 - 1) * unit) / 2),
      startY = Math.round(cy - (5 * unit) / 2)
    for (let c = 0; c < label.length; c++)
      for (let p = 0; p < 15; p++)
        if (digits[Number(label[c])]![p] === '1')
          for (let dy = 0; dy < unit; dy++)
            for (let dx = 0; dx < unit; dx++) {
              const x = startX + (c * 4 + (p % 3)) * unit + dx,
                y = startY + Math.floor(p / 3) * unit + dy
              if (x >= 0 && y >= 0 && x < width && y < height)
                raw.set([255, 255, 246], y * (width * 3 + 1) + 1 + x * 3)
            }
  })
  return rgbPng(width, height, raw)
}
export function artMaterialPrompt(material: ArtMaterial) {
  const brief = material.mode === 'precise' ? material.layout.brief : material.brief
  const environment =
    material.mode === 'precise' ? material.layout.environment : material.environment
  const edge =
    environment === 'outdoor' || environment === 'mixed'
      ? '室外地表自然延伸到图像边缘；不要沿画布边界添加围墙。仅绘制明确需要的建筑墙门。'
      : '仅保留明确配置的真实墙门，不因画布边界补墙。'
  const common = `门位表示通行开口，不是独立物品；不得把辅助门位画成柜子、箱子或堵塞道路。隐藏／淡化标记不会删除门洞。\n${edge}\n制作${brief.publicName || '场景'}的正上方俯视战术地图，画幅比例${material.aspectRatio}。最终图片不画人物、NPC、文字、数字、网格或辅助标记。丰富材质、自然建筑轮廓、植物、磨损、杂物、环境层次与光影，避免图标化、重复铺地与大面积无意义留白；道路和可辨认物体保持清晰。装饰不代表机关、奖励或可自动结算的玩法。\n场景：${brief.description}\n构图与必要连接：${brief.composition ?? ''}\n风格：${brief.style}\n材质：${brief.materials}\n光照：${brief.lighting}\n装饰：${brief.decorations}\n排除：${brief.exclusions}\n`
  if (material.mode === 'precise')
    return (
      common +
      `沿layout.json和reference.png保留精确地板、墙门、通道与物体位置／占地。可在结构内部丰富细节；不要把辅助线画入成品。物体：${JSON.stringify(material.layout.geometry.objects)}`
    )
  if (material.mode === 'approximate')
    return (
      common +
      `按composition.json与composition-guide.png保留主要分区关系。示意图是宽松位置锚点，不是地板或建筑轮廓；可自然调整建筑形状、物体尺寸、朝向和局部位置。不要求匹配精确格数或墙门框架。物体：${JSON.stringify(material.objects)}`
    )
  return (
    common +
    `自由安排建筑轮廓、物体位置、道路与开口，不依据原网格或位置锚点。必须保留列出的对象及明确连接要求，其余由你组织成自然、丰富、可游玩的场景。对象：${JSON.stringify(material.objects)}`
  )
}
