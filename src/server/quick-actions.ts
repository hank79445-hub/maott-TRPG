import { mkdir, readFile, writeFile, rename, unlink, readdir } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { quickActionsSchema, type QuickActions } from '../persistence/quick-actions-schema'
import { accountIdSchema } from './access-config'
import { RoomError } from './room-engine'

/** Account preferences convey no control rights and never enter a room/script archive. */
export class QuickActionsStore {
  private tail: Promise<unknown> = Promise.resolve()
  constructor(private directory: string) {}
  private location(owner: string, character: string) {
    accountIdSchema.parse(owner)
    if (!/^[\w-]{1,120}$/.test(character)) throw new RoomError('角色 ID 无效')
    const hash = (s: string) => createHash('sha256').update(s).digest('hex')
    return { folder: path.join(this.directory, hash(owner)), name: hash(character) + '.json' }
  }
  async get(owner: string, character: string): Promise<QuickActions> {
    const { folder, name } = this.location(owner, character)
    try {
      return quickActionsSchema.parse(JSON.parse(await readFile(path.join(folder, name), 'utf8')))
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { revision: 0, entries: [] }
      throw e
    }
  }
  set(owner: string, character: string, input: unknown) {
    const run = this.tail.then(async () => {
      const next = quickActionsSchema.parse(input),
        current = await this.get(owner, character)
      if (current.revision !== next.revision)
        throw new RoomError('收藏已在另一设备更改，请刷新后重试', 409)
      const { folder, name } = this.location(owner, character)
      await mkdir(folder, { recursive: true, mode: 0o700 })
      const files = await readdir(folder)
      if (!files.includes(name) && files.filter((f) => f.endsWith('.json')).length >= 200)
        throw new RoomError('个人角色收藏配置已达上限')
      next.revision++
      const tmp = path.join(folder, randomUUID() + '.tmp')
      try {
        await writeFile(tmp, JSON.stringify(next), { mode: 0o600 })
        await rename(tmp, path.join(folder, name))
      } finally {
        await unlink(tmp).catch(() => {})
      }
      return next
    })
    this.tail = run.catch(() => {})
    return run
  }
}
