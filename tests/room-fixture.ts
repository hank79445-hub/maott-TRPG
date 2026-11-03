import { newAdventure, newPoint, applyMap } from '../src/core/map'
import { catalogue, newCharacter, startingInventory, clone } from '../src/core/engine'
import { runtimeState } from '../src/core/runtime'
import { exportMap } from '../src/persistence/map-archive'
import type { MapWorld } from '../src/core/map-types'
import { build } from './fixtures'
import type { MapAsset } from '../src/core/map-types'
import { archiveSchema } from '../src/persistence/schema'
export async function emptyRoomFixture() {
  const { world } = await roomFixture()
  world.adventures = [newAdventure('未配置队伍的冒险')]
  const archives = world.characters.map((character) =>
    archiveSchema.parse({ format: 'trpg-character', version: 1, character, packs: world.packs }),
  )
  return {
    world,
    archives,
    archive: JSON.parse(await exportMap(world, [], world.adventures[0]!.id)),
  }
}
export function tinyAsset(): MapAsset {
  return {
    id: crypto.randomUUID(),
    name: '背景.png',
    mime: 'image/png',
    width: 1,
    height: 1,
    blob: new Blob(
      [
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5xkAAAAASUVORK5CYII=',
          'base64',
        ),
      ],
      { type: 'image/png' },
    ),
  }
}
export async function roomImageFixture() {
  const { world } = await roomFixture(),
    assets = [tinyAsset(), tinyAsset()]
  world.adventures[0]!.scenes.forEach((s, i) => {
    s.grid.cellPixels = 96
    s.grid.offsetX = 11
    s.grid.offsetY = 7
    s.grid.originX = 2
    s.grid.originY = 3
    s.background = {
      assetId: assets[i]!.id,
      x: 2,
      y: 3,
      width: 20,
      height: 16,
      rotation: 0,
      locked: true,
      clip: true,
    }
  })
  return {
    world,
    assets,
    archive: JSON.parse(await exportMap(world, assets, world.adventures[0]!.id)),
  }
}
export async function roomFixture() {
  const cat = catalogue(),
    chars = ['甲', '乙'].map((name) => {
      const c = newCharacter()
      c.build = build()
      c.build.name = name
      c.status = 'complete'
      const i = startingInventory(c.build, cat)
      c.inventory = i.inventory
      c.coins = i.coins
      c.runtime = runtimeState(c, cat)
      return c
    })
  const a = newAdventure('共享冒险')
  a.party = chars.map((c) => c.id)
  const s = a.scenes[0]!,
    p = newPoint('chest', { x: 1, y: 2 })
  p.name = '宝箱'
  p.revealed = '箱底有一张路线图'
  p.loot = [{ itemId: 'torch', quantity: 2 }]
  s.points.push(p)
  const hidden = newPoint('trap', { x: 8, y: 8 })
  hidden.name = '绝密陷阱'
  hidden.note = '绝密判定'
  hidden.hidden = true
  s.points.push(hidden)
  s.note = '绝密场景备注'
  s.annotations = [
    {
      id: crypto.randomUUID(),
      name: '绝密密道',
      note: '',
      x: 9,
      y: 9,
      color: '#112233',
      fontSize: 14,
      offsetX: 0,
      offsetY: 0,
      hidden: true,
    },
  ]
  const next = clone(s)
  next.id = crypto.randomUUID()
  next.name = '绝密下一场景'
  a.scenes.push(next)
  let world: MapWorld = { adventures: [a], characters: chars, encounters: [], packs: [] }
  world = applyMap(world, a.id, { type: 'enter', sceneId: s.id, landing: { x: 1, y: 1 } }, cat)
  return { world, archive: JSON.parse(await exportMap(world, [], a.id)) }
}
export async function batchARoomFixture() {
  const { world } = await roomFixture(),
    cat = catalogue()
  for (const [i, c] of world.characters.entries()) {
    c.build = build(i ? 'wizard' : 'fighter', i ? 'human' : 'orc', i ? 'sage' : 'soldier')
    c.build.name = i ? '乙法师' : '甲战士'
    if (i) {
      c.build.choices['class-cantrips'] = ['acid-splash', 'fire-bolt', 'dancing-lights']
      c.build.choices['class-spells'] = ['shield', 'magic-missile', 'burning-hands', 'thunderwave']
      c.build.choices.spellbook = [...c.build.choices['class-spells'], 'sleep', 'false-life']
    }
    const initial = startingInventory(c.build, cat)
    c.inventory = initial.inventory
    c.coins = initial.coins
    c.runtime = null
    c.runtime = runtimeState(c, cat)
  }
  const a = world.adventures[0]!,
    s = a.scenes[0]!
  a.activeSceneId = null
  a.checkpoints = []
  a.log = []
  s.tokens = []
  const entered = applyMap(
    world,
    a.id,
    { type: 'enter', sceneId: s.id, landing: { x: 1, y: 1 } },
    cat,
  )
  return { world: entered, archive: JSON.parse(await exportMap(entered, [], a.id)) }
}
