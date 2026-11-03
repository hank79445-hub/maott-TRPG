import { entranceTheme } from './entrance-theme'
import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { QqBotHub } from './qq-bots'
/** Loopback-only deployment console; room GM tokens do not grant access to Bot credentials. */
export function qqBotsAdminServer(hub: QqBotHub) {
  const csrf = randomBytes(32).toString('hex')
  return createServer(async (req, res) => {
    const json = (status: number, v: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(v))
    }
    const host = req.headers.host ?? ''
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') ||
      !/^(127\.0\.0\.1|localhost):\d+$/.test(host)
    ) {
      json(403, { error: '仅允许本机部署控制台' })
      return
    }
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(page(csrf))
      return
    }
    if (req.method === 'GET' && req.url === '/status') {
      json(200, hub.adminStatus())
      return
    }
    const token = req.headers['x-qq-bots-csrf']
    if (
      req.method !== 'POST' ||
      req.url !== '/command' ||
      typeof token !== 'string' ||
      token.length !== csrf.length ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(csrf)) ||
      (req.headers.origin !== undefined && req.headers.origin !== 'http://' + host) ||
      !req.headers['content-type']?.startsWith('application/json')
    ) {
      json(403, { error: '本机请求校验失败' })
      return
    }
    try {
      const chunks: Buffer[] = []
      let size = 0
      for await (const part of req) {
        size += part.length
        if (size > 8192) throw Error('请求过大')
        chunks.push(Buffer.from(part))
      }
      const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      json(200, await hub.admin(input))
    } catch (e) {
      json(400, { error: e instanceof Error ? e.message : '操作失败' })
    }
  })
}
function page(csrf: string) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QQ多Bot部署控制台</title><style>body{font:16px system-ui;max-width:900px;margin:24px auto;padding:16px;background:#f6f5ef;color:#23404d}form{display:grid;gap:12px}label{display:grid;gap:4px}input,select,button{font:inherit;padding:10px;max-width:100%;box-sizing:border-box}pre{white-space:pre-wrap;overflow-wrap:anywhere}button{min-height:44px}section{border:1px solid #ccd5d4;border-radius:12px;padding:16px;margin:16px 0}button{background:#e1e8ec;color:#283947;border:1px solid #aabac5;border-radius:7px;cursor:pointer}button:hover{background:#d2dfe6}button:disabled{background:#e5e7e5;color:#707b82;cursor:not-allowed}button:focus-visible,summary:focus-visible{outline:3px solid #947340;outline-offset:3px}summary{background:#e1e8ec;border:1px solid #aabac5;border-radius:7px;padding:8px;cursor:pointer}${entranceTheme}</style><h1>QQ 多Bot连接库</h1><p>仅本机部署者可配置。每个Bot独立AppID、密钥和连接；保存不发送群消息。新增连接默认停用，启用并连接后再到Web房间分别绑定。更换AppID请新增连接。</p><section><form id="config"><label>连接标识（英文／数字／下划线，原主Bot为default）<input name="key" required pattern="[A-Za-z0-9_-]{1,64}" maxlength="64"></label><label>显示名称<input name="name" required maxlength="60"></label><label>AppID<input name="appId" required pattern="[0-9]{1,32}"></label><label>AppSecret（已有连接可留空保留）<input name="appSecret" type="password" autocomplete="new-password"></label><button>保存Bot配置</button></form></section><section><label>操作连接<input id="key" value="default"></label><p><button data-action="enable">启用</button> <button data-action="connect">连接</button> <button data-action="disconnect">断开</button> <button data-action="disable">停用</button> <button id="reload">刷新状态</button></p><p id="error" role="alert"></p><pre id="status"></pre></section><script>const csrf='${csrf}';async function refresh(){const r=await fetch('/status');document.querySelector('#status').textContent=JSON.stringify(await r.json(),null,2)}async function send(body){document.querySelector('#error').textContent='';const r=await fetch('/command',{method:'POST',headers:{'Content-Type':'application/json','X-QQ-Bots-CSRF':csrf},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error);await refresh()}document.querySelector('#config').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f));if(!d.appSecret)delete d.appSecret;try{await send({action:'save',...d});f.elements.appSecret.value=''}catch(e){document.querySelector('#error').textContent=e.message}};document.querySelectorAll('[data-action]').forEach(b=>b.onclick=async()=>{try{await send({action:b.dataset.action,key:document.querySelector('#key').value})}catch(e){document.querySelector('#error').textContent=e.message}});document.querySelector('#reload').onclick=refresh;refresh().catch(()=>document.querySelector('#error').textContent='连接库无法读取');</script></html>`
}
