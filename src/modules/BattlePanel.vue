<script setup lang="ts">
import {uiDate} from './locale-format'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {abilityDisplayName,damageDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { spellPresentation } from "./runtime-presentation"
import MapTargetsButton from "./map-selection/MapTargetsButton.vue"
import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import HasteActions from './HasteActions.vue'
import AttackFeatureFields from './AttackFeatureFields.vue'
import { attackFeatureOptions } from '../core/combat-resolution-options'
import type {ControlSelection} from '../core/m2-social-controls'
import SupportSpellFields from './SupportSpellFields.vue'

import BattleResolution from './BattleResolution.vue'
import SpellAreaPicker from './SpellAreaPicker.vue'
import type { MapCombatOptions, MapTemplate } from '../core/map-types'
import AttackMethodPicker from './AttackMethodPicker.vue'
import UnarmedOptions from './UnarmedOptions.vue'
import WeaponHandlingPicker from './WeaponHandlingPicker.vue'
import { handlingPreview } from '../core/weapon-handling'
import type { WeaponHandling } from '../core/combat-types'
import { unarmedCommand } from '../core/weapon-rules'
import { useOperationFeedback } from '../app/useOperationFeedback'
import { SUMMON_FORM_NAMES } from '../core/phb-companions'
import { sourceCaption } from '../core/rule-sources'
import { srd } from '../content/srd'
import MetamagicFields from './MetamagicFields.vue'
import BattleSessionsPanel from './BattleSessionsPanel.vue'
import OriginCombatPanel from './OriginCombatPanel.vue'
import AdvancedPanel from './AdvancedPanel.vue'
import ComplexCombatPanel from './ComplexCombatPanel.vue'
import NpcMonsterActions from './NpcMonsterActions.vue'
import NpcRuleActions from './NpcRuleActions.vue'
import type { MapCommand } from '../core/map-types'
import type { PendingAction } from '../core/combat-types'
import { combatFeatures, spellTargets } from '../online/combat-controls'
import { computed, ref, watch } from 'vue'
import { useWorkshop } from '../app/store'
import { ABILITIES, ABILITY_NAMES, type Character, type Ability } from '../core/types'
import { signed, clone } from '../core/engine'
import {
  castSlotLevel,
  runtimeSpells,
  runtimeState,
  resources,
  type RuntimeCommand,
} from '../core/runtime'
import RuntimeInventory from './RuntimeInventory.vue'
import CharacterAvatar from './CharacterAvatar.vue'
import { actorPortrait } from '../core/portraits'
import { areaTargets, spellAreaSpec, makeAreaTemplate } from '../core/map-area'
import {
  attackOptions,
  combatStats,
  customNpc,
  defaultEnvironment,
  spellEffect,
} from '../core/combat-rules'
import {
  DAMAGE_NAMES,
  DAMAGE_TYPES,
  type CombatCommand,
  type Combatant,
  type Environment,
} from '../core/combat-types'
import {
  attackCategory,
  distance as mapDistance,
  mapEnvironment,
  templateCandidates,
} from '../core/map'
import { CONDITIONS } from '../content/conditions'
const handling = ref<WeaponHandling>({ before: [], after: [] })
const controlSelection = ref<ControlSelection>({}), supportChoice = ref(''),
  willing = ref(false),
  runtimeDamageTyped = ref(false)
const props = defineProps<{
  encounterId?: string
  workshop?: ReturnType<typeof useWorkshop>
  online?: boolean
  canUndo?: boolean
}>()
const store = props.workshop ?? useWorkshop(),
  emit = defineEmits<{ view: [id: string]; map: [id: string] }>()
const luckyDeath = ref(false)
const selectedId = ref(props.encounterId ?? ''),
  name = ref('林间遭遇'),
  feedback = ref(''),
  error = ref(false),
  busy = ref(false),
  importInput = ref<HTMLInputElement | null>(null)
const encounter = computed(() => store.encounters.find((e) => e.id === selectedId.value)),
  actorId = ref(''),
  targetId = ref(''),
  characterId = ref(''),
  side = ref<Combatant['side']>('party')
const actor = computed(() => encounter.value?.actors.find((a) => a.id === actorId.value)),
  target = computed(() => encounter.value?.actors.find((a) => a.id === targetId.value)),
  current = computed(() => encounter.value?.actors[encounter.value.current])
const stat = (a: Combatant) => combatStats(a, store.characters, store.content)
const actorPortraits = computed(
  () =>
    new Map(
      encounter.value?.actors.map((a) => [
        a.id,
        actorPortrait(
          {
            adventures: store.adventures,
            characters: store.characters,
            encounters: store.encounters,
            packs: store.packs,
          },
          a,
        ),
      ]),
    ),
)
const character = computed(() => store.characters.find((c) => c.id === actor.value?.characterId))
const attacks = computed(() =>
    actor.value
      ? attackOptions(
          actor.value,
          store.characters.map((c) =>
            c.id === character.value?.id ? handlingPreview(c, store.content, handling.value) : c,
          ),
          store.content,
        )
      : [],
  ),
  attackId = ref(''),
  cost = ref<Extract<CombatCommand, { type: 'attack' }>['cost']>('action'),
  sneak = ref(false),
  mastery = ref(true)
const grants = computed(() =>
    character.value ? runtimeSpells(character.value, store.content) : [],
  ),
  spellKey = ref(''),
  spell = computed(() => grants.value.find((g) => g.key === spellKey.value)),
  spellMode = ref(''),
  vigorDice = ref(1),
  ammoId = ref(''),
  ammoCount = ref(4),
  enchantedWeaponId = ref(''),
  wildCheck = ref(false),
  summonForm = ref(''),
  selectedTargets = ref<string[]>([]),
  darts = ref(['', '', '']),
  env = ref(defaultEnvironment()),
  componentsConfirmed = ref(false),
  triggerConfirmed = ref(false),
  metamagic = ref<PendingAction['metamagic']>(),
  excludedIds = ref<string[]>([]),
  chosenDamage = ref<(typeof DAMAGE_TYPES)[number]>('fire')
const selectedNpcAttack = computed(() =>
  actor.value?.npc?.attacks.find((a) => a.id === attackId.value),
)
watch(
  () => [actorId.value, attackId.value, targetId.value, encounter.value?.tick],
  () => {
    env.value.npcChargeConfirmed = false
    env.value.npcGrappleConfirmed = false
  },
)
const spellPolicy = computed(() =>
  spell.value
    ? spellTargets(
        spell.value.spell,
        spell.value.key,
        character.value?.level ?? 1,
        (castSlotLevel(spellMode.value) || spell.value.spell.level || 1) +
          (metamagic.value?.option === 'twinned' ? 1 : 0),
      )
    : null,
)
watch(
  () => [spellKey.value, spellMode.value, character.value?.level],
  () => {
    darts.value = Array.from(
      { length: spellPolicy.value?.darts ? spellPolicy.value.max : 3 },
      (_, i) => darts.value[i] ?? targetId.value,
    )
  },
)
const mapped = computed(() =>
  store.adventures
    .flatMap((a) => a.scenes.map((s) => ({ adventure: a, scene: s })))
    .find((x) => x.scene.encounterId === selectedId.value),
)
const managedAdventure = computed(
  () =>
    mapped.value?.adventure ??
    (props.online || !selectedId.value ? store.adventures.find((a) => a.activeSceneId) : undefined),
)
const managedScene = computed(() =>
  managedAdventure.value?.scenes.find((s) => s.id === managedAdventure.value?.activeSceneId),
)
watch(
  () => props.encounterId,
  (id) => {
    if (id !== undefined) selectedId.value = id
  },
)
watch(
  () => managedScene.value?.encounterId,
  (id) => {
    if (props.online) selectedId.value = id ?? ''
  },
  { immediate: true },
)
const mapOptions = ref<MapCombatOptions>({
  distance: true,
  highGround: true,
  obstacles: true,
  cover: true,
  area: true,
  reason: '',
})
const areaReport = computed(() => (mapped.value ? areaTargets(mapped.value.scene) : []))
const areaBackground = computed(() => {
  const asset = store.assets.find((a) => a.id === mapped.value?.scene.background?.assetId)
  return asset?.preview?.blob ?? asset?.blob
})
function applySpellArea(template: MapTemplate, ids: string[]) {
  mapOptions.value.template = template
  selectedTargets.value = ids.flatMap(
    (id) => mapped.value?.scene.tokens.find((t) => t.id === id)?.actorId ?? [],
  )
}
async function createSpellTemplate() {
  if (!mapped.value || !actor.value || !spell.value || busy.value) return
  const spec = spellAreaSpec(spell.value.spell),
    from = mapped.value.scene.tokens.find((t) => t.actorId === actorId.value)
  if (!spec || !from) return
  busy.value = true
  try {
    const s = clone(mapped.value.scene),
      anchor = spec.self ? from : (s.tokens.find((t) => t.actorId === targetId.value) ?? from)
    s.template = makeAreaTemplate(s.grid, anchor, spec)
    await store.mapOperate(mapped.value.adventure.id, { type: 'scene-edit', scene: s })
    feedback.value = '已按法术建立范围模板；请在地图核对原点与方向，并确认最终目标'
    error.value = false
  } catch (e) {
    feedback.value = (e as Error).message
    error.value = true
  } finally {
    busy.value = false
  }
}
const targetOverrides = ref<Record<string, { enabled: boolean; env: Environment }>>({})
watch(
  () => encounter.value?.actors.map((a) => a.id),
  (ids) => {
    for (const id of ids ?? [])
      if (!targetOverrides.value[id])
        targetOverrides.value[id] = { enabled: false, env: clone(env.value) }
  },
  { immediate: true },
)
const spatialPreview = computed(() => {
  if (!mapped.value || !actor.value || !target.value) return null
  const s = mapped.value.scene,
    from = s.tokens.find((t) => t.actorId === actorId.value),
    to = s.tokens.find((t) => t.actorId === targetId.value)
  if (!from || !to) return null
  const category =
    tab.value === 'weapon' || (tab.value === 'spell' && spell.value?.spell.id === 'true-strike')
      ? attackCategory(
          attacks.value.find((w) => w.id === attackId.value),
          !!actor.value.npc,
        )
      : spell.value &&
          spellEffect(spell.value.spell.id).kind === 'attack' &&
          spell.value.spell.range !== 'Touch'
        ? 'spell'
        : null
  try {
    return mapEnvironment(s, from, to, env.value, category, mapOptions.value)
  } catch {
    return null
  }
})
const nearbyCandidates = computed(() => {
  if (!mapped.value || !actor.value) return []
  const s = mapped.value.scene,
    from = s.tokens.find((t) => t.actorId === actorId.value)
  if (!from) return []
  return encounter
    .value!.actors.filter(
      (a) =>
        a.side !== actor.value!.side &&
        a.side !== 'neutral' &&
        !stat(a).conditions.includes('incapacitated'),
    )
    .filter((a) => {
      const t = s.tokens.find((t) => t.actorId === a.id)
      return t && mapDistance(s, from, t) <= 5
    })
    .map((a) => stat(a).name)
})
const featureId = ref(''),
  amount = ref(1),
  featureList = computed(() =>
    character.value ? combatFeatures(character.value, store.content) : [],
  )
const conversion = ref<
    'font-slot' | 'font-points' | 'font-inspiration' | 'wild-resurgence' | 'wild-slot'
  >('font-slot'),
  conversionLevel = ref(1)
watch(
  () => character.value?.id,
  () => {
    conversion.value =
      character.value?.build.classId === 'druid'
        ? 'wild-resurgence'
        : character.value?.build.classId === 'bard'
          ? 'font-inspiration'
          : 'font-slot'
  },
  { immediate: true },
)
const tab = ref<'weapon' | 'spell' | 'feature' | 'gm'>('weapon'),
  showNpc = ref(false),
  npc = ref(customNpc()),
  moveDistance = ref(5),
  difficult = ref(false),
  stand = ref(false),
  gmReason = ref(''),
  gmAmount = ref(1),
  gmCondition = ref('prone'),
  gmActive = ref(true)
const gmTargets = ref<string[]>([]),
  gmDamage = ref(0),
  gmHeal = ref(0),
  gmType = ref<(typeof DAMAGE_TYPES)[number]>('slashing'),
  gmRounds = ref(0),
  gmCost = ref<'action' | 'bonus' | 'reaction' | 'none'>('none'),
  gmEffect = ref(''),
  gmResource = ref('')
watch(
  () => [actorId.value, spell.value?.key, tab.value],
  () => {
    delete mapOptions.value.template
  },
)
watch(
  () => store.encounters.map((e) => e.id),
  (ids) => {
    const a = store.adventures.find((a) => a.activeSceneId),
      bound = a?.scenes.find((s) => s.id === a.activeSceneId)?.encounterId
    if (props.online) selectedId.value = bound ?? ''
    else if (!ids.includes(selectedId.value))
      selectedId.value =
        bound ??
        store.encounters
          .filter((e) => !e.session?.canceled && (!e.session || e.phase !== 'ended'))
          .at(-1)?.id ??
        ''
  },
  { immediate: true },
)
watch(selectedId, () => {
  actorId.value = encounter.value?.actors[encounter.value.current]?.id ?? ''
  targetId.value = encounter.value?.actors.find((a) => a.id !== actorId.value)?.id ?? ''
  gmTargets.value = actorId.value ? [actorId.value] : []
})
watch(
  () => current.value?.id,
  (id) => {
    if (id) actorId.value = id
  },
  { immediate: true },
)
watch(actorId, () => {
  targetOverrides.value = Object.fromEntries(
    (encounter.value?.actors ?? []).map((a) => [a.id, { enabled: false, env: clone(env.value) }]),
  )
  gmTargets.value = actorId.value ? [actorId.value] : []
  targetId.value = encounter.value?.actors.find((a) => a.id !== actorId.value)?.id ?? ''
  selectedTargets.value = targetId.value ? [targetId.value] : []
  darts.value = Array.from(
    { length: spellPolicy.value?.darts ? spellPolicy.value.max : 3 },
    () => targetId.value,
  )
  componentsConfirmed.value = false
  sneak.value = false
  cost.value = 'action'
})
watch(
  attacks,
  (list) => {
    if (!list.some((w) => w.id === attackId.value)) attackId.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  grants,
  (list) => {
    if (!list.some((g) => g.key === spellKey.value)) spellKey.value = list[0]?.key ?? ''
  },
  { immediate: true },
)
watch(
  spell,
  (g) => {
    metamagic.value = undefined
    excludedIds.value = []
    spellMode.value = g?.modes[0] ?? ''
    componentsConfirmed.value = false
    if (g && spellTargets(g.spell, g.key).self) selectedTargets.value = [actorId.value]
  },
  { immediate: true },
)
watch(
  featureList,
  (list) => {
    if (!list.some((g) => g.id === featureId.value)) featureId.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
const attackAllowed = ref(false)
const unarmedKind = ref<'damage' | 'grapple' | 'prone' | 'push'>('damage'),
  unarmedSave = ref<'str' | 'dex'>('str'),
  grappleHand = ref<'main-hand' | 'off-hand'>('main-hand'),
  escapeSkill = ref<'athletics' | 'acrobatics'>('athletics')
function submitAttack() {
  if (attackId.value === 'unarmed' && unarmedKind.value !== 'damage')
    void run(
      unarmedCommand(
        actorId.value,
        targetId.value,
        unarmedKind.value,
        unarmedSave.value,
        grappleHand.value,
        cost.value,
        env.value,
        handling.value,
      ),
    )
  else
    void run({
      type: 'attack',
      actorId: actorId.value,
      targetId: targetId.value,
      attackId: attackId.value,
      env: env.value,
      cost: cost.value,
      sneak: sneak.value && attackChoices.value.sneak && !attackChoices.value.sneakReason,
      mastery: mastery.value && attackChoices.value.mastery,
      handling:
        handling.value.before.length || handling.value.after.length ? handling.value : undefined,
    })
}
const attackContext = computed(() => {
  const a = actor.value,
    spec = attacks.value.find((s) => s.id === attackId.value)
  return a && spec
    ? {
        actor: a,
        currentId: current.value?.id,
        active: encounter.value?.phase === 'active',
        pending: !!encounter.value?.pending,
        character: character.value,
        cat: store.content,
        spec,
        targetDown:
          !!a.turn.lastAttack &&
          stat(encounter.value!.actors.find((t) => t.id === a.turn.lastAttack!.targetId)!).hp === 0,
      }
    : null
})
function activateFlurry() {
  void run({
    type: 'feature',
    actorId: actorId.value,
    id: 'growth/flurry',
    targetId: actorId.value,
    amount: 1,
    env: env.value,
    note: '明确启用疾风：附赠动作与 1 专注，逐次结算',
  })
}
async function run(
  command: CombatCommand,
  guard?: Extract<MapCommand, { type: 'combat' }>['resolutionGuard'],
) {
  if (!encounter.value || busy.value) return
  busy.value = true
  try {
    if (command.type === 'end' && mapped.value) {
      await store.mapOperate(mapped.value.adventure.id, {
        type: 'battle-finish',
        sceneId: mapped.value.scene.id,
        reason: 'GM 结束战斗',
      })
      selectedId.value = ''
      feedback.value = '战斗已归档，场景回到探索状态'
      error.value = false
      return
    }
    if (command.type === 'cast' || command.type === 'feature') {
      command = clone(command)
      command.targetEnvironments = Object.fromEntries(
        encounter.value.actors.map((a) => [
          a.id,
          targetOverrides.value[a.id]?.enabled
            ? clone(targetOverrides.value[a.id]!.env)
            : clone(env.value),
        ]),
      )
    }
    let next
    if (guard && mapped.value) {
      await store.mapOperate(mapped.value.adventure.id, {
        type: 'combat',
        sceneId: mapped.value.scene.id,
        command,
        resolutionGuard: guard,
      })
      next = store.encounters.find((e) => e.id === encounter.value!.id)!
    } else
      next = await store.combat(
        encounter.value.id,
        command,
        mapped.value ? mapOptions.value : undefined,
      )
    feedback.value = next.log.at(-1)?.detail ?? '已保存'
    error.value = false
  } catch (e) {
    feedback.value = e instanceof Error ? e.message : String(e)
    error.value = true
  } finally {
    busy.value = false
  }
}
async function create() {
  busy.value = true
  try {
    selectedId.value = await store.createEncounter(name.value)
    error.value = false
    feedback.value = '遭遇已创建，添加角色与 NPC 后设置先攻'
  } catch (e) {
    feedback.value = String(e)
    error.value = true
  } finally {
    busy.value = false
  }
}
function download() {
  if (!encounter.value) return
  const url = URL.createObjectURL(
      new Blob([store.exportEncounter(encounter.value.id)], { type: 'application/json' }),
    ),
    a = document.createElement('a')
  a.href = url
  a.download = encounter.value.name + '-encounter.json'
  a.click()
  URL.revokeObjectURL(url)
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  busy.value = true
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('遭遇文件不得超过 25 MB')
    selectedId.value = await store.importEncounter(JSON.parse(await file.text()))
    error.value = false
    feedback.value = '遭遇与角色已独立导入；导入前的撤销快照不恢复'
  } catch (e) {
    error.value = true
    feedback.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    input.value = ''
  }
}
async function remove() {
  if (!encounter.value || !confirm(controlText('operationResult.removeThisEncounterAndItsCombatRecordsCharacters'))) return
  busy.value = true
  try {
    await store.removeEncounter(encounter.value.id)
    feedback.value = '已移除遭遇'
    error.value = false
  } catch (e) {
    feedback.value = String(e)
    error.value = true
  } finally {
    busy.value = false
  }
}
const inventoryConfirmed = ref(false),
  inventoryCost = ref<'free' | 'action' | 'bonus'>('free'),
  saveAbility = ref<Ability>('dex'),
  saveDC = ref(10),
  savePurpose = ref<'normal' | 'concentration' | 'poison' | 'charm' | 'fear'>('normal')
async function inventoryRun(command: RuntimeCommand) {
  if (command.type === 'special-weapon' || command.type === 'mounted') {
    await run({ type: 'runtime', actorId: actorId.value, command, reason: command.reason })
    return !error.value
  }
  await run({
    type: 'inventory',
    actorId: actorId.value,
    command,
    cost: inventoryCost.value,
    requirementsConfirmed: inventoryConfirmed.value,
    note: env.value.note,
  })
  return !error.value
}
const sourceUrl = (page: number) =>
  'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=' + page
const conditionName = (id: string) => CONDITIONS.find((c) => c.id === id)?.name ?? id
const ownTurn = computed(() => current.value?.id === actor.value?.id)
watch(
  () => encounter.value?.actors.map((a) => a.id) ?? [],
  (ids) => {
    if (!ids.includes(actorId.value)) actorId.value = ids[0] ?? ''
    if (!ids.includes(targetId.value) || targetId.value === actorId.value)
      targetId.value = ids.find((id) => id !== actorId.value) ?? ''
    if (!selectedTargets.value.length && targetId.value) selectedTargets.value = [targetId.value]
    darts.value = darts.value.map((id) => (ids.includes(id) ? id : targetId.value))
  },
  { immediate: true },
)
const rollback = computed(
  () =>
    props.canUndo ||
    (mapped.value
      ? mapped.value.adventure.log.some((e) => !e.undone && e.before)
      : encounter.value?.log.some((e) => !e.undone && e.before)),
)
function swap(index: number) {
  if (!encounter.value || index <= 0) return
  const ids = encounter.value.actors.map((a) => a.id)
  ;[ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!]
  run({ type: 'order', ids })
}

useOperationFeedback(feedback, error, busy)
const attackChoices = computed(() =>
  attackFeatureOptions(
    character.value,
    actor.value?.turn,
    attacks.value.find((a) => a.id === attackId.value),
  ),
)
const npcSpellWeapons=computed(()=>(encounter.value?.actors??[]).flatMap(a=>{const c=store.characters.find(c=>c.id===a.characterId);return c?c.inventory.filter(r=>r.quantity===1&&store.content.items.find(i=>i.id===r.itemId)?.kind==='weapon').map(r=>({id:r.instanceId,ownerId:a.id,name:stat(a).name+' · '+(store.content.items.find(i=>i.id===r.itemId)?.name??r.itemId)})):(a.npc?.equipment??[]).map(g=>({id:g.id,ownerId:a.id,name:stat(a).name+' · '+(store.content.items.find(i=>i.id===g.itemId)?.name??g.itemId)}))}))
</script>
<template>
  <section class="battle-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">THE ENCOUNTER TABLE</p>
        <h1>{{ controlText('combat.table') }}</h1>
        <p class="muted">{{ controlText('combat.subtitle') }}</p>
      </div>
      <button v-if="!online" class="secondary" :disabled="busy" @click="importInput?.click()">
        {{ controlText('combat.importEncounter') }}
      </button>
    </div>
    <input
      ref="importInput"
      type="file"
      accept=".json,application/json"
      :aria-label="controlText('combat.importEncounterFile')"
      hidden
      @change="importFile"
    />
    <BattleSessionsPanel
      v-if="managedAdventure && managedScene"
      :workshop="store"
      :adventure="managedAdventure"
      :scene-id="managedScene.id"
      @select="selectedId = $event"
    />
    <div v-if="!managedAdventure" class="battle-toolbar">
      <label
        >{{ controlText('combat.encounter') }}<select v-model="selectedId" :aria-label="controlText('combat.chooseEncounter')">
          <option value="" disabled>{{ controlText('combat.chooseCreate') }}</option>
          <option
            v-for="e in store.encounters.filter((e) => !e.session?.canceled)"
            :key="e.id"
            :value="e.id"
          >
            {{ localizedEntryName(e) }} · {{ { setup: controlText('expressionTwo.preparing'), active: controlText('expressionTwo.inCombat'), ended: controlText('expressionOne.ended') }[e.phase] }}
          </option>
        </select></label
      ><label>{{ controlText('combat.newName') }}<input v-model="name" maxlength="120" /></label
      ><button
        class="primary"
        :disabled="busy || store.saving || store.readFailure"
        @click="create"
      >
        {{ controlText('combat.create') }}</button
      ><template v-if="encounter"
        ><button class="secondary" @click="download">{{ controlText('combat.export') }}</button
        ><button
          class="text-button danger"
          :disabled="busy || encounter.phase === 'active'"
          @click="remove"
        >
          {{ controlText('combat.remove') }}
        </button></template
      >
    </div>

    <div v-if="!encounter" class="battle-empty">
      <span>⚔</span>
      <h2>{{ controlText('combat.emptyTitle') }}</h2>
      <p>{{ controlText('combat.emptyHelp') }}</p>
    </div>
    <template v-else>
      <div v-if="mapped" class="mapped-battle">
        <strong>{{ localizedEntryName(mapped.adventure) }} · {{ localizedEntryName(mapped.scene) }}</strong>
        <p class="muted">
          {{ controlText('combat.mapLinkedHelp') }}
        </p>
        <button class="secondary" @click="emit('map', encounter!.id)">{{ controlText('combat.returnMap') }}</button>
      </div>
      <div class="encounter-heading">
        <h2>{{ localizedEntryName(encounter) }}</h2>
        <div class="battle-controls">
          <span class="tag">{{
            encounter.phase === 'active'
              ? controlText('expressionOne.round') + encounter.round + controlText('expressionOne.roundAlias28')
              : encounter.phase === 'setup'
                ? controlText('expressionOne.prepareEncounter')
                : controlText('broadcast.encounterEnd')
          }}</span
          ><button class="secondary" :disabled="busy || !rollback" @click="run({ type: 'undo' })">
            {{ controlText('combat.undoEncounter') }}</button
          ><button
            v-if="encounter.phase === 'setup'"
            class="primary"
            :disabled="busy"
            @click="run({ type: 'start' })"
          >
            {{ controlText('domain.startBattle') }}</button
          ><template v-if="encounter.phase === 'active'"
            ><button
              class="primary"
              :disabled="busy || !!encounter.pending"
              @click="run({ type: 'next' })"
            >
              {{ controlText('combat.endTurn') }}</button
            ><button
              class="secondary"
              :disabled="busy || !!encounter.pending"
              @click="run({ type: 'end' })"
            >
              {{ mapped ? controlText('domain.endBattle') : controlText('expressionOne.endEncounter') }}
            </button></template
          >
        </div>
      </div>
      <div v-if="encounter.phase === 'setup' && !managedAdventure" class="battle-setup">
        <div class="battle-card">
          <h3>{{ controlText('combat.addAdventurer') }}</h3>
          <label
            >{{ controlText('combat.completeCharacter') }}<select v-model="characterId">
              <option value="" disabled>{{ controlText('game.character') }}</option>
              <option
                v-for="c in store.characters.filter(
                  (c) =>
                    c.status === 'complete' &&
                    !encounter!.actors.some((a) => a.characterId === c.id),
                )"
                :key="c.id"
                :value="c.id"
              >
                {{ localizedEntryName(c.build) }}
              </option>
            </select></label
          ><label
            >{{ controlText('game.side') }}<select v-model="side">
              <option value="party">{{ controlText('combat.partySide') }}</option>
              <option value="enemy">{{ controlText('combat.enemySide') }}</option>
              <option value="neutral">{{ controlText('game.neutral') }}</option>
            </select></label
          ><button
            class="secondary"
            :disabled="busy || !characterId"
            @click="run({ type: 'add-character', characterId, side })"
          >
            {{ controlText('combat.addCharacter') }}
          </button>
        </div>
        <div class="battle-card">
          <h3>{{ controlText('combat.addNpc') }}</h3>
          <p class="muted">{{ controlText('combat.npcDataHelp') }}</p>
          <button class="secondary" @click="showNpc = !showNpc">
            {{ showNpc ? controlText('expressionOne.collapseConfiguration') : controlText('expressionOne.configureNpc') }}
          </button>
        </div>
        <div v-if="showNpc" class="battle-card npc-editor">
          <h3>{{ controlText('combat.npcData') }}</h3>
          <div class="battle-form-grid">
            <label>{{ controlText('game.npcName') }}<input v-model="npc.name" maxlength="120" /></label
            ><label
              >{{ controlText('game.creatureType') }}<select v-model="npc.creatureType" :aria-label="controlText('combat.npcType')">
                <option :value="undefined">{{ controlText('game.gmCheck') }}</option>
                <option value="humanoid">{{ controlText('game.humanoid') }}</option>
                <option value="beast">{{ controlText('game.beast') }}</option>
                <option value="monstrosity">{{ controlText('game.monstrosity') }}</option>
                <option value="fey">{{ controlText('game.fey') }}</option>
                <option value="fiend">{{ controlText('game.fiend') }}</option>
                <option value="undead">{{ controlText('game.undead') }}</option>
                <option value="other">{{ controlText('game.other') }}</option>
              </select></label
            ><label>{{ controlText('controls.armor') }}<input v-model.number="npc.ac" type="number" min="0" max="100" /></label
            ><label
              >{{ controlText('combat.maxHP') }}<input
                v-model.number="npc.maxHp"
                type="number"
                min="1"
                max="100000" /></label
            ><label
              >{{ controlText('game.speed') }}<input v-model.number="npc.speed" type="number" min="0" max="300" /></label
            ><label>{{ controlText('combat.initiativeModifier') }}<input v-model.number="npc.initiativeBonus" type="number" /></label
            ><label>{{ controlText('combat.dataSource') }}<input v-model="npc.source" /></label>
          </div>
          <div class="npc-abilities">
            <div v-for="a in ABILITIES" :key="a">
              <label
                >{{ abilityDisplayName(a) }}{{ controlText('game.abilities') }}<input
                  v-model.number="npc.scores[a]"
                  type="number"
                  min="1"
                  max="30" /></label
              ><label
                >{{ abilityDisplayName(a) }}{{ controlText('combat.saveBonus') }}<input v-model.number="npc.saves[a]" type="number"
              /></label>
            </div>
          </div>
          <div class="battle-form-grid">
            <label>{{ controlText('game.attackName') }}<input v-model="npc.attacks[0]!.name" /></label
            ><label>{{ controlText('combat.attackBonus') }}<input v-model.number="npc.attacks[0]!.bonus" type="number" /></label
            ><label
              >{{ controlText('combat.attackCategory') }}<select v-model="npc.attacks[0]!.kind">
                <option value="weapon">{{ controlText('combat.weaponAttack') }}</option>
                <option value="thrown">{{ controlText('game.thrown') }}</option>
                <option value="spell">{{ controlText('game.spellAttack') }}</option>
              </select></label
            ><label>{{ controlText('game.damageFormula') }}<input v-model="npc.attacks[0]!.damage" placeholder="1d6+1" /></label
            ><label
              >{{ controlText('game.damageType') }}<select v-model="npc.attacks[0]!.damageType">
                <option v-for="t in DAMAGE_TYPES" :key="t" :value="t">{{ damageDisplayName(t) }}</option>
              </select></label
            ><label
              >{{ controlText('combat.meleeReach') }}<input v-model.number="npc.attacks[0]!.reach" type="number" /></label
            ><label
              >{{ controlText('combat.normalRange') }}<input
                v-model.number="npc.attacks[0]!.range"
                type="number" /></label
            ><label
              >{{ controlText('combat.longRange') }}<input v-model.number="npc.attacks[0]!.longRange" type="number"
            /></label>
          </div>
          <details>
            <summary>{{ controlText('combat.damageDefenses') }}</summary>
            <div class="npc-defenses">
              <fieldset
                v-for="key in ['resistances', 'immunities', 'vulnerabilities'] as const"
                :key="key"
              >
                <legend>
                  {{ { resistances: controlText('controls.resistance'), immunities: controlText('controls.immunity'), vulnerabilities: controlText('spatial.vulnerable') }[key] }}
                </legend>
                <label v-for="t in DAMAGE_TYPES" :key="t" class="check"
                  ><input v-model="npc[key]" type="checkbox" :value="t" />{{
                    damageDisplayName(t)
                  }}</label
                >
              </fieldset>
            </div>
          </details>
          <button
            class="primary"
            :disabled="busy"
            @click="run({ type: 'add-npc', npc: { ...npc, hp: npc.maxHp }, side: 'enemy' })"
          >
            {{ controlText('combat.addEnemy') }}
          </button>
        </div>
      </div>
      <div class="battle-layout">
        <aside class="initiative-panel battle-card">
          <div class="battle-section-title">
            <h3>{{ controlText('combat.initiativeOrder') }}</h3>
            <button
              v-if="encounter.phase === 'setup'"
              class="text-button"
              :disabled="busy"
              @click="run({ type: 'roll-initiative' })"
            >
              {{ controlText('combat.rollAllInitiative') }}
            </button>
          </div>
          <p v-if="!encounter.actors.length" class="muted">{{ controlText('combat.twoParticipants') }}</p>
          <article
            v-for="(a, index) in encounter.actors"
            :key="a.id"
            class="combatant-card"
            :class="{
              current: encounter.phase === 'active' && current?.id === a.id,
              selected: actorId === a.id,
            }"
            :data-testid="'combatant-' + a.id"
          >
            <button class="combatant-select" @click="actorId = a.id">
              <CharacterAvatar
                :name="stat(a).name"
                :portrait="actorPortraits.get(a.id)"
                :size="36"
              />
              <span class="initiative-number">{{ a.initiative ?? '—' }}</span
              ><span
                ><strong>{{ localizedEntryName(stat(a)) }}</strong
                ><small
                  >{{ { party: controlText('finalField.adventurer'), enemy: controlText('game.hostile'), neutral: controlText('game.neutral') }[a.side] }} · AC
                  {{ stat(a).ac }}</small
                ></span
              >
            </button>
            <div class="combatant-hp">
              <span data-testid="combat-hp">{{ stat(a).hp }} / {{ stat(a).maxHp }} {{ controlText('domain.hp') }}</span
              ><small v-if="stat(a).temporaryHp">{{ controlText('combat.temporary') }} {{ stat(a).temporaryHp }}</small
              ><span v-if="stat(a).dead" class="danger">{{ controlText('combat.dead') }}</span>
            </div>
            <div class="hp-meter">
              <i :style="{ width: (100 * stat(a).hp) / stat(a).maxHp + '%' }"></i>
            </div>
            <div v-if="stat(a).conditions.length" class="condition-tags">
              <span v-for="id in stat(a).conditions" :key="id" class="tag">{{
                conditionName(id)
              }}</span>
            </div>
            <div v-if="encounter.phase === 'setup'" class="initiative-edit">
              <label
                >{{ controlText('controls.initiative') }}<input
                  :value="a.initiative ?? ''"
                  type="number"
                  :aria-label="localizedEntryName(stat(a)) + controlText('controls.initiative')"
                  @change="
                    run({
                      type: 'initiative',
                      actorId: a.id,
                      value:
                        ($event.target as HTMLInputElement).value === ''
                          ? null
                          : Number(($event.target as HTMLInputElement).value),
                      surprised: a.surprised,
                    })
                  " /></label
              ><label class="check"
                ><input
                  :checked="a.surprised"
                  type="checkbox"
                  @change="
                    run({
                      type: 'initiative',
                      actorId: a.id,
                      value: a.initiative,
                      surprised: ($event.target as HTMLInputElement).checked,
                    })
                  "
                />{{ controlText('combat.surprise') }}</label
              ><button
                :disabled="index === 0 || busy"
                :aria-label="controlText('combat.moveTie')"
                @click="swap(index)"
              >
                ↑</button
              ><button
                class="danger"
                :disabled="busy"
                :aria-label="controlText('game.remove') + localizedEntryName(stat(a))"
                @click="run({ type: 'remove-actor', actorId: a.id })"
              >
                ×
              </button>
            </div>
            <button v-if="a.characterId" class="text-button" @click="emit('view', a.characterId)">
              {{ controlText('combat.viewCharacter') }}
            </button>
          </article>
        </aside>
        <div class="battle-main">
          <BattleResolution
            :encounter-id="encounter.id"
            :workshop="store"
            :busy="busy"
            @command="run"
          />
          <NpcMonsterActions :zones="encounter.zones"
            v-if="actor?.npc && encounter.phase === 'active'"
            :weapons="npcSpellWeapons"
            :actor="actor"
            :targets="encounter.actors.map((a) => ({ id: a.id, name: stat(a).name }))"
            :environment="env"
            :busy="busy"
            :own-turn="current?.id === actor.id"
            :pending="!!encounter.pending"
            :tick="encounter.tick"
            @command="run"
          />
          <NpcRuleActions
            v-if="actor?.npc && encounter.phase === 'active'"
            :actor="actor"
            :tick="encounter.tick"
            :disabled="busy || !!encounter.pending || current?.id !== actor.id"
            @command="run"
          />
          <AdvancedPanel
            v-if="character && actor"
            :character="character"
            :content="store.content"
            :actor-id="actor.id"
            :targets="encounter.actors.map((a) => ({ id: a.id, name: stat(a).name }))"
            :pending-count="encounter.pending?.targets.length"
            :own-turn="current?.id === actor.id"
            :busy="busy"
            :environment="env"
            @combat="run"
          />
          <OriginCombatPanel
            :character="character"
            :content="store.content"
            :actor-id="actorId"
            :actors="
              encounter.actors.map((a) => ({
                id: a.id,
                name: combatStats(a, store.characters, store.content).name,
                characterId: a.characterId,
              }))
            "
            :current-id="encounter.actors[encounter.current]?.id ?? ''"
            :pending="encounter.pending"
            :env="env"
            :busy="busy"
            @execute="run"
          />
          <ComplexCombatPanel
            v-if="actor"
            :encounter="encounter"
            :characters="store.characters"
            :content="store.content"
            :actor-id="actorId"
            :target-id="targetId"
            :env="env"
            :busy="busy"
            @execute="run"
          />
          <section v-if="actor && encounter.phase === 'active'" class="battle-card action-panel">
            <div class="battle-section-title">
              <h3>
                <CharacterAvatar
                  :name="stat(actor).name"
                  :portrait="actorPortraits.get(actor.id)"
                  :size="32"
                />
                {{ localizedEntryName(stat(actor)) }}{{ controlText('field.sAction') }}
              </h3>
              <span class="tag">{{ ownTurn ? controlText('domain.currentTurn') : controlText('expressionOne.reactionGmRulingAvailable') }}</span>
            </div>
            <div class="turn-budget">
              <span :class="{ spent: !actor.turn.action }"
                >{{ controlText('controls.action') }} {{ actor.turn.action ? controlText('controls.enabledState') : controlText('controls.usedState')
                }}{{ actor.turn.attacksLeft ? controlText('expressionOne.remainingAttacks') + actor.turn.attacksLeft : '' }}</span
              ><span :class="{ spent: !actor.turn.bonus }"
                >{{ controlText('game.bonus') }} {{ actor.turn.bonus ? controlText('controls.enabledState') : controlText('controls.usedState') }}</span
              ><span :class="{ spent: !actor.turn.reaction }"
                >{{ controlText('controls.reaction') }} {{ actor.turn.reaction ? controlText('controls.enabledState') : controlText('controls.usedState') }}</span
              ><span
                >{{ controlText('combat.remainingMovement') }}
                {{ Math.max(0, stat(actor).speed + actor.turn.dash - actor.turn.movement) }}
                {{ controlText('game.feet') }}</span
              >
            </div>
            <HasteActions :actor-id="actor.id" :enabled="stat(actor).effects.some(f=>f.key==='haste')" :used="actor.turn.manualUsed?.includes('haste-action')??false" :disabled="busy||!!encounter.pending||encounter.actors[encounter.current]?.id!==actor.id" @command="run" />
            <nav class="battle-tabs" :aria-label="controlText('combat.combatActions')">
              <button
                v-for="t in ['weapon', 'spell', 'feature', 'gm'] as const"
                :key="t"
                :class="{ active: tab === t }"
                @click="tab = t"
              >
                {{
                  { weapon: controlText('combat.weaponAttack'), spell: controlText('operations.castSpell'), feature: controlText('finalField.characterAbility'), gm: controlText('state.gmRuling') }[t]
                }}
              </button>
            </nav>
            <div v-if="tab === 'weapon'" class="battle-form-grid">
              <label v-if="selectedNpcAttack?.proneRequiresCharge" class="check"
                ><input
                  v-model="env.npcChargeConfirmed"
                  type="checkbox"
                />{{ controlText('combat.chargeConfirm') }}</label
              >
              <label v-if="selectedNpcAttack?.advantageWhileGrappling" class="check"
                ><input
                  v-model="env.npcGrappleConfirmed"
                  type="checkbox"
                />{{ controlText('combat.grappleConfirm') }}</label
              >
              <label
                >{{ controlText('game.attackMode') }}<select v-model="attackId" :aria-label="controlText('game.attackMode')">
                  <option v-for="w in attacks" :key="w.id" :value="w.id">
                    {{ localizedEntryName(w) }} · {{ signed(w.bonus) }} · {{ w.damage }}
                  </option>
                </select></label
              ><label
                >{{ controlText('controls.target') }}<MapFieldPicker kind="entity"><select v-model="targetId">
                  <option
                    v-for="a in encounter.actors.filter((a) => a.id !== actorId)"
                    :key="a.id"
                    :value="a.id"
                  >
                    {{ localizedEntryName(stat(a)) }}
                  </option>
                </select></MapFieldPicker></label
              >
              <AttackMethodPicker
                v-model="cost"
                v-model:available="attackAllowed"
                :context="attackContext"
                :busy="busy"
                @activate-flurry="activateFlurry"
              />
              <UnarmedOptions
                v-if="character"
                v-model:kind="unarmedKind"
                v-model:save="unarmedSave"
                v-model:hand="grappleHand"
                v-model:skill="escapeSkill"
                :character="character"
                :content="store.content"
                :busy="busy || !!encounter.pending"
                :show-choice="attackId === 'unarmed'"
                @release="(targetId) => run({ type: 'grapple-release', actorId, targetId })"
                @escape="
                  (sourceId) =>
                    run({ type: 'grapple-escape', actorId, sourceId, skill: escapeSkill, env })
                "
              />
              <div v-if="actor?.npc" class="room-row">
                <template v-for="f in actor.npc.effects.filter((f) => f.grapple)" :key="f.id"
                  ><button
                    type="button"
                    :disabled="busy || !!encounter.pending || !ownTurn"
                    @click="
                      run({
                        type: 'grapple-escape',
                        actorId,
                        sourceId: f.sourceId,
                        skill: 'athletics',
                        env,
                      })
                    "
                  >
                    {{ controlText('combat.npcEscapeAthletics') }}</button
                  ><button
                    type="button"
                    :disabled="busy || !!encounter.pending || !ownTurn"
                    @click="
                      run({
                        type: 'grapple-escape',
                        actorId,
                        sourceId: f.sourceId,
                        skill: 'acrobatics',
                        env,
                      })
                    "
                  >
                    {{ controlText('combat.npcEscapeAcrobatics') }}
                  </button></template
                >
              </div>
              <WeaponHandlingPicker
                v-if="character"
                v-model="handling"
                :character="character"
                :content="store.content"
                :busy="busy || !!encounter.pending"
                :cost="cost"
              />
              <AttackFeatureFields
                v-model:sneak="sneak"
                v-model:mastery="mastery"
                :character="character"
                :turn="actor?.turn"
                :attack="attacks.find((a) => a.id === attackId)"
                :busy="busy || !!encounter.pending"
              />
            </div>
            <template v-if="tab === 'spell'"
              ><p v-if="!grants.length" class="muted">
                {{ controlText('combat.noSpellsHelp') }}
              </p>
              <div v-else class="battle-form-grid">
                <label
                  >{{ controlText('game.spellSource') }}<select v-model="spellKey" :aria-label="controlText('game.spellSource')">
                    <option v-for="g in grants" :key="g.key" :value="g.key">
                      {{ localizedEntryName(g.spell) }} · {{ g.source }}
                    </option>
                  </select></label
                ><label
                  >{{ controlText('domain.castMethod') }}<select v-model="spellMode">
                    <option v-for="mode in spell?.modes" :key="mode" :value="mode">
                      {{
                        {
                          slot: controlText('finalField.levelSpellSlot'),
                          free: controlText('state.freeUses'),
                          cantrip: controlText('domain.cantrips'),
                          ritual: controlText('finalField.ritualOutsideCombat'),
                          'at-will': controlText('state.atWill'),
                        }[mode] ?? mode
                      }}
                    </option>
                  </select></label
                >
              </div>
              <label v-if="spell?.spell.id === 'arcane-vigor'"
                >{{ controlText('game.arcaneVigor') }}<input
                  v-model.number="vigorDice"
                  type="number"
                  min="1"
                  max="3"
                  :aria-label="controlText('game.arcaneVigor')"
              /></label>
              <label v-if="character?.build.choices.subclass?.includes('wild-magic')" class="check"
                ><input v-model="wildCheck" type="checkbox" />{{ controlText('combat.wildMagic') }}</label
              >
              <label v-if="spell?.spell.id.startsWith('summon-')"
                >{{ controlText('game.spirit') }}<select v-model="summonForm" :aria-label="controlText('game.spirit')">
                  <option value="">{{ controlText('game.choose') }}</option>
                  <option
                    v-for="f in spell.spell.id === 'summon-beast'
                      ? ['air', 'land', 'water']
                      : spell.spell.id === 'summon-fey'
                        ? ['fuming', 'mirthful', 'tricksy']
                        : ['ghostly', 'putrid', 'skeletal']"
                    :key="f"
                    :value="f"
                  >
                    {{ uiLabel(SUMMON_FORM_NAMES[f]) ?? f }}
                  </option>
                </select></label
              >
              <SupportSpellFields v-model:control="controlSelection" :targets="encounter.actors.map(a=>({id:a.id,name:stat(a).name}))" :selected-ids="selectedTargets"
                :spell-id="spell?.spell.id"
                v-model:choice="supportChoice"
                v-model:willing="willing"
              />
              <MetamagicFields
                v-model="metamagic"
                :character="character"
                :targets="encounter.actors.map((a) => ({ id: a.id, name: stat(a).name }))"
              />
              <label v-if="spell?.spell.id === 'cordon-of-arrows'"
                >{{ controlText('game.cordonAmmo') }}<select v-model="ammoId" :aria-label="controlText('game.cordonAmmo')">
                  <option value="">{{ controlText('game.choose') }}</option>
                  <option
                    v-for="row in character?.inventory.filter((x) =>
                      ['arrow', 'bolt'].includes(x.itemId),
                    )"
                    :key="row.instanceId"
                    :value="row.instanceId"
                  >
                    {{ row.itemId === 'arrow' ? controlText('expressionOne.arrows') : controlText('expressionOne.bolts') }} ×{{ row.quantity }}
                  </option>
                </select></label
              >
              <label v-if="spell?.spell.id === 'cordon-of-arrows'"
                >{{ controlText('game.fixedAmmo') }}<input
                  v-model.number="ammoCount"
                  type="number"
                  min="1"
                  :max="4 + Math.max(0, castSlotLevel(spellMode) - 2) * 2"
                  :aria-label="controlText('game.fixedAmmo')"
              /></label>
              <label v-if="['magic-weapon', 'elemental-weapon'].includes(spell?.spell.id ?? '')"
                >{{ controlText('combat.targetMagicWeapon') }}<select v-model="enchantedWeaponId" :aria-label="controlText('combat.magicWeapon')">
                  <option value="">{{ controlText('game.choose') }}</option>
                  <option
                    v-for="row in store.characters
                      .find((c) => c.id === target?.characterId)
                      ?.inventory.filter((x) =>
                        store.content.items.some((i) => i.id === x.itemId && i.kind === 'weapon'),
                      )"
                    :key="row.instanceId"
                    :value="row.instanceId"
                  >
                    {{ localizedEntryName(store.content.items.find((i) => i.id === row.itemId)) }} ·
                    {{ row.instanceId.slice(-6) }}
                  </option>
                </select></label
              >
              <fieldset
                v-if="['spirit-guardians', 'cordon-of-arrows'].includes(spell?.spell.id ?? '')"
              >
                <legend>{{ controlText('combat.spiritGuardiansExclude') }}</legend>
                <MapTargetsButton v-model="excludedIds" :items="(((encounter.actors) ?? [])??[]).map(a=>({id:a.id,name:stat(a).name}))" /><label v-for="a in encounter.actors" :key="a.id" class="check"
                  ><input v-model="excludedIds" type="checkbox" :value="a.id" />{{
                    localizedEntryName(stat(a))
                  }}</label
                >
              </fieldset>
              <p
                v-if="['moonbeam', 'spirit-guardians'].includes(spell?.spell.id ?? '')"
                class="muted"
              >
                {{ controlText('combat.ongoingAreaHelp') }}
              </p>
              <template v-if="spell"
                ><div class="spell-rule-box">
                  <p>
                    <strong>{{ spell.spell.english }}</strong> · {{ spellPresentation(spell.spell).castingTime }} ·
                    {{ spellPresentation(spell.spell).range }} · {{ spellPresentation(spell.spell).duration }}
                  </p>
                  <span class="tag">{{
                    spellEffect(spell.spell.id).kind === 'manual' ? controlText('expressionOne.stepByStepGmRuling') : controlText('domain.ruleResolution')
                  }}</span>
                  <p v-if="spellEffect(spell.spell.id).note" class="muted">
                    {{ spellEffect(spell.spell.id).note }}
                  </p>
                  <details>
                    <summary>{{ controlText('combat.viewSpell') }}</summary>
                    <p class="rule-description">{{ spellPresentation(spell.spell).description }}</p>
                    <p v-if="spell.spell.source.pack !== srd.id">
                      {{ sourceCaption(spell.spell.source) }}
                    </p>
                    <a
                      v-else
                      :href="sourceUrl(spell.spell.source.page)"
                      target="_blank"
                      rel="noopener"
                      >SRD 5.2.1 p.{{ spell.spell.source.page }}</a
                    >
                  </details>
                </div>
                <div v-if="spellPolicy?.darts" class="battle-form-grid">
                  <label v-for="(_, i) in darts" :key="i"
                    >{{ controlText('game.projectile') }} {{ i + 1 }} {{ controlText('controls.target') }}<MapFieldPicker kind="entity"><select v-model="darts[i]">
                      <option v-for="a in encounter.actors" :key="a.id" :value="a.id">
                        {{ localizedEntryName(stat(a)) }}
                      </option>
                    </select></MapFieldPicker></label
                  >
                </div>
                <fieldset v-else class="target-choice">
                  <legend>{{ controlText('combat.gmTarget') }}</legend>
                  <MapTargetsButton v-model="selectedTargets" :items="(((encounter.actors) ?? [])??[]).map(a=>({id:a.id,name:stat(a).name}))" /><label v-for="a in encounter.actors" :key="a.id" class="check"
                    ><input v-model="selectedTargets" type="checkbox" :value="a.id" />{{
                      localizedEntryName(stat(a))
                    }}</label
                  >
                </fieldset>
                <label
                  v-if="
                    [
                      'chromatic-orb',
                      'sorcerous-burst',
                      'true-strike',
                      'elemental-weapon',
                    ].includes(spell.spell.id) ||
                    (character?.build.choices.subclass?.includes('great-old-one') &&
                      /^(class-|subclass:|tome-)/.test(spell.key))
                  "
                  >{{ controlText('combat.chooseDamage') }}<select v-model="chosenDamage">
                    <option v-for="t in DAMAGE_TYPES" :key="t" :value="t">
                      {{ damageDisplayName(t) }}
                    </option>
                  </select></label
                ><label v-if="['true-strike', 'shillelagh'].includes(spell.spell.id)"
                  >{{ controlText('combat.heldWeapon') }}<select v-model="attackId">
                    <option
                      v-for="w in attacks.filter((w) => w.weaponId)"
                      :key="w.id"
                      :value="w.id"
                    >
                      {{ localizedEntryName(w) }}
                    </option>
                  </select></label
                ><label class="check"
                  ><input
                    v-model="componentsConfirmed"
                    type="checkbox"
                  />{{ controlText('combat.componentsConfirmed') }}</label
                ><label
                  v-if="/Reaction|immediately after/i.test(spell.spell.castingTime)"
                  class="check"
                  ><input v-model="triggerConfirmed" type="checkbox" />{{ controlText('combat.triggerConfirmed') }}</label
                ></template
              ></template
            >
            <div v-if="tab === 'feature'" class="battle-form-grid">
              <label
                >{{ controlText('game.features') }}<select v-model="featureId">
                  <option v-for="r in featureList" :key="r.id" :value="r.id">
                    {{ localizedEntryName(r)
                    }}{{
                      r.id.startsWith('growth/')
                        ? controlText('expressionOne.stepByStepGmRulingAlias38')
                        : controlText('expressionOne.remaining') +
                          (character ? runtimeState(character, store.content).resources[r.id] : 0)
                    }}
                  </option>
                </select></label
              ><label
                >{{ controlText('controls.target') }}<MapFieldPicker kind="entity"><select v-model="targetId">
                  <option v-for="a in encounter.actors" :key="a.id" :value="a.id">
                    {{ localizedEntryName(stat(a)) }}
                  </option>
                </select></MapFieldPicker></label
              ><label>{{ controlText('combat.pointsSpent') }}<input v-model.number="amount" type="number" min="1" /></label>
              <p v-if="featureId" class="muted">
                {{ featureList.find((r) => r.id === featureId)?.detail }}
              </p>
            </div>
            <details
              v-if="
                tab === 'feature' &&
                character &&
                ((character.level >= 2 && character.build.classId === 'sorcerer') ||
                  (character.level >= 5 && ['druid', 'bard'].includes(character.build.classId)))
              "
            >
              <summary>{{ controlText('combat.resourceConversion') }}</summary>
              <label
                >{{ controlText('game.featureConversion') }}<select v-model="conversion" :aria-label="controlText('game.combatConversion')">
                  <template v-if="character.build.classId === 'sorcerer'"
                    ><option value="font-slot">{{ controlText('game.createSlots') }}</option>
                    <option value="font-points">{{ controlText('game.slotsToPoints') }}</option></template
                  ><template v-else-if="character.build.classId === 'druid'"
                    ><option value="wild-resurgence">{{ controlText('game.slotToWild') }}</option>
                    <option value="wild-slot">{{ controlText('game.wildToSlot') }}</option></template
                  >
                  <option v-if="character.build.classId === 'bard'" value="font-inspiration">
                    {{ controlText('game.fontInspiration') }}
                  </option>
                </select></label
              ><label
                >{{ controlText('game.conversionLevel') }}<select v-model.number="conversionLevel" :aria-label="controlText('game.combatConversionLevel')">
                  <option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ controlText('quantity.spellLevel', {p0:(l)}) }}</option>
                </select></label
              ><button
                class="secondary"
                :disabled="busy || !!encounter.pending || !ownTurn"
                @click="
                  run({
                    type: 'convert',
                    actorId,
                    command: { type: 'recover', id: conversion, slotLevel: conversionLevel },
                  })
                "
              >
                {{ controlText('combat.convert') }}
              </button>
              <p class="muted">{{ controlText('combat.conversionHelp') }}</p>
            </details>
            <fieldset v-if="tab === 'feature' && featureId === 'breath'" class="target-choice">
              <legend>{{ controlText('combat.breathTargets') }}</legend>
              <MapTargetsButton v-model="selectedTargets" :items="(((encounter.actors) ?? [])??[]).map(a=>({id:a.id,name:stat(a).name}))" /><label v-for="a in encounter.actors" :key="a.id" class="check"
                ><input v-model="selectedTargets" type="checkbox" :value="a.id" />{{
                  localizedEntryName(stat(a))
                }}</label
              >
            </fieldset>
            <template v-if="tab === 'gm'"
              ><p class="muted">
                {{ controlText('combat.gmAdjustmentHelp') }}
              </p>
              <fieldset class="target-choice">
                <legend>{{ controlText('combat.rulingTarget') }}</legend>
                <label v-for="a in encounter.actors" :key="a.id" class="check"
                  ><input v-model="gmTargets" type="checkbox" :value="a.id" />{{
                    localizedEntryName(stat(a))
                  }}</label
                >
              </fieldset>
              <div class="battle-form-grid">
                <label
                  >{{ controlText('combat.rawDamage') }}<input
                    v-model.number="gmDamage"
                    type="number"
                    min="0" /></label
                ><label
                  >{{ controlText('game.damageType') }}<select v-model="gmType">
                    <option v-for="t in DAMAGE_TYPES" :key="t" :value="t">
                      {{ damageDisplayName(t) }}
                    </option>
                  </select></label
                ><label>{{ controlText('game.healAmount') }}<input v-model.number="gmHeal" type="number" min="0" /></label
                ><label
                  >{{ controlText('combat.conditionEffect') }}<select v-model="gmEffect">
                    <option value="">{{ controlText('combat.noCondition') }}</option>
                    <option
                      v-for="c in CONDITIONS.filter((c) => c.id !== 'exhaustion')"
                      :key="c.id"
                      :value="c.id"
                    >
                      {{ localizedEntryName(c) }}
                    </option>
                  </select></label
                ><label
                  >{{ controlText('game.durationRounds') }}<input
                    v-model.number="gmRounds"
                    type="number"
                    min="0" /></label
                ><label
                  >{{ controlText('combat.actionCost') }}<select v-model="gmCost">
                    <option value="none">{{ controlText('combat.noActionGm') }}</option>
                    <option value="action">{{ controlText('controls.action') }}</option>
                    <option value="bonus">{{ controlText('controls.bonus') }}</option>
                    <option value="reaction">{{ controlText('controls.reaction') }}</option>
                  </select></label
                >
              </div>
              <details>
                <summary>{{ controlText('combat.gmSaveAssistant') }}</summary>
                <div class="battle-form-grid">
                  <label
                    >{{ controlText('combat.saveAbility') }}<select v-model="saveAbility">
                      <option v-for="a in ABILITIES" :key="a" :value="a">
                        {{ abilityDisplayName(a) }}
                      </option>
                    </select></label
                  ><label
                    >{{ controlText('combat.saveDC') }}<input v-model.number="saveDC" type="number" min="1" max="100" /></label
                  ><label
                    >{{ controlText('combat.savePurpose') }}<select v-model="savePurpose">
                      <option value="normal">{{ controlText('combat.general') }}</option>
                      <option value="concentration">{{ controlText('combat.concentration') }}</option>
                      <option value="poison">{{ controlText('combat.poison') }}</option>
                      <option value="charm">{{ controlText('combat.charmed') }}</option>
                      <option value="fear">{{ controlText('combat.frightened') }}</option>
                    </select></label
                  >
                </div>
                <p class="muted">
                  {{ controlText('combat.saveHelperHelp') }}
                </p>
                <button
                  class="secondary"
                  :disabled="busy || !!encounter.pending || !gmReason.trim()"
                  @click="
                    run({
                      type: 'save',
                      actorId,
                      ability: saveAbility,
                      dc: saveDC,
                      env,
                      purpose: savePurpose,
                      note: gmReason,
                    })
                  "
                >
                  {{ controlText('combat.rollRuleSave') }}
                </button>
              </details>
              <label>{{ controlText('combat.rulingReason') }}<textarea v-model="gmReason" rows="2" /></label>
              <div class="battle-form-grid">
                <label>{{ controlText('combat.adjustmentValue') }}<input v-model.number="gmAmount" type="number" min="1" /></label
                ><label
                  >{{ controlText('game.conditions') }}<select v-model="gmCondition">
                    <option
                      v-for="c in CONDITIONS.filter((c) => c.id !== 'exhaustion')"
                      :key="c.id"
                      :value="c.id"
                    >
                      {{ localizedEntryName(c) }}
                    </option>
                  </select></label
                >
              </div>
              <label class="check"
                ><input v-model="gmActive" type="checkbox" />{{ controlText('combat.addCondition') }}</label
              >
              <button
                class="primary"
                :disabled="busy || !!encounter.pending || !gmReason.trim() || !gmTargets.length"
                @click="
                  run({
                    type: 'adjudicate',
                    actorId,
                    targetIds: gmTargets,
                    damage: gmDamage,
                    damageType: gmType,
                    heal: gmHeal,
                    condition: gmEffect,
                    active: gmActive,
                    rounds: gmRounds,
                    cost: gmCost,
                    note: gmReason,
                  })
                "
              >
                {{ controlText('combat.submitGmResult') }}
              </button>
              <details v-if="character">
                <summary>{{ controlText('combat.resourceItems') }}</summary>
                <label
                  >{{ controlText('game.resources') }}<select v-model="gmResource">
                    <option value="" disabled>{{ controlText('combat.chooseResource') }}</option>
                    <option
                      v-for="r in resources(character, store.content)"
                      :key="r.id"
                      :value="r.id"
                    >
                      {{ controlText('quantity.current', {p0:(localizedEntryName(r)),p1:(runtimeState(character, store.content).resources[r.id])}) }}
                    </option>
                  </select></label
                ><button
                  class="secondary"
                  :disabled="busy || !!encounter.pending || !gmResource || !gmReason.trim()"
                  @click="
                    run({
                      type: 'runtime',
                      actorId,
                      command: {
                        type: 'resource-set',
                        id: gmResource,
                        amount: gmAmount,
                        reason: gmReason,
                      },
                      reason: gmReason,
                    })
                  "
                >
                  {{ controlText('combat.setResource') }}
                </button>
                <p class="muted">{{ controlText('combat.specialCostHelp') }}</p>
              </details>
              <label
                v-if="
                  character && (runtimeState(character, store.content).resources.lucky ?? 0) > 0
                "
                class="check"
                ><input
                  v-model="luckyDeath"
                  type="checkbox"
                  :aria-label="controlText('combat.deathLucky')"
                />{{ controlText('combat.deathLuckyHelp') }}</label
              >
              <label
                ><input
                  v-model="runtimeDamageTyped"
                  type="checkbox"
                />{{ controlText('combat.resistancePending') }}</label
              ><select v-if="runtimeDamageTyped" v-model="gmType" :aria-label="controlText('combat.gmDamageType')">
                <option v-for="t in DAMAGE_TYPES" :key="t" :value="t">{{ damageDisplayName(t) }}</option>
              </select>
              <p class="muted">
                {{ controlText('combat.resolvedDamageHelp') }}
              </p>
              <div class="battle-controls">
                <button
                  class="secondary"
                  :disabled="busy || !!encounter.pending || !actor.characterId"
                  @click="
                    run({
                      type: 'runtime',
                      actorId,
                      command: {
                        type: 'damage',
                        amount: gmAmount,
                        damageType: runtimeDamageTyped ? gmType : undefined,
                        note: gmReason,
                      },
                      reason: gmReason,
                    })
                  "
                >
                  {{ controlText('combat.recordDamage') }}</button
                ><button
                  class="secondary"
                  :disabled="busy || !!encounter.pending || !actor.characterId"
                  @click="
                    run({
                      type: 'runtime',
                      actorId,
                      command: { type: 'heal', amount: gmAmount, note: gmReason },
                      reason: gmReason,
                    })
                  "
                >
                  {{ controlText('combat.recordHealing') }}</button
                ><button
                  class="secondary"
                  :disabled="busy || !!encounter.pending || !actor.characterId"
                  @click="
                    run({
                      type: 'runtime',
                      actorId,
                      command: { type: 'condition', id: gmCondition, active: gmActive },
                      reason: gmReason,
                    })
                  "
                >
                  {{ controlText('combat.submitCondition') }}</button
                ><button
                  class="secondary"
                  :disabled="busy || !!encounter.pending || !actor.characterId"
                  @click="run({ type: 'death-save', actorId, lucky: luckyDeath })"
                >
                  {{ controlText('combat.deathSave') }}</button
                ><button
                  class="secondary"
                  :disabled="busy || !actor.characterId"
                  @click="run({ type: 'concentration', actorId })"
                >
                  {{ controlText('game.resolveConcentration') }}
                </button>
              </div></template
            >
            <details open class="environment-panel">
              <summary>{{ controlText('combat.distanceEnvironment') }}</summary>
              <template v-if="mapped"
                ><div class="mapped-battle">
                  <p v-if="spatialPreview">
                    {{ controlText('quantity.feetDetail', {p0:(controlText('combat.mapDistance')),p1:(spatialPreview.distance),p2:(spatialPreview.attackAdvantages?.join('；') || controlText('expressionOne.noHighGroundAttackAdvantageSource'))}) }}
                  </p>
                  <p v-if="spatialPreview" class="muted">{{ spatialPreview.spatial }}</p>
                  <p>
                    {{ controlText('combat.nearbyEnemyCandidates') }}{{ nearbyCandidates.join('、') || controlText('expressionOne.noneYet') }}{{ controlText('combat.enemyEligibilityHelp') }}
                  </p>
                  <label class="check"
                    ><input
                      v-model="mapOptions.distance"
                      type="checkbox"
                    />{{ controlText('combat.mapTargetDistance') }}</label
                  ><label class="check"
                    ><input
                      v-model="mapOptions.highGround"
                      type="checkbox"
                    />{{ controlText('combat.mapHighGround') }}</label
                  ><label class="check"
                    ><input
                      v-model="mapOptions.obstacles"
                      type="checkbox"
                    />{{ controlText('game.wallsSight') }}</label
                  ><label
                    v-if="
                      !mapOptions.distance ||
                      !mapOptions.highGround ||
                      !mapOptions.obstacles ||
                      !mapOptions.cover ||
                      !mapOptions.area
                    "
                    >{{ controlText('combat.overrideReason') }}<textarea
                      v-model="mapOptions.reason"
                      rows="2"
                      :placeholder="controlText('combat.overridePlaceholder')"
                    /></label
                  ><button
                    v-if="mapped.scene.template"
                    class="secondary"
                    @click="
                      selectedTargets = templateCandidates(mapped.scene).flatMap((t) =>
                        t.actorId ? [t.actorId] : [],
                      )
                    "
                  >
                    {{ controlText('combat.areaCandidates') }}
                  </button>
                  <button
                    v-if="tab === 'spell' && spell && spellAreaSpec(spell.spell)"
                    class="secondary"
                    @click="createSpellTemplate"
                  >
                    {{ controlText('combat.createSpellTemplate') }}
                  </button>
                  <SpellAreaPicker
                    :background-blob="areaBackground"
                    v-if="tab === 'spell' && spell && actor"
                    :scene="mapped.scene"
                    :caster-id="mapped.scene.tokens.find((t) => t.actorId === actorId)?.id ?? ''"
                    :spell="spell.spell"
                    :busy="busy"
                    gm
                    :allowed-ids="
                      mapped.scene.tokens
                        .filter((t) => encounter?.actors.some((a) => a.id === t.actorId))
                        .map((t) => t.id)
                    "
                    @apply="applySpellArea"
                    @clear="delete mapOptions.template"
                  />
                  <label class="check"
                    ><input v-model="mapOptions.cover" type="checkbox" />{{ controlText('game.mapCover') }}</label
                  >
                  <label class="check"
                    ><input
                      v-model="mapOptions.area"
                      type="checkbox"
                    />{{ controlText('combat.checkCurrentLine') }}</label
                  >
                  <p v-if="mapped.scene.template">
                    {{ controlText('combat.areaReachable') }}{{
                      areaReport
                        .filter((r) => r.eligible)
                        .map((r) => localizedEntryName(r.token))
                        .join('、') || controlText('expressionOne.noneYet')
                    }}{{ controlText('combat.areaBlocked') }}{{
                      areaReport
                        .filter((r) => r.blocked)
                        .map((r) => localizedEntryName(r.token))
                        .join('、') || controlText('expressionOne.noneYet')
                    }}{{ controlText('combat.templateMatch') }}
                  </p>
                </div></template
              >
              <div class="battle-form-grid">
                <label
                  >{{ controlText('combat.distance') }}<input
                    v-model.number="env.distance"
                    :disabled="!!mapped && mapOptions.distance"
                    type="number"
                    min="0"
                    max="10000" /></label
                ><label
                  >{{ controlText('combat.targetCover') }}<select v-model="env.cover">
                    <option value="none">{{ controlText('game.noCover') }}</option>
                    <option value="half">{{ controlText('combat.halfCover') }}</option>
                    <option value="three-quarters">{{ controlText('combat.threeQuarterCover') }}</option>
                    <option value="total">{{ controlText('game.fullCover') }}</option>
                  </select></label
                >
              </div>
              <div class="environment-checks">
                <label class="check"
                  ><input v-model="env.attackerSees" type="checkbox" />{{ controlText('combat.actorSees') }}</label
                ><label class="check"
                  ><input v-model="env.targetSees" type="checkbox" />{{ controlText('combat.targetSees') }}</label
                ><label class="check"
                  ><input
                    v-model="env.nearbyEnemy"
                    type="checkbox"
                  />{{ controlText('combat.nearbyEnemy') }}</label
                ><label class="check"
                  ><input v-model="env.advantage" type="checkbox" />{{ controlText('combat.advantage') }}</label
                ><label class="check"
                  ><input v-model="env.disadvantage" type="checkbox" />{{ controlText('combat.disadvantage') }}</label
                ><label class="check"
                  ><input v-model="env.fearVisible" type="checkbox" />{{ controlText('game.fearVisible') }}</label
                ><label class="check"
                  ><input v-model="env.areaConfirmed" type="checkbox" />{{ controlText('combat.areaConfirmed') }}</label
                ><label class="check"
                  ><input v-model="env.crusaderActive" type="checkbox" />{{ controlText('combat.crusaderMantle') }}</label
                >
              </div>
              <label
                >{{ controlText('combat.contextBasis') }}<textarea
                  v-model="env.note"
                  rows="2"
                  :placeholder="controlText('combat.contextPlaceholder')"
                />
              </label>
              <details v-if="encounter.actors.length">
                <summary>{{ controlText('combat.perTargetEnvironment') }}</summary>
                <div v-for="a in encounter.actors" :key="a.id">
                  <label v-if="targetOverrides[a.id]" class="check"
                    ><input v-model="targetOverrides[a.id]!.enabled" type="checkbox" />{{
                      localizedEntryName(stat(a))
                    }}
                    {{ controlText('combat.individualEnvironment') }}</label
                  >
                  <div v-if="targetOverrides[a.id]?.enabled" class="battle-form-grid">
                    <label
                      >{{ controlText('combat.targetDistance') }}<input
                        v-model.number="targetOverrides[a.id]!.env.distance"
                        type="number"
                        min="0"
                        :disabled="!!mapped && mapOptions.distance" /></label
                    ><label
                      >{{ controlText('combat.thisTargetCover') }}<select v-model="targetOverrides[a.id]!.env.cover">
                        <option value="none">{{ controlText('game.noCover') }}</option>
                        <option value="half">{{ controlText('combat.half') }}</option>
                        <option value="three-quarters">{{ controlText('combat.threeQuarters') }}</option>
                        <option value="total">{{ controlText('game.fullCover') }}</option>
                      </select></label
                    ><label class="check"
                      ><input
                        v-model="targetOverrides[a.id]!.env.attackerSees"
                        type="checkbox"
                      />{{ controlText('combat.actorSeesThis') }}</label
                    ><label class="check"
                      ><input
                        v-model="targetOverrides[a.id]!.env.targetSees"
                        type="checkbox"
                      />{{ controlText('combat.thisSeesActor') }}</label
                    ><label class="check"
                      ><input
                        v-model="targetOverrides[a.id]!.env.areaConfirmed"
                        type="checkbox"
                      />{{ controlText('combat.thisAreaConfirmed') }}</label
                    >
                  </div>
                </div>
              </details>
              <p class="muted">
                {{ controlText('combat.perTargetHelp') }}
              </p>
            </details>
            <button
              v-if="tab === 'weapon'"
              class="primary"
              :disabled="busy || !!encounter.pending || !attackId || !targetId || !attackAllowed"
              @click="submitAttack()"
            >
              {{ controlText('combat.attackReaction') }}</button
            ><button
              v-if="tab === 'spell'"
              class="primary"
              :disabled="
                busy ||
                (!!encounter.pending && spell?.spell.id !== 'lightning-arrow') ||
                !spell ||
                !componentsConfirmed
              "
              @click="
                run({
                  type: 'cast',
                  actorId,
                  key: spellKey,
                  mode: spellMode,
                  targets: spellPolicy?.self
                    ? [actorId]
                    : spellPolicy?.darts
                      ? darts
                      : selectedTargets,
                  metamagic,
                  excludedIds,
                  env,
                  requirementsConfirmed: componentsConfirmed,
                  hitDice: spell?.spell.id === 'arcane-vigor' ? vigorDice : undefined,
                  wildCheck,
                  summonForm: spell?.spell.id.startsWith('summon-') ? summonForm : undefined,
                  damageType: chosenDamage,
                  supportChoice: supportChoice || undefined,...controlSelection,
                  willing,
                  weaponId: ['magic-weapon', 'elemental-weapon'].includes(spell?.spell.id ?? '')
                    ? enchantedWeaponId
                    : attackId,
                  ammunition:
                    spell?.spell.id === 'cordon-of-arrows'
                      ? { instanceId: ammoId, count: ammoCount }
                      : undefined,
                  triggerConfirmed,
                })
              "
            >
              {{ controlText('combat.castResolution') }}</button
            ><button
              v-if="tab === 'feature'"
              class="primary"
              :disabled="busy || !!encounter.pending || !featureId"
              @click="
                run({
                  type: 'feature',
                  actorId,
                  id: featureId,
                  targetId: targetId || actorId,
                  amount,
                  env,
                  note: env.note,
                  targets: featureId === 'breath' ? selectedTargets : undefined,
                })
              "
            >
              {{ controlText('combat.useAbility') }}
            </button>
          </section>
          <section v-if="actor && encounter.phase === 'active'" class="battle-card">
            <h3>{{ controlText('combat.movementActions') }}</h3>
            <div class="battle-form-grid">
              <label
                >{{ controlText('combat.movementDistance') }}<input v-model.number="moveDistance" type="number" min="0"
              /></label>
              <div>
                <label class="check"><input v-model="difficult" type="checkbox" />{{ controlText('combat.difficultTerrain') }}</label
                ><label class="check"><input v-model="stand" type="checkbox" />{{ controlText('combat.standFirst') }}</label>
              </div>
            </div>
            <button
              class="secondary"
              :disabled="busy || !!encounter.pending || !ownTurn"
              @click="
                run({
                  type: 'move',
                  actorId,
                  distance: moveDistance,
                  difficult,
                  stand,
                  note: env.note,
                })
              "
            >
              {{ controlText('combat.recordMovement') }}
            </button>
            <div class="battle-controls general-actions">
              <button
                v-for="(label, id) in {
                  dash: '疾走',
                  disengage: '撤离',
                  dodge: '闪避',
                  help: '协助',
                  ready: '预备',
                  utilize: '使用物件',
                }"
                :key="id"
                class="secondary"
                :disabled="busy || !!encounter.pending || !ownTurn || !actor.turn.action"
                @click="run({ type: 'action', actorId, action: id, note: env.note })"
              >
                {{ label }}
              </button>
              <button
                class="secondary"
                :disabled="
                  busy || !!encounter.pending || !ownTurn || !actor.turn.action || !targetId
                "
                @click="run({ type: 'wake', actorId, targetId, env, note: env.note })"
              >
                {{ controlText('combat.wakeTarget') }}
              </button>
            </div>
            <p class="muted">{{ controlText('combat.helpReadyNote') }}</p>
          </section>
          <section v-if="actor && character && encounter.phase === 'active'" class="battle-card">
            <details>
              <summary>{{ controlText('combat.combatItems') }}</summary>
              <p class="muted">
                {{ controlText('combat.combatItemsHelp') }}
              </p>
              <label
                >{{ controlText('combat.interactionCost') }}<select v-model="inventoryCost">
                  <option value="free">{{ controlText('combat.freeInteraction') }}</option>
                  <option value="action">{{ controlText('combat.useAction') }}</option>
                  <option value="bonus">{{ controlText('combat.featureBonus') }}</option>
                </select></label
              ><label class="check"
                ><input v-model="inventoryConfirmed" type="checkbox" />{{ controlText('combat.confirmItemTime') }}</label
              ><RuntimeInventory
                :character="character"
                :content="store.content"
                :pending="busy || !!encounter.pending || !ownTurn"
                :active="true"
                :feedback="feedback"
                :failure="error"
                :run="inventoryRun"
                :allow-gm-configuration="true"
              />
            </details>
          </section>
          <section v-if="actor && stat(actor).effects.length" class="battle-card">
            <h3>{{ controlText('combat.currentEffects') }}</h3>
            <article v-for="eff in stat(actor).effects" :key="eff.id" class="active-effect">
              <div>
                <strong>{{ localizedEntryName(eff) }}</strong
                ><small
                  >{{ controlText('controls.source') }}
                  {{
                    encounter.actors.find((a) => a.id === eff.sourceId)
                      ? localizedEntryName(stat(encounter.actors.find((a) => a.id === eff.sourceId)!))
                      : eff.sourceId
                  }}
                  · {{ eff.concentration ? controlText('expressionOne.concentration') : ''
                  }}{{
                    eff.expiresAt === null
                      ? controlText('expressionOne.gmEnded')
                      : controlText('expressionOne.approximatelyRemaining') +
                        Math.max(
                          0,
                          Math.ceil(
                            (eff.expiresAt - encounter.tick) / Math.max(1, encounter.actors.length),
                          ),
                        ) +
                        controlText('expressionOne.roundAlias28')
                  }}
                  · p.{{ eff.page }}</small
                >
                <p v-if="eff.note" class="muted">{{ eff.note }}</p>
              </div>
              <button
                class="text-button"
                :disabled="busy || !!encounter.pending"
                @click="
                  run({
                    type: 'end-effect',
                    actorId,
                    effectId: eff.id,
                    reason: env.note || 'GM 确认效果结束',
                  })
                "
              >
                {{ controlText('combat.end') }}
              </button>
            </article>
          </section>
        </div>
      </div>
      <section class="battle-card combat-log">
        <h3>{{ controlText('combat.encounterLog') }}</h3>
        <p class="muted">
          {{ controlText('combat.wholeResolutionHelp') }}
        </p>
        <ol>
          <li
            v-for="event in [...encounter.log].reverse()"
            :key="event.id"
            :class="{ undone: event.undone }"
          >
            <small
              >{{ uiDate(event.at,'time',{ hour12: false }) }} ·
              {{ event.kind }}{{ event.undone ? controlText('expressionOne.undone') : '' }}</small
            >
            <p>{{ event.detail }}</p>
          </li>
        </ol>
      </section>
    </template>
  </section>
</template>
