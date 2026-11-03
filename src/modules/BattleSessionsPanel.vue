<script setup lang="ts">
import {uiDate} from './locale-format'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { useOperationFeedback } from '../app/useOperationFeedback'
import { computed, ref, watch } from 'vue'
import type { Adventure } from '../core/map-types'
import type { BattleParticipant, BattleMapCommand, BattleRequest } from '../core/battle-types'
import type { BattlePreset } from '../core/battle-types'
import PracticalBattlePolicyEditor from './review/PracticalBattlePolicyEditor.vue'
import { clone } from '../core/engine'
import { explorationAttacks } from '../core/battle-opening'
import { runtimeSpells, findItem, MODE_NAMES } from '../core/runtime'
import { combatStats } from '../core/combat-rules'
import type { useWorkshop } from '../app/store'
const props = defineProps<{
  workshop: ReturnType<typeof useWorkshop>
  adventure: Adventure
  sceneId: string
  blocked?: boolean
}>()
const emit = defineEmits<{ select: [id: string] }>()
const scene = computed(() => props.adventure.scenes.find((s) => s.id === props.sceneId))
const encounter = computed(() =>
  props.workshop.encounters.find((e) => e.id === scene.value?.encounterId),
)
const active = computed(() => encounter.value?.phase === 'active')
const rosterOpen = ref(true)
watch(
  () => [props.sceneId, encounter.value?.id, encounter.value?.phase].join(':'),
  () => {
    rosterOpen.value = !active.value
  },
  { immediate: true },
)
const rosterSummary = computed(() => {
  const selected = Object.values(roster.value).filter((r) => r.selected)
  return controlText('confirmation.rosterCounts',{selected:selected.length,party:selected.filter(r=>r.side==='party').length,enemy:selected.filter(r=>r.side==='enemy').length,neutral:selected.filter(r=>r.side==='neutral').length})
})
const currentScene = computed(() => props.adventure.activeSceneId === props.sceneId)
const presets = computed(
  () => props.adventure.battles?.presets.filter((p) => p.sceneId === props.sceneId) ?? [],
)
const requests = computed(
  () =>
    props.adventure.battles?.requests.filter(
      (r) => r.sceneId === props.sceneId && r.status === 'pending',
    ) ?? [],
)
const history = computed(() => [...(props.adventure.battles?.history ?? [])].reverse())
const historyLimit = ref(20)
const choices = computed(() => {
  const npcs = props.adventure.ai?.npcs ?? []
  const pcs = (scene.value?.tokens ?? []).flatMap((t) => {
    const c = props.workshop.characters.find((c) => c.id === t.characterId)
    return c && !c.npcOwnerId && props.adventure.party.includes(c.id)
      ? [
          {
            kind: 'character' as const,
            id: c.id,
            name: c.build.name,
            side: 'party' as const,
            joined: !!encounter.value?.actors.some((a) => a.characterId === c.id),
            hidden: t.hidden,
          },
        ]
      : []
  })
  return [
    ...pcs,
    ...npcs
      .filter(
        (n) =>
          n.enabled &&
          !(n.initiallyAbsent && !n.appeared) &&
          n.sceneId === props.sceneId &&
          (n.body ||
            n.characterId ||
            props.workshop.encounters.some((e) =>
              e.actors.some((a) => a.id === n.actorId && a.npc),
            )),
      )
      .map((n) => ({
        kind: 'npc' as const,
        id: n.id,
        name: n.name,
        side: n.side,
        joined: !!encounter.value?.actors.some((a) => a.id === n.actorId),
        hidden: n.hidden,
      })),
    ...(scene.value?.tokens ?? [])
      .filter(
        (t) =>
          !t.characterId &&
          !t.npcId &&
          !t.companionKey &&
          !!(t.npcBody || t.actorId || t.npcSourceActorId),
      )
      .map((t) => ({
        kind: 'token' as const,
        id: t.id,
        name: t.name,
        side: 'enemy' as const,
        joined: !!encounter.value?.actors.some((a) => a.id === t.actorId),
        hidden: t.hidden,
      })),
  ]
})
const key = (p: { kind: string; id: string }) => p.kind + ':' + p.id
const roster = ref<
  Record<string, { selected: boolean; side: BattleParticipant['side']; initiative: number | null }>
