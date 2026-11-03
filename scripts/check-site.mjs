import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Explicit manual deployment check. Never part of the offline rules test suite.
const origin = 'https://maott1.cn'
const checksum = (await readFile(new URL('../website/public/downloads/maott-trpg-public-source.sha256.txt', import.meta.url), 'utf8')).split(/\s+/)[0]
for (const route of ['/', '/guide/player/containers.html', '/media/scene-desktop.png', '/downloads/lamplit-inn.trpg-script.zip', '/downloads/maott-trpg-public-source.zip']) {
  let failure
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(origin + route, { signal: AbortSignal.timeout(20000) })
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (!response.ok || bytes.length < 100) throw Error('Unexpected HTTP status or empty response')
      if (route === '/' && !new TextDecoder().decode(bytes).includes('猫团团')) throw Error('Wrong site content')
      if (route.endsWith('maott-trpg-public-source.zip') && createHash('sha256').update(bytes).digest('hex') !== checksum) throw Error('Source archive checksum differs')
      console.log(JSON.stringify({ origin, route, status: response.status, bytes: bytes.length, pass: true }))
      failure = undefined
      break
    } catch (error) {
      failure = error
      if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }
  if (failure) throw Error('Live verification failed for ' + route + ': ' + failure.message)
}
