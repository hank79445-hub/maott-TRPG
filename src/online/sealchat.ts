import { z } from 'zod'
import { actionSchema, type RoomView } from './protocol'
export const INTENT_TOPIC = 'trpg.intent.v1'
export const sealIntentSchema = z
  .object({
    version: z.literal(1),
    id: z.string().uuid(),
    roomId: z.string().uuid(),
    baseWorldRevision: z.number().int().nonnegative(),
    summary: z.string().min(1).max(2000),
    action: actionSchema,
  })
  .strict()
export interface EmbedClient {
  capabilities: readonly string[]
  context: {
    get: () => Promise<{ channel: { id: string }; currentUser: { displayName: string } | null }>
  }
  connection: {
    getState: () => Promise<{ state: string }>
    onChanged: (handler: (state: { state: string }) => void) => () => void
  }
  session: { onClosed: (handler: () => void) => () => void }
  events: { on: (topic: string, handler: (payload: unknown) => void) => () => void }
  close: () => void
}
type Transport = (url: string, token: string, body?: unknown) => Promise<RoomView | null>
/** Events are untrusted suggestions. The relay token is an independently scoped AI identity. */
export function sealRelay(
  client: EmbedClient,
  roomId: string,
  token: string,
  transport: Transport,
  notify: (message: string) => void,
) {
  if (!['context.read', 'events.subscribe'].every((c) => client.capabilities.includes(c)))
    throw new Error('SealChat 需授予 context.read 与 events.subscribe')
  const seen = new Set<string>(),
    offs: (() => void)[] = []
  let closed = false,
    chain = Promise.resolve()
  const receive = (payload: unknown) => {
    chain = chain
      .catch(() => {})
      .then(async () => {
        if (closed) return
        try {
          if (new TextEncoder().encode(JSON.stringify(payload)).length > 16 * 1024)
            throw new Error('SealChat 意图超过 16 KiB')
          const intent = sealIntentSchema.parse(payload)
          if (intent.roomId !== roomId) throw new Error('意图所属房间不匹配')
          if (seen.has(intent.id)) return
          const view = await transport(`/rooms/${roomId}/snapshot`, token)
          if (!view || view.self.role !== 'ai') throw new Error('转交必须使用受限 AI 身份令牌')
          if (intent.baseWorldRevision !== view.worldRevision)
            throw new Error('意图的世界版本已过期')
          if (closed) return
          await transport(`/rooms/${roomId}/commands`, token, {
            id: intent.id,
            revision: view.revision,
            command: {
              kind: 'intent-submit',
              action: intent.action,
              summary: intent.summary,
              source: 'sealchat',
              baseWorldRevision: intent.baseWorldRevision,
            },
          })
          seen.add(intent.id)
          if (seen.size > 128) seen.delete(seen.values().next().value!)
          notify('SealChat 意图已转交，等待 GM 审核：' + intent.summary)
        } catch (e) {
          notify('SealChat 意图未转交：' + (e instanceof Error ? e.message : String(e)))
        }
      })
    return chain
  }
  offs.push(
    client.events.on(INTENT_TOPIC, (payload) => {
      void receive(payload)
    }),
  )
  offs.push(client.connection.onChanged((state) => notify('SealChat 连接：' + state.state)))
  offs.push(
    client.session.onClosed(() => {
      closed = true
      offs.splice(0).forEach((off) => off())
      notify('SealChat 会话已失效，请重新连接')
    }),
  )
  return {
    receive,
    close() {
      closed = true
      offs.splice(0).forEach((off) => off())
      client.close()
    },
  }
}
declare global {
  interface Window {
    SealChatEmbed?: {
      connect: (options: { targetOrigin: string; timeoutMs: number }) => Promise<EmbedClient>
    }
    __SEALCHAT_EMBED_CONFIG__?: { hostOrigin?: string; sdkUrl?: string }
  }
}
export function validateSDK(host: string, address: string) {
  const origin = new URL(host),
    sdk = new URL(address)
  if (
    origin.origin !== host ||
    sdk.origin !== origin.origin ||
    sdk.username ||
    sdk.password ||
    sdk.search ||
    sdk.hash ||
    !sdk.pathname.endsWith('/api/v1/channel-embed-sdk.js')
  )
    throw new Error('请填写明确的宿主 Origin 与同源 SDK 地址（可包含实例路径前缀）')
  if (
    sdk.protocol !== 'https:' &&
    !(sdk.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(sdk.hostname))
  )
    throw new Error('SDK 地址需为 HTTPS，或本机 HTTP')
  return sdk.href
}
export async function connectEmbed(host: string, address: string) {
  const url = validateSDK(host, address)
  if (window.parent === window)
    throw new Error('请通过 SealChat 频道 iForm iframe 打开工具，再连接 Embed SDK')
  if (!window.SealChatEmbed)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = () => resolve()
      script.onerror = () => {
        script.remove()
        reject(new Error('SealChat SDK 加载失败'))
      }
      document.head.append(script)
    })
  if (!window.SealChatEmbed) throw new Error('实例 SDK 未提供 SealChatEmbed')
  return window.SealChatEmbed.connect({ targetOrigin: host, timeoutMs: 10000 })
}
