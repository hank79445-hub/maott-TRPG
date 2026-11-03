import type { Room, RoomMember, RoomView } from '../online/protocol'
/** Short-lived coalescing of command replies and simultaneous live polls. */
export class ProjectionCache {
  private rows = new Map<string, { room: Room; at: number; json: string; bytes: number }>()
  private bytes = 0
  get(room: Room, member: RoomMember, live: boolean, compute: () => RoomView) {
    const key = JSON.stringify([room.id, room.revision, member.id, member.role, member.characterIds, member.actorIds, member.revoked, live])
    const old = this.rows.get(key), now = performance.now()
    if (old?.room === room && now - old.at < 150) return JSON.parse(old.json) as RoomView
    const view = compute(), json = JSON.stringify(view), bytes = Buffer.byteLength(json)
    if (old) { this.rows.delete(key); this.bytes -= old.bytes }
    if (bytes <= 8 * 1024 * 1024) {
      while (this.rows.size >= 32 || this.bytes + bytes > 16 * 1024 * 1024) {
        const first = this.rows.keys().next().value
        if (!first) break
        this.bytes -= this.rows.get(first)!.bytes; this.rows.delete(first)
      }
      this.rows.set(key, { room, at: now, json, bytes }); this.bytes += bytes
    }
    return view
  }
  invalidate(roomId: string) {
    for (const [key, row] of this.rows) if (row.room.id === roomId) { this.rows.delete(key); this.bytes -= row.bytes }
  }
}
