import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export type Mem0Scope = {
  roomId: string
  adventureId: string
  npcId: string
  epoch: string
  audience: string
}
export type Mem0RecallOptions = {
  directory: string
  scope: Mem0Scope
  query: string
  records: { id: string; text: string }[]
  embedding: { baseUrl: string; apiKey: string; model: string; dimension: number }
  signal?: AbortSignal
  timeoutMs?: number
  /** Internal test-only injection; never expose through client or room configuration. */
  sdkPath?: string
  /** Internal test-only stub; must be paired with an explicit sdkPath. */
  testStub?: boolean
}

const pending = new Map<string, Promise<void>>()
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
function location(options: Pick<Mem0RecallOptions, 'directory' | 'scope' | 'embedding'>) {
  const { scope, embedding } = options
  const key = hash(
    JSON.stringify([
      scope.roomId,
      scope.adventureId,
      scope.npcId,
      scope.epoch,
      scope.audience,
      new URL(embedding.baseUrl).toString(),
      embedding.model,
      embedding.dimension,
      'mem0ai-3.3.1',
    ]),
  )
  return path.join(path.resolve(options.directory), 'indexes', key + '.sqlite')
}
function fingerprint(file: string) {
  const s = statSync(file)
  return [s.size, s.mtimeMs, s.ctimeMs].join(':')
}
export function estimateMem0Work(
  options: Pick<Mem0RecallOptions, 'directory' | 'scope' | 'embedding' | 'records' | 'query'>,
) {
  const file = location(options)
  let known: Record<string, string> = {}
  try {
    const receipt = JSON.parse(readFileSync(file + '.receipts.json', 'utf8'))
    if (receipt.fingerprint === fingerprint(file)) known = receipt.records
  } catch {
    /* Missing or replaced index has no trusted receipts. */
  }
  const pending = options.records.filter((r) => known[r.id] !== hash(r.text)).slice(0, 16)
  return {
    calls: pending.length + Number(options.records.length > 0),
    reservedTokens: pending.reduce(
      (sum, r) => sum + Buffer.byteLength(r.text) + 128,
      Buffer.byteLength(options.query) + 512,
    ),
  }
}

