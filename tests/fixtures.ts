import type { Build } from '../src/core/types'
import {
  assignRecommended,
  catalogue,
  equipmentChoices,
  getChoices,
  newCharacter,
  reconcile,
} from '../src/core/engine'
export function resolve(b: Build) {
  const c = catalogue()
  for (let pass = 0; pass < 8; pass++) {
    for (const n of getChoices(b, c)) {
      const current = b.choices[n.id] || []
      if (current.length < n.count)
        b.choices[n.id] = [
          ...current,
          ...n.options
            .filter((x) => !current.includes(x.id))
            .slice(0, n.count - current.length)
            .map((x) => x.id),
        ]
    }
    reconcile(b, c)
  }
  for (const n of equipmentChoices(b, c))
    b.equipmentChoices[n.id] = n.options.slice(0, n.count).map((x) => x.id)
  return b
}
export function build(classId = 'fighter', speciesId = 'human', backgroundId = 'soldier'): Build {
  const c = catalogue(),
    b = newCharacter().build
  Object.assign(b, { classId, speciesId, backgroundId, name: '测试冒险者' })
  assignRecommended(b)
  const bg = c.backgrounds.find((x) => x.id === backgroundId)!
  b.boosts[bg.abilities[0]!] = 2
  b.boosts[bg.abilities[1]!] = 1
  return resolve(b)
}
