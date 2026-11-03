import { describe, it, expect } from 'vitest'
import { containerFixture } from './experience-v22-fixture'
import { catalogue, newCharacter, startingInventory, clone } from '../src/core/engine'
import { build } from './fixtures'
import {
  runtimeSpells,
  applyRuntime,
  runtimeState,
  validateRuntimeArchive,
} from '../src/core/runtime'
import { executeCommand, projectRoom } from '../src/server/room-engine'
import { executeContainer } from '../src/server/point-container'
const cat = catalogue()
function wizard(scroll = 'scroll-invisibility', quantity = 1) {
  const c = newCharacter()
  c.status = 'complete'
  c.build = build('wizard', 'human', 'sage')
  c.inventory = startingInventory(c.build, cat).inventory
  c.runtime = runtimeState(c, cat)
  c.inventory.push({
    instanceId: 'synthetic-scroll',
    itemId: scroll,
    quantity,
    source: '合成',
    equipped: false,
    note: '',
  })
  return c
}
describe('ABC functional changes', () => {
  it('revisits legacy completed containers with story bindings without respawning stock', async () => {
    const f = await containerFixture()
    f.point.state = 'resolved'
    f.point.storyResults = [
      {
        id: 'story',
        type: 'aided',
        npcId: f.n.id,
        outcome: 'success',
        text: '只触发一次',
        requiresGM: false,
      },
    ]
    f.point.battlePresetId = 'legacy-preset'
    const before = clone(f.room.world.adventures[0]!.broadcastLog)
    executeContainer(
      f.room,
      f.player,
      {
        kind: 'container',
        sceneId: f.scene.id,
        pointId: f.point.id,
        characterId: f.c.id,
        stamp: f.view().stamp,
        operation: 'take-all',
      },
      false,
    )
    expect(f.current().p.state).toBe('open')
    expect(f.view().items).toEqual([])
    expect(f.room.world.adventures[0]!.broadcastLog).toEqual(before)
  })
  it('honors explicitly one-time containers', async () => {
    const f = await containerFixture()
    f.point.repeatAccess = false
    executeContainer(
      f.room,
      f.player,
      {
        kind: 'container',
        sceneId: f.scene.id,
        pointId: f.point.id,
        characterId: f.c.id,
        stamp: f.view().stamp,
        operation: 'take-all',
      },
      false,
    )
    expect(f.current().p.state).toBe('resolved')
    expect(() => f.view()).toThrow(/一次性/)
  })
  it('casts an unprepared inventory spell, consumes one scroll and no class slot, retaining valid concentration', () => {
    const c = wizard('scroll-detect-magic', 2),
      g = runtimeSpells(c, cat).find((g) => g.item)!
    expect(g.spell.id).toBe('detect-magic')
    const before = runtimeState(c, cat).resources
    const next = applyRuntime(
      c,
      cat,
      { type: 'cast', key: g.key, mode: g.modes[0]!, requirementsConfirmed: true },
      () => 20,
    )
    expect(next.inventory.find((i) => i.instanceId === 'synthetic-scroll')!.quantity).toBe(1)
    expect(next.runtime!.resources).toEqual(before)
    expect(next.runtime!.itemCasts!.at(-1)!.success).toBe(true)
    validateRuntimeArchive(next, cat)
  })
  it('records over-level scroll failure as a consumed attempt without spell effects or slots', () => {
    const c = wizard(),
      g = runtimeSpells(c, cat).find((g) => g.item)!
    const next = applyRuntime(
      c,
      cat,
      { type: 'cast', key: g.key, mode: g.modes[0]!, requirementsConfirmed: true },
      () => 1,
    )
    expect(next.inventory.find((i) => i.instanceId === 'synthetic-scroll')).toBeUndefined()
    expect(next.runtime!.itemCasts!.at(-1)).toMatchObject({ success: false, checkDC: 12 })
    expect(next.runtime!.concentration).toBeNull()
    expect(next.runtime!.resources).toEqual(c.runtime!.resources)
  })
  it('does not grant unreadable scrolls or bypass ownership and mode validation', () => {
    const c = wizard('scroll-cure-wounds')
    expect(runtimeSpells(c, cat).some((g) => g.item)).toBe(false)
    const owned = wizard('scroll-detect-magic'),
      g = runtimeSpells(owned, cat).find((g) => g.item)!
    expect(() =>
      applyRuntime(owned, cat, {
        type: 'cast',
        key: g.key,
        mode: 'at-will',
        requirementsConfirmed: true,
      }),
    ).toThrow(/方式不可用/)
    expect(owned.inventory.find((i) => i.instanceId === 'synthetic-scroll')!.quantity).toBe(1)
  })
  it('isolates personal opening text, independent progress and immutable replay snapshots', async () => {
    const f = await containerFixture()
    const presentation = {
      opening: '公共开场',
      background: '公共背景',
      origin: '公共起源',
      identities: [
        { characterId: f.c.id, text: '甲的私有身份' },
        { characterId: f.other.id, text: '乙的私有身份' },
      ],
    }
    executeCommand(f.room, f.gm, { kind: 'opening', operation: 'configure', presentation })
    executeCommand(f.room, f.gm, { kind: 'opening', operation: 'start' })
    let one = projectRoom(f.room, f.player, []).openingReading!,
      two = projectRoom(f.room, f.second, []).openingReading!
    expect(JSON.stringify(one)).not.toContain('乙的私有身份')
    expect(JSON.stringify(two)).not.toContain('甲的私有身份')
    const revision = f.room.worldRevision
    executeCommand(f.room, f.player, { kind: 'opening', operation: 'read', runId: one.id, page: 2 })
    expect(f.room.worldRevision).toBe(revision)
    expect(projectRoom(f.room, f.player, []).openingReading!.page).toBe(2)
    expect(projectRoom(f.room, f.second, []).openingReading!.page).toBe(0)
    executeCommand(f.room, f.gm, {
      kind: 'opening',
      operation: 'configure',
      presentation: { ...presentation, background: '下一轮背景' },
    })
    expect(projectRoom(f.room, f.player, []).openingReading!.pages[1]).toBe('公共背景')
    executeCommand(f.room, f.gm, { kind: 'opening', operation: 'start' })
    expect(projectRoom(f.room, f.player, []).openingReading!.pages[1]).toBe('下一轮背景')
    expect(
      f.room.world.adventures[0]!.broadcastLog!.events.filter((e) => e.type === 'story.start'),
    ).toHaveLength(1)
    expect(() => executeCommand(f.room, f.player, { kind: 'opening', operation: 'start' })).toThrow(
      /GM/,
    )
    f.player.characterIds = []
    expect(projectRoom(f.room, f.player, []).openingReading!.pages[2]).toBe('')
  })
})
