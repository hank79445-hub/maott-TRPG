// Opaque hints only; never store documents, secrets, names, or execution rights.
const key = 'trpg-config-import-fingerprints-v1'
export function importedBefore(type: string, fingerprint: string) {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]).includes(
      type + ':' + fingerprint,
    )
  } catch {
    return false
  }
}
export function rememberImport(type: string, fingerprint: string) {
  if (!fingerprint) return
  try {
    const rows = JSON.parse(localStorage.getItem(key) ?? '[]')
    const value = type + ':' + fingerprint
    localStorage.setItem(
      key,
      JSON.stringify([...new Set([...(Array.isArray(rows) ? rows : []), value])].slice(-50)),
    )
  } catch {
    /* The duplicate hint is optional, the authoritative save is unchanged. */
  }
}
export async function fileFingerprint(data: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data))))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
}
