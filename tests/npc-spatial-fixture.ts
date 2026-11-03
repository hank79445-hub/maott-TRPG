import { roomFixture } from './room-fixture'
import { newNpcProfile, defaultAdventureAi, newAiJournal } from '../src/core/ai'
import { customNpc, defaultEnvironment } from '../src/core/combat-rules'
import { newPoint } from '../src/core/map'
import { defaultSpatialPolicy } from '../src/persistence/npc-spatial-schema'
import type { Room, RoomMember } from '../src/online/protocol'
import type { MapToken } from '../src/core/map-types'
export async function spatialFixture() {
  const { world } = await roomFixture(),
    a = world.adventures[0]!,
    scene = a.scenes[0]!,
    n = newNpcProfile(scene.id)
  n.name = '观察者'
  n.position = { x: 2, y: 2 }
  n.body = customNpc()
  n.side = 'neutral'
  n.enabled = true
  n.spatialPolicy = { ...defaultSpatialPolicy(), enabled: true }
  n.importanceRole = 'companion'
  a.ai = defaultAdventureAi()
  a.ai.npcs = [n]
  a.aiLog = newAiJournal(a.broadcastLog!.branchId)
  a.activeSceneId = scene.id
  scene.tokens = scene.tokens.filter((t) => t.x !== 2 || t.y !== 2)
  const token: MapToken = {
    id: crypto.randomUUID(),
    npcId: n.id,
    characterId: null,
    actorId: null,
    name: n.name,
    x: 2,
    y: 2,
    span: 1,
    hidden: false,
    color: '#75609e',
    facing: 0,
  }
  scene.tokens.push(token)
  const point = newPoint('clue', { x: 3, y: 2 })
  point.name = '可见机关'
  point.note = '秘密DC'
  point.check = null
  scene.points.push(point)
  const gm = {
    id: 'gm',
    nickname: 'GM',
    role: 'gm',
    revoked: false,
    tokenHash: 'synthetic',
    characterIds: [],
    actorIds: [],
  } as RoomMember
  const room = {
    id: crypto.randomUUID(),
    name: '合成空间房间',
    world,
    members: [gm],
    worldRevision: 1,
    revision: 1,
    intents: [],
    events: [],
    environment: defaultEnvironment(),
  } as unknown as Room
  return { room, a, scene, n, token, point, gm }
}
