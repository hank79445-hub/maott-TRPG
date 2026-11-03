import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
process.env.TRPG_QQ_ENABLED ??= '0'
// Keep the server in this process so its own SIGINT/SIGTERM handlers close stores.
await import(pathToFileURL(path.join(root, '.local/server/main.mjs')).href)
