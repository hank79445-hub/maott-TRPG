import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RoomHostingOptions } from './test-access'
import { RoomError } from './room-engine'

export async function handleQqHttp(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  hosting: RoomHostingOptions,
) {
  const match = url.pathname.match(
    /^\/api\/rooms\/([a-f0-9-]{36})\/(qq|qq-member|qq-bots|qq-pairing)$/,
  )
  if (!match) return false
  if (!hosting.qqBridge) throw new RoomError('本实例尚未启用 QQ 接入；请由部署者配置后端', 503)
  const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1] ?? ''
  const bot = url.searchParams.get('bot') ?? 'default'
  const bridge = hosting.qqBots ? hosting.qqBots.bridge(bot) : hosting.qqBridge
  if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json'))
    throw new RoomError('需要 JSON 请求', 415)
  let value: unknown
  if (match[2] === 'qq-pairing') {
    if (!hosting.qqBots) throw new RoomError('多Bot连接库未启用', 503)
    if (req.method === 'GET') value = await hosting.qqBots.pairing(match[1]!, token)
    else if (req.method === 'POST') {
      const chunks: Buffer[] = []
      let size = 0
      for await (const p of req) {
        size += p.length
        if (size > 16000) throw new RoomError('请求过大', 413)
        chunks.push(Buffer.from(p))
      }
      value = await hosting.qqBots.pairing(
        match[1]!,
        token,
        JSON.parse(Buffer.concat(chunks).toString('utf8')),
      )
    } else throw new RoomError('接口方法不允许', 405)
  } else if (match[2] === 'qq-bots') {
    if (!hosting.qqBots) throw new RoomError('多Bot连接库未启用', 503)
    if (req.method === 'GET') value = hosting.qqBots.status(match[1]!, token)
    else if (req.method === 'POST') {
      const chunks: Buffer[] = []
      let size = 0
      for await (const p of req) {
        size += p.length
        if (size > 16000) throw new RoomError('请求过大', 413)
        chunks.push(Buffer.from(p))
      }
      value = await hosting.qqBots.command(
        match[1]!,
        token,
        JSON.parse(Buffer.concat(chunks).toString('utf8')),
      )
    } else throw new RoomError('接口方法不允许', 405)
  } else if (req.method === 'GET')
    value =
      match[2] === 'qq-member'
        ? bridge.memberStatus(match[1]!, token)
        : {
            ...bridge.status(match[1]!, token),
            transport: hosting.qqBots?.transportStatus(bot) ?? hosting.qqStatus?.(),
          }
  else if (req.method === 'POST') {
    if (!req.headers['content-type']?.startsWith('application/json'))
      throw new RoomError('需要 JSON 请求', 415)
    const chunks: Buffer[] = []
    let bytes = 0
    for await (const part of req) {
      bytes += part.length
      if (bytes > (match[2] === 'qq-member' ? 16384 : 4096)) throw new RoomError('请求过大', 413)
      chunks.push(Buffer.from(part))
    }
    let body: unknown
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      throw new RoomError('JSON 格式不正确')
    }
    value =
      match[2] === 'qq-member'
        ? await bridge.memberCommand(match[1]!, token, body)
        : {
            ...(await bridge.command(match[1]!, token, body)),
            transport: hosting.qqBots?.transportStatus(bot) ?? hosting.qqStatus?.(),
          }
  } else throw new RoomError('接口方法不允许', 405)
  if (match[2] === 'qq-member' && value && typeof value === 'object' && hosting.qqBots)
    Object.assign(value, { bots: hosting.qqBots.memberBots(match[1]!, token) })
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
  return true
}
