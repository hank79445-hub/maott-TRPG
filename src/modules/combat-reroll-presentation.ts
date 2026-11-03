import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import type { DamageReroll } from '../core/combat-types'

export function damageRerollCaption(reroll: DamageReroll) {
  const name = reroll.reason === 'healer' ? controlText('projection.healer') : controlText('projection.tavernBrawler')
  return controlText('projection.actualRerollDie', {p0:(name),p1:(reroll.index + 1),p2:(reroll.from),p3:(reroll.to)})
}
