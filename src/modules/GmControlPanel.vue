<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { computed, ref, watch } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
import type { Catalogue } from '../core/engine'
import type { NpcDirective } from '../core/ai-types'
import { attackOptions, combatStats, freshTurn, defaultEnvironment } from '../core/combat-rules'
import { npcCapabilities, reachableNpcCells } from '../core/npc-strategy'
import { directPath } from '../core/map'
import PointItemPicker from './scene-tools/PointItemPicker.vue'
const props = defineProps<{
  view: RoomView
  sceneId: string
  tokenId: string
  content: Catalogue
  busy: boolean
}>()
const emit = defineEmits<{
  command: [command: RoomCommand]
  view: [id: string]
  battle: [id: string]
}>()
const reason = ref('GM临时接管操作'),
  x = ref(0),
  y = ref(0),
  target = ref(''),
  attack = ref(''),
  ability = ref(''),
  item = ref(''),
  point = ref(''),
  itemIds = ref<string[]>([]),
  confirmCosts = ref(false),
  itemLimits = ref<Record<string, number>>({}),
  bypassItems = ref(false)
const scene = computed(() =>
  props.view.world?.adventures[0]?.scenes.find((s) => s.id === props.sceneId),
)
const token = computed(() => scene.value?.tokens.find((t) => t.id === props.tokenId))
const npc = computed(() =>
  props.view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === token.value?.npcId),
)
const character = computed(() =>
  props.view.world?.characters.find(
    (c) => c.id === (npc.value?.characterId ?? token.value?.characterId),
  ),
)
const kind = computed(() => (npc.value ? ('npc' as const) : ('character' as const)))
const id = computed(() => npc.value?.id ?? character.value?.id ?? '')
const hold = computed(() =>
  props.view.gmControls?.find((h) => h.targetKind === kind.value && h.targetId === id.value),
)
const mine = computed(() => hold.value?.gmId === props.view.self.id)
const encounter = computed(() =>
  props.view.world?.encounters.find((e) => e.id === scene.value?.encounterId),
)
const actor = computed(() =>
  encounter.value?.actors.find(
    (a) =>
      a.id === (npc.value?.actorId ?? token.value?.actorId) ||
      (!!character.value && a.characterId === character.value.id),
  ),
)
const active = computed(() => encounter.value?.phase === 'active')
const body = computed(
  () =>
    actor.value ?? {
      id: token.value?.id ?? '',
      characterId: character.value?.id ?? null,
      npc: npc.value?.body ?? token.value?.npcBody ?? null,
      side: npc.value?.side ?? 'party',
      initiative: null,
      surprised: false,
      turn: freshTurn(),
    },
)
const attacks = computed(() =>
  props.view.world && id.value
    ? attackOptions(body.value, props.view.world.characters, props.content)
    : [],
)
const abilities = computed(() =>
  props.view.world && npc.value ? npcCapabilities(props.view.world, npc.value) : [],
)
const items = computed(() =>
  character.value
    ? character.value.inventory
        .filter((i) => i.quantity > 0)
        .map((i) => ({
          id: i.instanceId,
          name: props.content.items.find((d) => d.id === i.itemId)?.name ?? i.itemId,
        }))
    : (npc.value?.consumables
        ?.filter((i) => i.quantity - (npc.value?.consumablesUsed?.[i.id] ?? 0) > 0)
        .map((i) => ({
          id: i.id,
          name: props.content.items.find((d) => d.id === i.itemId)?.name ?? i.itemId,
        })) ?? []),
)
const points = computed(() => scene.value?.points.filter((p) => p.enabled) ?? [])
watch(
  () => props.tokenId,
  () => {
    x.value = token.value?.x ?? 0
    y.value = token.value?.y ?? 0
    target.value = ''
    itemIds.value = []
    confirmCosts.value = false
  },
  { immediate: true },
)
function control(operation: 'take' | 'release') {
  emit('command', {
    kind: 'gm-control',
    targetKind: kind.value,
    targetId: id.value,
    operation,
    reason: reason.value,
  })
}
function npcAction(d: NpcDirective) {
  if (npc.value)
    emit('command', {
      kind: 'gm-control-npc',
      npcId: npc.value.id,
      directive: d,
      reason: reason.value,
    })
}
function move() {
  if (npc.value) return npcAction({ kind: 'move', destination: { x: x.value, y: y.value } })
  if (!scene.value || !token.value) return
  const speed = combatStats(body.value, props.view.world!.characters, props.content).speed
  const route = reachableNpcCells(scene.value, token.value, active.value ? speed * 4 : speed).find(
    (p) => p.x === x.value && p.y === y.value,
  )
  emit('command', {
    kind: 'map',
    command: {
      type: 'move',
      sceneId: props.sceneId,
      tokenId: props.tokenId,
      path: route?.path ?? directPath(token.value, { x: x.value, y: y.value }),
      gm: false,
      reactionsConfirmed: false,
      reason: reason.value,
    },
  })
}
function attackNow() {
  if (npc.value)
    return npcAction({ kind: 'attack', attackId: attack.value, targetId: target.value })
  if (actor.value)
    emit('command', {
      kind: 'map',
      command: {
        type: 'combat',
        sceneId: props.sceneId,
        command: {
          type: 'attack',
          actorId: actor.value.id,
          targetId: target.value,
          attackId: attack.value,
          cost: 'action',
          env: defaultEnvironment(),
          sneak: false,
          mastery: false,
        },
      },
    })
}
function act(action: 'dash' | 'disengage' | 'dodge') {
  if (npc.value) return npcAction({ kind: 'action', action })
  if (actor.value && active.value)
    emit('command', {
      kind: 'map',
      command: {
        type: 'combat',
        sceneId: props.sceneId,
        command: { type: 'action', actorId: actor.value.id, action, note: reason.value },
      },
    })
  else if (token.value)
    emit('command', {
      kind: 'map',
      command: {
        type: 'explore',
        sceneId: props.sceneId,
        command: {
          operation: 'action',
          tokenId: token.value.id,
          action,
          note: reason.value,
          confirmed: true,
        },
      },
    })
}
function interact(operation: 'use' | 'check' | 'claim') {
  emit('command', {
    kind: 'map',
    command: {
      type: 'interact',
      sceneId: props.sceneId,
      pointId: point.value,
      characterId: character.value?.id ?? '',
      ...(npc.value ? { npcId: npc.value.id } : {}),
      operation,
      gm: false,
      reason: reason.value,
      itemIds: itemIds.value,
      confirmItemCosts: confirmCosts.value,
      itemLimits: itemLimits.value,
      bypassItems: bypassItems.value,
    },
  })
}
</script>
<template>
  <section v-if="id" class="gm-control-panel" :aria-label="controlText('field.gmCharacterTakeover')">
    <div class="control-line">
      <strong
        >{{ localizedEntryName(npc) ?? localizedEntryName(character?.build) }} · {{ hold ? controlText('expressionOne.underTakeover') : controlText('expressionOne.originalControlPolicy') }}</strong
      ><button :disabled="busy || !reason.trim()" @click="control(hold ? 'release' : 'take')">
        {{ hold ? controlText('expressionOne.returnControl') : controlText('expressionOne.takeOverThisCharacter') }}</button
      ><input v-model="reason" :aria-label="controlText('field.takeoverOperationReason')" :placeholder="controlText('field.operationReasonAlias162')" />
    </div>
    <p v-if="hold && !mine" role="status">{{ controlText('operations.anotherGmCurrentlyControlsThisCharacterReturnControl') }}</p>
    <template v-if="mine"
      ><p class="muted">{{ controlText('operations.rulesActionsStillSpendTheirNormalResourcesResolve') }}</p>
      <div class="control-line">
        <label>X<input v-model.number="x" type="number" min="0" max="79" /></label
        ><label>Y<input v-model.number="y" type="number" min="0" max="79" /></label
        ><button :disabled="busy" @click="move">{{ controlText('operations.moveAlongRoute') }}</button
        ><button
          v-for="(name, key) in { dash: '疾走', disengage: '撤离', dodge: '闪避' }"
          :key="key"
          :disabled="busy"
          @click="act(key)"
        >
          {{ name }}</button
        ><button v-if="character" @click="emit('view', character.id)">{{ controlText('operations.characterSheetItems') }}</button>
      </div>
      <label v-if="!active"
        >{{ controlText('game.featureTarget') }}<MapFieldPicker kind="entity"><select v-model="target">
          <option value="">{{ controlText('operations.defaultSelf') }}</option>
          <option v-for="t in scene?.tokens" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
        </select></MapFieldPicker></label
      >
      <div v-if="active" class="control-line">
        <select v-model="target" :aria-label="controlText('field.actionTarget')">
          <option value="">{{ controlText('game.chooseTarget') }}</option>
          <option
            v-for="a in encounter?.actors.filter((a) => a.id !== actor?.id)"
            :key="a.id"
            :value="a.id"
          >
            {{
              localizedEntryName(a.npc) ??
              localizedEntryName(view.world?.characters.find((c) => c.id === a.characterId)?.build) ??
              a.id
            }}
          </option></select
        ><select v-model="attack" :aria-label="controlText('controls.attack')">
          <option value="">{{ controlText('operations.chooseAvailableAttack') }}</option>
          <option v-for="a in attacks" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option></select
        ><button :disabled="busy || !target || !attack" @click="attackNow">{{ controlText('controls.attack') }}</button
        ><button
          v-if="actor"
          :disabled="busy"
          @click="
            emit('command', {
              kind: 'map',
              command: {
                type: 'combat',
                sceneId,
                command: {
                  type: 'end-turn',
                  actorId: actor.id,
                  encounterId: encounter!.id,
                  expectedTick: encounter!.tick,
                },
              },
            })
          "
        >
          {{ controlText('operations.endTurn') }}</button
        ><button v-if="encounter" @click="emit('battle', encounter.id)">{{ controlText('operations.combatTableResolution') }}</button>
      </div>
      <div v-else-if="npc" class="control-line">
        <button :disabled="busy" @click="npcAction({ kind: 'start-combat' })">{{ controlText('operations.requestCombat') }}</button
        ><small>{{ controlText('operations.attacksDuringFreeExplorationFirstEnterTheCombat') }}</small>
      </div>
      <p v-if="npc && !character && !active" class="muted">
        {{ controlText('operations.templateAbilitiesWithoutAnExplorationEntryRequireGm') }}
      </p>
      <div v-if="npc" class="control-line">
        <select v-model="ability" :aria-label="controlText('domain.actualAbility')">
          <option value="">{{ controlText('operations.chooseAbilitySpell') }}</option>
          <option v-for="a in abilities" :key="a.id" :value="a.id">
            {{ localizedEntryName(a) }} · {{ a.note }}
          </option></select
        ><button
          :disabled="busy || !ability || (!active && !character)"
          @click="
            npcAction({
              kind: 'ability',
              abilityId: ability,
              ...(target ? { targetId: target } : {}),
            })
          "
        >
          {{ controlText('operations.useAbility') }}</button
        ><select v-model="item" :aria-label="controlText('domain.ownItems')">
          <option value="">{{ controlText('operations.chooseOwnItem') }}</option>
          <option v-for="i in items" :key="i.id" :value="i.id">{{ localizedEntryName(i) }}</option></select
        ><button
          :disabled="busy || !item"
          @click="npcAction({ kind: 'action', action: 'utilize', itemId: item })"
        >
          {{ controlText('domain.useItem') }}
        </button>
      </div>
      <details>
        <summary>{{ controlText('operations.interactWithPoint') }}</summary>
        <select v-model="point" :aria-label="controlText('game.point')">
          <option value="">{{ controlText('domain.choosePoint') }}</option>
          <option v-for="p in points" :key="p.id" :value="p.id">
            {{ localizedEntryName(p) }} · {{ p.state }}
          </option></select
        ><PointItemPicker
          v-model="itemIds"
          v-model:confirmed="confirmCosts"
          v-model:limits="itemLimits"
          :items="character?.inventory ?? []"
          :supplies="npc && !character ? npc.consumables : undefined"
          :used="npc?.consumablesUsed"
          :content="content"
        /><label class="check"
          ><input
            v-model="bypassItems"
            type="checkbox"
          />{{ controlText('field.gmItemConditionRulingTheOperationReasonAbove') }}</label
        >
        <div class="control-line">
          <button :disabled="busy || !point" @click="interact('use')">{{ controlText('operations.useOpen') }}</button
          ><button :disabled="busy || !point" @click="interact('check')">{{ controlText('operations.configureCheck') }}</button
          ><button :disabled="busy || !point" @click="interact('claim')">{{ controlText('operations.claimContainerContents') }}</button>
        </div>
      </details>
    </template>
  </section>
</template>
<style scoped>
.gm-control-panel {
  padding: 0.65rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: var(--surface);
  margin: 0.5rem 0;
}
.control-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}
.control-line input[type='number'] {
  width: 4.5rem;
}
.control-line input:not([type='number']) {
  max-width: 20rem;
}
.control-line select {
  width: auto;
  max-width: min(22rem, 100%);
}
.control-line > * {
  min-width: 0;
  max-width: 100%;
}
.control-line button {
  padding: 0.35rem 0.6rem;
}
.gm-control-panel p {
  margin: 0.3rem 0;
  font-size: 0.85rem;
}
</style>
