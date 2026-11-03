import type { Adventure, MapWorld } from './map-types'
import type { Catalogue } from './engine'
import type { SceneEffectCast } from '../persistence/scene-effects-schema'
import { runtimeSpells, castSlotLevel } from './runtime'
import { applyRuntime, runtimeDerived } from './runtime'
import { consumeNpcAbility } from './npc-abilities'
import { sceneMagicSchema } from '../persistence/scene-magic-schema'
import { sceneEffects, tokenPoint, effectEvent } from './scene-effects'
import { m1Entity } from './m1-utility'
import type { MapScene, MapToken } from './map-types'
import type { SceneEffect } from '../persistence/scene-effects-schema'
import { spellEffect, rollDamage, savingRoll, defaultEnvironment, freshTurn } from './combat-rules'
import { m3Hazard } from './m3-space-events'
import { geometryContains } from './scene-effect-geometry'
import { physicalPropagation } from './scene-propagation'
import { MAGIC_RULES } from './scene-magic-rules'
import { TERRAIN_RULES } from './scene-terrain-rules'
import { queueMagic } from './scene-magic'
import { queueTerrain, terrainTurn, terrainGeometry } from './scene-terrain'
import { m3GroundAt } from './m3-ground'
import { areaTargets, makeAreaTemplate, spellAreaSpec } from './map-area'
import { magicCrossing } from './scene-magic'
import { m3Caster as actualCaster } from './m3-world-cast'
import {
  addRestorationBuff,
  restorationBuff,
  validateRestorationChoice,
  healingRollTotal,
} from './spell-restoration'
import { restoreCondition } from './support-spells'
import { validateSupportSpell } from './support-spells'
import { m3SpellEffect, validateM3Willing } from './m3-spells'
import { validateControlTargets } from './control-spells'
import { m2ControlEffect } from './m2-control'
import { protectionBlocks } from './protection-evil'
import { combatStats } from './combat-rules'
import { sceneCreatureType } from './scene-magic'
import { equipmentLayout } from './equipment'
import type { ActiveEffect, Ability } from './types'
import type { m3Caster } from './m3-world-cast'
/** Explicit adapters, rather than treating every manual/support spell as damage.
 * Unsupported storage is rejected before either spell spends resources. */
