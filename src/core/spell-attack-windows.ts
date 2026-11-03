import { clone, type Catalogue } from './engine'
import type { Character } from './types'
import type { CombatCommand, Encounter, PendingAction, DamagePart } from './combat-types'
import { combatCharacter, combatStats } from './combat-rules'
import { runtimeSpells, runtimeState, castSlotLevel, availableSlots } from './runtime'
import { abilityAvailable } from './npc-abilities'
import { hasStyle } from './growth-rules'

export const M5_HIT_SPELLS = [
  'divine-smite',
  'lightning-arrow',
  'searing-smite',
  'thunderous-smite',
  'wrathful-smite',
  'shining-smite',
  'blinding-smite',
  'ensnaring-strike',
] as const
export const isM5HitSpell = (id: string) => (M5_HIT_SPELLS as readonly string[]).includes(id)
export interface HitSpellWindow {
  id: string
  attackId: string
  actorId: string
  targetId: string
  spellId: string
  status: 'pending' | 'attached' | 'canceled'
  critical: boolean
}
/** The original attack is saved intact while the immediate spell has its own
 * counterspell/save frame. Its damage is attached before mitigation, never paid twice. */
export function prepareHitSpell(
  e: Encounter,
  cs: Character[],
  cat: Catalogue,
  c: Extract<CombatCommand, { type: 'hit-spell' }>,
) {
  const p = e.pending,
    a = e.actors.find((a) => a.id === c.actorId),
    t = p?.targets.find((t) => t.id === c.targetId)
  if (
    !a ||
    !p ||
    p.id !== c.attackId ||
    p.actorId !== a.id ||
    p.kind !== 'attack' ||
    !p.attack ||
    p.damageRolled ||
    !t ||
    t.sanctuaryBlocked
  )
    throw Error('须当前本人尚未掷伤害的真实命中窗口')
  const character = combatCharacter(a, cs),
    grant = character
      ? runtimeSpells(character, cat).find((g) => g.key === c.key && g.modes.includes(c.mode))
      : undefined,
    ability = a.npc?.abilities?.find((b) => 'npc:' + b.id === c.key),
    id = grant?.spell.id ?? ability?.spellId
  if (!id || !isM5HitSpell(id)) throw Error('本次命中后法术来源不可用')
  if(!t.hit&&id!=='lightning-arrow')throw Error('本法术须实际命中')
  const stats = combatStats(a, cs, cat)
  if (
    !a.turn.bonus ||
    e.actors[e.current]?.id !== a.id ||
    stats.dead ||
    stats.conditions.includes('incapacitated')
  )
    throw Error('须本人回合、可行动且附赠动作可用')
  if (
    character &&
    castSlotLevel(c.mode) &&
    availableSlots(character, cat, castSlotLevel(c.mode)) < 1
  )
    throw Error('实际法术位已耗尽')
  if (
    character &&
    c.mode === 'free' &&
    (!grant?.resource || (runtimeState(character, cat).resources[grant.resource] ?? 0) < 1)
  )
    throw Error('实际免费次数已耗尽')
  if (!character && (!ability || !abilityAvailable(a.npc!, ability.id)))
    throw Error('NPC实际能力次数已耗尽')
  if (
    id === 'lightning-arrow' ? !p.attack.ranged||!p.attack.weaponId : id === 'ensnaring-strike'
      ? !p.attack.weaponId
      : p.attack.ranged ||
        !(p.attack.weaponId || p.attack.id === 'unarmed' || p.attack.properties.includes('unarmed'))
  )
    throw Error('所选法术不符合本次武器／徒手及近远程条件')
  if (
    e.attackWindows?.some((w) => w.attackId === p.id && w.spellId === id && w.status !== 'canceled')
  )
    throw Error('该命中后法术已提交')
  const window: HitSpellWindow = {
    id: crypto.randomUUID(),
    attackId: p.id,
    actorId: a.id,
    targetId: t.id,
    spellId: id,
    status: 'pending',
    critical: t.critical,
  }
  const common = { areaTargets:c.areaTargets,areaEnvironments:c.areaEnvironments, actorId: a.id, env: t.env, note: c.note, attackWindowId: window.id }
  const command: CombatCommand = character
    ? {
        ...common,
        type: 'cast',
        key: c.key,
        mode: c.mode,
        targets: [t.id],
        damageType: 'radiant',
        requirementsConfirmed: true,
        triggerConfirmed: true,
      }
    : { ...common, type: 'npc-ability', abilityId: ability!.id, targetIds: [t.id], confirmed: true }
  return { window, parent: { ...clone(p), attackLocked: true }, command }
}
export function hitSpellCritical(e: Encounter, id?: string) {
  return !!id && !!e.attackWindows?.find((w) => w.id === id && w.status === 'pending')?.critical
}
export function hitSpellMinimum(e: Encounter, cs: Character[], cat: Catalogue, id?: string) {
  const window = e.attackWindows?.find((w) => w.id === id),
    parent = e.attackParents?.find((p) => p.id === window?.attackId),
    actor = e.actors.find((a) => a.id === window?.actorId),
    c = actor && combatCharacter(actor, cs),
    weapon = parent?.attack,
    row = c?.inventory.find((r) => r.instanceId === weapon?.instanceId)
  return c &&
    weapon?.weaponId &&
    !weapon.ranged &&
    row?.grip === 'two-handed' &&
    hasStyle(c.build, 'great-weapon-fighting', cat) &&
    (weapon.properties.includes('two-handed') ||
      weapon.properties.some((p) => p.startsWith('versatile')))
    ? 3
    : 1
}
export function assertHitSpellLink(
  e: Encounter,
  id: string | undefined,
  actorId: string,
  spellId: string,
) {
  if (!id) return
  const w = e.attackWindows?.find((w) => w.id === id && w.status === 'pending'),
    p = e.attackParents?.at(-1)
  if (!w || !p || w.attackId !== p.id || w.actorId !== actorId || w.spellId !== spellId)
    throw Error('命中后法术须经真实攻击窗口提交，不能伪造关联')
}
export function hitSpellCandidates(e: Encounter, cs: Character[], cat: Catalogue) {
  const p = e.pending,
    a = p && e.actors.find((a) => a.id === p.actorId)
  if (!a || !p?.id || p.kind !== 'attack' || !p.attack || p.damageRolled) return []
  const c = combatCharacter(a, cs),
    sources = c
      ? runtimeSpells(c, cat)
          .filter((g) => isM5HitSpell(g.spell.id))
          .flatMap((g) =>
            g.modes.map((mode) => ({ key: g.key, mode, id: g.spell.id, name: g.spell.name })),
          )
      : (a.npc?.abilities ?? [])
          .filter((b) => b.spellId && isM5HitSpell(b.spellId))
          .map((b) => ({ key: 'npc:' + b.id, mode: 'npc', id: b.spellId!, name: b.name }))
  return sources.flatMap((g) =>
    p.targets
      .filter((t) => t.hit||g.id==='lightning-arrow')
      .map((t) => {
        const command: Extract<CombatCommand, { type: 'hit-spell' }> = {
          type: 'hit-spell',
          actorId: a.id,
          targetId: t.id,
          attackId: p.id!,
          key: g.key,
          mode: g.mode,
          note: '确认真实命中后的即时施法',
        }
        let reason = ''
        try {
          prepareHitSpell(e, cs, cat, command)
        } catch (e) {
          reason = (e as Error).message
        }
        if (!a.turn.bonus) reason = '附赠动作已用'
        return { command, name: g.name, reason, targetIndex: p.targets.indexOf(t) }
      }),
  )
}
export function attachHitSpellDamage(
  e: Encounter,
  p: PendingAction,
  targetId: string,
  parts: DamagePart[],
) {
  if (!p.attackWindowId||p.spellId==='lightning-arrow') return false
  const w = e.attackWindows?.find((w) => w.id === p.attackWindowId && w.status === 'pending'),
    parent = e.attackParents?.at(-1),
    target = parent?.targets.find((t) => t.id === targetId)
  if (!w || !target || parent?.id !== w.attackId || targetId !== w.targetId)
    throw Error('命中后法术原攻击凭据丢失')
  target.hitSpellDamage = [...(target.hitSpellDamage ?? []), ...clone(parts)]
  w.status = 'attached'
  return true
}
export function resumeHitSpell(e: Encounter) {
  if (e.pending || !e.attackParents?.length) return
  const parent = e.attackParents.pop()!
  for (const w of e.attackWindows ?? [])
    if (w.attackId === parent.id && w.status === 'pending') w.status = 'canceled'
  e.pending = parent
}
