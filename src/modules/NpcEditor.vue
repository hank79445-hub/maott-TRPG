<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import NpcDesignEditor from './NpcDesignEditor.vue'
import NpcPersonaEditor from './NpcPersonaEditor.vue'
import LongTextField from './LongTextField.vue'
import {vNpcAutoHeight} from './npc-auto-height'
import MerchantPolicyEditor from './trade/MerchantPolicyEditor.vue'
import NpcSocialPolicyEditor from './review/NpcSocialPolicyEditor.vue'
import { npcLifeState } from '../core/npc-life-state'
import { computed, ref, watch } from 'vue'
import { NPC_LIMIT } from '../core/configuration-limits'
import { clone, catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { newNpcProfile, recommendedNpcActivity } from '../core/ai'
import { NPC_BEHAVIORS } from '../core/ai-types'
import { NPC_ACTIVITY_EVENTS } from '../core/ai-types'
import { npcCapabilities } from '../core/npc-strategy'
import { runtimeSpells } from '../core/runtime'
import { useWorkshop } from '../app/store'
import NpcBodyEditor from './NpcBodyEditor.vue'
import NpcMonsterDefinitionEditor from './NpcMonsterDefinitionEditor.vue'
import NpcActivityEditor from './NpcActivityEditor.vue'
import NpcMemoryEditor from './NpcMemoryEditor.vue'
import NpcDialogueReviewEditor from './NpcDialogueReviewEditor.vue'
import PortraitPicker from './PortraitPicker.vue'
import CharacterAvatar from './CharacterAvatar.vue'
import NpcConfigTools from './config-imports/NpcConfigTools.vue'
import { npcPortrait } from '../core/portraits'
import { NPC_TEMPLATES, npcTemplate } from '../content/npc-templates'
import NpcTemplatePicker from './NpcTemplatePicker.vue'
import type { RoomView, RoomCommand } from '../online/protocol'
const props = defineProps<{
    view: Pick<RoomView, 'world' | 'scene' | 'sceneNames' | 'packs' | 'characters' | 'encounter' | 'gmReview'>
    busy: boolean
    modelProfiles?: { name: string }[]
    designOnly?: boolean
    submitCommand?: (command: RoomCommand, requestId?: string) => Promise<boolean>
  }>(),
  emit = defineEmits<{ command: [command: RoomCommand]; navigate: [tab: string] }>()
const practicalText = computed(()=>props.view.gmReview?.settings?.mode==='assisted' && !props.view.gmReview.settings.paused && !!props.view.gmReview.settings.practical?.enabled && !!props.view.gmReview.settings.practical.text)
const newId = () => crypto.randomUUID()
function changeImportance(event: Event) {
  draft.value.importanceRole = (event.target as HTMLSelectElement).value as 'resident' | 'companion'
  if (draft.value.importanceRole === 'resident') draft.value.followParty = false
}
const NPCPAGES = [
  ['basic', '基本资料'],
  ['persona', '人设与知识'],
  ['stats', '能力与数据卡'],
  ['combat', '战斗策略'],
  ['talk', '公开交谈与知识'],
  ['trade', '交易与授权'],
] as const
const NPC_PAGE_KEY = 'trpg-npc-page'
function readPage() {
  try {
    const saved = localStorage.getItem(NPC_PAGE_KEY)
    if (saved && NPCPAGES.some((p) => p[0] === saved)) return saved
  } catch {}
  return 'basic'
}
const page = ref<string>(readPage())
const selected = ref(''),
  draft = ref(
    newNpcProfile(props.view.scene?.id ?? props.view.sceneNames[0]?.id ?? '', 'ordinary'),
  ),
  item = ref('torch'),
  itemSearch = ref(''),
  dirty = ref(false)
const saveState = ref<'idle' | 'pending' | 'saved'>('idle')
const saveLabel = computed(() => {
  if (saveState.value === 'pending' || dirty.value) return '有未保存修改'
  if (!selected.value) return '新增 NPC'
  return '已保存'
})
let saveTimer: ReturnType<typeof setTimeout> | undefined
function canPersist() {
  return !!draft.value.name?.trim() && !!draft.value.sceneId
}
function persistDraft() {
  emit('command', { kind: 'map', command: { type: 'npc-profile', profile: clone(draft.value) } })
}
const pendingSelect = ref('')
function onEdit() {
  dirty.value = true
  scheduleSave()
}
function scheduleSave() {
  if (!canPersist()) {
    saveState.value = 'idle'
    return
  }
  saveState.value = 'pending'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => save(), 800)
}
watch(page, (value) => {
  try {
    localStorage.setItem(NPC_PAGE_KEY, value)
  } catch {}
})
const npcs = computed(() => props.view.world?.adventures[0]?.ai?.npcs ?? []),
  cat = computed(() => catalogue([srd, ...props.view.packs])),
  items = computed(() =>
    cat.value.items
      .filter(
        (i) =>
          i.kind !== 'pack' &&
          (!itemSearch.value ||
            i.name.includes(itemSearch.value) ||
            i.id.includes(itemSearch.value)),
      )
      .slice(0, 100),
  )
const npcSearch = ref(''),
  npcScene = ref(''),
  npcType = ref('')
