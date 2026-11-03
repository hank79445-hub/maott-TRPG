import path from 'node:path'
import { RoomStore } from './room-store'
import { roomServer } from './http'
import { TestAccess, httpsOrigin, type RoomHostingOptions } from './test-access'
import metadata from '../../package.json'
import { ScriptLibrary } from './script-library'
import { QqBotHub } from './qq-bots'
import { qqBotsAdminServer } from './qq-bots-admin'
import { LanManager } from './lan'
import { lanAdminServer } from './lan-admin'
import { createHash } from 'node:crypto'
const port = Number(process.env.TRPG_ROOM_PORT ?? 8787),
  host = process.env.TRPG_ROOM_HOST ?? '127.0.0.1'
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('房间端口不合法')
const hosting: RoomHostingOptions = { version: metadata.version }
if (process.env.TRPG_PUBLIC_ORIGIN) {
  hosting.publicOrigin = httpsOrigin(process.env.TRPG_PUBLIC_ORIGIN)
  hosting.backupOrigins = process.env.TRPG_BACKUP_ORIGIN
    ? [httpsOrigin(process.env.TRPG_BACKUP_ORIGIN)]
    : []
  if (process.env.TRPG_DEPLOYMENT_ID) {
    if (!/^[a-f0-9]{64}$/.test(process.env.TRPG_DEPLOYMENT_ID)) throw Error('部署标识格式不合法')
    hosting.deploymentId = process.env.TRPG_DEPLOYMENT_ID
  }
  if (hosting.backupOrigins.includes(hosting.publicOrigin)) throw Error('备用入口不能与主入口相同')
  if (!['127.0.0.1', '::1'].includes(host)) throw new Error('公开实例后端必须仅监听回环地址')
  for (const key of ['TRPG_ROOM_DATA', 'TRPG_STATIC_DIR', 'TRPG_TEST_ACCESS_FILE'])
    if (!process.env[key] || !path.isAbsolute(process.env[key]!))
      throw new Error(`${key} 必须配置绝对路径`)
  hosting.trustLoopbackProxy = process.env.TRPG_TRUST_LOOPBACK_PROXY === '1'
  hosting.icpRecord = process.env.TRPG_ICP_RECORD ?? ''
  if (hosting.icpRecord && !/^[\p{Script=Han}A-Za-z0-9-]{4,64}$/u.test(hosting.icpRecord))
    throw new Error('ICP备案号格式不合法')
  hosting.frameOrigins = (process.env.TRPG_EMBED_ORIGINS ?? '')
    .split(',')
    .filter(Boolean)
    .map(httpsOrigin)
  hosting.access = new TestAccess(
    process.env.TRPG_TEST_ACCESS_FILE!,
    hosting.publicOrigin,
    hosting.trustLoopbackProxy,
    hosting.icpRecord,
  )
  await hosting.access.ready()
}
const store = new RoomStore(path.resolve(process.env.TRPG_ROOM_DATA ?? '.local/rooms'))
await store.init()
let qqHub: QqBotHub | undefined
let qqAdmin: ReturnType<typeof qqBotsAdminServer> | undefined
if (process.env.TRPG_QQ_ENABLED === '1') {
  try {
    const directory = path.resolve(
      process.env.TRPG_QQ_DATA ?? path.join(store.directory, '..', 'qq'),
    )
    qqHub = new QqBotHub(
      directory,
      store,
      hosting.publicOrigin ?? '',
      process.env.TRPG_QQ_BACKUP_ENTRY === '1' ? (hosting.backupOrigins?.[0] ?? '') : '',
    )
    await qqHub.init()
    hosting.qqBots = qqHub
    hosting.qqBridge = qqHub.bridge()
    hosting.qqStatus = () => qqHub!.transportStatus()
    const adminPort = Number(process.env.TRPG_QQ_BOTS_ADMIN_PORT ?? 8796)
    if (!Number.isInteger(adminPort) || adminPort < 1 || adminPort > 65535)
      throw Error('Bot部署端口不合法')
    qqAdmin = qqBotsAdminServer(qqHub)
    qqAdmin.on('error', () => console.error('QQ本机部署控制台端口不可用；现有房间服务继续运行'))
    qqAdmin.listen(adminPort, '127.0.0.1')
  } catch {
    if (qqHub) await qqHub.close()
    hosting.qqBots = undefined
    hosting.qqBridge = undefined
    console.error('QQ多Bot初始化失败，Web继续运行；请保留原配置并核对主体／磁盘记录')
  }
}
if (hosting.access) {
  const directory = process.env.TRPG_SCRIPT_DATA ?? path.join(store.directory, '..', 'scripts')
  if (!path.isAbsolute(directory)) throw new Error('TRPG_SCRIPT_DATA 必须为绝对路径')
  const setting = (name: string, fallback: number) =>
    process.env[name] ? Number(process.env[name]) : fallback
  hosting.scriptLibrary = new ScriptLibrary(directory, {
    accountBytes: setting('TRPG_SCRIPT_ACCOUNT_BYTES', 2 * 1024 ** 3),
    totalBytes: setting('TRPG_SCRIPT_TOTAL_BYTES', 10 * 1024 ** 3),
    minimumFreeBytes: setting('TRPG_SCRIPT_MINIMUM_FREE_BYTES', 512 * 1024 ** 2),
    scriptsPerAccount: setting('TRPG_SCRIPT_ACCOUNT_COUNT', 100),
  })
  await hosting.scriptLibrary.init()
}
const server = roomServer(store, path.resolve(process.env.TRPG_STATIC_DIR ?? 'dist'), hosting)
hosting.lanManager = new LanManager(store, path.resolve(process.env.TRPG_STATIC_DIR ?? 'dist'), {
  version: metadata.version,
  deploymentId:
    hosting.deploymentId ??
    (hosting.access
      ? await hosting.access.deploymentId()
      : createHash('sha256').update(store.directory).digest('hex')),
})
const lanAdmin = lanAdminServer(hosting.lanManager)
lanAdmin.on('error', () => console.error('局域网本机管理端口 8797 不可用；房间服务继续运行'))
lanAdmin.listen(Number(process.env.TRPG_LAN_ADMIN_PORT ?? 8797), '127.0.0.1')
server.listen(port, host, () => console.log(`TRPG room service ready: http://${host}:${port}`))
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    qqAdmin?.close()
    lanAdmin.close()
    void hosting.lanManager?.disable()
    void qqHub?.close()
    store.close()
    server.close(() => process.exit(0))
  })
