import { describe, it, expect } from 'vitest'
import { catalogue } from '../src/core/engine'
import {
  runtimeState,
  runtimeSpells,
  applyRuntime,
  validateRuntimeArchive,
} from '../src/core/runtime'
import { teachingCharacter } from '../scripts/example-fixture'
import { buildExample } from '../scripts/example-entry'
import { inspectScript } from '../src/core/script'
import { isBuiltinPack } from '../src/content/builtin-ids'
import { S_FAMILIARS, summonBody } from '../src/core/summon-templates'
import { BUILTIN_PACKS } from '../src/content/builtin-packs'
import { authoringExample } from '../src/content/script-authoring-example'
import { authoringWorkbenchExample } from '../src/content/script-authoring-workbench-example'
import { compileAuthoring } from '../src/core/script-authoring'
describe('public edition actual catalogue', () => {
  it('ships SRD only and does not silently treat optional private packs as installed', () => {
    expect(BUILTIN_PACKS.map((p) => p.id)).toEqual(['srd-5.2.1'])
    expect(isBuiltinPack('phb-2024-origins')).toBe(false)
    expect(catalogue().items.find((i) => i.id === 'goodberry')?.source.pack).toBe('srd-5.2.1')
  })
  for (const cl of catalogue().classes)
    it('creates a legal ' + cl.id + ' character with native resources', () => {
      const c = teachingCharacter(cl.id, cl.name)
      expect(c.status).toBe('complete')
      expect(c.runtime?.hp).toBeGreaterThan(0)
      validateRuntimeArchive(c, catalogue())
    })
  it('keeps SRD Goodberry generation and consumption usable after optional items are removed', () => {
    const cat = catalogue()
    let c = teachingCharacter('druid')
    c.inventory.push({
      instanceId: 'public-goodberry-scroll',
      itemId: 'scroll-goodberry',
      quantity: 1,
      source: '原创测试',
      equipped: false,
      note: '',
    })
    c.runtime = runtimeState(c, cat)
    const source = runtimeSpells(c, cat).find((g) => g.item && g.spell.id === 'goodberry')!
    expect(source).toBeDefined()
    c = applyRuntime(
      c,
      cat,
      { type: 'cast', key: source.key, mode: source.modes[0]!, requirementsConfirmed: true },
      () => 20,
    )
    const berries = c.inventory.find((i) => i.itemId === 'goodberry')!
    expect(berries.quantity).toBe(10)
    c.runtime!.hp = 1
    c = applyRuntime(c, cat, {
      type: 'item-remove',
      instanceId: berries.instanceId,
      quantity: 1,
      consume: true,
      note: '食用',
    })
    expect(c.runtime!.hp).toBe(2)
    expect(c.inventory.find((i) => i.instanceId === berries.instanceId)!.quantity).toBe(9)
    validateRuntimeArchive(c, cat)
  })
  it('preserves supported SRD familiar and steed cards', () => {
    expect(S_FAMILIARS.Cat.hp).toBe(2)
    expect(S_FAMILIARS.Owl.ac).toBe(11)
    expect(summonBody('find-steed', 2, 'fey', 5)?.maxHp).toBe(25)
    expect(() => summonBody('summon-beast', 2, 'land', 5)).toThrow('非SRD')
  })
  it('builds a fresh original example with no missing dependencies and correct party placement', async () => {
    const f = await buildExample(),
      a = f.world.adventures[0]!
    expect(f.compiled.definition.scenes).toHaveLength(3)
    expect(inspectScript(f.compiled.definition).missingDependencies).toEqual([])
    expect(
      a.scenes.find((s) => s.id === a.activeSceneId)!.tokens.filter((t) => t.characterId),
    ).toHaveLength(2)
    expect(a.openingPresentation?.identities).toHaveLength(2)
    expect(
      a.scenes
        .flatMap((s) => s.points)
        .filter((p) => p.kind === 'chest')
        .every((p) => p.repeatAccess !== false),
    ).toBe(true)
  })
  it('keeps the built-in authoring examples compilable using only public content', () => {
    for (const source of [authoringExample(), authoringWorkbenchExample()]) {
      const result = compileAuthoring(source)
      expect(inspectScript(result.definition).missingDependencies).toEqual([])
    }
  })
})
