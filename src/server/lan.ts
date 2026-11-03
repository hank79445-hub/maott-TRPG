import { entranceTheme } from './entrance-theme'
import { networkInterfaces } from 'node:os'
import { once } from 'node:events'
import type { Server, IncomingMessage } from 'node:http'
import type { RoomStore } from './room-store'
import { roomServer } from './http'
import { RoomError } from './room-engine'
export const localIPv4 = (ip: string) =>
  ip === '127.0.0.1' ||
  /^10\./.test(ip) ||
  /^192\.168\./.test(ip) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
export function lanCandidates() {
  return [
    ...new Set(
      Object.entries(networkInterfaces())
        .filter(([name]) => !/tailscale|clash|loopback|wsl|hyper-v|veth/i.test(name))
        .flatMap(([, rows]) =>
          (rows ?? [])
            .filter((r) => r.family === 'IPv4' && !r.internal && localIPv4(r.address))
            .map((r) => r.address),
        ),
    ),
  ]
}
export function checkLanRequest(req: IncomingMessage) {
  const host = req.headers.host ?? '',
    address = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '')
  if (!localIPv4(address) || !/^([\d.]+|localhost):\d+$/.test(host))
    throw new RoomError('局域网入口仅允许本地网络', 403)
  const target = host.split(':')[0]!,
    local = (req.socket.localAddress ?? '').replace(/^::ffff:/, '')
  if (target !== local && !(address === '127.0.0.1' && ['127.0.0.1', 'localhost'].includes(target)))
    throw new RoomError('请求主机不允许', 403)
  if (req.headers.origin && req.headers.origin !== `http://${host}`)
    throw new RoomError('请求来源不允许', 403)
  return address === local || address === '127.0.0.1'
}
export class LanManager {
  private server?: Server
  private host = ''
  private actualPort = 0
  constructor(
    private store: RoomStore,
    private staticDirectory?: string,
    private options: { port?: number; deploymentId?: string; version?: string } = {},
  ) {}
  status() {
    return {
      enabled: !!this.server,
      port: this.actualPort || this.options.port || 8795,
      addresses: this.server ? [`http://${this.host}:${this.actualPort}`] : [],
      candidates: lanCandidates(),
      adminUrl: 'http://127.0.0.1:8797/',
    }
  }
  async enable(host: string) {
    if (!['127.0.0.1', ...lanCandidates()].includes(host))
      throw new RoomError('请选择本机可用的局域网地址')
    if (this.server && this.host === host) return
    await this.disable()
    const server = roomServer(this.store, this.staticDirectory, {
      lanOnly: true,
      lanManager: this,
      version: this.options.version,
      deploymentId: this.options.deploymentId,
    })
    server.listen(this.options.port ?? 8795, host)
    try {
      await once(server, 'listening')
    } catch (e) {
      server.close()
      throw e
    }
    this.server = server
    this.host = host
    this.actualPort = (server.address() as { port: number }).port
  }
  async disable() {
    const server = this.server
    this.server = undefined
    if (server) {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }
}
export const lanJoinPage = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>同网跑团 · 加入房间</title><style>body{font:16px system-ui;background:#f6f5ef;color:#23404d;max-width:520px;margin:8vh auto;padding:20px}label{display:grid;gap:6px;margin:16px 0}input,button{font:inherit;padding:12px;border:1px solid #b8c7c9;border-radius:8px;box-sizing:border-box}input{width:100%}button{min-height:44px;background:#315367;color:white}p{line-height:1.6}#status{white-space:pre-wrap}${entranceTheme}</style><h1>同网跑团</h1><p>输入房间号和有效邀请码。GM 批准后才能进入；请保持 GM 电脑和本工具运行。</p><form id="join"><label>短房间号／完整ID<input name="code" required autocomplete="off"></label><label>邀请码<input name="invite" required autocomplete="off"></label><label>你的称呼<input name="nickname" required maxlength="80"></label><button>申请加入</button></form><p id="status" role="status"></p><p><a href="/?page=room">恢复已有房间身份／打开工具</a></p><script>const form=document.querySelector('#join'),status=document.querySelector('#status'),params=new URLSearchParams(location.search);for(const key of ['code','invite'])form.elements[key].value=params.get(key)||'';let ticket;try{ticket=JSON.parse(localStorage.getItem('trpg-lan-pending')||'null')}catch{}async function post(route,body){const r=await fetch('/api/lan/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error||'连接失败');return v}async function poll(){if(!ticket)return;try{const v=await post('poll',ticket);if(v.status==='approved'){localStorage.setItem('trpg-room-session',JSON.stringify({roomId:v.roomId,token:v.token}));localStorage.removeItem('trpg-lan-pending');location.assign('/?page=room');return}if(v.status==='rejected'){localStorage.removeItem('trpg-lan-pending');ticket=null;status.textContent='GM 已拒绝或邀请已重置，请核对后重新申请。';return}status.textContent='已申请，等待 GM 批准。'}catch(e){status.textContent=e.message}if(ticket)setTimeout(poll,3000)}form.onsubmit=async e=>{e.preventDefault();try{ticket=await post('join',Object.fromEntries(new FormData(form)));localStorage.setItem('trpg-lan-pending',JSON.stringify(ticket));await poll()}catch(e){status.textContent=e.message}};if(ticket)poll();</script></html>`