const filteredNpcs = computed(() =>
  npcs.value.filter(
    (n) =>
      (!npcSearch.value ||
        n.name.toLocaleLowerCase().includes(npcSearch.value.toLocaleLowerCase())) &&
      (!npcScene.value || n.sceneId === npcScene.value) &&
      (!npcType.value || n.npcType === npcType.value),
  ),
)
// Filtering is presentation only: keep the selected option and current unsaved editor.
const selectableNpcs = computed(() => {
  const chosen = npcs.value.find((n) => n.id === selected.value)
  return chosen && !filteredNpcs.value.includes(chosen)
    ? [chosen, ...filteredNpcs.value]
    : filteredNpcs.value
})
const NPC_CHIP_LIMIT = 16
const showAllNpcs = ref(false)
const visibleNpcs = computed(() =>
  showAllNpcs.value ? filteredNpcs.value : filteredNpcs.value.slice(0, NPC_CHIP_LIMIT),
)
const sideLabel = computed(
  () =>
    ({ enemy: '敌方', party: '友方', neutral: '中立' } as Record<string, string>)[
      draft.value.side
    ] ?? '中立',
)
function selectNpc(id: string) {
  selected.value = id
}
function addNpc() {
  selected.value = ''
  load()
}
const actors = computed(
  () =>
    props.view.world?.encounters
      .find(
        (e) =>
          e.id ===
          props.view.world?.adventures[0]?.scenes.find((s) => s.id === draft.value.sceneId)
            ?.encounterId,
      )
      ?.actors.filter((a) => a.npc && !a.companion && !a.characterId) ?? [],
)
function load() {
  draft.value = clone(
    npcs.value.find((n) => n.id === selected.value) ??
      newNpcProfile(props.view.scene?.id ?? props.view.sceneNames[0]?.id ?? '', 'ordinary'),
  )
  const live = props.view.world?.encounters
    .flatMap((e) => e.actors)
    .find((a) => a.id === draft.value.actorId)?.npc
  if (live && !draft.value.characterId) draft.value.body = clone(live)
  dirty.value = false
  saveState.value = selected.value ? 'saved' : 'idle'
}
watch(selected, (_value, old) => {
  clearTimeout(saveTimer)
  if (old && dirty.value && canPersist()) persistDraft()
  load()
})
watch(
  () => npcs.value.map((n) => n.id + ':' + n.revision).join(','),
  () => {
    if (pendingSelect.value) {
      const created = npcs.value.find((n) => n.id === pendingSelect.value)
      if (created) {
        selected.value = pendingSelect.value
        pendingSelect.value = ''
        return
      }
    }
    if (dirty.value) return
    const latest = npcs.value.find((n) => n.id === draft.value.id)
    if (latest && JSON.stringify(latest) === JSON.stringify(draft.value)) return
    load()
  },
)
function save() {
  if (!canPersist()) return
  clearTimeout(saveTimer)
  persistDraft()
  dirty.value = false
  saveState.value = 'saved'
  if (!selected.value) {
    const id = draft.value.id
    pendingSelect.value = id
    const trySelect = (tries = 20) => {
      if (npcs.value.some((n) => n.id === id)) {
        selected.value = id
        pendingSelect.value = ''
        return
      }
      if (tries > 0) setTimeout(() => trySelect(tries - 1), 150)
    }
    setTimeout(trySelect, 150)
  } else if (selected.value !== draft.value.id) selected.value = draft.value.id
}
const names = {
  interact: '地图互动',
  travel: '已知路线旅行',
  move: '移动',
  action: '使用动作',
  ability: '使用已配置能力',
  hostile: '敌对',
  'start-combat': '发起战斗',
  attack: '攻击',
  flee: '逃跑',
  surrender: '投降',
  alert: '警报',
  promise: '承诺',
  trade: '交易',
  reveal: '线索公开',
}
const workshop = useWorkshop(),
  templateId = ref('')
const copyConfirmed = ref(false)
watch(templateId, () => {
  copyConfirmed.value = false
})
const copyPreview = computed(() => templates.value.find((c) => c.id === templateId.value))
const templates = computed(() =>
    workshop.characters.filter((c) => c.status === 'complete' && !c.npcOwnerId),
  ),
  role = computed(() => props.view.world?.characters.find((c) => c.id === draft.value.characterId))
const resolvedPortrait = computed(() =>
  npcPortrait(
    draft.value,
    role.value,
    props.view.world?.adventures[0]?.ai?.settings.npcPortrait,
    props.view.world?.adventures[0]?.ai?.templates?.find((t) => t.id === draft.value.templateId),
  ),
)
function setPortrait(image: string | null) {
  draft.value.portrait = image
  dirty.value = true
}
function setIllustration(image: string | null) {
  draft.value.illustration = image
  dirty.value = true
}
const available = computed(() =>
  props.view.world ? npcCapabilities(props.view.world, draft.value, true) : [],
)
const missingAbilities = computed(() =>
  available.value.filter((a) => !draft.value.abilities.some((old) => old.id === a.id)),
)
function supplementAbilities() {
  draft.value.abilities.push(...missingAbilities.value.map((a) => clone(a)))
  dirty.value = true
}
const bodyLocked = computed(
  () =>
    props.view.world?.encounters.some(
      (e) => e.phase !== 'ended' && e.actors.some((a) => a.id === draft.value.actorId),
    ) ?? false,
)
const creatureTemplate = ref(''),
  creatureTemplates = computed(() => [
    ...NPC_TEMPLATES,
    ...(props.view.world?.adventures[0]?.ai?.templates ?? []),
  ])
