import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createSpatialToolServer } from './npc-spatial-mcp-server'
import { spatialToolSchemas } from '../persistence/npc-spatial-tool-schema'

async function main() {
  const endpoint = new URL(process.env.TRPG_MCP_ORIGIN ?? 'http://127.0.0.1:8794')
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/'
  )
    throw Error('MCP适配器仅允许明确的本机服务源地址')
  const token = process.env.TRPG_MCP_GM_TOKEN ?? '',
    roomId = process.env.TRPG_MCP_ROOM_ID ?? '',
    npcId = process.env.TRPG_MCP_NPC_ID ?? '',
    branchId = process.env.TRPG_MCP_BRANCH_ID ?? ''
  if (
    !/^[A-Za-z0-9_-]{32,128}$/.test(token) ||
    ![roomId, npcId, branchId].every((id) => /^[A-Za-z0-9_-]{1,120}$/.test(id))
  )
    throw Error('请在宿主私有环境配置GM令牌、房间、NPC及当前分支；不要把令牌写入命令参数或公开文件')
  const headers: Record<string, string> = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  }
  const host = process.env.TRPG_MCP_FORWARD_HOST,
    cookie = process.env.TRPG_MCP_ACCESS_COOKIE
  if (host) {
    const parsed = new URL('https://' + host)
    if (parsed.host !== host || parsed.username || parsed.password) throw Error('入口Host格式无效')
    headers.Host = host
  }
  if (cookie) {
    if (cookie.length > 8192 || /[\r\n]/.test(cookie)) throw Error('入口认证Cookie格式无效')
    headers.Cookie = cookie
  }
  const server = createSpatialToolServer(async (name, raw) => {
    const args = spatialToolSchemas[name].parse(raw)
    // Native request preserves the explicitly authorized public Host. Node fetch may
    // replace it with the loopback address, which fails the private entrance check.
    return new Promise<unknown>((resolve, reject) => {
      const send = endpoint.protocol === 'https:' ? httpsRequest : httpRequest
      let settled = false
      const finish = (error?: Error, value?: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(deadline)
        if (error) reject(error)
        else resolve(value)
      }
      const req = send(
        new URL('/api/rooms/' + encodeURIComponent(roomId) + '/npc-tools', endpoint),
        { method: 'POST', headers },
        (res) => {
          res.on('error', () => finish(Error('本机NPC工具服务连接中断')))
          const status = res.statusCode ?? 0
          if (status < 200 || status >= 300) {
            finish(Error('NPC工具请求被拒绝（HTTP ' + status + '）；请核对权限、分支及服务版本'))
            res.destroy()
            return
          }
          const chunks: Buffer[] = []
          let size = 0
          res.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > 1024 * 1024) {
              finish(Error('NPC工具结果超出大小限制'))
              res.destroy()
            } else chunks.push(chunk)
          })
          res.on('end', () => {
            if (settled) return
            try {
              finish(undefined, JSON.parse(Buffer.concat(chunks).toString('utf8')))
            } catch {
              finish(Error('工具结果不是有效JSON，请核对本机入口认证'))
            }
          })
        },
      )
      const deadline = setTimeout(() => {
        finish(Error('本机NPC工具请求超时'))
        req.destroy()
      }, 15000)
      req.on('error', () => finish(Error('本机NPC工具服务不可达或入口认证未通过')))
      req.end(JSON.stringify({ branchId, npcId, tool: name, args }))
    })
  })
  await server.connect(new StdioServerTransport())
  process.stdin.once('end', () => {
    void server.close()
  })
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void server.close().finally(() => process.exit(0))
    })
}
main().catch((e) => {
  process.stderr.write((e instanceof Error ? e.message : 'MCP适配器启动失败') + '\n')
  process.exitCode = 1
})
