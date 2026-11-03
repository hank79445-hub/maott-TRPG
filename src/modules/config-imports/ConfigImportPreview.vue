<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import { CONDITIONS } from '../../content/conditions'
import { clone } from '../../core/engine'
import { catalogue, newCharacter } from '../../core/engine'
import { resources } from '../../core/runtime'
import { BUILTIN_PACKS } from '../../content/builtin-packs'
import type { NpcConfigDocument, ConfigMapping } from '../../persistence/npc-config-schema'
const props = defineProps<{
  document: NpcConfigDocument
  mapping: ConfigMapping
  scenes: { id: string; name: string }[]
  subjects: { id: string; name: string }[]
  locked: boolean
}>()
const emit = defineEmits<{ update: [mapping: ConfigMapping] }>()
function change(fn: (m: ConfigMapping) => void) {
  const m = clone(props.mapping)
  fn(m)
  emit('update', m)
}
function scene(id: string, event: Event) {
  change((m) => (m.scenes[id] = (event.target as HTMLSelectElement).value))
}
function subject(id: string, event: Event) {
  change((m) => (m.subjects[id] = (event.target as HTMLSelectElement).value))
}
function row(id: string, key: string, event: Event) {
  const target = event.target as HTMLInputElement
  change((m) => {
    const r = m.entries.find((e) => e.id === id)!
    if (key === 'hp' && !target.value) {
      delete r.hp
      return
    }
    Object.assign(r, {
      [key]:
        target.type === 'checkbox'
          ? target.checked
          : target.type === 'number'
            ? Number(target.value)
            : target.value,
    })
  })
}
function condition(id: string, key: string, event: Event) {
  change((m) => {
    const r = m.entries.find((e) => e.id === id)!,
      n = props.document.npcs.find((n) => n.id === id)!,
      card = props.document.characters.find((c) => c.id === n.characterId)
    const current = r.conditions ?? n.body?.conditions ?? card?.initial.conditions ?? []
    r.conditions = (event.target as HTMLInputElement).checked
      ? [...new Set([...current, key])]
      : current.filter((c) => c !== key)
  })
}
const npcs = computed(() =>
  props.mapping.entries.map((r) => ({
    r,
    n: props.document.npcs.find((n) => n.id === r.id)!,
    card: props.document.characters.find(
      (c) => c.id === props.document.npcs.find((n) => n.id === r.id)?.characterId,
    ),
  })),
)
function pools(card: NpcConfigDocument['characters'][number]) {
  try {
    return resources(
      { ...newCharacter(), ...card },
      catalogue([...BUILTIN_PACKS, ...props.document.packs]),
    )
  } catch {
    return []
  }
}
function resource(id: string, key: string, event: Event) {
  const input = event.target as HTMLInputElement
  change((m) => {
    const r = m.entries.find((e) => e.id === id)!
    r.resources ??= {}
    if (!input.value) delete r.resources[key]
    else r.resources[key] = Number(input.value)
  })
}
</script>
<template>
  <fieldset :disabled="locked" class="config-grid">
    <legend>{{ controlText('operations.sceneAndExternalObjectBindings') }}</legend>
    <label v-for="s in document.scenes" :key="s.id"
      >{{ localizedEntryName(s) }} {{ controlText('field.destinationScene') }}<select
        :value="mapping.scenes[s.id] ?? ''"
        @change="scene(s.id, $event)"
      >
        <option value="">{{ controlText('game.choose') }}</option>
        <option v-for="t in scenes" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
      </select></label
    >
    <label v-for="s in document.subjects" :key="s.id"
      >{{ localizedEntryName(s) }} {{ controlText('field.actualCharacterCharacterSlot') }}<select
        :value="mapping.subjects[s.id] ?? ''"
        @change="subject(s.id, $event)"
      >
        <option value="">{{ controlText('operations.leaveUnboundDependentFeaturesMustBeDisabled') }}</option>
        <option v-for="t in subjects" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
      </select></label
    >
  </fieldset>
  <div class="config-preview-list">
    <details v-for="{ r, n, card } in npcs" :key="r.id" open class="config-preview-item">
      <summary>
        {{ localizedEntryName(r) }} · {{ n.npcType === 'important' ? controlText('domain.important') : controlText('domain.normal') }} NPC ·
        {{ card ? controlText('expressionOne.independentClassCard') : n.body ? controlText('expressionOne.compactStatBlock') : controlText('expressionOne.textOnlyConfiguration') }}
      </summary>
      <fieldset :disabled="locked" class="config-grid">
        <legend class="sr-only">{{ controlText('quantity.importConfig', {p0:(localizedEntryName(r))}) }}</legend>
        <label
          >{{ controlText('field.newName') }}<input :value="r.name" maxlength="120" @input="row(r.id, 'name', $event)"
        /></label>
        <label
          >{{ controlText('field.destinationXZeroBased') }}<input
            :value="r.x"
            type="number"
            min="0"
            max="79"
            @input="row(r.id, 'x', $event)"
        /></label>
        <label
          >{{ controlText('field.destinationYZeroBased') }}<input
            :value="r.y"
            type="number"
            min="0"
            max="79"
            @input="row(r.id, 'y', $event)"
        /></label>
        <label class="check"
          ><input :checked="r.enabled" type="checkbox" @change="row(r.id, 'enabled', $event)" />{{ controlText('field.enableNpcDisabledByDefault') }}</label
        >
        <label v-if="n.autoDialogue" class="check"
          ><input
            :checked="r.autoReply"
            type="checkbox"
            @change="row(r.id, 'autoReply', $event)"
          />{{ controlText('field.reauthorizeAutomaticReplies') }}</label
        >
        <label v-if="n.followParty" class="check"
          ><input
            :checked="r.follow"
            type="checkbox"
            @change="row(r.id, 'follow', $event)"
          />{{ controlText('field.reallowFollowingTheParty') }}</label
        >
        <label v-if="n.activity.enabled" class="check"
          ><input
            :checked="r.activity"
            type="checkbox"
            @change="row(r.id, 'activity', $event)"
          />{{ controlText('field.enableProactiveActionsRequiresALinkedSubject') }}</label
        >
        <label v-if="n.combatPolicy.strategy === 'protect'" class="check"
          ><input
            :checked="r.protect"
            type="checkbox"
            @change="row(r.id, 'protect', $event)"
          />{{ controlText('field.enableProtectedCharacterSwitchesToGuardWhenDisabled') }}</label
        >
        <label v-if="card || n.body"
          >{{ controlText('field.initialHp') }}<input
            :value="r.hp ?? n.body?.hp ?? card?.initial.hp ?? ''"
            :placeholder="card ? controlText('expressionOne.blankUsesCharacterMaximumHp') : ''"
            type="number"
            min="0"
            @change="row(r.id, 'hp', $event)"
        /></label>
      </fieldset>
      <p v-if="card">
        {{ controlText('liveSummary.levelInventoryEntriesRetainsClassAndEquipment', {p0:(card.build.classId),p1:(card.level),p2:(card.inventory.length)}) }}</p>
      <details v-if="card || n.body">
        <summary>{{ controlText('operations.initialStateAndResources') }}</summary>
        <fieldset :disabled="locked" class="config-grid">
          <legend class="sr-only">{{ controlText('domain.initialState') }}</legend>
          <label v-for="c in CONDITIONS" :key="c.id" class="check"
            ><input
              type="checkbox"
              :checked="
                (r.conditions ?? n.body?.conditions ?? card?.initial.conditions ?? []).includes(
                  c.id,
                )
              "
              @change="condition(r.id, c.id, $event)"
            />{{ localizedEntryName(c) }}</label
          >
        </fieldset>
        <p>{{ controlText('liveSummary.temporaryHpResourcesHealthyCopiesRestoreMaxima', {p0:(n.body?.temporaryHp ?? card?.initial.temporaryHp ?? 0),p1:(JSON.stringify(card?.initial.resources ?? {}))}) }}</p>
        <fieldset v-if="card" :disabled="locked" class="config-grid">
          <legend>{{ controlText('operations.initialResourceUsesEmptyUseFileValuesUnspecified') }}</legend>
          <label v-for="p in pools(card)" :key="p.id"
            >{{ localizedEntryName(p) }}／{{ p.max
            }}<input
              :value="r.resources?.[p.id] ?? card.initial.resources?.[p.id] ?? ''"
              :placeholder="String(p.max)"
              type="number"
              min="0"
              :max="p.max"
              @change="resource(r.id, p.id, $event)"
          /></label>
        </fieldset>
      </details>
    </details>
  </div>
</template>
