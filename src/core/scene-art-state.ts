import { wallState } from './map-spatial'
import {
  artDigest,
  sceneArtFingerprint,
  projectSceneArt,
  type ArtScene,
} from './scene-art-projection'
import {
  artTransformSchema,
  sceneArtRecordSchema,
  type SceneArtRecord,
  type SceneArtRecords,
  type ArtTransform,
  type LayoutMode,
} from '../persistence/scene-art-schema'
import type { MapAsset, MapScene } from './map-types'
export interface SceneArtDraft {
  record: SceneArtRecord
  candidate?: {
    asset: MapAsset
    transform: ArtTransform
    sourceGeometryHash: string | null
    sourcePurpose?: 'direct' | 'beautify'
    sourceMode?: LayoutMode
    sourceMaterialHash?: string | null
  }
}
export type ArtBackgroundScene = ArtScene & Pick<MapScene, 'background'>
// Background transforms use MapPanel's fixed 64px units; grid cells may use a different spacing.
export function backgroundTransform(scene: ArtScene, t: ArtTransform): ArtTransform {
  const scale = (scene.grid.cellPixels ?? 64) / 64
  return {
    ...t,
    x: scene.grid.originX + (scene.grid.offsetX ?? 0) / 64 + t.x * scale,
    y: scene.grid.originY + (scene.grid.offsetY ?? 0) / 64 + t.y * scale,
    width: t.width * scale,
    height: t.height * scale,
  }
}
export function logicalTransform(scene: ArtScene, t: ArtTransform): ArtTransform {
  const scale = (scene.grid.cellPixels ?? 64) / 64
  return {
    ...t,
    x: (t.x - scene.grid.originX - (scene.grid.offsetX ?? 0) / 64) / scale,
    y: (t.y - scene.grid.originY - (scene.grid.offsetY ?? 0) / 64) / scale,
    width: t.width / scale,
    height: t.height / scale,
  }
}
export function coverTransform(
  scene: ArtScene,
  image: { width: number; height: number },
): ArtTransform {
  const scale = Math.max(scene.grid.columns / image.width, scene.grid.rows / image.height)
  const width = image.width * scale,
    height = image.height * scale
  return backgroundTransform(scene, {
    x: (scene.grid.columns - width) / 2,
    y: (scene.grid.rows - height) / 2,
    width,
    height,
    rotation: 0,
  })
}
export function coversScene(scene: ArtScene, raw: ArtTransform) {
  const result = artTransformSchema.safeParse(raw)
  if (!result.success) return false
  const t = logicalTransform(scene, result.data),
    cx = t.x + t.width / 2,
    cy = t.y + t.height / 2,
    angle = (-t.rotation * Math.PI) / 180
  return [
    [0, 0],
    [scene.grid.columns, 0],
    [0, scene.grid.rows],
    [scene.grid.columns, scene.grid.rows],
  ].every(([x, y]) => {
    const dx = x! - cx,
      dy = y! - cy,
      u = dx * Math.cos(angle) - dy * Math.sin(angle),
      v = dx * Math.sin(angle) + dy * Math.cos(angle)
    return Math.abs(u) <= t.width / 2 + 1e-7 && Math.abs(v) <= t.height / 2 + 1e-7
  })
}
export function currentArtCandidate(
  scene: ArtBackgroundScene,
  asset: MapAsset,
  record: SceneArtRecord,
): NonNullable<SceneArtDraft['candidate']> {
  const b = scene.background
  if (!b || b.assetId !== asset.id) throw Error('当前场景背景与图片不匹配')
  const previous = record.adopted?.assetId === asset.id ? record.adopted : undefined
  return {
    asset,
    transform: { x: b.x, y: b.y, width: b.width, height: b.height, rotation: b.rotation },
    ...(previous?.purpose ? { sourcePurpose: previous.purpose } : {}),
    sourceGeometryHash: previous?.exportGeometryHash ?? null,
    sourceMaterialHash: previous?.sourceMaterialHash ?? null,
    sourceMode:
      scene.artCalibration?.mode ??
      (previous
        ? (previous.mode ?? 'precise')
        : record.policy.purpose === 'beautify'
          ? 'approximate'
          : (record.policy.layoutMode ?? 'precise')),
  }
}
export function calibrationFingerprint(scene: ArtScene) {
  return artDigest({
    ...(scene.environment ? { environment: scene.environment } : {}),
    ...(scene.boundaryWalls ? { boundaryWalls: scene.boundaryWalls } : {}),
    grid: {
      columns: scene.grid.columns,
      rows: scene.grid.rows,
      feet: scene.grid.feet,
      cellPixels: scene.grid.cellPixels ?? 64,
      originX: scene.grid.originX,
      originY: scene.grid.originY,
      offsetX: scene.grid.offsetX ?? 0,
      offsetY: scene.grid.offsetY ?? 0,
    },
    regions: scene.regions.map((r) => ({
      cells: r.cells,
      tags: r.tags,
      height: r.height,
      jumpable: r.jumpable,
    })),
    walls: (scene.walls ?? []).map((w) => ({
      a: w.a,
      b: w.b,
      kind: w.kind,
      state: wallState({ points: scene.points ?? [] }, w),
      hidden: w.hidden,
      blocksMovement: w.blocksMovement,
      blocksSight: w.blocksSight,
      blocksTargeting: w.blocksTargeting,
      cover: w.cover,
    })),
    points: (scene.points ?? []).map((p) => ({
      x: p.x,
      y: p.y,
      kind: p.kind,
      hidden: p.hidden,
      appearance: p.appearance,
      landing: p.landing,
      arrival: p.portal?.arrival,
    })),
    ground: (scene.groundItems ?? []).map((g) => ({ x: g.x, y: g.y, hidden: g.hidden })),
  })
}
export async function adoptArt(
  scene: ArtBackgroundScene,
  draft: SceneArtDraft,
  locked: boolean,
  confirmed: boolean,
  calibrated = false,
) {
  if (locked) throw Error('场景已锁定，请先解锁再采用')
  if (!confirmed) throw Error('请先核对墙门、通道、物体与图片来源')
  if (!draft.candidate) throw Error('没有候选图片')
  const transform = artTransformSchema.parse(draft.candidate.transform)
  if (!coversScene(scene, transform)) throw Error('背景未覆盖地图，请调整缩放、偏移或旋转')
  const hash = await sceneArtFingerprint(
    projectSceneArt(scene, draft.record.brief, draft.record.policy),
  )
  const purpose =
    draft.candidate.sourcePurpose ??
    (draft.candidate.sourceMode ? undefined : draft.record.policy.purpose)
  const mode =
    purpose === 'beautify'
      ? 'approximate'
      : (draft.candidate.sourceMode ??
        scene.artCalibration?.mode ??
        (draft.record.adopted?.assetId === draft.candidate.asset.id
          ? (draft.record.adopted.mode ?? 'precise')
          : (draft.record.policy.layoutMode ?? 'precise')))
  return sceneArtRecordSchema.parse({
    ...draft.record,
    adopted: {
      ...(purpose ? { purpose } : {}),
      mode,
      calibration: mode === 'precise' || calibrated ? 'confirmed' : 'pending',
      calibrationHash: await calibrationFingerprint(scene),
      sourceMaterialHash: draft.candidate.sourceMaterialHash ?? null,
      assetId: draft.candidate.asset.id,
      geometryHash: hash,
      exportGeometryHash: draft.candidate.sourceGeometryHash,
      transform,
      reviewedAt: new Date().toISOString(),
    },
  })
}
export async function artStatus(scene: ArtBackgroundScene, record?: SceneArtRecord) {
  if (
    scene.artCalibration ||
    (record?.adopted?.calibration === 'pending' &&
      scene.background?.assetId === record.adopted.assetId)
  )
    return 'pending' as const
  if (!scene.background) return 'none' as const
  if (!record?.adopted || scene.background.assetId !== record.adopted.assetId)
    return 'unknown' as const
  const hash = await sceneArtFingerprint(projectSceneArt(scene, record.brief, record.policy))
  const t = record.adopted.transform,
    b = scene.background
  const calibrationMatches =
    !record.adopted.calibrationHash ||
    (await calibrationFingerprint(scene)) === record.adopted.calibrationHash
  return calibrationMatches &&
    hash === record.adopted.geometryHash &&
    ['x', 'y', 'width', 'height', 'rotation'].every(
      (k) => Math.abs(b[k as keyof ArtTransform] - t[k as keyof ArtTransform]) < 1e-7,
    )
    ? ('confirmed' as const)
    : ('stale' as const)
}
export function assertCalibrationReady(scenes: ArtScene[]) {
  for (const scene of scenes)
    if (scene.artCalibration)
      throw Error(scene.name + '背景尚待GM校准，不能保存可开团版本或最终导出')
}
export async function assertArtReady(scenes: ArtBackgroundScene[], records: SceneArtRecords) {
  assertCalibrationReady(scenes)
  for (const scene of scenes) {
    const status = await artStatus(scene, records[scene.id])
    if (status === 'pending') throw Error(scene.name + '背景尚待GM校准')
    if (status === 'stale') throw Error(scene.name + '背景布局已变化，请复核后再保存版本或导出')
  }
}
