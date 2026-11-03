import type { MapFeedback, MapFeedbackFeed } from '../../online/map-feedback-types'
/** Cursor advancement is independent of animation: skipped/hidden history can never be replayed. */
export class FeedbackCursor {
  private scope = ''
  private head = -1
  reset() {
    this.scope = ''
    this.head = -1
  }
  consume(feed: MapFeedbackFeed, sceneId: string, live: boolean): MapFeedback[] {
    const scope = feed.roomId + ':' + feed.branchId
    if (this.scope !== scope || this.head < 0 || feed.head < this.head) {
      this.scope = scope
      this.head = feed.head
      return []
    }
    const after = this.head
    this.head = Math.max(this.head, feed.head)
    if (!live || feed.earliest > after + 1) return []
    return feed.events
      .filter(
        (e) =>
          e.sequence > after &&
          e.sequence <= feed.head &&
          e.branchId === feed.branchId &&
          e.roomId === feed.roomId &&
          e.sceneId === sceneId,
      )
      .slice(-32)
  }
}
export function feedbackRayVisible(
  source: { x: number; y: number },
  target: { x: number; y: number },
  visible?: (x: number, y: number) => boolean,
) {
  if (!visible) return true
  const steps = Math.ceil(
    Math.max(Math.abs(source.x - target.x), Math.abs(source.y - target.y)) * 4,
  )
  for (let i = 0; i <= steps; i++) {
    const k = steps ? i / steps : 0
    if (
      !visible(
        Math.floor(source.x + (target.x - source.x) * k),
        Math.floor(source.y + (target.y - source.y) * k),
      )
    )
      return false
  }
  return true
}
