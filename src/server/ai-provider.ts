import type { AiProvider, ModelConfiguration } from '../core/ai-types'

export function modelEndpoint(baseUrl: string) {
  const url = new URL(baseUrl)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error('模型地址须使用 HTTPS（本机服务可用 HTTP），且不能包含凭据、查询或片段')
  url.pathname = url.pathname.replace(/\/$/, '') + '/chat/completions'
  return url.toString()
}

/** Credentials stay in the room backend. Never follow a provider redirect with a bearer key. */
export const httpAiProvider: AiProvider = {
  async generate(request, config: ModelConfiguration, signal) {
    const response = await fetch(modelEndpoint(config.baseUrl), {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: 'Bearer ' + config.apiKey } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: JSON.stringify(request.input) },
        ],
        ...(config.maxOutputTokens === null
          ? {}
          : { [config.tokenParameter]: config.maxOutputTokens }),
        ...(config.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw Error('模型服务返回 HTTP ' + response.status)
    }
    const reader = response.body?.getReader()
    if (!reader) throw Error('模型服务返回空响应')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > 256000) throw Error('模型响应超过大小限制')
        chunks.push(part.value)
      }
    } finally {
      await reader.cancel().catch(() => {})
    }
    let data: { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } }
    try {
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      throw Error('模型响应不是有效 JSON')
    }
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw Error('模型没有返回文本内容')
    let output: unknown
    try {
      output = JSON.parse(content)
    } catch {
      throw Error('模型内容不是有效 JSON，请检查 JSON 模式和模型兼容性')
    }
    const tokens = data.usage?.total_tokens
    return { output, tokens: Number.isSafeInteger(tokens) && tokens! >= 0 ? tokens! : null }
  },
}
