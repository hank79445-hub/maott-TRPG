export interface ReviewViewport {
  width: number
  height: number
}
export interface ReviewPoint {
  x: number
  y: number
}
export interface ReviewLayout {
  dot: ReviewPoint
  panel: ReviewPoint & { width: number; height: number }
}

export const REVIEW_DOT_SIZE = 56
export const REVIEW_EDGE = 12
export const REVIEW_MOBILE_WIDTH = 760

function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function bound(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}
function screen(viewport: ReviewViewport) {
  return {
    width: Math.max(REVIEW_DOT_SIZE + REVIEW_EDGE * 2, finite(viewport.width, 1024)),
    height: Math.max(REVIEW_DOT_SIZE + REVIEW_EDGE * 2, finite(viewport.height, 768)),
  }
}

/** Keep the complete controls reachable after screen changes or stale saved coordinates. */
export function clampReviewLayout(layout: ReviewLayout, viewport: ReviewViewport): ReviewLayout {
  const size = screen(viewport),
    maxWidth = size.width - REVIEW_EDGE * 2,
    maxHeight = size.height - REVIEW_EDGE * 2,
    width = bound(finite(layout.panel.width, 640), Math.min(360, maxWidth), maxWidth),
    height = bound(finite(layout.panel.height, 620), Math.min(280, maxHeight), maxHeight)
  return {
    dot: {
      x: bound(
        finite(layout.dot.x, REVIEW_EDGE),
        REVIEW_EDGE,
        size.width - REVIEW_DOT_SIZE - REVIEW_EDGE,
      ),
      y: bound(
        finite(layout.dot.y, REVIEW_EDGE),
        REVIEW_EDGE,
        size.height - REVIEW_DOT_SIZE - REVIEW_EDGE,
      ),
    },
    panel: {
      width,
      height,
      x: bound(finite(layout.panel.x, REVIEW_EDGE), REVIEW_EDGE, size.width - width - REVIEW_EDGE),
      y: bound(
        finite(layout.panel.y, REVIEW_EDGE),
        REVIEW_EDGE,
        size.height - height - REVIEW_EDGE,
      ),
    },
  }
}

export function defaultReviewLayout(viewport: ReviewViewport): ReviewLayout {
  const size = screen(viewport)
  return clampReviewLayout(
    {
      dot: { x: size.width - REVIEW_DOT_SIZE - 24, y: size.height - REVIEW_DOT_SIZE - 24 },
      panel: { x: size.width - 664, y: 88, width: 640, height: 620 },
    },
    size,
  )
}

export function restoreReviewLayout(raw: string | null, viewport: ReviewViewport): ReviewLayout {
  const defaults = defaultReviewLayout(viewport)
  try {
    const saved = raw ? JSON.parse(raw) : null
    if (!saved || typeof saved !== 'object' || !saved.dot || !saved.panel) return defaults
    return clampReviewLayout(
      {
        dot: {
          x: finite(saved.dot.x, defaults.dot.x),
          y: finite(saved.dot.y, defaults.dot.y),
        },
        panel: {
          x: finite(saved.panel.x, defaults.panel.x),
          y: finite(saved.panel.y, defaults.panel.y),
          width: finite(saved.panel.width, defaults.panel.width),
          height: finite(saved.panel.height, defaults.panel.height),
        },
      },
      viewport,
    )
  } catch {
    return defaults
  }
}
