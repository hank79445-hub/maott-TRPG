export interface DialogueSegment {
  kind: 'speech' | 'action'
  text: string
}
/** A presentation hint may never replace the reviewed canonical text. */
export function dialogueSegments(text: string, candidate?: unknown): DialogueSegment[] {
  if (
    Array.isArray(candidate) &&
    candidate.length > 0 &&
    candidate.length <= 80 &&
    candidate.every(
      (s) =>
        s &&
        ['speech', 'action'].includes(s.kind) &&
        typeof s.text === 'string' &&
        s.text.length <= 2000 &&
        s.text.trim(),
    ) &&
    candidate.reduce((sum, s) => sum + s.text.length, 0) <= 6000 &&
    candidate.map((s) => s.text).join('') === text
  )
    return candidate.map((s) => ({ kind: s.kind, text: s.text }))
  const result: DialogueSegment[] = []
  let buffer = ''
  const characters = Array.from(text)
  for (let i = 0; i < characters.length; i++) {
    const c = characters[i]!
    buffer += c
    const prefix = characters.slice(Math.max(0,i-12),i+1).join('')
    const englishEnd = c === '.' && !(/\d/.test(characters[i-1] ?? '') && /\d/.test(characters[i+1] ?? '')) && !/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)\.$/i.test(prefix) && !/(?:\b[A-Z]\.){1,}$/.test(prefix) && /[\s"'”’]|^$/.test(characters[i+1] ?? '')
    if (
      result.length < 79 &&
      (c === '\n' || englishEnd ||
        (/[。！？!?]/.test(c) && !/[。！？!?”’」』"]/.test(characters[i + 1] ?? '')) ||
        (/[”’」』"]/.test(c) && /[。！？!?]/.test(characters[i - 1] ?? '')))
    ) {
      result.push({ kind: 'speech', text: buffer })
      buffer = ''
    }
  }
  if (buffer) result.push({ kind: 'speech', text: buffer })
  return result.length ? result : [{ kind: 'speech', text }]
}
