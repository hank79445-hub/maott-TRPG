import path from 'node:path'
import { QqProbe } from './qq-probe'
import { qqProbeServer } from './qq-probe-http'

const port = Number(process.env.TRPG_QQ_PROBE_PORT ?? 8798)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid QQ probe port')
const probe = new QqProbe(
  path.resolve(process.env.TRPG_QQ_PROBE_DATA ?? '.local/qq-probe'),
  fetch,
  (url) => new WebSocket(url),
  () => Date.now(),
  path.resolve('.local/qq-locks'),
)
await probe.init()
const server = qqProbeServer(probe)
server.listen(port, '127.0.0.1', () => console.log(`QQ-0 本机验证页：http://127.0.0.1:${port}/`))
server.on('error', () => {
  console.error('QQ-0 服务无法监听端口，请检查端口是否已使用')
  process.exitCode = 1
})
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    probe.disconnect()
    server.close(() => process.exit(0))
  })