export const STORED_SPELLS = [
  'burning-hands',
  'thunderwave',
  'shatter',
  'fireball',
  'lightning-bolt',
  'inflict-wounds',
  'cure-wounds',
  'healing-word',
  'darkness',
  'fog-cloud',
  'silence',
  'grease',
  'entangle',
  'web',
  'spike-growth',
  'sleet-storm',
  'stinking-cloud',
  'moonbeam',
  'cloud-of-daggers',
  'hunger-of-hadar',
  'aid',
  'heroism',
  'shield-of-faith',
  'mage-armor',
  'barkskin',
  'protection-from-poison',
  'protection-from-energy',
  'enhance-ability',
  'bless',
  'bane',
  'longstrider',
  'beacon-of-hope',
  'feign-death',
  'sanctuary',
  'hold-person',
  'blindness-deafness',
  'slow',
  'darkvision',
  'invisibility',
  'fly',
  'spider-climb',
  'water-breathing',
  'jump',
  'gaseous-form',
  'lesser-restoration',
  'remove-curse',
] as const
export function storedSpellSupport(cat: Catalogue) {
  return cat.spells
    .filter((s) => s.level > 0 && s.level <= 3)
    .map((s) => ({
      id: s.id,
      name: s.name,
      supported: (STORED_SPELLS as readonly string[]).includes(s.id),
      reason: (STORED_SPELLS as readonly string[]).includes(s.id)
        ? '已有明确储存释放适配器'
        : /summon|conjure-(?:fey|celestial|elemental)/.test(s.id)
          ? '召唤／M5或S阶段未开放'
          : s.id === 'dissonant-whispers'
            ? '需要目标反应逃离的专用路径适配'
            : /^Self/.test(s.range) && !spellAreaSpec(s)
              ? '自身法术不能改为任意触发者'
              : s.components.includes('GP')
                ? '尚需专用材料／物件或遗体适配'
                : '需额外选择、目标类型、GM语义或生命周期适配；当前扣费前拒绝',
    }))
}
export function validateStoredSpell(
  w: MapWorld,
  a: Adventure,
  c: ReturnType<typeof m3Caster>,
  op: SceneEffectCast,
  slot: number,
  cat: Catalogue,
) {
  const choice = op.magic?.stored
  if (!choice || !(STORED_SPELLS as readonly string[]).includes(choice.spellId))
    throw Error('该法术尚无守卫刻文储存适配器；请保留草稿，不能扣费后降级为标签')
  const grant = c.c ? runtimeSpells(c.c, cat).find((g) => g.key === choice.key) : undefined,
    ability = c.body?.abilities?.find((b) => b.id === choice.key),
    spell = grant?.spell ?? cat.spells.find((s) => s.id === ability?.spellId)
  if (
    !spell ||
    spell.id !== choice.spellId ||
    spell.level > slot ||
    spell.level > 3 ||
    !spell.level ||
    (grant ? !grant.modes.includes(choice.mode) : choice.mode !== 'npc')
  )
    throw Error('储存法术须是本人真实可用、不高于符文环级的1–3环来源')
  if ((castSlotLevel(choice.mode) || ability?.slotLevel || spell.level) > slot)
    throw Error('储存施放环级不能高于符文环级')
  validateSupportSpell(spell.id, { supportChoice: choice.supportChoice, willing: choice.willing })
  validateM3Willing(spell.id, choice.willing, true)
  return {
    grant,
    ability,
    spell,
    slot: castSlotLevel(choice.mode) || ability?.slotLevel || spell.level,
  }
}
export function payStoredSpell(
  w: MapWorld,
  a: Adventure,
  op: SceneEffectCast,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const c = actualCaster(w, a, op.casterId, cat),
    choice = validateStoredSpell(w, a, c, op, 3, cat),
    attr =
      choice.grant?.ability ?? choice.ability?.ability ?? c.body?.spellcasting?.ability ?? 'wis'
  const bonus = c.c
    ? runtimeDerived(c.c, cat).mods[attr] + Math.ceil(c.c.level / 4) + 1
    : (c.body?.spellcasting?.dc ??
        8 +
          (c.body?.templateMetadata?.proficiencyBonus ?? 2) +
          Math.floor(((c.body?.scores[attr] ?? 10) - 10) / 2)) - 8
  if (c.c)
    w.characters[w.characters.indexOf(c.c)] = applyRuntime(
      c.c,
      cat,
      {
        type: 'cast',
        key: op.magic!.stored!.key,
        mode: op.magic!.stored!.mode,
        requirementsConfirmed: true,
        deferEffects: true,
      },
      dice,
    )
  else consumeNpcAbility(c.body!, choice.ability!.id)
  const live = m1Entity(w, a, c.id)
  if (live?.c?.runtime) live.c.runtime.concentration = null
  else if (live?.body) delete live.body.concentration
  return {
    spellId: choice.spell.id,
    key: op.magic!.stored!.key,
    slotLevel: choice.slot,
    ability: attr,
    dc: 8 + bonus,
    attackBonus: bonus,
    sourceLevel: c.c?.level ?? c.body?.spellcasting?.level ?? 1,
    modifier: c.c
      ? runtimeDerived(c.c, cat).mods[attr]
      : Math.floor(((c.body?.scores[attr] ?? 10) - 10) / 2),
    supportChoice: op.magic?.stored?.supportChoice,
    willing: op.magic?.stored?.willing,
  }
}
export function fireStoredSpell(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  glyph: SceneEffect,
  target: MapToken,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const stored = glyph.magic?.stored
  if (!stored) throw Error('原储存法术数据缺失，保留符文等待修正')
  const spell = cat.spells.find((s) => s.id === stored.spellId)!
  if (!spell) throw Error('规则目录缺少储存法术')
  const now =
      w.characters.find((c) => c.id === glyph.clockSourceId)?.runtime?.hours ?? glyph.createdHour,
    p = { x: target.x, y: target.y, height: target.spatial?.height ?? 0 },
    magicRule = MAGIC_RULES[spell.id],
    terrain = TERRAIN_RULES[spell.id]
  try {
    const origin = a.m3?.entities.find((o) => o.id === glyph.anchor.id)
    magicCrossing(
      w,
      a,
      s,
      origin ? { x: origin.x + 0.5, y: origin.y + 0.5, height: origin.height } : tokenPoint(target),
      tokenPoint(target),
      glyph.sourceId,
      { spellLevel: stored.slotLevel },
    )
  } catch {
    return
  }
  if (terrain?.ground) p.height = m3GroundAt(a, s, p)
  if (magicRule || terrain || ['light', 'darkness', 'fog-cloud'].includes(spell.id)) {
    const duration = magicRule?.hours ?? terrain?.hours ?? (spell.id === 'darkness' ? 1 / 6 : 1)
    const region: SceneEffect = {
      ...glyph,
      id: crypto.randomUUID(),
      castId: crypto.randomUUID(),
      spellId: spell.id,
      name: spell.name,
      slotLevel: stored.slotLevel,
      createdHour: now,
      endsAt: duration === undefined ? undefined : now + duration,
      concentration: false,
      status: 'active',
      hidden: false,
      obscurity:
        spell.id === 'darkness'
          ? 'magical-darkness'
          : spell.id === 'fog-cloud'
            ? 'heavy'
            : magicRule && spell.id === 'hunger-of-hadar'
              ? 'absolute-darkness'
              : (terrain?.obscurity ?? 'none'),
      anchor: { kind: 'point', offsetHeight: 0 },
      geometry: terrain
        ? terrainGeometry(spell.id, p, false)
        : {
            ...p,
            shape: magicRule?.shape ?? 'sphere',
            size:
              magicRule?.size ??
              (spell.id === 'darkness'
                ? 15
                : spell.id === 'fog-cloud'
                  ? 20 * stored.slotLevel
                  : 40),
            heightFeet: magicRule?.height ?? 0,
            width: 5,
            angle: 0,
            originSpan: 1,
          },
      channels: spell.id === 'silence' ? ['sound'] : [],
      note: '守卫刻文独立释放；目标为真实触发者，持续至原法术期限',
    }
    delete region.magic
    delete region.terrain
    delete region.legacy
    delete region.light
    if (magicRule)
      region.magic = sceneMagicSchema.parse({
        dc: stored.dc,
        attackBonus: stored.attackBonus,
        createdTurn: terrainTurn(w, a, s),
        damageType: spell.id === 'hunger-of-hadar' ? 'cold' : 'radiant',
      })
    if (terrain)
      region.terrain = {
        dc: stored.dc,
        multiplier: terrain.multiplier,
        groundOnly: terrain.ground,
        plantCells: [],
        excludedCells: [],
        knownTo: [glyph.sourceId],
        supportIds: [],
        createdTurn: terrainTurn(w, a, s),
        burns: [],
        enrichment: false,
        travel: [],
        ...(spell.id === 'web' ? { webSupport: 'unsupported' as const } : {}),
      }
    if (spell.id === 'light')
      region.light = { bright: 20, dimExtra: 20, sunlight: false, magical: true, color: '#e3cc82' }
    sceneEffects(a).regions.push(region)
    effectEvent(a, region, 'created', '储存法术释放，无额外费用或来源专注')
    for (const t of s.tokens) {
      queueMagic(w, a, s, t, 'created', region.id, region)
      queueTerrain(w, a, s, t, 'created', region.id, region)
    }
    return
  }
  const profile = spellEffect(spell.id, stored.sourceLevel, stored.slotLevel),
    area = !!profile.area
  const spec = spellAreaSpec(spell),
    template = spec
      ? {
          ...makeAreaTemplate(s.grid, target, spec),
          x: target.x,
          y: target.y,
          includeOrigin: true,
          angle: glyph.magic?.angle ?? 0,
        }
      : undefined
  const candidates =
    area && template
      ? areaTargets(s, template)
          .filter((t) => t.inside && !t.blocked)
          .map((t) => t.token)
      : [target]
  // Each logical target is saved by the room transaction; manual dice aborts
  // the entire attempt until every required raw face is present.
  for (const t of candidates) {
    const entity = m1Entity(w, a, t.characterId ?? t.npcId ?? t.actorId ?? t.id)
    if (!entity) continue
    const actor = entity.actor ?? {
      id: entity.id,
      characterId: entity.c?.id ?? null,
      npc: entity.body ?? null,
      side: 'neutral' as const,
      initiative: null,
      surprised: false,
      turn: freshTurn(),
    }
    try {
      validateControlTargets(spell.id, [actor], w.characters)
    } catch {
      continue
    }
    if (['hold-person', 'blindness-deafness', 'slow'].includes(spell.id)) {
      const save = savingRoll(actor, profile.save!, defaultEnvironment(), w.characters, cat, dice)
      if (!save.autoFail && save.total >= stored.dc) continue
      const condition =
        spell.id === 'hold-person'
          ? 'paralyzed'
          : spell.id === 'blindness-deafness'
            ? stored.supportChoice
            : undefined
      if (
        condition &&
        (entity.body?.conditionImmunities.includes(condition) ||
          combatStats(actor, w.characters, cat).effects.some((f) =>
            f.conditionImmunities?.includes(condition),
          ))
      )
        continue
      const effect = storedEffect(w, glyph, spell.id, spell.name, stored.slotLevel, now, 1 / 60)
      entity.state.effects = [
        ...(entity.state.effects ?? []),
        {
          ...effect,
          ...m2ControlEffect(spell.id, stored.dc),
          condition,
          repeatSave: { ability: profile.save!, dc: stored.dc },
        },
      ]
      continue
    }
    if (spell.id === 'lesser-restoration') {
      restoreCondition(
        entity.state as { conditions: string[]; effects: ActiveEffect[] },
        stored.supportChoice!,
      )
      continue
    }
    if (spell.id === 'sanctuary') {
      entity.state.effects = [
        ...(entity.state.effects ?? []),
        {
          ...storedEffect(w, glyph, spell.id, spell.name, stored.slotLevel, now, 1 / 60),
          spellDc: stored.dc,
        },
      ]
      continue
    }
    if (spell.id === 'mage-armor' && entity.c && equipmentLayout(entity.c, cat).slots.armor?.length)
      continue
    if (
      restorationBuff(spell.id, stored.slotLevel, stored.supportChoice, stored.modifier) ||
      m3SpellEffect(spell.id)
    ) {
      if (profile.save) {
        const save = savingRoll(actor, profile.save, defaultEnvironment(), w.characters, cat, dice)
        if (!save.autoFail && save.total >= stored.dc) continue
      }
      const duration = spell.duration.match(/(\d+)\s*(minute|hour|day)/i),
        hours = duration
          ? Number(duration[1]) *
            (duration[2]!.toLowerCase() === 'day'
              ? 24
              : duration[2]!.toLowerCase() === 'hour'
                ? 1
                : 1 / 60)
          : 1 / 60,
        effect = storedEffect(w, glyph, spell.id, spell.name, stored.slotLevel, now, hours)
      if (
        !addRestorationBuff(
          entity.state as { hp: number; conditions: string[]; effects: ActiveEffect[] },
          spell,
          effect,
          stored.slotLevel,
          stored.supportChoice,
          stored.modifier,
        )
      )
        entity.state.effects = [
          ...(entity.state.effects ?? []),
          { ...effect, ...m3SpellEffect(spell.id) },
        ]
      continue
    }
    if (spell.id === 'remove-curse') {
      entity.state.effects = entity.state.effects?.filter((f) => !f.curse)
      continue
    }
    if (profile.kind === 'heal') {
      const roll = rollDamage(profile.dice!, dice),
        amount = healingRollTotal(entity.state.effects ?? [], roll) + stored.modifier
      if (entity.c)
        w.characters[w.characters.indexOf(entity.c)] = applyRuntime(
          entity.c,
          cat,
          { type: 'heal', amount: Math.max(0, amount), note: '守卫刻文储存治疗' },
          dice,
        )
      else entity.body!.hp = Math.min(entity.body!.maxHp, entity.body!.hp + Math.max(0, amount))
    } else {
      const actor = entity.actor ?? {
          id: entity.id,
          characterId: entity.c?.id ?? null,
          npc: entity.body ?? null,
          side: 'neutral' as const,
          initiative: null,
          surprised: false,
          turn: freshTurn(),
        },
        save = profile.save
          ? savingRoll(actor, profile.save, defaultEnvironment(), w.characters, cat, dice)
          : undefined,
        success = save && !save.autoFail && save.total >= stored.dc,
        roll = rollDamage(profile.dice!, dice)
      const amount = success ? (profile.half ? Math.floor(roll.total / 2) : 0) : roll.total
      if (amount) m3Hazard(w, a, entity.id, amount, profile.type ?? 'force', cat, dice)
      if (spell.id === 'thunderwave' && !success) {
        const origin = a.m3?.entities.find((o) => o.id === glyph.anchor.id),
          angle =
            (Math.atan2(
              t.y - (origin?.y ?? glyph.geometry!.y),
              t.x - (origin?.x ?? glyph.geometry!.x),
            ) *
              180) /
            Math.PI
        sceneEffects(a).hazards.push({
          id: crypto.randomUUID(),
          effectId: glyph.id,
          entityId: entity.id,
          sceneId: s.id,
          receipt: `stored-push:${glyph.id}:${entity.id}`,
          phase: 'strike',
          status: 'pending',
          turnKey: terrainTurn(w, a, s),
          distance: 0,
          rolls: save?.dice ?? [],
          total: save?.total,
          success: false,
          note: '雷鸣波失败豁免已结算，保留10尺推移窗口',
          magic: {
            dc: stored.dc,
            half: false,
            rolled: true,
            decision: 'apply',
            endsSource: false,
            push: {
              angle,
              feet: 10,
              travel: 0,
              from: { x: t.x, y: t.y, height: t.spatial?.height ?? 0 },
            },
          },
        })
      }
    }
  }
}

function storedEffect(
  w: MapWorld,
  glyph: SceneEffect,
  id: string,
  name: string,
  slot: number,
  now: number,
  hours: number,
): ActiveEffect {
  return {
    id: crypto.randomUUID(),
    key: id,
    spellId: id,
    spellLevel: slot,
    castId: crypto.randomUUID(),
    sourceId: glyph.sourceId,
    name,
    page: 0,
    clockSourceId: glyph.clockSourceId,
    concentration: false,
    endsAt: now + hours,
    expiresAt: null,
    encounterId: 'outside',
    phase: 'end',
    visibility: 'public',
    note: '守卫刻文储存法术：独立持续，不需施法者专注',
  }
}