>({})
const name = ref('场景战斗'),
  practical = ref<BattlePreset['practical']>(),
  presetId = ref(''),
  presetName = ref(''),
  intro = ref(''),
  requestId = ref(''),
  reason = ref('GM 确认参战名单'),
  resetReason = ref(''),
  resetConfirmed = ref(false),
  busy = ref(false),
  feedback = ref(''),
  failed = ref(false)
function defaults() {
  roster.value = Object.fromEntries(
    choices.value.map((p) => [
      key(p),
      {
        selected: !active.value && p.kind === 'character',
        side: p.side,
        initiative: null,
      },
    ]),
  )
  requestId.value = ''
  resetConfirmed.value = false
}
watch(
  () =>
    [
      props.sceneId,
      encounter.value?.id,
      encounter.value?.phase,
      choices.value.map((p) => key(p) + ':' + p.joined).join(','),
    ].join('|'),
  defaults,
  { immediate: true },
)
const participants = computed<BattleParticipant[]>(() =>
  choices.value.flatMap((p) => {
    const r = roster.value[key(p)]
    return r?.selected && (!active.value || !p.joined)
      ? [
          {
            kind: p.kind,
            id: p.id,
            side: r.side,
            ...(active.value && r.initiative !== null ? { initiative: r.initiative } : {}),
          },
        ]
      : []
  }),
)
const validRoster = computed(
  () =>
    (participants.value.length > 0 ||
      (active.value && !!requests.value.find((r) => r.id === requestId.value)?.opening)) &&
    (!active.value || participants.value.every((p) => Number.isInteger(p.initiative))),
)
function usePreset() {
  const preset = presets.value.find((p) => p.id === presetId.value)
  defaults()
  if (!preset) {practical.value=undefined;return}
  name.value = preset.name
  presetName.value = preset.name
  intro.value = preset.intro
  practical.value=preset.practical?clone(preset.practical):undefined
  for (const p of preset.participants)
    if (roster.value[key(p)]) {
      roster.value[key(p)]!.selected = true
      roster.value[key(p)]!.side = p.side
    }
}
function configure(r: BattleRequest) {
  rosterOpen.value = true
  presetId.value = r.presetId ?? ''
  usePreset()
  requestId.value = r.id
  name.value = r.name
  if (
    r.source === 'npc' &&
    (props.adventure.ai?.npcs.find((n) => n.id === r.sourceId)?.hidden ||
      scene.value?.tokens.some((t) => t.npcId === r.sourceId && t.hidden))
  )
    name.value = scene.value!.name + '战斗'
  reason.value = 'GM 确认请求与参战名单'
  if (r.source === 'npc' && roster.value['npc:' + r.sourceId])
    roster.value['npc:' + r.sourceId]!.selected = true
  if (r.opening) {
    for (const t of scene.value?.tokens.filter(
      (t) => r.opening!.tokenIds.includes(t.id) || t.characterId === r.characterId,
    ) ?? []) {
      const k = t.npcId
        ? 'npc:' + t.npcId
        : t.characterId
          ? 'character:' + t.characterId
          : 'token:' + t.id
      const choice = choices.value.find((p) => key(p) === k)
      if (roster.value[k] && (!active.value || !choice?.joined)) roster.value[k]!.selected = true
    }
  }
}
function openingLabel(r: BattleRequest) {
  const o = r.opening,
    c = props.workshop.characters.find((c) => c.id === r.characterId)
  if (!o || !c) return '行动已不可用'
  if (o.kind === 'attack')
    return (
      explorationAttacks(c, props.workshop.content).find((a) => a.id === o.attackId)?.name ??
      '原武器已不可用'
    )
  if (o.kind === 'cast') {
    const g = runtimeSpells(c, props.workshop.content).find((g) => g.key === o.key)
    return (
      (g ? g.spell.name + ' · ' + g.source : '原法术已不可用') +
      ' · ' +
      (MODE_NAMES[o.mode] ?? o.mode)
    )
  }
  const row = c.inventory.find((r) => r.instanceId === o.instanceId)
  return row
    ? (findItem(c, props.workshop.content, row.itemId)?.name ?? row.itemId)
    : '原物品已不可用'
}
async function operate(c: BattleMapCommand) {
  if (busy.value) return
  if (props.blocked) {
    failed.value = true
    feedback.value = '请先保存场景编辑，再操作战斗'
    return
  }
  busy.value = true
  failed.value = false
  try {
    const a = await props.workshop.mapOperate(props.adventure.id, c)
    emit('select', a.scenes.find((s) => s.id === props.sceneId)?.encounterId ?? '')
    feedback.value = a.log.at(-1)?.detail ?? '已保存'
    if (c.type === 'battle-reset') {
      resetConfirmed.value = false
      resetReason.value = ''
    }
    if (c.type === 'battle-request-review') requestId.value = ''
  } catch (e) {
    failed.value = true
    feedback.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
function prepare() {
  if (requestId.value)
    return operate({
      type: 'battle-request-review',
      requestId: requestId.value,
      name: name.value,
      approve: true,
      reason: reason.value,
      participants: clone(participants.value),
    })
  if (active.value)
    return operate({
      type: 'battle-reinforce',
      sceneId: props.sceneId,
      participants: clone(participants.value),
      reason: reason.value,
    })
  return operate({
    type: 'battle-prepare',
    sceneId: props.sceneId,
    name: name.value,
    participants: clone(participants.value),
    ...(presetId.value ? { presetId: presetId.value } : {}),
  })
}
function savePreset() {
  return operate({
    type: 'battle-preset',
    preset: {
      id: presetId.value || crypto.randomUUID(),
      sceneId: props.sceneId,
      name: presetName.value,
      intro: intro.value,
      practical:practical.value?clone(practical.value):undefined,
      participants: clone(participants.value.map(({ initiative: _initiative, ...p }) => p)),
    },
  })
}
const caption = computed(() =>
  requestId.value
    ? active.value
      ? '确认请求并加入增援'
      : '确认请求并准备战斗'
    : active.value
      ? '确认名单并加入增援'
      : '确认名单并准备战斗',
)
const sourceNames = { gm: 'GM', player: '玩家', npc: 'NPC', point: '互动点' }
const sideNames = { party: '冒险者一方', enemy: '敌对一方', neutral: '中立' }
useOperationFeedback(feedback, failed, busy)
</script>
<template>
  <section class="battle-sessions room-card" :aria-label="controlText('field.sceneCombatManagement')">
    <div class="session-heading">
      <div>
        <h2>{{ controlText('quantity.sceneBattle', {p0:(localizedEntryName(scene))}) }}</h2>
        <p v-if="!encounter || encounter.phase === 'ended'">{{ controlText('operations.thisSceneIsInExplorationMode') }}</p>
        <p v-else>
          {{
            encounter.phase === 'active'
              ? controlText('expressionOne.combatInProgressReinforcementsJoinCurrentCombat')
              : controlText('expressionOne.rosterConfirmedSetInitiativeBeforeStarting')
          }}
        </p>
      </div>
      <span class="tag">{{ controlText('quantity.archivedBattles', {p0:(history.length)}) }}</span>
    </div>
    <p class="muted">
      {{ controlText('operations.eachPreparationReadsCurrentHpResourcesAndPositions') }}
    </p>
    <p v-if="blocked" role="status">{{ controlText('operations.saveSceneEditsBeforeOperatingCombat') }}</p>
    <p v-if="!currentScene" class="muted">{{ controlText('operations.haveThePartyEnterThisSceneBeforePreparing') }}</p>
    <div v-if="requests.length" class="session-requests">
      <article v-for="r in requests" :key="r.id" class="battle-request">
        <strong>{{ controlText('quantity.battleRequest', {p0:(uiLabel(sourceNames[r.source])),p1:(localizedEntryName(r))}) }}</strong>
        <p>{{ r.reason }}</p>
        <p v-if="r.opening" class="small">{{ controlText('quantity.requestedAction', {p0:(openingLabel(r)),p1:(r.opening.tokenIds
              .map((id) => localizedEntryName(scene?.tokens.find((t) => t.id === id)) ?? '目标已不可用')
              .join('、'))}) }}</p>
        <div class="session-actions">
          <button class="secondary" :disabled="busy" @click="configure(r)">{{ controlText('operations.configureThisRequest') }}</button>
          <button
            class="text-button"
            :disabled="busy || !reason.trim()"
            @click="
              operate({
                type: 'battle-request-review',
                requestId: r.id,
                approve: false,
                reason,
                participants: [],
              })
            "
          >
            {{ controlText('operations.rejectRequest') }}
          </button>
        </div>
      </article>
    </div>
    <template v-if="encounter?.phase !== 'setup'">
      <label
        >{{ controlText('field.useCombatPreset') }}<select v-model="presetId" @change="usePreset">
          <option value="">{{ controlText('operations.selectRosterManually') }}</option>
          <option v-for="p in presets" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
        </select></label
      >
      <label v-if="!active"
        >{{ controlText('field.combatNamePublic') }}<input v-model="name" :aria-label="controlText('field.combatName')" maxlength="120"
      /></label>
      <button
        type="button"
        class="secondary"
        :aria-expanded="rosterOpen"
        @click="rosterOpen = !rosterOpen"
      >
        {{ rosterOpen ? controlText('controls.collapse') : controlText('controls.expand') }}{{ active ? controlText('expressionOne.reinforcementRoster') : controlText('expressionOne.currentCombatRoster') }} ·
        {{ rosterSummary }}
      </button>
      <fieldset v-show="rosterOpen" class="session-roster">
        <legend>{{ active ? controlText('expressionOne.reinforcementRoster') : controlText('expressionOne.currentCombatRoster') }}</legend>
        <p v-if="!choices.length" class="muted">{{ controlText('operations.noAvailableCharactersInThisSceneSetUp') }}</p>
        <div v-for="p in choices" :key="key(p)" class="roster-row">
          <label class="check"
            ><input
              v-model="roster[key(p)]!.selected"
              type="checkbox"
              :aria-label="controlText('expressionOne.joinCombat') + localizedEntryName(p)"
              :disabled="busy || (active && p.joined)"
            />
            {{ localizedEntryName(p) }}<small v-if="p.hidden">{{ controlText('operations.hiddenByGm') }}</small
            ><small v-if="active && p.joined">{{ controlText('operations.alreadyInCombat') }}</small></label
          >
          <label
            >{{ controlText('game.side') }}<select
              v-model="roster[key(p)]!.side"
              :aria-label="controlText('expressionOne.side') + localizedEntryName(p)"
              :disabled="busy || !roster[key(p)]!.selected || (active && p.joined)"
            >
              <option v-for="(v, k) in sideNames" :key="k" :value="k">{{ uiLabel(v) }}</option>
            </select></label
          >
          <label v-if="active && !p.joined"
            >{{ controlText('controls.initiative') }}<input
              v-model.number="roster[key(p)]!.initiative"
              :aria-label="controlText('expressionOne.reinforcementInitiative') + localizedEntryName(p)"
              type="number"
              min="-100"
              max="100"
              :disabled="busy || !roster[key(p)]!.selected"
          /></label>
        </div>
      </fieldset>
      <label v-if="active || requestId">{{ controlText('field.rulingNotes') }}<input v-model="reason" maxlength="2000" /></label>
      <p v-if="active" class="muted">{{ controlText('operations.reinforcementsRequireInitiativeTheCurrentRoundActingCharacter') }}</p>
      <p v-if="requestId" role="status">{{ controlText('quantity.configuringRequest', {p0:(active ? controlText('state.joinCombat') : controlText('expressionOne.prepareNewCombat'))}) }}</p>
      <div class="session-actions">
        <button
          class="primary"
          :disabled="
            busy ||
            !currentScene ||
            !validRoster ||
            (!active && !name.trim()) ||
            ((active || !!requestId) && !reason.trim())
          "
          @click="prepare"
        >
          {{ uiLabel(caption) }}
        </button>
        <button v-if="requestId" class="text-button" :disabled="busy" @click="requestId = ''">
          {{ controlText('operations.cancelRequestConfiguration') }}
        </button>
      </div>
      <details>
        <summary>{{ controlText('quantity.battlePreset', {p0:(presets.length)}) }}</summary>
        <p class="muted">{{ controlText('workspace.savesExistingNpcAndCombatantReferencesSidesAnd') }}</p>
        <label>{{ controlText('field.presetName') }}<input v-model="presetName" maxlength="120" /></label
        ><label>{{ controlText('field.presetOpeningText') }}<textarea v-model="intro" rows="2" maxlength="2000" /></label>
        <PracticalBattlePolicyEditor v-model="practical" :npcs="adventure.ai?.npcs.filter(n=>n.sceneId===sceneId)??[]" />
        <div class="session-actions">
          <button
            class="secondary"
            :disabled="busy || !presetName.trim() || !participants.length"
            @click="savePreset"
          >
            {{ controlText('game.saveBattle') }}
          </button>
          <button
            v-if="presetId"
            class="text-button"
            :disabled="busy"
            @click="operate({ type: 'battle-preset-delete', presetId })"
          >
            {{ controlText('operations.deleteSelectedPreset') }}
          </button>
        </div>
      </details>
    </template>
    <div v-else class="session-actions">
      <button class="secondary" :disabled="busy" @click="emit('select', encounter!.id)">
        {{ controlText('operations.viewCurrentCombatPreparation') }}
      </button>
      <button
        class="text-button"
        :disabled="busy"
        @click="operate({ type: 'battle-cancel', sceneId, reason: 'GM 取消未开始的战斗' })"
      >
        {{ controlText('operations.cancelCombatPreparation') }}
      </button>
    </div>
    <details class="battle-history">
      <summary>{{ controlText('quantity.battleHistory', {p0:(history.length)}) }}</summary>
      <p class="muted">{{ controlText('operations.readOnlyEndSnapshotHistoryBeforeATest') }}</p>
      <details
        v-for="h in history.slice(0, historyLimit)"
        :key="h.id + ':' + h.branchId"
        class="history-record"
      >
        <summary>
          {{ localizedEntryName(h) }} · {{ uiDate(h.endedAt,'datetime')
          }}{{ h.legacy ? controlText('expressionOne.legacyArchive') : '' }}
        </summary>
        <p>{{ controlText('quantity.round', {p0:(h.reason),p1:(h.encounter.round),p2:(controlText('game.rounds'))}) }}</p>
        <ul>
          <li v-for="a in h.encounter.actors" :key="a.id">
            {{ controlText('quantity.hp', {p0:(localizedEntryName(combatStats(a, h.characters, workshop.content))),p1:(uiLabel(sideNames[a.side])),p2:(combatStats(a, h.characters, workshop.content).hp),p3:(combatStats(a, h.characters, workshop.content).maxHp)}) }}
          </li>
        </ul>
        <details>
          <summary>{{ controlText('operations.combatLogAtEnding') }}</summary>
          <p v-for="l in h.encounter.log.slice(-50)" :key="l.id">{{ l.detail }}</p>
        </details>
      </details>
      <button v-if="historyLimit < history.length" class="secondary" @click="historyLimit += 20">
        {{ controlText('operations.show20MorePastCombats') }}
      </button>
    </details>
    <details v-if="adventure.testBattle" class="test-reset">
      <summary>{{ controlText('operations.testResetEntireAdventure') }}</summary>
      <p>{{ controlText('quantity.restoreBefore', {p0:(localizedEntryName(adventure.testBattle)),p1:(uiDate(adventure.testBattle.at,'datetime'))}) }}</p>
      <p>
        {{ controlText('adjudication.restoresRoomCharactersAndNpcsHpResourcesInventory') }}
      </p>
      <label class="check"
        ><input
          v-model="resetConfirmed"
          type="checkbox"
        />{{ controlText('field.confirmedRestorationOfAllCharactersNpcsInventoryScenes') }}</label
      >
      <label>{{ controlText('field.testResetReason') }}<input v-model="resetReason" maxlength="2000" /></label>
      <button
        class="secondary danger"
        :disabled="busy || !resetConfirmed || !resetReason.trim()"
        @click="operate({ type: 'battle-reset', confirmed: resetConfirmed, reason: resetReason })"
      >
        {{ controlText('operations.resetTestCombat') }}
      </button>
    </details>
  </section>
</template>
<style scoped>
.battle-sessions {
  margin-bottom: 1rem;
  min-width: 0;
}
.session-heading,
.session-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.session-heading {
  justify-content: space-between;
}
.session-heading h2 {
  margin: 0;
  font-size: 1.25rem;
}
.session-roster {
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 1rem 0;
  padding: 0.75rem;
  min-width: 0;
}
.roster-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.6fr);
  align-items: end;
  gap: 0.75rem;
  padding: 0.5rem 0;
}
.roster-row .check {
  align-self: center;
  flex-wrap: wrap;
}
.battle-request,
.history-record {
  border-top: 1px solid var(--line);
  padding: 0.75rem 0;
  overflow-wrap: anywhere;
}
.battle-sessions details {
  margin-top: 1rem;
}
.battle-sessions label {
  min-width: 0;
}
.battle-sessions input,
.battle-sessions select,
.battle-sessions textarea {
  max-width: 100%;
}
.session-actions button {
  min-height: 44px;
}
.battle-sessions summary {
  cursor: pointer;
  min-height: 32px;
}
@media (max-width: 650px) {
  .roster-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .roster-row .check {
    grid-column: 1 / -1;
  }
}
</style>
