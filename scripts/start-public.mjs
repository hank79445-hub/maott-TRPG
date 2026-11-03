import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const child = spawn(process.execPath, [path.join(root, '.local/server/main.mjs')], {
  cwd: root,
  env: { ...process.env, TRPG_QQ_ENABLED: process.env.TRPG_QQ_ENABLED ?? '0' },
  stdio: 'inherit',
  windowsHide: true,
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (e) => {
  console.error(e.message)
  process.exitCode = 1
})