function applyTemplate() {
  const t = npcTemplate(creatureTemplate.value, props.view.world?.adventures[0]?.ai?.templates)
  if (!t || bodyLocked.value) return
  draft.value.body = clone(t.body)
  draft.value.body.name = draft.value.name
  draft.value.templateId = t.id
  draft.value.combatPolicy.strategy = t.strategy
  draft.value.combatPolicy.attackIds = []
  draft.value.combatPolicy.monsterAbilityIds = []
  draft.value.abilities = []
  if (draft.value.npcType === 'ordinary')
    draft.value.turnMode = t.metadata?.requiresManualTurn ? 'manual' : 'automatic'
  dirty.value = true
}
function saveTemplate() {
  if (!draft.value.body) return
  const body = clone(draft.value.body)
  body.hp = body.maxHp
  body.temporaryHp = 0
  body.conditions = []
  body.effects = []
  body.dead = false
  emit('command', {
    kind: 'map',
    command: {
      type: 'npc-template',
      template: {
        id: 'custom-' + crypto.randomUUID(),
        name: draft.value.name,
        body,
        source: 'GM 自定义模板',
        strategy: draft.value.combatPolicy.strategy,
        portrait: draft.value.portrait,
        notes: [],
        metadata: body.templateMetadata && clone(body.templateMetadata),
      },
    },
  })
}
function copyRole() {
  const c = templates.value.find((c) => c.id === templateId.value)
  if (c && selected.value && copyConfirmed.value && !bodyLocked.value) {
    dirty.value = false
    emit('command', {
      kind: 'npc-character-copy',
      npcId: selected.value,
      archive: JSON.parse(workshop.exportArchive(c)),
      replace: !!draft.value.characterId,
    })
  }
}
function toggleMonsterAbility(id: string, enabled: boolean) {
  draft.value.combatPolicy.monsterAbilityIds ??= []
  if (enabled) {
    draft.value.combatPolicy.monsterAbilityIds.push(id)
    addAbility('monster:' + id)
    if (!draft.value.allowed.includes('ability')) draft.value.allowed.push('ability')
  } else {
    draft.value.combatPolicy.monsterAbilityIds = draft.value.combatPolicy.monsterAbilityIds.filter(
      (a) => a !== id,
    )
    draft.value.abilities = draft.value.abilities.filter((a) => a.id !== 'monster:' + id)
  }
  dirty.value = true
}
function addAbility(id: string) {
  const source = available.value.find((a) => a.id === id)
  if (source && !draft.value.abilities.some((a) => a.id === id)) {
    draft.value.abilities.push(clone(source))
    dirty.value = true
  }
}
function addDialogue() {
  draft.value.dialogue.push({ id: crypto.randomUUID(), when: 'default', text: '' })
  dirty.value = true
}
function changeType() {
  draft.value.turnMode = draft.value.npcType === 'ordinary' ? 'automatic' : 'plan'
  if (draft.value.npcType === 'ordinary') {
    draft.value.followParty = false
    draft.value.tacticalInput = false
  }
  if (draft.value.npcType === 'ordinary') {
    draft.value.controller = 'gm'
    draft.value.activity.enabled = false
  } else {
    draft.value.controller = 'model'
    draft.value.activity = recommendedNpcActivity()
  }
}
function applyActivityDefaults() {
  const defaults = recommendedNpcActivity(),
    existing = draft.value.activity.templates ?? []
  draft.value.activity = {
    ...draft.value.activity,
    enabled: true,
    events: defaults.events,
    templates: [
      ...existing,
      ...defaults.templates!.filter((t) => !existing.some((e) => e.type === t.type)),
    ].slice(0, 30),
  }
  dirty.value = true
}
const eventNames: Record<string, string> = {
  'scene.enter': '进入场景',
  'token.moved': '角色移动',
  'point.result': '互动完成',
  'target.resolved': '攻击／施法最终结算',
  'gm.mark': 'GM 已确认进程',
}
function addStock() {
  if (!draft.value.stock.some((s) => s.itemId === item.value))
    draft.value.stock.push({
      itemId: item.value,
      quantity: 1,
      priceGP: cat.value.items.find((i) => i.id === item.value)?.cost ?? 0,
    })
}
function addSecret() {
  draft.value.secrets.push({ id: crypto.randomUUID(), text: '' })
}
function removeSecret(index: number) {
  const secret = draft.value.secrets[index]!
  draft.value.secrets.splice(index, 1)
  draft.value.preauthorization.revealIds = draft.value.preauthorization.revealIds.filter(
    (id) => id !== secret.id,
  )
}
function removeNpc() {
  emit('command', { kind: 'map', command: { type: 'npc-delete', npcId: selected.value } })
  selected.value = ''
}
</script>
<template>
  <section v-npc-auto-height class="npc-editor">
    <div class="npc-filter">
      <label>{{ controlText('ai.searchNpc') }}<input v-model="npcSearch" type="search" :placeholder="controlText('domain.enterName')" /></label>
      <label
        >{{ controlText('controls.scene') }}<select v-model="npcScene">
          <option value="">{{ controlText('ai.allScenes') }}</option>
          <option v-for="s in view.sceneNames" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
        </select></label
      >
      <label
        >{{ controlText('controls.type') }}<select v-model="npcType">
          <option value="">{{ controlText('ai.allTypes') }}</option>
          <option value="important">{{ controlText('ai.importantNpc') }}</option>
          <option value="ordinary">{{ controlText('ai.ordinaryNpc') }}</option>
        </select></label
      >
      <button type="button" class="secondary" :disabled="busy || npcs.length >= NPC_LIMIT" @click="addNpc">
        {{ controlText('ai.newNpc') }}
      </button>
    </div>
    <p class="npc-filter-note">
      {{ controlText('liveSummary.shownTotalLimitFilteringDoesNotSwitch', {p0:(controlText('domain.match')),p1:(filteredNpcs.length),p2:(npcs.length),p3:(NPC_LIMIT)}) }}</p>
    <p v-if="npcs.length >= NPC_LIMIT * 0.8" class="npc-filter-note warning" role="status">
      {{ controlText('ai.capacityWarning') }}
    </p>
    <details class="npc-tools">
      <summary>{{ controlText('ai.copyImportExport') }}</summary>
      <NpcConfigTools
        v-if="view.world && view.world.adventures[0] && submitCommand"
        :world="view.world"
        :adventure="view.world.adventures[0]"
        :subjects="view.characters"
        :busy="busy"
        :submit-command="(c, id) => submitCommand!({ kind: 'map', command: c }, id)"
      />
    </details>
    <nav class="npc-picker" :aria-label="controlText('game.npc')">
      <button
        v-for="n in visibleNpcs"
        :key="n.id"
        type="button"
        class="npc-chip"
        :class="{ on: n.id === selected }"
        @click="selectNpc(n.id)"
      >
        {{ localizedEntryName(n) }}<small v-if="!n.enabled">{{ controlText('ai.disabledSuffix') }}</small>
      </button>
      <button
        v-if="filteredNpcs.length > visibleNpcs.length"
        type="button"
        class="npc-chip more"
        @click="showAllNpcs = true"
      >{{ controlText('liveSummary.more', {p0:(filteredNpcs.length - visibleNpcs.length)}) }}</button>
    </nav>
    <header class="npc-edit-head">
      <div>
        <h3>{{ localizedEntryName(draft) || controlText('expressionTwo.addNpc') }}</h3>
        <span
          >{{ draft.npcType === 'important' ? controlText('ai.importantNpc') : controlText('ai.ordinaryNpc') }} · {{ sideLabel }} ·
          {{ saveLabel }}</span
        >
      </div>
      <button v-if="selected" type="button" class="danger-text" :disabled="busy" @click="removeNpc">
        {{ controlText('controls.remove') }}
      </button>
    </header>
    <nav class="npc-pages" :aria-label="controlText('ai.npcPages')">
      <button
        v-for="p in NPCPAGES"
        :key="p[0]"
        type="button"
        :class="{ on: page === p[0] }"
        @click="page = p[0]"
      >
        {{ uiLabel(p[1]) }}
      </button>
    </nav>
    <form class="npc-page" @input="onEdit" @change="onEdit" @submit.prevent="save">
      <section v-show="page === 'basic'" class="npc-sec">
      <p class="muted ai-wide">
        {{ controlText('ai.restorePositionHelp') }}
      </p>
      <button
        type="button"
        class="subtle ai-wide"
        :disabled="
          busy || !npcs.some((n) => n.npcType === 'important' && n.sceneId === draft.sceneId)
        "
        @click="
          emit('command', {
            kind: 'map',
            command: {
              type: 'npc-party-scope',
              npcIds: npcs
                .filter((n) => n.npcType === 'important' && n.sceneId === draft.sceneId)
                .map((n) => n.id),
            },
          })
        "
      >
        {{ controlText('ai.partyTalkRange') }}
      </button>
      <label>{{ controlText('game.npcName') }}<input v-model="draft.name" maxlength="120" required /></label>
      <div>
        <button type="button" class="subtle" @click="emit('navigate', 'integration')">
          {{ controlText('ai.configureBot') }}</button
        ><small>{{ controlText('ai.botIdentityHelp') }}</small>
      </div>
      <div class="ai-wide">
        <PortraitPicker
          :name="draft.name"
          :portrait="draft.portrait"
          :disabled="busy"
          @change="setPortrait"
        >
          <template #preview
            ><CharacterAvatar :name="draft.name" :portrait="resolvedPortrait" :size="84"
          /></template>
        </PortraitPicker>
        <label>{{ controlText('ai.messageIllustration') }}</label>
        <PortraitPicker
          :name="draft.name + '立绘'"
          :portrait="draft.illustration"
          :disabled="busy"
          @change="setIllustration"
        />
        <p class="muted small">
          {{ controlText('ai.portraitHelp') }}
        </p>
      </div>
      <label
        >{{ controlText('domain.npcType') }}<select
          v-model="draft.npcType"
          :aria-label="controlText('domain.npcType')"
          :disabled="!!draft.characterId"
          @change="changeType"
        >
          <option value="ordinary">{{ controlText('ai.ordinarySubtitle') }}</option>
          <option value="important">{{ controlText('ai.importantSubtitle') }}</option>
        </select></label
      ><label v-if="draft.npcType === 'important'"
        >{{ controlText('ai.controller') }}<select v-model="draft.controller">
          <option value="model">{{ controlText('ai.modelProposals') }}</option>
          <option value="gm">{{ controlText('ai.gmControl') }}</option>
        </select></label
      ><label
        >{{ controlText('game.side') }}<select v-model="draft.side">
          <option value="enemy">{{ controlText('domain.enemy') }}</option>
          <option value="party">{{ controlText('ai.ally') }}</option>
          <option value="neutral">{{ controlText('game.neutral') }}</option>
        </select></label
      ><label
        >{{ controlText('ai.assignedScene') }}<select v-model="draft.sceneId">
          <option v-for="s in view.sceneNames" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
        </select></label
      >
      <label v-if="!draft.characterId && !designOnly"
        >{{ controlText('ai.linkedActor') }}<select v-model="draft.actorId">
          <option :value="null">{{ controlText('ai.conversationOnly') }}</option>
          <option v-for="a in actors" :key="a.id" :value="a.id">{{ localizedEntryName(a.npc) }}</option>
        </select></label
      ><label>X<input v-model.number="draft.position.x" type="number" min="0" max="79" /></label
      ><label>Y<input v-model.number="draft.position.y" type="number" min="0" max="79" /></label
      ><label class="check"><input v-model="draft.enabled" type="checkbox" />{{ controlText('controls.enable') }}</label
      ><label class="check"><input v-model="draft.hidden" type="checkbox" />{{ controlText('ai.hiddenPlayer') }}</label>
      <label v-if="draft.npcType === 'important'"
        >{{ controlText('ai.storyRole') }}<select
          :value="draft.importanceRole ?? (draft.followParty ? 'companion' : 'resident')"
          @change="changeImportance"
        >
          <option value="resident">{{ controlText('domain.resident') }}</option>
          <option value="companion">{{ controlText('ai.keyCompanion') }}</option>
        </select></label
      >
      <label v-if="draft.npcType === 'important'" class="check"
        ><input
          v-model="draft.followParty"
          :disabled="
            (draft.importanceRole ?? (draft.followParty ? 'companion' : 'resident')) === 'resident'
          "
          type="checkbox"
        />{{ controlText('ai.joinCompanions') }}</label
      >
      <p class="muted ai-wide">
        {{ controlText('ai.visibilityHelp') }}
      </p>
      </section>
      <section v-show="page === 'persona'" class="npc-sec npc-persona-page">
      <NpcPersonaEditor v-model="draft.persona" :legacy-personality="draft.personality" />
      <label>{{ controlText('ai.publicDescription') }}<textarea v-model="draft.description" maxlength="2000" /></label
      ><label>{{ controlText('ai.personality') }}<textarea v-model="draft.personality" maxlength="2000" /></label
      ><label>{{ controlText('controls.target') }}<textarea v-model="draft.goals" maxlength="2000" /></label
      ><label>{{ controlText('ai.strategy') }}<textarea v-model="draft.strategy" maxlength="2000" /></label
      ><LongTextField v-model="draft.knowledge" :label="controlText('finalField.npcKnownInformationExistingFields')" :limit="2000" />
      <label
        >{{ controlText('ai.communication') }}<select
          :value="draft.communication ?? 'auto'"
          @change="
            draft.communication = ($event.target as HTMLSelectElement).value as
              'auto' | 'speaking' | 'nonverbal'
          "
        >
          <option value="auto">{{ controlText('ai.defaultCommunication') }}</option>
          <option value="speaking">{{ controlText('ai.confirmedSpeaking') }}</option>
          <option value="nonverbal">{{ controlText('ai.nonverbal') }}</option>
        </select></label
      >
      <small
        >{{ controlText('ai.communicationHelp') }}</small
      >
      <label
        >{{ controlText('ai.gmNote') }}<textarea v-model="draft.privateNote" maxlength="2000" /></label
      ><label>{{ controlText('ai.fallback') }}<textarea v-model="draft.fallbackReply" maxlength="2000" /></label>
      <NpcDesignEditor v-model="draft.gmDesign" />
      <details v-if="draft.npcType === 'ordinary'">
        <summary>{{ controlText('domain.replyMode') }}</summary>
        <label
          >{{ controlText('domain.afterReplies') }}<select
            :value="draft.fixedReplyMode ?? 'end'"
            @change="
              draft.fixedReplyMode = ($event.target as HTMLSelectElement).value as 'end' | 'loop'
            "
          >
            <option value="end">{{ controlText('domain.endReplies') }}</option>
            <option value="loop">{{ controlText('domain.loopReplies') }}</option>
          </select></label
        >
        <button v-if="!designOnly" type="button" @click="draft.fixedReplyCursor = 0">
          {{ controlText('domain.resetReplyProgress') }}
        </button>
        <label
          >{{ controlText('domain.endReply') }}<input
            v-model="draft.fixedReplyEnd"
            :placeholder="controlText('ai.defaultEnd')"
            maxlength="2000"
        /></label>
        <details><summary>{{ controlText('domain.bilingual') }} · {{ controlText('domain.endReply') }}</summary><label>English<textarea maxlength="2000" :value="draft.fixedReplyEndLocales?.en??''" @input="draft.fixedReplyEndLocales={...draft.fixedReplyEndLocales,en:($event.target as HTMLTextAreaElement).value}" /></label><label>{{ controlText('domain.chinese') }}<textarea maxlength="2000" :value="draft.fixedReplyEndLocales?.['zh-CN']??''" @input="draft.fixedReplyEndLocales={...draft.fixedReplyEndLocales,'zh-CN':($event.target as HTMLTextAreaElement).value}" /></label></details>
        <div v-for="(line, index) in draft.fixedReplies" :key="line.id" class="room-row">
          <label>{{ controlText('configurationField.entry') }}{{ index + 1 }}{{ controlText('configurationField.entries') }}<textarea v-model="line.text" maxlength="2000" /></label>
          <details><summary>{{ controlText('domain.bilingual') }}</summary><p>{{ controlText('domain.sharedReplyHelp') }}</p><label>English<textarea maxlength="2000" :value="line.localized?.en??''" @input="line.localized={...line.localized,en:($event.target as HTMLTextAreaElement).value}" /></label><label>{{ controlText('domain.chinese') }}<textarea maxlength="2000" :value="line.localized?.['zh-CN']??''" @input="line.localized={...line.localized,'zh-CN':($event.target as HTMLTextAreaElement).value}" /></label></details>
          <button type="button" @click="draft.fixedReplies!.splice(index, 1)">{{ controlText('domain.deleteReply') }}</button>
        </div>
        <button
          type="button"
          :disabled="(draft.fixedReplies?.length ?? 0) >= 30"
          @click="(draft.fixedReplies ??= []).push({ id: newId(), text: '新的固定回复' })"
        >
          {{ controlText('domain.addFixedReply') }}
        </button>
      </details>
      <details v-if="!draft.characterId">
        <summary>{{ controlText('domain.npcConsumables') }}</summary>
        <div v-for="(s, index) in draft.consumables" :key="s.id" class="room-row">
          <span>{{ controlText('ai.healingPotion') }}</span
          ><input
            v-model.number="s.quantity"
            type="number"
            min="1"
            max="999"
            :aria-label="controlText('ai.potionQuantity')"
          />
          <button type="button" @click="draft.consumables!.splice(index, 1)">{{ controlText('game.remove') }}</button>
        </div>
        <button
          type="button"
          :disabled="(draft.consumables?.length ?? 0) >= 30"
          @click="
            (draft.consumables ??= []).push({ id: newId(), itemId: 'healing-potion', quantity: 1 })
          "
        >
          {{ controlText('ai.addPotion') }}
        </button>
      </details>
      <label
        >{{ controlText('domain.attitude') }}<select v-model="draft.attitude">
          <option value="friendly">{{ controlText('domain.friendly') }}</option>
          <option value="indifferent">{{ controlText('game.neutral') }}</option>
          <option value="hostile">{{ controlText('game.hostile') }}</option>
        </select></label
      ><label v-if="!designOnly"
        >{{ controlText('ai.behaviorFlags') }}<select v-model="draft.behaviorState">
          <option value="none">{{ controlText('ai.noFlag') }}</option>
          <option value="fleeing">{{ controlText('ai.fleeing') }}</option>
          <option value="surrendered">{{ controlText('ai.surrendered') }}</option>
        </select></label
      >
      </section>
      <section v-show="page === 'stats'" class="npc-sec">
      <fieldset class="ai-wide">
        <legend>{{ controlText('ai.characterAbilities') }}</legend>
        <details v-if="draft.npcType === 'important'">
          <summary>{{ controlText('ai.mergeAbilities') }}</summary>
          <p>
            {{ controlText('ai.mergeHelp') }}
          </p>
          <ul>
            <li v-for="a in missingAbilities" :key="a.id">{{ localizedEntryName(a) }} · {{ a.note }}</li>
          </ul>
          <p v-if="!missingAbilities.length">{{ controlText('ai.nothingToMerge') }}</p>
          <button
            :disabled="busy || !missingAbilities.length || bodyLocked"
            @click="supplementAbilities"
          >
            {{ controlText('ai.confirmMerge') }}</button
          ><small>{{ controlText('domain.saveNpcEffect') }}</small>
        </details>
        <p v-if="role">{{ controlText('liveSummary.linkedLevelHpSpellSlotsAndInventory', {p0:(localizedEntryName(role.build)),p1:(role.level)}) }}</p>
        <div v-if="draft.npcType === 'important'" class="room-row">
          <label
            >{{ controlText('domain.workshopTemplate') }}<select v-model="templateId" :aria-label="controlText('domain.workshopTemplate')">
              <option value="">{{ controlText('ai.chooseCompleted') }}</option>
              <option v-for="c in templates" :key="c.id" :value="c.id">
                {{ controlText('quantity.level', {p0:(localizedEntryName(c.build)),p1:(c.level)}) }}</option>
            </select></label
          ><button
            type="button"
            :disabled="busy || !selected || !templateId || bodyLocked || !copyConfirmed"
            @click="copyRole"
          >
            {{ draft.characterId ? controlText('expressionTwo.confirmClassCardReplacement') : controlText('expressionTwo.copyCharacterCardToNpc') }}
          </button>
          <p class="muted">
            {{ controlText('ai.copyCardHelp') }}
          </p>
          <div v-if="copyPreview">
            <p>{{ controlText('liveSummary.differencePreviewLevelEquipmentUsesTheNew', {p0:(role ? role.build.classId + '／' + role.level + controlText('remainingField.level') : controlText('expressionTwo.compactTemplateCard')),p1:(copyPreview.build.classId),p2:(copyPreview.level),p3:(copyPreview.inventory.length)}) }}</p>
            <label class="check"
              ><input v-model="copyConfirmed" type="checkbox" />{{ controlText('ai.copyConfirmed') }}</label
            >
          </div>
        </div>
        <div v-if="draft.npcType === 'ordinary'" class="ai-wide">
          <NpcTemplatePicker
            v-model="creatureTemplate"
            :templates="creatureTemplates"
            :disabled="bodyLocked || busy"
          />
          <div class="room-row">
            <button
              type="button"
              :disabled="busy || bodyLocked || !creatureTemplate"
              @click="applyTemplate"
            >
              {{ controlText('ai.applyCard') }}</button
            ><button
              type="button"
              class="subtle"
              :disabled="busy || !draft.body"
              @click="saveTemplate"
            >
              {{ controlText('ai.saveTemplate') }}</button
            ><button
              v-if="creatureTemplate.startsWith('custom-')"
              type="button"
              class="subtle"
              :disabled="busy"
              @click="
                emit('command', {
                  kind: 'map',
                  command: { type: 'npc-template-delete', templateId: creatureTemplate },
                })
              "
            >
              {{ controlText('ai.deleteTemplate') }}
            </button>
          </div>
          <p class="muted">
            {{ controlText('ai.templateHelp') }}
          </p>
        </div>
        <NpcBodyEditor
          v-if="!draft.characterId"
          v-model="draft.body"
          :name="draft.name"
          :locked="bodyLocked"
        />
        <div v-if="draft.characterId">
          <label
            >{{ controlText('ai.addOwnedAbility') }}<select
              value=""
              :aria-label="controlText('ai.addAbility')"
              @change="addAbility(($event.target as HTMLSelectElement).value)"
            >
              <option value="">{{ controlText('game.feature') }}</option>
              <option v-for="a in available" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
            </select></label
          >
          <div v-for="(a, i) in draft.abilities" :key="a.id" class="ai-form">
            <label class="check"><input v-model="a.enabled" type="checkbox" />{{ localizedEntryName(a) }}</label
            ><label v-if="a.kind === 'spell'"
              >{{ controlText('domain.castMethod') }}<select v-model="a.mode">
                <option
                  v-for="mode in runtimeSpells(role!, cat).find((g) => g.key === a.key)?.modes"
                  :key="mode"
                  :value="mode"
                >
                  {{ mode }}
                </option>
              </select></label
            ><label>{{ controlText('ai.abilityStrategy') }}<textarea v-model="a.note" maxlength="2000" /></label
            ><button type="button" class="subtle" @click="draft.abilities.splice(i, 1)">
              {{ controlText('ai.removeAbility') }}
            </button>
          </div>
          <p class="muted">{{ controlText('ai.ownedAbilityHelp') }}</p>
        </div>
      </fieldset>
      <fieldset v-if="draft.npcType === 'ordinary'" class="ai-wide">
        <legend>{{ controlText('ai.fixedDialogue') }}</legend>
        <div v-for="(d, i) in draft.dialogue" :key="d.id" class="ai-form">
          <label
            >{{ controlText('ai.replyCondition') }}<select v-model="d.when">
              <option value="default">{{ controlText('ai.default') }}</option>
              <option value="initial">{{ controlText('ai.firstTalk') }}</option>
              <option value="repeat">{{ controlText('ai.repeatTalk') }}</option>
              <option value="success">{{ controlText('ai.checkSuccess') }}</option>
              <option value="failure">{{ controlText('ai.checkFailure') }}</option>
              <option value="friendly">{{ controlText('domain.friendly') }}</option>
              <option value="hostile">{{ controlText('game.hostile') }}</option>
            </select></label
          ><label>{{ controlText('domain.fixedReply') }}<textarea v-model="d.text" maxlength="2000" /></label
          ><button type="button" class="subtle" @click="draft.dialogue.splice(i, 1)">
            {{ controlText('ai.removeReply') }}
          </button>
        </div>
        <button type="button" class="subtle" @click="addDialogue">{{ controlText('domain.addFixedReply') }}</button>
        <p class="muted">{{ controlText('ai.ordinaryHelp') }}</p>
      </fieldset>
      <NpcMonsterDefinitionEditor v-if="draft.body" :body="draft.body" :disabled="bodyLocked" />
      <fieldset class="ai-wide">
        <legend>{{ controlText('ai.combatPlanning') }}</legend>
        <details v-if="draft.body?.abilities?.length">
          <summary>{{ controlText('ai.ordinarySpellPolicy') }}</summary>
          <p class="muted">
            {{ controlText('ai.spellPolicyHelp') }}
          </p>
          <label
            >{{ controlText('ai.healingThreshold') }}<input
              v-model.number="draft.combatPolicy.healPercent"
              type="number"
              min="0"
              max="100"
          /></label>
          <label
            v-for="a in draft.body.abilities.filter(
              (a) =>
                a.support === 'automatic' &&
                a.cost !== 'reaction' &&
                ['healing-word', 'bless', 'hold-person', 'invisibility'].includes(a.spellId ?? ''),
            )"
            :key="a.id"
            class="check"
            ><input
              :checked="draft.combatPolicy.monsterAbilityIds?.includes(a.id)"
              type="checkbox"
              @change="toggleMonsterAbility(a.id, ($event.target as HTMLInputElement).checked)"
            />{{ localizedEntryName(a) }}</label
          >
        </details>
        </fieldset>
      </section>
      <section v-show="page === 'combat'" class="npc-sec">
        <fieldset class="ai-wide"><legend>{{ controlText('ai.combatStrategy') }}</legend>
        <div class="ai-form">
          <label
            >{{ controlText('ai.turnExecution') }}<select v-model="draft.turnMode">
              <option value="manual">{{ controlText('domain.gmManual') }}</option>
              <option v-if="draft.npcType === 'ordinary'" value="automatic">
                {{ controlText('ai.autoFixed') }}
              </option>
              <option v-if="draft.npcType === 'important'" value="plan">
                {{ controlText('ai.approvePlan') }}
              </option>
              <option value="step">{{ controlText('ai.stepReview') }}</option>
            </select></label
          >
          <label v-if="draft.npcType === 'important'" class="check"
            ><input
              v-model="draft.tacticalInput"
              type="checkbox"
            />{{ controlText('ai.tacticalInput') }}</label
          >
          <p v-if="draft.npcType === 'important'" class="muted">
            {{ controlText('ai.tacticalHelp') }}
          </p>
          <label
            >{{ controlText('ai.fixedStrategy') }}<select v-model="draft.combatPolicy.strategy">
              <option value="nearest">{{ controlText('ai.nearest') }}</option>
              <option value="guard">{{ controlText('ai.guard') }}</option>
              <option value="protect">{{ controlText('domain.protectCharacter') }}</option>
              <option value="ranged">{{ controlText('ai.ranged') }}</option>
              <option value="retreat">{{ controlText('ai.retreat') }}</option>
            </select></label
          ><label
            >{{ controlText('ai.guardRadius') }}<input
              v-model.number="draft.combatPolicy.guardRadius"
              type="number"
              min="0"
              max="300" /></label
          ><label
            >{{ controlText('domain.protectCharacter') }}<select v-model="draft.combatPolicy.protectCharacterId">
              <option :value="null">{{ controlText('controls.none') }}</option>
              <option v-for="c in view.characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
            </select></label
          ><label
            >{{ controlText('ai.retreatThreshold') }}<input
              v-model.number="draft.combatPolicy.retreatPercent"
              type="number"
              min="0"
              max="100" /></label
          ><label class="check"
            ><input
              v-model="draft.combatPolicy.planOnTurn"
              type="checkbox"
            />{{ controlText('ai.startTurnMode') }}</label
          >
        </div>
        <label>{{ controlText('ai.reactionPolicy') }}<select v-model="draft.combatPolicy.resourceStrategy"><option :value="undefined">{{ controlText('ai.inheritPolicy') }}</option><option value="conservative">{{ controlText('domain.conservative') }}</option><option value="balanced">{{ controlText('domain.balanced') }}</option><option value="aggressive">{{ controlText('ai.aggressive') }}</option></select></label>
        <p>{{ controlText('ai.availableAttacks') }}</p>
        <label
          v-for="attack in view.encounter?.actors.find((a) => a.id === draft.actorId)?.attacks ??
          draft.body?.attacks ??
          []"
          :key="attack.id"
          class="check"
          ><input v-model="draft.combatPolicy.attackIds" type="checkbox" :value="attack.id" />{{
            localizedEntryName(attack)
          }}</label
        >
        <div v-if="!designOnly" class="room-row">
          <button
            type="button"
            class="subtle"
            :disabled="busy || !selected"
            @click="emit('navigate', 'battle')"
          >
            {{ controlText('ai.openRoster') }}</button
          ><button
            type="button"
            class="subtle"
            :disabled="busy || !selected"
            @click="emit('command', { kind: 'npc-plan', npcId: selected })"
          >
            {{ controlText('ai.planTurn') }}
          </button>
        </div>
        <p class="muted">
          {{ controlText('ai.planningHelp') }}
        </p>
      </fieldset>
      <label class="check ai-wide"
        ><input
          v-model="draft.initiallyAbsent"
          type="checkbox"
          :disabled="busy || !!draft.appeared || !!draft.actorId"
        />{{ controlText('ai.pendingArrival') }}</label
      >
      </section>
      <section v-show="page === 'talk'" class="npc-sec">
      <NpcMemoryEditor
        v-if="draft.npcType === 'important'"
        v-model="draft"
        :characters="
          view.characters.filter(
            (c) => !view.world?.characters.find((role) => role.id === c.id)?.npcOwnerId,
          )
        "
        :busy="busy"
      />
      <fieldset v-if="draft.npcType === 'important'" class="ai-wide">
        <legend>{{ controlText('ai.proactive') }}</legend>
        <details>
          <summary>{{ controlText('ai.recommendedDefaults') }}</summary>
          <p>
            {{ controlText('liveSummary.eventTypesTemplates', {p0:(controlText('inventory.current')),p1:(draft.activity.enabled ? controlText('controls.enable') : controlText('controls.close')),p2:(draft.activity.events.length),p3:(draft.activity.templates?.length ?? 0)}) }}</p>
          <p>
            {{ controlText('ai.recommendedHelp') }}
          </p>
          <button :disabled="busy" @click="applyActivityDefaults">{{ controlText('ai.applyDraft') }}</button
          ><small>{{ controlText('domain.saveNpcEffect') }}</small>
        </details>
        <label class="check"
          ><input v-model="draft.activity.enabled" type="checkbox" />{{ controlText('ai.enableProactive') }}</label
        ><label v-for="type in NPC_ACTIVITY_EVENTS" :key="type" class="check"
          ><input v-model="draft.activity.events" type="checkbox" :value="type" />{{
            uiLabel(eventNames[type])
          }}</label
        >
        <NpcActivityEditor
          v-model="draft.activity"
          :scenes="view.world?.adventures[0]?.scenes ?? []"
          :characters="
            view.characters.filter(
              (c) => !view.world?.characters.find((role) => role.id === c.id)?.npcOwnerId,
            )
          "
          :busy="busy"
        />
        <label
          >{{ controlText('ai.modelPurpose') }}<input
            v-model="draft.modelRef"
            :list="'npc-models-' + draft.id"
            maxlength="80"
            :placeholder="controlText('ai.modelPurposePlaceholder')"
        /></label>
        <datalist :id="'npc-models-' + draft.id">
          <option v-for="p in modelProfiles ?? []" :key="p.name" :value="p.name" />
        </datalist>
        <p class="muted">{{ controlText('ai.modelPurposeHelp') }}</p>
        <div class="ai-form">
          <label
            >{{ controlText('ai.perceptionRange') }}<input
              v-model.number="draft.activity.range"
              type="number"
              min="0"
              max="300" /></label
          ><label
            >{{ controlText('ai.cooldown') }}<input
              v-model.number="draft.activity.cooldownSeconds"
              type="number"
              min="0"
              max="86400" /></label
          ><label
            >{{ controlText('ai.branchLimit') }}<input
              v-model.number="draft.activity.maxPerScene"
              type="number"
              min="1"
              max="20" /></label
          ><label class="check"
            ><input
              v-model="draft.activity.allowDuringCombat"
              type="checkbox"
            />{{ controlText('ai.combatTalk') }}</label
          >
        </div>
        <p class="muted">
          {{ controlText('ai.proactiveHelp') }}
        </p>
      </fieldset>
      <fieldset class="ai-wide">
        <legend>{{ controlText('ai.allowedBehavior') }}</legend>
        <label v-for="kind in NPC_BEHAVIORS" :key="kind" class="check"
          ><input v-model="draft.allowed" type="checkbox" :value="kind" />{{ uiLabel(names[kind]) }}</label
        >
      </fieldset>
      <fieldset class="ai-wide">
        <legend>{{ controlText('ai.secretsClues') }}</legend>
        <div v-for="(s, i) in draft.secrets" :key="s.id" class="room-row">
          <label>{{ controlText('ai.clueText') }}<input v-model="s.text" maxlength="2000" /></label
          ><label class="check"
            ><input
              v-model="draft.preauthorization.revealIds"
              type="checkbox"
              :value="s.id"
            />{{ controlText('ai.allowReveal') }}</label
          ><span v-if="draft.revealedIds.includes(s.id)">{{ controlText('ai.alreadyPublic') }}</span
          ><button type="button" class="subtle" @click="removeSecret(i)">{{ controlText('game.remove') }}</button>
        </div>
        <button
          type="button"
          class="subtle"
          :disabled="draft.secrets.length >= 30"
          @click="addSecret"
        >
          {{ controlText('ai.addSecret') }}
        </button>
        <p class="muted">{{ controlText('ai.secretHelp') }}</p>
      </fieldset>
      <NpcSocialPolicyEditor v-model="draft.practicalSocial" :secrets="draft.secrets" :points="view.world?.adventures[0]?.scenes.find(s=>s.id===draft.sceneId)?.points" :presets="view.world?.adventures[0]?.battles?.presets.filter(p=>p.sceneId===draft.sceneId)" :stock="draft.stock" />
      </section>
      <section v-show="page === 'trade'" class="npc-sec">
      <fieldset class="ai-wide">
        <legend>{{ controlText('ai.saleStock') }}</legend>
