import { clone } from './engine'
import type { MapScene } from './map-types'
export function sceneWithoutPoint(scene: MapScene, pointId: string): MapScene {
  if (!scene.points.some((p) => p.id === pointId)) throw Error('互动点已不存在，请刷新后重试')
  const walls = (scene.walls ?? []).filter((w) => w.pointId === pointId)
  if (walls.length)
    throw Error(
      `无法删除：门段「${walls.map((w) => w.name || w.id).join('、')}」仍有关联，请先在墙门配置解除关联。`,
    )
  const next = clone(scene)
  const links = scene.pointLinks?.filter(
    (g) => g.sourcePointId === pointId || g.effects.some((e) => e.pointId === pointId),
  )
  if (links?.length)
    throw Error('无法删除：请先解除关联组「' + links.map((g) => g.name).join('、') + '」')
  next.points = next.points.filter((p) => p.id !== pointId)
  return next
}
