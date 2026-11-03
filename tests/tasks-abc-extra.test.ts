import { it, expect } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { once } from 'node:events'
import { lanAdminServer } from '../src/server/lan-admin'
import { qqBotsAdminServer } from '../src/server/qq-bots-admin'
import { probePage } from '../src/server/qq-probe-page'
import { extractScript, instantiateScript } from '../src/core/script'
import { roomFixture } from './room-fixture'
it('retains identity role binding through script extraction and a new adventure instance', async () => {
  const f = await roomFixture(),
    a = f.world.adventures[0]!,
    c = f.world.characters[0]!
  a.openingPresentation = {
    opening: '开场',
    background: '背景',
    origin: '起源',
    identities: [{ characterId: c.id, text: '仅分配给对应角色位的身份' }],
  }
  const definition = extractScript(f.world, [], a.id, true)
  expect(definition.openingPresentation!.identities[0]!.characterId).toMatch(/^role:/)
  const roleId = definition.openingPresentation!.identities[0]!.characterId.slice(5),
    result = instantiateScript(definition, [], [c], { [roleId]: c.id })
  expect(result.world.adventures[0]!.openingPresentation!.identities[0]).toEqual({
    characterId: c.id,
    text: '仅分配给对应角色位的身份',
  })
})
it('renders standalone administration interfaces from synthetic factories without credentials or Bot operations', async () => {
  const root = '.local/agent-ui/abc-20261103/ui'
  await mkdir(root, { recursive: true })
  for (const [name, server] of [
    ['lan-admin', lanAdminServer({} as never)],
    ['qq-admin', qqBotsAdminServer({} as never)],
  ] as const) {
    try {
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const response = await fetch(
        'http://127.0.0.1:' + (server.address() as { port: number }).port,
        { headers: { Connection: 'close' } },
      )
      expect(response.status).toBe(200)
      const html = await response.text()
      await writeFile(
        root + '/' + name + '.html',
        html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
      )
    } finally {
      server.closeAllConnections()
      await new Promise<void>((r) => server.close(() => r()))
    }
  }
  await writeFile(
    root + '/qq-probe.html',
    probePage('synthetic-csrf', 'synthetic-nonce').replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      '',
    ),
  )
})