export async function recallMem0(
  options: Mem0RecallOptions,
): Promise<{ ids: string[]; indexed: number }> {
  const { directory, scope, query, records, embedding, signal, sdkPath, testStub } = options
  const timeoutMs = options.timeoutMs ?? 30_000
  if (
    !directory ||
    !query.trim() ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 300_000
  )
    throw new Error('Invalid Mem0 request')
  if (
    !scope ||
    [scope.roomId, scope.adventureId, scope.npcId, scope.epoch, scope.audience].some(
      (v) => typeof v !== 'string' || !v.trim(),
    )
  )
    throw new Error('Invalid Mem0 scope')
  if (
    !embedding ||
    typeof embedding.baseUrl !== 'string' ||
    !embedding.baseUrl.trim() ||
    typeof embedding.apiKey !== 'string' ||
    typeof embedding.model !== 'string' ||
    !embedding.model.trim() ||
    !Number.isSafeInteger(embedding.dimension) ||
    embedding.dimension < 1 ||
    embedding.dimension > 16384
  )
    throw new Error('Invalid embedding configuration')
  let endpoint: URL
  try {
    endpoint = new URL(embedding.baseUrl)
  } catch {
    throw new Error('Invalid embedding endpoint')
  }
  if (
    (endpoint.protocol !== 'https:' &&
      !(
        endpoint.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
      )) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error('Invalid embedding endpoint')
  if ((testStub || sdkPath) && (process.env.VITEST !== 'true' || !sdkPath))
    throw new Error('Mem0 test injection is only available in tests')
  if (
    !Array.isArray(records) ||
    records.some(
      (r) =>
        !r ||
        typeof r.id !== 'string' ||
        !r.id.trim() ||
        typeof r.text !== 'string' ||
        !r.text.trim(),
    ) ||
    new Set(records.map((r) => r.id)).size !== records.length
  )
    throw new Error('Invalid Mem0 records')
  const root = path.resolve(directory)
  const indexPath = location(options)
  const home = path.join(root, 'worker-home')
  const lockKey = path.resolve(indexPath)
  const previous = pending.get(lockKey) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => gate)
  pending.set(lockKey, tail)
  void tail.then(() => {
    if (pending.get(lockKey) === tail) pending.delete(lockKey)
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Mem0 request timed out')), timeoutMs)
    abortHandler = () => reject(new Error('Mem0 request aborted'))
    if (signal?.aborted) abortHandler()
    else signal?.addEventListener('abort', abortHandler, { once: true })
  })
  try {
    await Promise.race([previous, deadline])
    await Promise.race([
      Promise.all([
        mkdir(path.dirname(indexPath), { recursive: true }),
        mkdir(home, { recursive: true }),
      ]),
      deadline,
    ])
    const result = await runWorker({ ...options, indexPath, home }, deadline)
    const allowed = new Set(records.map((r) => r.id))
    if (
      !result ||
      !Array.isArray(result.ids) ||
      result.ids.length > 12 ||
      !Number.isSafeInteger(result.indexed) ||
      result.indexed < 0 ||
      result.indexed > Math.min(16, records.length) ||
      result.ids.some((id: unknown) => typeof id !== 'string' || !allowed.has(id)) ||
      new Set(result.ids).size !== result.ids.length ||
      !Array.isArray(result.indexedRecordIds) ||
      result.indexedRecordIds.some((id) => !allowed.has(id))
    )
      throw new Error('Invalid Mem0 worker response')
    const receipt = indexPath + '.receipts.json',
      temporary = receipt + '.tmp'
    const texts = new Map(records.map((r) => [r.id, r.text]))
    await writeFile(
      temporary,
      JSON.stringify({
        fingerprint: fingerprint(indexPath),
        records: Object.fromEntries(
          result.indexedRecordIds.map((id) => [id, hash(texts.get(id)!)]),
        ),
      }),
    )
    await rename(temporary, receipt)
    return { ids: result.ids, indexed: result.indexed }
  } finally {
    if (timer) clearTimeout(timer)
    if (abortHandler) signal?.removeEventListener('abort', abortHandler)
    release()
  }
}

async function runWorker(
  options: Mem0RecallOptions & { indexPath: string; home: string },
  deadline: Promise<never>,
): Promise<{ ids: string[]; indexed: number; indexedRecordIds: string[] }> {
  const env: NodeJS.ProcessEnv = {
    HOME: options.home,
    USERPROFILE: options.home,
    TEMP: options.home,
    TMP: options.home,
    MEM0_TELEMETRY: 'false',
  }
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot
  const worker = spawn(process.execPath, [path.resolve('scripts/npc-mem0-worker.mjs')], {
    cwd: process.cwd(),
    env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore'],
  })
  let output = ''
  let failure: Error | undefined
  const finished = new Promise<{ ids: string[]; indexed: number; indexedRecordIds: string[] }>(
    (resolve, reject) => {
      worker.on('error', () => {
        failure = new Error('Mem0 worker could not start')
      })
      worker.stdout.setEncoding('utf8')
      worker.stdout.on('data', (part: string) => {
        output += part
        if (output.length > 1_000_000) {
          failure = new Error('Mem0 worker response too large')
          worker.kill()
        }
      })
      worker.on('close', (code) => {
        if (failure || code !== 0) return reject(failure ?? new Error('Mem0 worker failed'))
        try {
          resolve(JSON.parse(output))
        } catch {
          reject(new Error('Invalid Mem0 worker response'))
        }
      })
      worker.stdin.on('error', () => {
        failure = new Error('Mem0 worker input failed')
      })
      const {
        directory: _directory,
        signal: _signal,
        timeoutMs: _timeout,
        home: _home,
        ...payload
      } = options
      worker.stdin.end(JSON.stringify(payload) + '\n')
    },
  )
  try {
    return await Promise.race([finished, deadline])
  } catch (error) {
    worker.kill()
    await finished.catch(() => {})
    throw error
  }
}
