import { describe, expect, it } from 'vitest'
import { containerFixture } from './experience-v22-fixture'
import { applyMap } from '../src/core/map'
import { clone, catalogue } from '../src/core/engine'
import { pointContainerView, executeContainer } from '../src/server/point-container'
import { projectRoom, executeCommand } from '../src/server/room-engine'
import {
  containerActionSchema,
  type ContainerAction,
} from '../src/persistence/point-container-schema'
import { projectSceneEffects, scenePointVisible } from '../src/core/scene-effect-view'
import { SPECIAL_WEAPONS } from '../src/core/special-weapons'
import { exportMap, importMap } from '../src/persistence/map-archive'

function action(
  f: Awaited<ReturnType<typeof containerFixture>>,
  op: ContainerAction['operation'],
  rowId?: string,
  quantity?: number,
): ContainerAction {
  return containerActionSchema.parse({
    kind: 'container',
    sceneId: f.scene.id,
    pointId: f.point.id,
    characterId: f.c.id,
    stamp: f.view().stamp,
    operation: op,
    ...(rowId ? { rowId, quantity } : {}),
  })
}
describe('v22 container transfers and visibility', () => {
  it('projects authorized contents only and rejects hidden, locked, distant and unowned containers without mutation', async () => {
    const f = await containerFixture()
    f.point.containerInventory = [{ ...clone(f.c.inventory[0]!), instanceId: 'stored-private-test', note: '不得下发的实例私密备注' }]
    const before = JSON.stringify(f.room)
    expect(f.view().items[0]).toMatchObject({ coins: true, quantity: 12.34 })
    expect(JSON.stringify(f.view())).not.toContain('GM秘密')
    expect(JSON.stringify(f.view())).not.toContain('实例私密备注')
    expect(JSON.stringify(projectRoom(f.room, f.player, []))).not.toContain('containerInventory')
    expect(JSON.stringify(f.room)).toBe(before)
    expect(() => pointContainerView(f.room, f.second, f.scene.id, f.point.id, f.c.id)).toThrow(
      /无权/,
    )
    f.point.hidden = true
    expect(() => f.view()).toThrow(/不可访问/)
    f.point.hidden = false
    f.point.state = 'locked'
    expect(() => f.view()).toThrow(/打开/)
    f.point.state = 'open'
    f.pcToken.x = 9
    expect(() => f.view()).toThrow(/靠近/)
  })
  it('takes partial stacks and precise coins, then takes all atomically while keeping the empty container usable', async () => {
    const f = await containerFixture()
    executeCommand(f.room, f.player, action(f, 'take', 'legacy:0', 1))
    expect(f.current().p.loot[0]!.quantity).toBe(2)
    expect(f.current().c.inventory.find((i) => i.itemId === 'torch')?.quantity).toBe(1)
    const invalid = action(f, 'take', 'coins', 0.001),
      before = JSON.stringify(f.room)
    expect(() => executeCommand(f.room, f.player, invalid)).toThrow(/金额/)
    expect(JSON.stringify(f.room)).toBe(before)
    executeCommand(f.room, f.player, action(f, 'take', 'coins', 0.25))
    expect(f.current().p.coins).toBe(12.09)
    executeCommand(f.room, f.player, action(f, 'take-all'))
    expect(f.current().p).toMatchObject({ loot: [], coins: 0, state: 'open' })
    expect(f.current().c.coins).toBe(112.34)
    expect(
      f
        .current()
        .c.inventory.filter((i) => i.itemId === 'torch')
        .reduce((n, i) => n + i.quantity, 0),
    ).toBe(3)
    expect(f.view().items).toEqual([])
  })
  it('preserves a permanent special instance, notes and uses through put, archive, reload and take', async () => {
    const f = await containerFixture(),
      item = f.c.inventory[0]!
    item.quantity = 1
    item.specialWeapon = clone(SPECIAL_WEAPONS.find((w) => w.itemId === 'dagger')!.definition)
    f.c.inventory.push({
      instanceId: 'kit-test',
      itemId: 'healers-kit',
      quantity: 1,
      uses: 3,
      source: '合成',
      equipped: false,
      note: '余下3次',
    })
    const original = clone(item)
    executeCommand(f.room, f.player, action(f, 'put', 'inventory:' + item.instanceId, 1))
    expect(f.current().c.inventory.some((i) => i.instanceId === original.instanceId)).toBe(false)
    expect(f.current().p.containerInventory?.[0]).toMatchObject(original)
    const archive = await exportMap(f.room.world, [], f.a.id)
    const imported = await importMap(
      JSON.parse(archive),
      { characters: [], adventures: [], encounters: [], packs: [] },
      [],
    )
    expect(
      imported.world.adventures[0]!.scenes[0]!.points[0]!.containerInventory?.[0],
    ).toMatchObject(original)
    executeCommand(f.room, f.player, action(f, 'take', 'stored:' + original.instanceId, 1))
    expect(f.current().c.inventory.find((i) => i.instanceId === original.instanceId)).toMatchObject(
      original,
    )
    expect(f.current().p.containerInventory).toEqual([])
    executeCommand(f.room, f.player, action(f, 'put', 'inventory:kit-test', 1))
    executeCommand(f.room, f.player, action(f, 'take', 'stored:kit-test', 1))
    expect(f.current().c.inventory.find((i) => i.instanceId === 'kit-test')?.uses).toBe(3)
  })
  it('rejects repeated/stale stock and whole-transfer failures without removing any property', async () => {
    const f = await containerFixture(),
      old = action(f, 'take', 'legacy:0', 2)
    executeCommand(f.room, f.player, old)
    const before = JSON.stringify(f.room)
    expect(() => executeCommand(f.room, f.player, old)).toThrow(/已变化/)
    expect(JSON.stringify(f.room)).toBe(before)
    f.current().c.coins = 999999
    const overflow = action(f, 'take-all'),
      beforeAll = JSON.stringify(f.room)
    expect(() => executeCommand(f.room, f.player, overflow)).toThrow(/上限/)
    expect(JSON.stringify(f.room)).toBe(beforeAll)
  })
  it('rejects equipped/linked items and supports historical empty containers without restoring loot', async () => {
    const f = await containerFixture()
    f.c.inventory[0]!.equipped = true
    expect(f.view().inventory.find((r) => r.itemId === 'dagger')?.reason).toMatch(/卸下/)
    const before = JSON.stringify(f.room)
    expect(() =>
      executeCommand(f.room, f.player, action(f, 'put', 'inventory:dagger-instance', 1)),
    ).toThrow(/卸下/)
    expect(JSON.stringify(f.room)).toBe(before)
    f.c.inventory[0]!.equipped = false
    f.point.loot = []
    f.point.coins = 0
    f.point.state = 'resolved'
    expect(f.view().items).toEqual([])
    executeCommand(f.room, f.player, action(f, 'put', 'inventory:dagger-instance', 1))
    expect(f.current().p.state).toBe('open')
    expect(f.current().p.containerInventory?.[0]?.quantity).toBe(1)
  })
  it('keeps the legacy whole-claim path compatible with stored instances', async () => {
    const f = await containerFixture(),
      original = clone(f.c.inventory[0]!)
    executeCommand(f.room, f.player, action(f, 'put', 'inventory:dagger-instance', 2))
    f.room.world = applyMap(
      f.room.world,
      f.a.id,
      {
        type: 'interact',
        sceneId: f.scene.id,
        pointId: f.point.id,
        characterId: f.c.id,
        operation: 'claim',
        gm: false,
        reason: '',
      },
      catalogue(),
    )
    expect(f.current().c.inventory.find((i) => i.instanceId === original.instanceId)).toMatchObject(
      original,
    )
    expect(f.current().p.containerInventory).toEqual([])
  })
})
describe('v22 ambient lighting without local effects', () => {
  it('projects dim/dark environments and preserves the bright fast path and actual vision', async () => {
    const f = await containerFixture(),
      cat = catalogue()
    f.scene.fog = undefined
    f.a.sceneEffects = undefined
    f.a.m3 = {
      ...f.a.m3!,
      environments: [{ sceneId: f.scene.id, floorHeight: 0, openSky: true, light: 'dim' }],
      entities: f.a.m3?.entities ?? [],
    }
    expect(
      projectSceneEffects(f.room.world, f.a, f.scene, cat, true, []).lighting[0]?.runs.every(
        (r) => r.kind === 'dim',
      ),
    ).toBe(true)
    f.a.m3.environments[0]!.light = 'dark'
    expect(
      projectSceneEffects(f.room.world, f.a, f.scene, cat, true, []).lighting[0]?.runs.every(
        (r) => r.kind === 'dark',
      ),
    ).toBe(true)
    expect(scenePointVisible(f.room.world, f.a, f.scene, [], f.point, cat)).toBe(false)
    f.a.m3.environments[0]!.light = 'bright'
    expect(projectSceneEffects(f.room.world, f.a, f.scene, cat, true, []).lighting).toEqual([])
  })
})