<MerchantPolicyEditor v-model="draft.merchantPolicy" :items="items" :disabled="busy" />
        <div class="room-row">
          <label>{{ controlText('domain.searchItem') }}<input v-model="itemSearch" /></label
          ><label
            >{{ controlText('ai.item') }}<select v-model="item">
              <option v-for="i in items" :key="i.id" :value="i.id">{{ localizedEntryName(i) }}</option>
            </select></label
          ><button type="button" class="subtle" @click="addStock">{{ controlText('ai.addStock') }}</button>
        </div>
        <div v-for="(s, i) in draft.stock" :key="s.id??s.itemId+'-'+i" class="room-row">
          <span>{{ localizedEntryName(cat.items.find((i) => i.id === s.itemId)) }}</span
          ><label>{{ controlText('ai.stock') }}<input v-model.number="s.quantity" type="number" min="0" max="10000" /></label
          ><label
            >{{ controlText('ai.price') }}<input v-model.number="s.priceGP" type="number" min="0" step="0.01" /></label
          ><button type="button" class="subtle" @click="draft.stock.splice(i, 1)">{{ controlText('ai.removeStock') }}</button>
        </div>
        <p v-if="role" class="muted">{{ controlText('liveSummary.npcCharacterCoinsGpTradeProceedsSynchronize', {p0:(role.coins)}) }}</p>
        <label v-else
          >{{ controlText('ai.npcCoins') }}<input v-model.number="draft.coins" type="number" min="0" step="0.01"
        /></label>
      </fieldset>
      <NpcDialogueReviewEditor
        :profile="draft" :practical-text="practicalText"
        :settings="view.world?.adventures[0]?.ai?.settings"
        :disabled="busy"
        :design-only="designOnly"
        @update="Object.assign(draft, $event)"
      />
      <fieldset class="ai-wide">
        <legend>{{ controlText('ai.limitedAuthorization') }}</legend>
        <p class="muted">
          {{ controlText('ai.legacyAuthorizationHelp') }}
        </p>
        <details><summary>旧版回复兼容设置</summary><label class="check"
          ><input
            v-model="draft.autoDialogue"
            type="checkbox"
          />{{ controlText('ai.legacyAutoPublish') }}</label
        ><label class="check"
          ><input v-model="draft.publicKnowledgeOnly" type="checkbox" />{{ controlText('ai.legacyQqPublic') }}</label></details><label class="check"
          ><input v-model="draft.preauthorization.trade" type="checkbox" />{{ controlText('ai.allowLimitedTrade') }}</label
        >
        <p v-if="designOnly" class="muted">
          {{ controlText('ai.authorizationHelp') }}
        </p>
        <p v-else>{{ controlText('ai.authorizeCharacters') }}</p>
        <label v-for="c in designOnly ? [] : view.characters" :key="c.id" class="check"
          ><input v-model="draft.preauthorization.characterIds" type="checkbox" :value="c.id" />{{
            localizedEntryName(c)
          }}</label
        >
        <div class="ai-form">
          <label v-if="!designOnly"
            >{{ controlText('ai.remainingUses') }}<input
              v-model.number="draft.preauthorization.remaining"
              type="number"
              min="0"
              max="1000" /></label
          ><label
            >{{ controlText('ai.maxQuantity') }}<input
              v-model.number="draft.preauthorization.maxQuantity"
              type="number"
              min="1"
              max="1000" /></label
          ><label
            >{{ controlText('ai.maxDiscount') }}<input
              v-model.number="draft.preauthorization.maxDiscountGP"
              type="number"
              min="0"
              step="0.01" /></label
          ><label
            >{{ controlText('ai.maxAmount') }}<input
              v-model.number="draft.preauthorization.maxValueGP"
              type="number"
              min="0"
              step="0.01" /></label
          ><label v-if="!designOnly"
            >{{ controlText('ai.realExpiration') }}<input
              type="datetime-local"
              :value="
                draft.preauthorization.expiresAt
                  ? new Date(
                      Date.parse(draft.preauthorization.expiresAt) -
                        new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              "
              @input="
                draft.preauthorization.expiresAt = ($event.target as HTMLInputElement).value
                  ? new Date(($event.target as HTMLInputElement).value).toISOString()
                  : null
              "
          /></label>
        </div>
      </fieldset>
      </section>
      <footer class="npc-savebar">
        <span>{{ saveLabel }}</span>
        <button :disabled="busy || !draft.sceneId">{{ controlText('domain.saveNpc') }}</button>
        <button v-if="selected" type="button" class="subtle" :disabled="busy" @click="removeNpc">
          {{ controlText('ai.deleteNpc') }}
        </button>
      </footer>
    </form>
  </section>
</template>

<style scoped>.npc-persona-page > label{grid-column:1/-1;width:100%;min-width:0}.npc-persona-page :deep(textarea){width:100%;min-height:280px;line-height:1.8;font-size:15px;resize:vertical}.npc-persona-page :deep(.npc-design){grid-column:1/-1}</style>
