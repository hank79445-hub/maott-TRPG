<script setup lang="ts">
import {uiLabel} from '../ui-label'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { Catalogue } from '../../core/engine'
import { runtimeDerived } from '../../core/runtime'
import CharacterAvatar from '../CharacterAvatar.vue'

const props = defineProps<{
  view: RoomView
  gm: boolean
  content: Catalogue
  currentCharacterId: string
}>()
const emit = defineEmits<{
  navigate: [tab: string]
  focusToken: [id: string]
  select: [id: string]
  visibility: [tokenId: string, effectId: string, visibility: 'public' | 'owner' | 'gm']
}>()

type Option = {
  key: string
  name: string
  portrait?: string | null
  kind: 'player' | 'npc'
  npcType?: 'important' | 'ordinary'
  tokenId?: string
  characterId?: string
  statuses?: import('../../core/status-summary').StatusSummary[]
  hp?: number
  maxHp?: number
  ac?: number
  actorId?: string
  initiative?: number | null
}

function playerCharacter(id?: string | null) {
  if (!id) return undefined
  return (
    props.view.ownCharacters.find((c) => c.id === id) ??
    (props.gm ? props.view.world?.characters.find((c) => c.id === id) : undefined)
  )
}
function playerOption(id: string, name: string, portrait?: string | null): Option {
  const full = playerCharacter(id)
  let hp: number | undefined
  let maxHp: number | undefined
  let ac: number | undefined
  if (full) {
    try {
      const d = runtimeDerived(full, props.content)
      hp = full.runtime?.hp ?? d.hp
      maxHp = d.hp
      ac = d.ac
    } catch {
      /* 数据不完整时只显示姓名 */
    }
  }
  return {
    key: 'player:' + id,
    name,
    portrait,
    kind: 'player',
    characterId: id,
    hp,
    maxHp,
    ac,
    tokenId: props.view.scene?.tokens.find((t) => t.characterId === id)?.id,
  }
}
function npcOption(
  tokenId: string,
  name: string,
  portrait?: string | null,
  npcType?: 'important' | 'ordinary',
  statuses?: Option['statuses'],
  hp?: number,
  maxHp?: number,
): Option {
  return {
    key: 'npc:' + tokenId,
    name,
    portrait,
    kind: 'npc',
    npcType,
    tokenId,
    statuses,
    hp,
    maxHp,
  }
}

const options = computed<Option[]>(() => {
  const tokens = props.view.scene?.tokens ?? []
  const encounter = props.view.encounter
  const list: Option[] = []
  if (encounter?.phase === 'active') {
    for (const actor of encounter.actors) {
      if (actor.characterId) {
        const known = props.view.characters.find((c) => c.id === actor.characterId)
        list.push(playerOption(actor.characterId, actor.name, actor.portrait ?? known?.portrait))
      } else {
        const token = tokens.find((t) => t.actorId === actor.id || t.npcId === actor.id)
        list.push(
          npcOption(
            token?.id ?? actor.id,
            actor.name,
            actor.portrait ?? token?.portrait,
            token?.npcType,
            actor.statuses,
            props.gm ? token?.npcBody?.hp : undefined,
            props.gm ? token?.npcBody?.maxHp : undefined,
          ),
        )
      }
      const added = list.at(-1)!
      added.actorId = actor.id
      added.initiative = actor.initiative
      added.statuses = actor.statuses
    }
    return list
  } else {
    const seen = new Set<string>()
    for (const c of props.view.characters) {
      seen.add(c.id)
      list.push(playerOption(c.id, c.name, c.portrait))
    }
    for (const t of tokens) {
      if (!t.npcType && !t.npcId) continue
      if (t.characterId && seen.has(t.characterId)) continue
      list.push(
        npcOption(
          t.id,
          t.name,
          t.portrait,
          t.npcType,
          t.statuses,
          props.gm ? t.npcBody?.hp : undefined,
          props.gm ? t.npcBody?.maxHp : undefined,
        ),
      )
    }
  }
  for (const option of list) {
    if (option.characterId)
      option.statuses = tokens.find((t) => t.characterId === option.characterId)?.statuses
  }
  const weight = (o: Option) => (o.kind === 'player' ? 0 : o.npcType === 'important' ? 1 : 2)
  return list
    .map((o, index) => ({ o, index }))
    .sort((a, b) => weight(a.o) - weight(b.o) || a.index - b.index)
    .map((x) => x.o)
})

const kindLabel = (o: Option) =>
  o.kind === 'player' ? '玩家角色' : o.npcType === 'important' ? '重要 NPC' : '普通 NPC'
const canOpen = (o: Option) =>
  o.kind === 'npc' ? !!o.tokenId : props.gm || o.characterId === props.currentCharacterId

