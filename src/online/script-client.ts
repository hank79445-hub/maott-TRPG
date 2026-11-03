import type { ScriptDefinition, ScriptAsset } from '../persistence/script-schema'
import type { MapAsset } from '../core/map-types'
import type { SitePrincipal } from '../server/access-config'
import type { ScriptLibrary } from '../server/script-library'
import { ApiError } from './client'
export type ScriptEntry = Awaited<ReturnType<ScriptLibrary['get']>>
export type ScriptList = Awaited<ReturnType<ScriptLibrary['list']>>
export type ScriptSummary = ScriptList['scripts'][number]
export type ImportPreview = {
  token: string
  expiresAt: string
  definition: ScriptDefinition
  ready: boolean
  missingDependencies: { id: string; version: string }[]
}
export async function scriptApi<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const binary = body instanceof Blob
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body === undefined || binary ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }),
    signal: AbortSignal.timeout(binary ? 120000 : 40000),
  })
  const data = await response.json()
  if (!response.ok) throw new ApiError(data.error ?? '剧本请求失败', response.status, data.code)
  return data
}
export const scriptAccount = () => scriptApi<SitePrincipal>('/account')
export async function scriptImage(id: string, meta: ScriptAsset): Promise<MapAsset> {
  async function blob(preview = false) {
    const res = await fetch(`/api/scripts/${id}/assets/${meta.id}${preview ? '?preview=1' : ''}`)
    if (!res.ok) throw new ApiError('剧本图片读取失败', res.status)
    return res.blob()
  }
  const { bytes: _b, preview, ...m } = meta
  return {
    ...m,
    blob: await blob(),
    ...(preview
      ? {
          preview: {
            mime: preview.mime,
            width: preview.width,
            height: preview.height,
            blob: await blob(true),
          },
        }
      : {}),
  }
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
