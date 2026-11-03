<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
import { clone } from '../../core/engine'
import { roleReference } from '../../core/script'
import type { ScriptDefinition } from '../../persistence/script-schema'
import type { BattlePreset, BattleMapCommand } from '../../core/battle-types'
import PracticalBattlePolicyEditor from '../review/PracticalBattlePolicyEditor.vue'
const props = defineProps<{ definition: ScriptDefinition }>(),
  emit = defineEmits<{ command: [c: BattleMapCommand] }>()
const selected = ref(''),
  draft = ref<BattlePreset>({
    id: crypto.randomUUID(),
    sceneId: props.definition.scenes[0]!.id,
    name: '新的战斗预设',
    intro: '',
    participants: [],
  })
const options = computed(() => [
  ...props.definition.roles.map((r) => ({
    kind: 'character' as const,
    id: roleReference(r.id),
    name: r.name + '（角色位）',
    side: 'party' as const,
  })),
  ...props.definition.npcs
    .filter((n) => n.sceneId === draft.value.sceneId)
    .map((n) => ({ kind: 'npc' as const, id: n.id, name: n.name, side: n.side })),
  ...(props.definition.scenes.find((s) => s.id === draft.value.sceneId)?.tokens ?? [])
    .filter((t) => !t.npcId && t.npcBody)
    .map((t) => ({ kind: 'token' as const, id: t.id, name: t.name, side: 'enemy' as const })),
])
function load() {
  draft.value = clone(
    props.definition.battles.find((b) => b.id === selected.value) ?? {
      id: crypto.randomUUID(),
      sceneId: props.definition.scenes[0]!.id,
      name: '新的战斗预设',
      intro: '',
      participants: [],
    },
  )
}
function toggle(o: (typeof options.value)[number], checked: boolean) {
  draft.value.participants = draft.value.participants.filter(
    (p) => !(p.kind === o.kind && p.id === o.id),
  )
  if (checked) draft.value.participants.push({ kind: o.kind, id: o.id, side: o.side })
}
function save() {
  emit('command', { type: 'battle-preset', preset: clone(draft.value) })
  selected.value = draft.value.id
}
function remove() {
  emit('command', { type: 'battle-preset-delete', presetId: selected.value })
  selected.value = ''
  load()
}
</script>
<template>
  <section class="script-card">
    <h2>{{ controlText('authoringFlow.combatPresets') }}</h2>
    <p class="muted">
      {{ controlText('authoringFlow.savesCombatRosterAndOpeningTextAfterGame') }}
    </p>
    <label
      >{{ controlText('remainingField.existingCombatPresets') }}<select v-model="selected" @change="load">
        <option value="">{{ controlText('game.create') }}</option>
        <option v-for="b in definition.battles" :key="b.id" :value="b.id">{{ localizedEntryName(b) }}</option>
      </select></label
    >
    <label>{{ controlText('remainingField.combatPresetName') }}<input v-model="draft.name" maxlength="120" /></label
    ><label
      >{{ controlText('remainingField.presetScene') }}<select v-model="draft.sceneId" @change="draft.participants = []">
        <option v-for="s in definition.scenes" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
      </select></label
    >
    <div v-for="o in options" :key="o.kind + o.id" class="script-role">
      <label class="check"
        ><input
          type="checkbox"
          :checked="draft.participants.some((p) => p.kind === o.kind && p.id === o.id)"
          @change="toggle(o, ($event.target as HTMLInputElement).checked)"
        />{{ localizedEntryName(o) }}</label
      >
      <label v-if="draft.participants.find((p) => p.kind === o.kind && p.id === o.id)"
        >{{ controlText('game.side') }}<select
          v-model="draft.participants.find((p) => p.kind === o.kind && p.id === o.id)!.side"
        >
          <option value="party">{{ controlText('controls.party') }}</option>
          <option value="enemy">{{ controlText('domain.enemy') }}</option>
          <option value="neutral">{{ controlText('game.neutral') }}</option>
        </select></label
      >
    </div>
    <label>{{ controlText('remainingField.combatOpening') }}<textarea v-model="draft.intro" maxlength="4000" rows="3"></textarea></label>
    <PracticalBattlePolicyEditor v-model="draft.practical" :npcs="definition.npcs.filter(n=>n.sceneId===draft.sceneId)" />
    <div class="script-actions">
      <button class="primary" :disabled="!draft.name.trim()" @click="save">{{ controlText('game.saveBattle') }}</button
      ><button v-if="selected" class="subtle" @click="remove">{{ controlText('authoringFlow.deletePreset') }}</button>
    </div>
  </section>
</template>
