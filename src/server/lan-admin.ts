import { entranceTheme } from './entrance-theme'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import type { LanManager } from './lan'
export function lanAdminServer(manager: LanManager) {
  const csrf = randomBytes(32).toString('hex')
  return createServer(async (req, res) => {
    const host = req.headers.host ?? ''
    const json = (v: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(v))
    }
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') ||
      !/^(127\.0\.0\.1|localhost):\d+$/.test(host)
    )
      return json({ error: '仅允许本机管理' }, 403)
    if (req.method === 'GET' && req.url === '/status') return json(manager.status())
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' })
      res.end(page(csrf))
      return
    }
    if (req.method !== 'POST' || req.url !== '/command') return json({ error: '接口不存在' }, 404)
    if (
      req.headers.origin !== `http://${host}` ||
      req.headers['x-trpg-lan-csrf'] !== csrf ||
      !req.headers['content-type']?.startsWith('application/json')
    )
      return json({ error: '请求来源不允许' }, 403)
    try {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 4096) throw Error('请求过大')
        chunks.push(chunk)
      }
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (
        !value ||
        Object.keys(value).some((k) => !['enabled', 'host'].includes(k)) ||
        typeof value.enabled !== 'boolean'
      )
        throw Error('配置格式无效')
      if (value.enabled) await manager.enable(value.host)
      else await manager.disable()
      json(manager.status())
    } catch (e) {
      json({ error: e instanceof Error ? e.message : '局域网入口未能开启' }, 400)
    }
  })
}
function page(csrf: string) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>局域网入口管理</title><style>body{font:16px system-ui;background:#f6f5ef;color:#23404d;max-width:720px;margin:40px auto;padding:20px;line-height:1.6}select,button{font:inherit;padding:12px;margin:8px;min-height:44px}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:inherit}button{background:#e1e8ec;color:#283947;border:1px solid #aabac5;border-radius:7px;cursor:pointer}button:hover{background:#d2dfe6}button:disabled{background:#e5e7e5;color:#707b82;cursor:not-allowed}button:focus-visible,summary:focus-visible{outline:3px solid #947340;outline-offset:3px}summary{background:#e1e8ec;border:1px solid #aabac5;border-radius:7px;padding:8px;cursor:pointer}${entranceTheme}</style><h1>局域网入口管理</h1><p>仅在 GM 电脑开启。选择当前同 Wi-Fi 的网卡地址；玩家从房间分享链接申请，GM 在房间批准。普通 HTTP 面向可信同网设备，私人库及部署设置不会开放。</p><label>本机网卡<select id="host"></select></label><button id="on">开启局域网入口</button><button id="off">关闭入口</button><button id="refresh">刷新</button><pre id="status" role="status"></pre><p id="links"></p><details><summary>其他设备无法连接时</summary><p>保持同一网络，关闭路由器的访客隔离。Windows 防火墙仅允许本工具通过“专用网络”；不要关闭整个防火墙或设置路由器公网端口映射。网卡地址改变后重新选择并开启，已有成员可用身份文件恢复。</p></details><script>const csrf='${csrf}',select=document.querySelector('#host'),status=document.querySelector('#status');function show(s){const previous=select.value;select.replaceChildren(...s.candidates.map(ip=>{const o=document.createElement('option');o.value=ip;o.textContent=ip;return o}));if(s.candidates.includes(previous))select.value=previous;status.textContent=s.enabled?'已开启 · '+s.addresses.join('，'):'已关闭';document.querySelector('#links').replaceChildren(...s.addresses.flatMap(origin=>{const a=document.createElement('a');a.href=origin+'/?page=room';a.target='_blank';a.rel='noopener';a.textContent='在本机打开房间管理：'+origin;return[a]}))}async function refresh(){const r=await fetch('/status');show(await r.json())}async function set(enabled){try{const r=await fetch('/command',{method:'POST',headers:{'Content-Type':'application/json','X-TRPG-LAN-CSRF':csrf},body:JSON.stringify({enabled,host:select.value})});const s=await r.json();if(!r.ok)throw Error(s.error);show(s)}catch(e){status.textContent=e.message}}document.querySelector('#on').onclick=()=>set(true);document.querySelector('#off').onclick=()=>set(false);document.querySelector('#refresh').onclick=refresh;refresh();</script></html>`
}
