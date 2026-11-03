import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createServer } from 'node:http'
import { TestAccess } from '../src/server/test-access'

describe('documented public access setup', () => {
  it('creates a usable account, rejects overwrite and authenticates through the real HTTP handler', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'maott-synthetic-access-'))
    const file = path.join(directory, 'access.json')
    const run = promisify(execFile)
    const args = ['scripts/create-access.mjs', '--output', file, '--username', 'synthetic_gm']
    const origin = 'https://synthetic.example'
    const access = new TestAccess(file, origin)
    const server = createServer((req, res) => {
      void access.handle(req, res, new URL(req.url!, origin).pathname).catch(() => {
        res.writeHead(500).end()
      })
    })
    try {
      await expect(
        run(process.execPath, args.slice(0, -1), { windowsHide: true }),
      ).rejects.toThrow()
      await expect(readFile(file)).rejects.toThrow()
      const result = await run(process.execPath, args, { windowsHide: true })
      const password = result.stdout.match(/Password: (\S+)/)?.[1]
      expect(Boolean(password)).toBe(true)
      const before = await readFile(file, 'utf8')
      await expect(run(process.execPath, args, { windowsHide: true })).rejects.toThrow()
      expect(await readFile(file, 'utf8')).toBe(before)
      await access.ready()
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as { port: number }).port
      const response = await fetch(`http://127.0.0.1:${port}/__test/login`, {
        method: 'POST',
        redirect: 'manual',
        headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: 'synthetic_gm', password: password! }),
      })
      expect(response.status).toBe(303)
      expect(response.headers.get('set-cookie')).toMatch(/HttpOnly; Secure; SameSite=Strict/)
      const rejected = await fetch(`http://127.0.0.1:${port}/__test/login`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: 'synthetic_gm',
          password: 'incorrect-synthetic-password',
        }),
      })
      expect(rejected.status).toBe(401)
    } finally {
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()))
      await rm(file, { force: true })
      await rmdir(directory)
    }
  })
})
