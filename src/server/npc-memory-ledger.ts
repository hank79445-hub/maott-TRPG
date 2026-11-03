import { DatabaseSync, backup } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { Room } from '../online/protocol'
import type { NpcConversation, NpcProfile } from '../core/ai-types'
import { newKnowledgeState } from '../core/npc-relationships'
import {
  memoryRecordSchema,
  type KnowledgeRecord,
  type KnowledgeState,
} from '../persistence/npc-knowledge-schema'

const bindings = new WeakMap<Room, MemoryLedger>()
export const memoryLedger = (room: Room) => bindings.get(room)
export function memoryState(room: Room) {
  const ai = room.world.adventures[0]?.ai
  if (!ai) return
  return (ai.knowledgeState ??= newKnowledgeState())
}
export function validMemory(s: KnowledgeState, r: KnowledgeRecord) {
  return (
    !s.removedIds.includes(r.id) &&
    !r.dependencies.some((id) => s.removedIds.includes(id)) &&
    (r.epoch === s.epoch
      ? r.sequence <= s.sequence
      : s.ancestors.some((a) => a.epoch === r.epoch && r.sequence <= a.upto))
  )
}
export function visibleMemory(
  r: KnowledgeRecord,
  job: Pick<NpcConversation, 'visibility' | 'characterId' | 'qqSessionId'>,
) {
  return (
    r.visibility === 'public' ||
    (!job.qqSessionId &&
      job.visibility === 'personal' &&
      r.visibility === 'personal' &&
      r.characterId === job.characterId)
  )
}
export function memoryIdentity(
  npcId: string,
  sourceId: string,
  kind: KnowledgeRecord['sourceKind'],
) {
  return createHash('sha256')
    .update(JSON.stringify([npcId, sourceId, kind]))
    .digest('hex')
}
export class MemoryLedger {
  private db: DatabaseSync
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true })
    this.db = new DatabaseSync(path.join(directory, 'canonical.sqlite'))
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS memories (room TEXT NOT NULL, epoch TEXT NOT NULL, id TEXT NOT NULL, npc TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(room,epoch,id)); CREATE INDEX IF NOT EXISTS memory_scope ON memories(room,npc,epoch,seq); CREATE INDEX IF NOT EXISTS memory_source ON memories(room,npc,json_extract(data,'$.sourceId'),json_extract(data,'$.sourceKind'))",
    )
  }
  attach(room: Room) {
    bindings.set(room, this)
  }
  private lineage(s: KnowledgeState) {
    return [{ epoch: s.epoch, upto: s.sequence }, ...s.ancestors]
  }
  records(room: Room, npcId?: string) {
    const s = room.world.adventures[0]?.ai?.knowledgeState
    if (!s) return []
    const lineage = this.lineage(s)
    const raw = this.db
      .prepare(
        'SELECT data FROM memories WHERE room=?' +
          (npcId ? ' AND npc=?' : '') +
          ' AND (' +
          lineage.map(() => '(epoch=? AND seq<=?)').join(' OR ') +
          ') ORDER BY seq',
      )
      .all(...[room.id, ...(npcId ? [npcId] : []), ...lineage.flatMap((a) => [a.epoch, a.upto])])
    const merged = new Map<string, KnowledgeRecord>()
    for (const v of [
      ...raw.map((r) => JSON.parse(r.data as string)),
      ...s.outbox,
      ...(s.archiveSegments ?? []).flat(),
    ]) {
      const r = memoryRecordSchema.parse(v)
      if ((!npcId || r.npcId === npcId) && validMemory(s, r)) merged.set(r.id, r)
    }
    return [...merged.values()]
  }
  stage(room: Room) {
    this.attach(room)
    const ai = room.world.adventures[0]?.ai
    if (!ai?.memoryConfig?.enabled) return
    const s = memoryState(room)!
    const superseded = new Set(
      room.world.adventures[0]?.broadcastLog?.events.filter(e=>e.branchId===room.world.adventures[0]?.broadcastLog?.branchId&&e.phase!=='pending').flatMap((e) => e.supersedes) ?? [],
    )
    for (const source of superseded) {
      const rows = this.db
        .prepare("SELECT id FROM memories WHERE room=? AND json_extract(data,'$.sourceId')=?")
        .all(room.id, source)
      for (const r of rows)
        if (!s.removedIds.includes(String(r.id))) s.removedIds.push(String(r.id))
    }
    const add = (
      n: NpcProfile,
      source: string,
      kind: KnowledgeRecord['sourceKind'],
      value: Omit<
        KnowledgeRecord,
        'id' | 'npcId' | 'sourceId' | 'sourceKind' | 'epoch' | 'sequence'
      >,
    ) => this.append(room, n.id, source, kind, value)
    for (const n of ai.npcs) {
      if (n.npcType !== 'important') continue
      for (const e of n.experiences ?? []) {
        if (e.branchId !== room.world.adventures[0]?.broadcastLog?.branchId) continue
        add(n, e.sourceId, e.kind === 'relationship' ? 'relationship' : 'event', {
          kind: e.kind === 'relationship' ? 'opinion' : 'fact',
          text: e.text,
          visibility: e.visibility,
          characterId: e.characterId,
          at: e.at,
          importance: e.importance ?? 'routine',
          basis: e.knowledgeSource ?? 'gm',
          dependencies: [e.sourceId],
        })
      }
      for (const m of n.memory) {
        if (m.branchId && m.branchId !== room.world.adventures[0]?.broadcastLog?.branchId) continue
        add(n, m.id, 'dialogue', {
          kind: 'statement',
          text: m.player,
          reply: m.reply,
          visibility: m.visibility,
          characterId: m.characterId,
          at: m.at,
          importance: 'routine',
          basis: 'published',
          dependencies: [m.id],
        })
      }
    }
  }
  append(
    room: Room,
    npcId: string,
    source: string,
    kind: KnowledgeRecord['sourceKind'],
    value: Omit<KnowledgeRecord, 'id' | 'npcId' | 'sourceId' | 'sourceKind' | 'epoch' | 'sequence'>,
  ) {
    if (!room.world.adventures[0]?.ai?.memoryConfig?.enabled) return
    const s = memoryState(room)!,
      id = memoryIdentity(npcId, source, kind)
    if (
      s.removedIds.includes(id) ||
      [...s.outbox, ...(s.archiveSegments ?? []).flat()].some(
        (r) => r.id === id || (r.npcId === npcId && r.sourceId === source && r.sourceKind === kind),
      )
    )
      return
    let previous: { data: unknown }[] = []
    try {
      previous = this.db
        .prepare(
          "SELECT data FROM memories WHERE room=? AND npc=? AND json_extract(data,'$.sourceId')=? AND json_extract(data,'$.sourceKind')=?",
        )
        .all(room.id, npcId, source, kind) as { data: unknown }[]
    } catch {
      s.status = '记忆账本暂不可读，待写任务保留'
    }
    if (
      previous.some((row) => {
        const r = JSON.parse(row.data as string) as KnowledgeRecord
        return validMemory(s, r) || s.removedIds.includes(r.id)
      })
    )
      return
    if (s.outbox.length >= 10000) throw Error('NPC记忆待写队列已满，请先修复存储')
    s.outbox.push(
      memoryRecordSchema.parse({
        id,
        npcId,
        sourceId: source,
        sourceKind: kind,
        epoch: s.epoch,
        sequence: ++s.sequence,
        ...value,
      }),
    )
  }

  flush(room: Room) {
    const s = room.world.adventures[0]?.ai?.knowledgeState
    if (!s) return
    const states = room.world.adventures
      .flatMap((a) => [
        a,
        ...a.checkpoints.map((c) => c.snapshot.adventure),
        ...a.log.flatMap((e) => (e.before ? [e.before.adventure] : [])),
        ...(a.testBattle
          ? [
              a.testBattle.snapshot.adventure,
              ...(a.testBattle.checkpoints ?? []).map((c) => c.snapshot.adventure),
            ]
          : []),
      ])
      .flatMap((a) => (a.ai?.knowledgeState ? [a.ai.knowledgeState] : []))
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO memories(room,epoch,id,npc,seq,data) VALUES(?,?,?,?,?,?)',
    )
    this.db.exec('BEGIN')
    try {
      for (const state of states)
        for (const r of [...state.outbox, ...(state.archiveSegments ?? []).flat()])
          insert.run(room.id, r.epoch, r.id, r.npcId, r.sequence, JSON.stringify(r))
      this.db.exec('COMMIT')
      for (const state of states) {
        state.outbox = []
        delete state.archiveSegments
      }
      for (const n of room.world.adventures[0]!.ai!.npcs) {
        if ((n.experiences?.length ?? 0) > 80)
          n.experiences = [
            ...(n.experiences ?? []).filter((e) => e.pinned || e.importance === 'major'),
            ...(n.experiences ?? [])
              .filter((e) => !e.pinned && e.importance !== 'major')
              .slice(-80),
          ].slice(-500)
        if (n.memory.length > 40) n.memory = n.memory.slice(-40)
      }
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
  }
  export(room: Room) {
    return this.records(room)
  }
  async backup(destination: string) {
    mkdirSync(path.dirname(destination), { recursive: true })
    await backup(this.db, destination)
  }
  close() {
    if (this.db.isOpen) this.db.close()
  }
}
export function recallNative(room: Room, n: NpcProfile, job: NpcConversation) {
  const query = (job.message ?? '').toLowerCase(),
    terms = [
      ...new Set(
        [...query.matchAll(/[\p{L}\p{N}]{2,}/gu)].flatMap((m) => {
          const word = m[0]
          return /[\u4e00-\u9fff]/.test(word)
            ? Array.from({ length: Math.max(1, word.length - 1) }, (_, i) => word.slice(i, i + 2))
            : [word]
        }),
      ),
    ]
  const rank = (r: KnowledgeRecord) =>
    terms.reduce((v, t) => v + Number(r.text.toLowerCase().includes(t)), 0)
  const cited = new Set(job.dialogueReview?.citedIds ?? [])
  return (memoryLedger(room)?.records(room, n.id) ?? [])
    .filter((r) => visibleMemory(r, job))
    .sort(
      (a, b) =>
        Number(cited.has('archive:' + b.id)) - Number(cited.has('archive:' + a.id)) ||
        Number(b.importance === 'major') - Number(a.importance === 'major') ||
        rank(b) - rank(a) ||
        b.at.localeCompare(a.at),
    )
}
export function forkMemoryTimeline(room: Room) {
  const s = room.world.adventures[0]?.ai?.knowledgeState
  if (!s) return
  s.ancestors.push({ epoch: s.epoch, upto: s.sequence })
  s.epoch = crypto.randomUUID()
  s.sequence = 0
  delete s.consolidationRun
  s.probeRequested = false
  s.status = '已切换记忆时间线，索引待补'
}
