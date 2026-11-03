export interface MapName {
  key: string
  kind: 'token' | 'point' | 'annotation'
  id: string
  name: string
  x: number
  y: number
  color: string
  fontSize: number
  offsetX?: number
  offsetY?: number
  selected?: boolean
}
export interface PlacedName extends MapName {
  left: number
  top: number
  width: number
  height: number
  text: string
}
const textWidth = (text: string, size: number) =>
  Array.from(text).reduce((sum, c) => sum + (c.charCodeAt(0) < 128 ? 0.6 : 1) * size, 0)
export function layoutMapNames(names: MapName[], width: number, height: number) {
  const placed: PlacedName[] = [],
    omitted: MapName[] = []
  const sorted = names
    .map((n, index) => ({ n, index }))
    .sort((a, b) => Number(!!b.n.selected) - Number(!!a.n.selected) || a.index - b.index)
  for (const { n } of sorted) {
    if (width < 32 || height < n.fontSize + 16) {
      omitted.push(n)
      continue
    }
    const maxWidth = Math.min(240, width - 4)
    let text = n.name
    while (textWidth(text, n.fontSize) + 16 > maxWidth && Array.from(text).length > 1)
      text = Array.from(text).slice(0, -1).join('')
    if (text !== n.name) text = Array.from(text).slice(0, -1).join('') + '…'
    const w = Math.min(maxWidth, textWidth(text, n.fontSize) + 16),
      h = n.fontSize + 12,
      x = n.x + (n.offsetX ?? 0),
      y = n.y + (n.offsetY ?? 0),
      candidates = [
        { left: x - w / 2, top: y + 12 },
        { left: x - w / 2, top: y - h - 12 },
        { left: x + 18, top: y - h / 2 },
        { left: x - w - 18, top: y - h / 2 },
      ]
    const boxes = candidates.map((p) => ({
      ...p,
      left: Math.max(2, Math.min(width - w - 2, p.left)),
      top: Math.max(2, Math.min(height - h - 2, p.top)),
    }))
    const box = boxes.find(
      (p) =>
        !placed.some(
          (other) =>
            p.left < other.left + other.width + 4 &&
            p.left + w + 4 > other.left &&
            p.top < other.top + other.height + 4 &&
            p.top + h + 4 > other.top,
        ),
    )
    if (box || n.selected) placed.push({ ...n, ...(box ?? boxes[0]!), width: w, height: h, text })
    else omitted.push(n)
  }
  return { placed, omitted }
}
export const nameTextColor = (color: string) => {
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  return channels[0]! * 0.299 + channels[1]! * 0.587 + channels[2]! * 0.114 > 155
    ? '#182a32'
    : '#ffffff'
}