function open(o: Option) {
  if (!canOpen(o)) return
  if (o.kind === 'npc') {
    if (o.tokenId) emit('focusToken', o.tokenId)
    return
  }
  if (o.characterId) {
    if (o.characterId !== props.currentCharacterId) emit('select', o.characterId)
    else emit('navigate', 'character')
  }
}
</script>
<template>
  <section v-if="options.length" class="rail-card quick-list" :aria-label="controlText('domain.characterOverview')">
    <header class="quick-list-head">
      <strong>{{
        view.encounter?.phase === 'active'
          ? controlText('expressionFour.combatInitiativeRound') + view.encounter.round + controlText('game.rounds')
          : controlText('expressionFour.sceneCharacters')
      }}</strong>
      <small>{{ options.length }}</small>
    </header>
    <ul>
      <li v-for="o in options" :key="o.key">
        <button
          type="button"
          class="quick-item"
          :class="{
            on: o.kind === 'player' && o.characterId === currentCharacterId,
            current: !!o.actorId && o.actorId === view.encounter?.currentId,
          }"
          :disabled="!canOpen(o)"
          @click="open(o)"
        >
          <CharacterAvatar :name="o.name" :portrait="o.portrait" :size="40" />
          <span class="quick-main">
            <span class="quick-name"
              ><b>{{ localizedEntryName(o) }}</b
              ><i>{{ uiLabel(kindLabel(o)) }}</i></span
            >
            <span class="quick-facts">
              <span v-if="o.actorId"
                >{{ controlText('controls.initiative') }} {{ o.initiative ?? controlText('expressionTwo.undetermined')
                }}{{ o.actorId === view.encounter?.currentId ? controlText('expressionFour.currentTurn') : '' }}</span
              >
              <span v-if="o.hp != null">{{ controlText('domain.hp') }} {{ o.hp }} / {{ o.maxHp }}</span>
              <span v-else>{{ controlText('resourceFlow.hpNotPublic') }}</span>
              <span v-if="o.ac != null">AC {{ o.ac }}</span>
            </span>
            <span v-if="o.statuses?.length" class="quick-tags"
              >{{
                o.statuses
                  .slice(0, 2)
                  .map((s) => localizedEntryName(s))
                  .join(' · ')
              }}<small v-if="o.statuses.length > 2">＋{{ o.statuses.length - 2 }}</small></span
            >
          </span>
        </button>
        <details v-if="o.statuses?.length" class="quick-status">
          <summary>{{ controlText('scriptSummary.conditionDetails', {p0:(localizedEntryName(o))}) }}</summary>
          <div v-for="s in o.statuses" :key="s.id">
            {{ localizedEntryName(s) }}{{ s.source ? controlText('expressionFour.source') + s.source : ''
            }}{{ s.duration ? ' · ' + s.duration : '' }}{{ s.concentration ? controlText('expressionFour.maintainedConcentration') : '' }}
            <select
              v-if="gm && s.visibility && o.tokenId"
              :value="s.visibility"
              :aria-label="localizedEntryName(o) + ' · ' + localizedEntryName(s) + controlText('domain.visibility')"
              @change="
                emit(
                  'visibility',
                  o.tokenId!,
                  s.id,
                  ($event.target as HTMLSelectElement).value as 'public' | 'owner' | 'gm',
                )
              "
            >
              <option value="owner">{{ controlText('resourceFlow.selfAndGm') }}</option>
              <option value="public">{{ controlText('resourceFlow.publicName') }}</option>
              <option value="gm">{{ controlText('game.gmOnly') }}</option>
            </select>
          </div>
        </details>
      </li>
    </ul>
  </section>
</template>
<style scoped>
.quick-list {
  display: grid;
  gap: 8px;
  padding: 10px 11px;
}
.quick-list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.quick-list-head strong {
  font-size: 13px;
}
.quick-list-head small {
  color: var(--muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
.quick-list ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: clamp(220px, calc(100vh - 520px), 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.quick-item {
  width: 100%;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 7px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  text-align: left;
  cursor: pointer;
}
.quick-item:hover:not(:disabled) {
  border-color: var(--accent);
}
.quick-item.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.quick-item.current {
  border-left: 4px solid var(--gold);
}
.quick-status {
  font-size: 12px;
  margin-top: 3px;
  overflow-wrap: anywhere;
}
.quick-status summary {
  padding: 5px 8px;
  min-height: 32px;
}
.quick-status div {
  padding: 5px;
}
.quick-status select {
  font-size: 12px;
}
.quick-item:disabled {
  cursor: default;
  opacity: 0.85;
}
.quick-main {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.quick-name {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.quick-name b {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-name i {
  flex: none;
  padding: 0 5px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-style: normal;
  line-height: 1.6;
}
.quick-facts {
  display: flex;
  gap: 8px;
  font-size: 11.5px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.quick-tags {
  font-size: 11.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-item.on .quick-name i {
  background: var(--panel);
}
</style>
