<script setup lang="ts">
import {buildIssuePresentation} from '../modules/build-issue-presentation'
import {uiDate} from '../modules/locale-format'
import {uiLabel} from '../modules/ui-label'
import {ruleText,ruleLabel,abilityDisplayName,skillDisplayName} from '../modules/rule-presentation'
import { i18n as controlI18n } from './i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../modules/runtime-presentation'

import { i18n } from './i18n'
import LanguageSelect from '../modules/LanguageSelect.vue'
const { t } = i18n.global
import { spellPresentation,entryDisplayName } from "../modules/runtime-presentation"
import NpcPresentationEditor from '../modules/NpcPresentationEditor.vue'
import NotificationHost from '../modules/NotificationHost.vue'
import { notifyOperation } from './notifications'
import { sourceCaption } from '../core/rule-sources'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useWorkshop } from './store'
import {
  ABILITIES,
  ABILITY_NAMES,
  SKILLS,
  type Ability,
  type Character,
  type Item,
  type WearSlot,
  type InventoryTag,
  WEAR_SLOTS,
  INVENTORY_TAGS,
} from '../core/types'
import {
  ARRAY,
  POINT_COST,
  assignRecommended,
  clone,
  derived,
  equipmentChoices,
  getChoices,
  newCharacter,
  one,
  reconcile,
  rollAbilityScores,
  signed,
  startingInventory,
  validate,
  warnings,
} from '../core/engine'
import { ATTRIBUTION } from '../content/srd'
import ChoiceField from '../modules/ChoiceField.vue'
import CharacterSummary from '../modules/CharacterSummary.vue'
import CharacterSheet from '../modules/CharacterSheet.vue'
import CharacterAvatar from '../modules/CharacterAvatar.vue'
import PortraitPicker from '../modules/PortraitPicker.vue'
import RuntimePanel from '../modules/RuntimePanel.vue'
import BattlePanel from '../modules/BattlePanel.vue'
import MapPanel from '../modules/MapPanel.vue'
import RoomPanel from '../modules/RoomPanel.vue'
import ScriptLibraryPanel from '../modules/scripts/ScriptLibraryPanel.vue'
import type { RoomView } from '../online/protocol'
import { SLOT_NAMES, TAG_NAMES } from '../core/equipment'
import { ZodError } from 'zod'
import samplePack from '../../docs/example-pack.json'
const store = useWorkshop()
const page = ref<'library' | 'builder' | 'sheet' | 'battle' | 'map' | 'room' | 'scripts'>(
    new URLSearchParams(location.search).get('page') === 'room' ? 'room' : 'library',
  ),
  battleId = ref('')
const roomVisited = ref(page.value === 'room')
const scriptsVisited = ref(false),
  createdRoom = ref<{ roomId: string; token: string; invite: string; view: RoomView } | null>(null)
watch(page, (value) => {
  if (value === 'room') roomVisited.value = true
  if (value === 'scripts') scriptsVisited.value = true
})
const mapSelection = ref({ adventureId: '', sceneId: '' })
function openMapFromEncounter(id: string) {
  const bound = store.adventures
    .flatMap((a) =>
      a.scenes.map((s) => ({ adventureId: a.id, sceneId: s.id, encounterId: s.encounterId })),
    )
    .find((s) => s.encounterId === id)
  if (bound) mapSelection.value = { adventureId: bound.adventureId, sceneId: bound.sceneId }
  page.value = 'map'
}
const abilityNames = (ids: Ability[]) => ids.map((id) => ABILITY_NAMES[id]).join('／')
const skillNames = (ids: string[]) => ids.map(id=>skillDisplayName(id)).join(', ')
const featName = (id: string) => entryDisplayName(store.content.feats.find((f) => f.id === id))
const steps = computed(()=>['class','origin','abilities','features','equipment','story','check'].map(key=>t('builder.'+key)))
const descriptions=computed(()=>['class','origin','abilities','features','equipment','story','check'].map(key=>t('builderHints.'+key)))
const b = computed(() => store.editor?.character.build || newCharacter().build)
async function setDraftPortrait(image: string | null) {
  if (!store.editor) return
  const character = store.editor.character
  const previous = character.portrait
  character.portrait = image
  try {
    await store.draft()
  } catch (error) {
    character.portrait = previous
    throw error
  }
}
const step = computed({
  get: () => store.editor?.step || 0,
  set: (v: number) => {
    if (store.editor) store.editor.step = v
  },
})
const cl = computed(() => store.content.classes.find((x) => x.id === b.value.classId))
const bg = computed(() => store.content.backgrounds.find((x) => x.id === b.value.backgroundId))
const sp = computed(() => store.content.species.find((x) => x.id === b.value.speciesId))
const choices = computed(() => getChoices(b.value, store.content))
const issues = computed(() => validate(b.value, store.content))
const pendingAt = (index: number) => {
  if (index === 6) return issues.value.length
  const count = issues.value.filter((issue) => issue.step === index).length
  if (index === 3 && (!cl.value || !bg.value || !sp.value)) return Math.max(1, count)
  if (index === 4 && (!cl.value || !bg.value)) return Math.max(1, count)
  return count
}
const initial = computed(() => startingInventory(b.value, store.content))
const actualInventory = computed(() =>
  store.editor && !store.editor.rebuild
    ? store.editor.character.inventory
    : initial.value.inventory,
)
const d = computed(() => derived(b.value, store.content, actualInventory.value))
const notice = computed(() => warnings(b.value, store.content))
const currentCharacter = computed(() => store.characters.find((x) => x.id === store.viewId))
const item = (id: string) =>
  [...store.content.items, ...b.value.customItems].find((x) => x.id === id)
const busy = ref(false)
let saveTimer: ReturnType<typeof setTimeout>
function message(text: string, error = false) {
  notifyOperation(text, error)
}
async function action(fn: () => Promise<unknown> | unknown) {
  if (busy.value) return
  if (store.readFailure) {
    message('已阻止覆盖无法读取的本地存档，请先导出原始存档。', true)
    return
  }
  busy.value = true
  try {
    await fn()
  } catch (e) {
    message(
      e instanceof ZodError
        ? '文件格式不兼容：' +
            e.issues
              .slice(0, 3)
              .map((i) => i.path.join('.') + ' ' + i.message)
              .join('；')
        : e instanceof Error
          ? e.message
          : String(e),
      true,
    )
  } finally {
    busy.value = false
  }
}
onMounted(async () => {
  await store.load()
  if (store.editor) page.value = 'builder'
})
watch(
  () => store.editor?.character.build,
  () => {
    if (!store.loaded) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => store.draft().catch(() => {}), 650)
  },
  { deep: true },
)
watch(
  () => store.editor?.rebuild,
  () => {
    if (store.loaded) store.save().catch(() => {})
  },
)
watch(
  () => store.editor?.step,
  () => {
    if (store.loaded) store.save().catch(() => {})
  },
)
async function create() {
  if (store.editor) await store.draft()
  store.create()
  page.value = 'builder'
  await store.save()
}
async function open(c: Character) {
  if (store.editor) await store.draft()
  if (c.status === 'draft') {
    store.edit(c)
    page.value = 'builder'
    await store.save()
  } else {
    store.viewId = c.id
    page.value = 'sheet'
  }
}
async function edit(c: Character) {
  if (store.editor) await store.draft()
  store.edit(c)
  page.value = 'builder'
  await store.save()
}
async function leave() {
  await store.draft()
  page.value = 'library'
}
async function finish() {
  clearTimeout(saveTimer)
  await store.finish()
  page.value = 'sheet'
  message('角色已保存，可以查看或重新编辑。')
}
const modal = ref<'source' | 'spell' | 'delete' | 'change' | 'reroll' | 'summary' | null>(null),
  modalElement = ref<HTMLDialogElement | null>(null)
const spellId = ref(''),
  deleting = ref<Character | null>(null),
  change = ref<{ next: typeof b.value; removed: string[] } | null>(null)
const selectedSpell = computed(() => store.content.spells.find((s) => s.id === spellId.value))
watch(modal, async (v) => {
  await nextTick()
  if (v && !modalElement.value?.open) modalElement.value?.showModal()
  if (!v && modalElement.value?.open) modalElement.value.close()
})
function requestDelete(character: Character) {
  deleting.value = character
  modal.value = 'delete'
}
function removePurchase(index: number) {
  b.value.purchases.splice(index, 1)
  reconcile(b.value, store.content)
}
function closeModal() {
  modal.value = null
  change.value = null
  deleting.value = null
}
function spellInfo(id: string) {
  spellId.value = id
  modal.value = 'spell'
}
function identity(field: 'classId' | 'backgroundId' | 'speciesId', value: string) {
  if (b.value[field] === value) return
  const next = clone(b.value)
  next[field] = value
  if (field === 'classId') next.classEquipment = 0
  if (field === 'backgroundId') next.backgroundEquipment = 0
  const removed = reconcile(next, store.content)
  if (b.value[field] && removed.length) {
    change.value = { next, removed }
    modal.value = 'change'
  } else if (store.editor) store.editor.character.build = next
}
function confirmChange() {
  if (store.editor && change.value) store.editor.character.build = change.value.next
  closeModal()
}
function updateChoice(id: string, value: string[]) {
  b.value.choices[id] = value
  const removed = reconcile(b.value, store.content)
  if (removed.length) message('已清除失效选择：' + removed.join('、'))
}
function changeEquipment(field: 'classEquipment' | 'backgroundEquipment', index: number) {
  b.value[field] = index
  const removed = reconcile(b.value, store.content)
  if (removed.length) message('装备方案已更新，原穿戴或选择已清理。')
}
function setScore(a: Ability, n: number) {
  if (b.value.method !== 'point') {
    const other = ABILITIES.find((k) => k !== a && b.value.scores[k] === n)
    if (other) b.value.scores[other] = b.value.scores[a]
  }
  b.value.scores[a] = n
}
function setMethod(method: typeof b.value.method) {
  b.value.method = method
  if (method === 'point') ABILITIES.forEach((a) => (b.value.scores[a] = 8))
  else if (method === 'array') assignRecommended(b.value)
  else if (b.value.rolls) assignRecommended(b.value)
}
function roll() {
  b.value.rolls = rollAbilityScores()
  assignRecommended(b.value)
  closeModal()
}
const pointSpent = computed(() =>
  ABILITIES.reduce((n, a) => n + (POINT_COST[b.value.scores[a]] ?? 0), 0),
)
const purchaseSearch = ref(''),
  purchaseId = ref(''),
  purchaseQuantity = ref(1)
const purchaseOptions = computed(() =>
  store.content.items.filter((i) =>
    (i.name + ' ' + i.english).toLowerCase().includes(purchaseSearch.value.toLowerCase()),
  ),
)
function purchase() {
  const i = item(purchaseId.value),
    q = purchaseQuantity.value
  if (!i || !Number.isInteger(q) || q < 1 || q > 1000) {
    message('请选择物品并填写 1–1000 的整数数量。', true)
    return
  }
  if (initial.value.coins - i.cost * q < -0.00001) {
    message('金币不足，请更换装备方案或减少购置。', true)
    return
  }
  const existing = b.value.purchases.find((p) => p.itemId === i.id)
  if ((existing?.quantity || 0) + q > 1000) {
    message('同一购置物品最多 1000 件。', true)
    return
  }
  if (existing) existing.quantity += q
  else b.value.purchases.push({ itemId: i.id, quantity: q })
  message('已加入初始背包：' + i.name + ' × ' + q)
}
function wear(id: string) {
  b.value.equipped = b.value.equipped.includes(id)
    ? b.value.equipped.filter((x) => x !== id)
    : [...b.value.equipped, id]
}
function exportCharacter(c: Character) {
  download((c.build.name || '角色') + '.json', store.exportArchive(c))
  message('已导出角色与所需扩展规则包。')
}
function download(name: string, data: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const importCharacterInput = ref<HTMLInputElement | null>(null),
  importPackInput = ref<HTMLInputElement | null>(null)
async function importFile(event: Event, pack = false) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  await action(async () => {
    const maxMB = pack ? 5 : 50
    if (file.size > maxMB * 1024 * 1024) throw new Error(`文件超过 ${maxMB} MB 限制`)
    const value = JSON.parse(await file.text())
    if (pack) {
      await store.importPack(value)
      message('扩展规则包已安装。')
    } else {
      const imported = await store.importArchive(value)
      message('角色已作为独立副本导入。')
      await open(imported)
    }
  })
  input.value = ''
}
const customName = ref(''),
  customNote = ref(''),
  customWeight = ref(0),
  customWearSlot = ref<WearSlot | ''>(''),
  customHoldable = ref(false),
  customTag = ref<InventoryTag>('misc'),
  adjustField = ref<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'hp' | 'ac'>('hp'),
  adjustAmount = ref(1),
  adjustReason = ref('')
function addCustom() {
  if (!customName.value.trim()) return
  if (!Number.isFinite(customWeight.value) || customWeight.value < 0) {
    message('物品重量必须是非负数。', true)
    return
  }
  const i: Item = {
    id: 'custom/' + crypto.randomUUID(),
    name: customName.value.trim(),
    english: 'Custom Item',
    summary: customNote.value,
    kind: 'gear',
    cost: 0,
    weight: Math.max(0, customWeight.value || 0),
    source: { pack: 'local-custom', version: '1', page: 0 },
    ...(customWearSlot.value ? { wearSlot: customWearSlot.value } : {}),
    holdable: customHoldable.value,
    inventoryTag: customTag.value,
  }
  b.value.customItems.push(i)
  if (store.editor && !store.editor.rebuild) {
    const added = startingInventory(b.value, store.content).inventory.find(
      (row) => row.itemId === i.id,
    )
    if (added) store.editor.character.inventory.push(added)
  }
  customName.value = ''
  customNote.value = ''
  customWearSlot.value = ''
  customHoldable.value = false
  customTag.value = 'misc'
  message('已添加并标记自定义物品。')
}
function removeCustom(index: number) {
  const id = b.value.customItems[index]?.id
  if (!id) return
  b.value.customItems.splice(index, 1)
  if (store.editor)
    store.editor.character.inventory = store.editor.character.inventory.filter(
      (row) => row.itemId !== id,
    )
  reconcile(b.value, store.content)
}
function addAdjustment() {
  if (
    !adjustReason.value.trim() ||
    !Number.isInteger(adjustAmount.value) ||
    Math.abs(adjustAmount.value) > 100
  ) {
    message('GM 调整需要 -100 至 100 的整数数值与原因。', true)
    return
  }
  b.value.adjustments.push({
    id: crypto.randomUUID(),
    field: adjustField.value,
    amount: adjustAmount.value,
    reason: adjustReason.value.trim(),
  })
  adjustReason.value = ''
}
const dark = ref(false)
try {
  dark.value = localStorage.getItem('workshop-theme') === 'dark'
} catch {}
watch(
  dark,
  (v) => {
    document.documentElement.dataset.theme = v ? 'dark' : 'light'
    try {
      localStorage.setItem('workshop-theme', v ? 'dark' : 'light')
    } catch {}
  },
  { immediate: true },
)
const safeSource = (url?: string) =>
  url && /^https?:\/\//.test(url) ? url : 'https://www.dndbeyond.com/srd'
</script>
<template>
  <div class="app-shell">
    <header class="app-header">
      <button class="brand" @click="action(leave)">
        <span class="brand-mark">✦</span><span>{{ controlText('creation.brand') }} <small>{{t('library.workshop')}}</small></span>
      </button>
      <div class="header-center">2024 RULES <span>·</span> SRD 5.2.1 · PUBLIC</div>
      <div class="header-actions">
        <button class="subtle" :disabled="busy || !store.loaded" @click="page = 'scripts'">{{ t('navigation.scripts') }}</button>
        <button class="subtle" :disabled="busy || !store.loaded" @click="page = 'room'">{{ t('navigation.room') }}</button>
        <button
          class="subtle"
          :disabled="busy || store.saving || !store.loaded"
          @click="page = 'map'"
        >{{ t('navigation.map') }}</button>
        <button
          class="subtle"
          :disabled="busy || store.saving || !store.loaded"
          @click="page = 'battle'"
        >{{ t('navigation.battle') }}</button>
        <button
          class="icon-button"
          :aria-label="t(dark ? 'navigation.light' : 'navigation.dark')"
          @click="dark = !dark"
        >
          {{ dark ? '☀' : '☾' }}</button
        ><button class="subtle" @click="modal = 'source'">{{ t('navigation.rules') }}</button
        ><button
          class="primary compact"
          :disabled="busy || store.saving || !store.loaded || store.readFailure"
          @click="action(create)"
        >{{ t('navigation.create') }}</button>
      </div>
      <LanguageSelect />
    </header>
    <div v-if="store.storageError" class="storage-error" role="alert">
      {{ store.storageError }}
      <button v-if="store.editor" @click="exportCharacter(store.editor.character)">
        {{ controlText('creation.exportDraft') }}</button
      ><button
        v-if="store.readFailure"
        @click="
          store
            .rawBackup()
            .then((data) => download('local-backup.json', JSON.stringify(data, null, 2)))
            .catch(() => message('当前浏览器存储不可用，无法导出。', true))
        "
      >
        {{ controlText('creation.exportRaw') }}
      </button>
    </div>
    <div v-if="!store.loaded" class="loading">{{t('common.loading')}}</div>
    <RoomPanel
      v-if="store.loaded && roomVisited"
      v-show="page === 'room'"
      :created-room="createdRoom" :active="page === 'room'"
      @workshop="page = 'library'"
    />
    <ScriptLibraryPanel
      v-if="store.loaded && scriptsVisited"
      v-show="page === 'scripts'"
      @local="
        (id) => {
          mapSelection = {
            adventureId: id,
            sceneId: store.adventures.find((a) => a.id === id)?.sourceScript?.startSceneId ?? '',
          }
          page = 'map'
        }
      "
      @room="
        (value) => {
          createdRoom = value
          page = 'room'
        }
      "
    />
    <BattlePanel
      v-if="store.loaded && page === 'battle'"
      :encounter-id="battleId"
      @map="openMapFromEncounter"
      @view="
        (id) => {
          store.viewId = id
          page = 'sheet'
        }
      "
    />
    <MapPanel
      v-else-if="page === 'map'"
      :initial-adventure-id="mapSelection.adventureId"
      :initial-scene-id="mapSelection.sceneId"
      @selection="
        (adventureId, sceneId) => {
          mapSelection = { adventureId, sceneId }
        }
      "
      @view="
        (id) => {
          store.viewId = id
          page = 'sheet'
        }
      "
      @battle="
        (id) => {
          battleId = id
          page = 'battle'
        }
      "
    />
    <main v-else-if="store.loaded && page === 'library'" class="library">
      <div class="page-heading">
        <div>
          <p class="eyebrow">YOUR ADVENTURE BEGINS HERE</p>
          <h1>{{t('library.title')}}</h1>
          <p class="muted">{{t('library.tagline')}}</p>
        </div>
        <button class="secondary" @click="importCharacterInput?.click()">{{t('library.import')}}</button>
      </div>
      <button v-if="store.editor" class="resume-banner" @click="page = 'builder'">
        <span
          >↳ {{ store.editor.editingId ? t('library.resumeEdit') : t('library.resumeBuild') }} ·
          {{ localizedEntryName(b) || t('library.unnamed') }}</span
        ><span>{{t('library.resumeStep',{step:step+1,name:steps[step]})}}</span>
      </button>
      <div v-if="!store.characters.length" class="empty-library">
        <div class="empty-sigil">✧</div>
        <h2>{{t('library.empty')}}</h2>
        <p>{{t('library.guide')}}</p>
        <button class="primary" @click="action(create)">{{t('library.first')}}</button>
        <div class="empty-meta">
          <span>{{t('library.classes')}}</span><span>{{t('library.species')}}</span><span>{{t('library.spells')}}</span>
        </div>
      </div>
      <div v-else class="character-grid">
        <article
          v-for="c in [...store.characters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))"
          :key="c.id"
          class="character-card"
        >
          <div class="card-top">
            <span :class="['tag', c.status === 'complete' ? 'complete' : 'draft']">{{
              c.status === 'complete' ? t('controls.completed') : t('library.draft')
            }}</span
            ><span class="muted small">{{t('library.level',{level:c.level})}}</span>
          </div>
          <CharacterAvatar :name="c.build.name" :portrait="c.portrait" :size="64" />
          <h2>{{ localizedEntryName(c.build) || t('library.unnamed') }}</h2>
          <p>
            {{ entryDisplayName(store.content.species.find((s) => s.id === c.build.speciesId) ?? {name:t('library.speciesPending')}) }}
            ·
            {{ entryDisplayName(store.content.classes.find((s) => s.id === c.build.classId) ?? {name:t('library.classPending')}) }} ·
            {{t('library.level',{level:c.level})}}
          </p>
          <small class="muted">{{t('library.updated',{date:uiDate(c.updatedAt,'datetime')})}}</small>
          <label
            >{{t('library.purpose')}}<select
              :value="c.purpose ?? (c.npcOwnerId ? 'npc' : 'shared')"
              :disabled="!!c.npcOwnerId || busy"
              @change="
                action(() =>
                  store.setPurpose(
                    c.id,
                    ($event.target as HTMLSelectElement).value as 'player' | 'npc' | 'shared',
                  ),
                )
              "
            >
              <option value="player">{{t('library.player')}}</option>
              <option value="npc">{{t('library.npc')}}</option>
              <option value="shared">{{t('library.shared')}}</option>
            </select></label
          >
          <div class="card-actions">
            <button class="primary" @click="action(() => open(c))">
              {{ c.status === 'draft' ? t('library.continue') : t('library.view') }} →</button
            ><button
              v-if="c.status === 'complete'"
              class="secondary"
              @click="action(() => edit(c))"
            >
              {{ controlText('controls.edit') }}
            </button>
          </div>
          <div class="card-tools">
            <button @click="action(() => store.duplicate(c))">{{ controlText('controls.copy') }}</button
            ><button @click="exportCharacter(c)">{{ controlText('controls.export') }}</button
            ><button class="danger-text" @click="requestDelete(c)">{{ controlText('controls.remove') }}</button>
          </div>
        </article>
      </div>
      <footer class="library-footer">
        <span>{{t('library.local')}}</span><span>{{t('library.backup')}}</span>
      </footer>
    </main>
    <template v-else-if="page === 'builder' && store.editor">
      <div class="builder-topbar">
        <button class="text-button" @click="action(leave)">{{ controlText('game.myCharacters') }}</button
        ><span class="save-status" role="status">{{
          store.saving ? controlText('expressionFour.saving') : store.savedAt ? controlText('expressionFour.saved') + store.savedAt : controlText('expressionFour.draftAutosave')
        }}</span
        ><button class="subtle mobile-summary" @click="modal = 'summary'">{{ controlText('creation.summary') }}</button>
        <button
          v-if="store.editor.editingId"
          class="subtle"
          @click="
            action(async () => {
              await store.cancel()
              page = 'library'
            })
          "
        >
          {{ controlText('creation.cancelEdit') }}</button
        ><button
          class="secondary compact"
          :disabled="busy"
          @click="
            action(async () => {
              await store.draft()
              message('草稿已保存。')
            })
          "
        >
          {{ controlText('creation.saveDraft') }}
        </button>
      </div>
      <div class="builder-layout">
        <nav class="step-nav" :aria-label="controlText('creation.steps')">
          <div class="nav-title">{{ controlText('creation.create') }} <small>{{ controlText('creation.levelOne') }}</small></div>
          <button
            v-for="(name, i) in steps"
            :key="name"
            :class="['step-button', { active: step === i }]"
            :aria-current="step === i ? 'step' : undefined"
            @click="step = i"
          >
            <span :class="['step-number', { done: !pendingAt(i) }]">{{
              !pendingAt(i) ? '✓' : String(i + 1).padStart(2, '0')
            }}</span
            ><span
              >{{ name
              }}<small>{{ pendingAt(i) ? pendingAt(i) + controlText('expressionFour.itemsRemaining') : controlText('state.readyState') }}</small></span
            >
          </button>
          <div class="nav-bottom">{{ controlText('creation.changeAnytime') }}<br />{{ controlText('creation.validateAtEnd') }}</div>
        </nav>
        <section class="builder-main">
          <div class="step-heading">
            <p class="eyebrow">STEP {{ String(step + 1).padStart(2, '0') }} / 07</p>
            <h1>{{ steps[step] }}</h1>
            <p class="muted">{{ descriptions[step] }}</p>
          </div>
          <template v-if="step === 0"
            ><div class="class-grid">
              <button
                v-for="(c, i) in store.content.classes"
                :key="c.id"
                :class="['class-tile', { selected: b.classId === c.id }]"
                @click="identity('classId', c.id)"
              >
                <span class="class-index">{{
                  ['⚒', '♫', '☀', '❧', '⚔', '◈', '✥', '➶', '◇', '✺', '☽', '✧'][i] || '✦'
                }}</span
                ><strong>{{ localizedEntryName(c) }}</strong
                ><small>{{ c.english }}</small
                ><span class="muted">{{ ruleText(c.summary) }}</span
                ><span v-if="b.classId === c.id" class="tile-check">✓</span>
              </button>
            </div>
            <section v-if="cl" class="panel class-details">
              <div class="section-heading">
                <h2>
                  {{ localizedEntryName(cl) }} <small v-if="controlI18n.global.locale.value==='zh-CN'">{{ cl.english }}</small>
                </h2>
                <a
                  :href="safeSource(cl.source.url) + '#page=' + cl.source.page"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="source-link"
                  >{{ controlText('scriptSummary.srdP', {p0:(cl.source.page)}) }}</a
                >
              </div>
              <div class="tag-row">
                <span class="tag">{{ controlText('scriptSummary.hitDieD', {p0:(cl.hitDie)}) }}</span
                ><span class="tag">{{ controlText('creation.mainAbility') }} {{ abilityNames(cl.primary) }}</span
                ><span class="tag">{{ controlText('controls.saveThrow') }} {{ abilityNames(cl.saves) }}</span>
              </div>
              <p v-for="f in cl.features" :key="f" class="feature">{{ ruleText(f) }}</p>
              <p class="muted small">
                {{ controlText('creation.levelOneHelp') }}
              </p>
            </section></template
          >
          <template v-if="step === 1"
            ><h2>{{ controlText('controls.background') }} <span class="muted small">{{ controlText('creation.backgroundHelp') }}</span></h2>
            <div class="background-grid">
              <button
                v-for="o in store.content.backgrounds"
                :key="o.id"
                :class="['origin-tile', { selected: b.backgroundId === o.id }]"
                @click="identity('backgroundId', o.id)"
              >
                <strong>{{ localizedEntryName(o) }}</strong
                ><small>{{ o.english }} · {{ sourceCaption(o.source) }}</small>
                <p>{{ ruleText(o.summary) }}</p>
                <span>{{ skillNames(o.skills) }}</span
                ><small>{{ controlText('creation.boostable') }} {{ abilityNames(o.abilities) }}</small>
              </button>
            </div>
            <p v-if="bg" class="info-strip">
              {{ controlText('scriptSummary.proficiencyProficiency', {p0:(controlText('creation.backgroundGrants')),p1:(skillNames(bg.skills)),p2:(localizedEntryName(item(bg.tool)) || controlText('expressionFour.gamingSet')),p3:(bg.feat.startsWith('magic-initiate')
                  ? controlText('expressionFour.magicInitiate') + (bg.feat.endsWith('cleric') ? controlText('configuration.cleric') : controlText('configuration.wizard')) + '）'
                  : featName(bg.feat))}) }}
            </p>
            <h2>{{ controlText('controls.species') }} <span class="muted small">{{ controlText('creation.speciesHelp') }}</span></h2>
            <div class="species-grid">
              <button
                v-for="o in store.content.species"
                :key="o.id"
                :class="['species-tile', { selected: b.speciesId === o.id }]"
                @click="identity('speciesId', o.id)"
              >
                <strong>{{ localizedEntryName(o) }}</strong
                ><small>{{ o.english }}</small
                ><span>{{ o.speed }} {{ controlText('game.feet') }}</span>
              </button>
            </div>
            <section v-if="sp" class="panel">
              <p v-for="f in sp.features" :key="f" class="feature">{{ ruleText(f) }}</p>
              <p class="source-link">{{ controlText('scriptSummary.page', {p0:(sp.source.pack),p1:(sp.source.page)}) }}</p>
            </section>
            <ChoiceField :content="store.content"
              v-for="node in choices.filter((n) => n.step === 1)"
              :key="node.id"
              :node="node"
              :model-value="b.choices[node.id] || []"
              @update:model-value="updateChoice(node.id, $event)"
          /></template>
          <template v-if="step === 2"
            ><div class="segmented" :aria-label="controlText('creation.abilityMethod')">
              <button
                v-for="m in ['array', 'point', 'roll'] as const"
                :key="m"
                :class="{ selected: b.method === m }"
                @click="setMethod(m)"
              >
                {{ { array: controlText('finalField.standardArray'), point: controlText('finalField.pointBuy'), roll: controlText('finalField.dDropTheLowest') }[m] }}
              </button>
            </div>
            <div class="section-heading">
              <p class="muted small">
                {{
                  b.method === 'array'
                    ? controlText('expressionFour.useEachOfTheSixValuesOnceSelecting')
                    : b.method === 'point'
                      ? controlText('expressionFour.baseValuesRangeFromCostsPointsAndCosts')
                      : controlText('expressionFour.rollDDropLowestSixTimesAndAssign')
                }}
              </p>
              <button
                v-if="b.method !== 'roll' || b.rolls"
                class="secondary compact"
                @click="assignRecommended(b)"
              >
                {{ controlText('creation.recommended') }}
              </button>
            </div>
            <div
              v-if="b.method === 'point'"
              :class="['point-budget', { 'over-budget': pointSpent > 27 }]"
            >
              <span>{{ controlText('creation.used') }} {{ pointSpent }} {{ controlText('creation.pointBudget') }}</span><b>{{ controlText('domain.remaining') }} {{ 27 - pointSpent }}</b>
            </div>
            <div v-if="b.method === 'roll'" class="roll-area">
              <button class="secondary" @click="b.rolls ? (modal = 'reroll') : roll()">
                {{ b.rolls ? controlText('creation.reroll') : controlText('expressionFour.generateSixAbilityRolls') }}
              </button>
              <div v-if="b.rolls" class="dice-grid">
                <div v-for="(dice, i) in b.rolls.dice" :key="i">
                  <span>{{ dice.join(' · ') }}</span
                  ><b>{{ b.rolls.totals[i] }}</b>
                </div>
              </div>
              <p v-if="b.rolls" class="muted small">
                {{ controlText('creation.recorded') }} {{ uiDate(b.rolls.at,'datetime') }} {{ controlText('creation.localRecord') }}
              </p>
            </div>
            <div class="ability-table">
              <div class="ability-row ability-table-head">
                <span>{{ controlText('game.abilities') }}</span><span>{{ controlText('creation.base') }}</span><span>{{ controlText('creation.backgroundBoosts') }}</span><span>{{ controlText('creation.final') }}</span
                ><span>{{ controlText('game.modifier') }}</span>
              </div>
              <div v-for="a in ABILITIES" :key="a" class="ability-row">
                <label :for="'score-' + a"
                  ><strong>{{ abilityDisplayName(a) }}</strong
                  ><small>{{ a.toUpperCase() }}</small></label
                ><select
                  :id="'score-' + a"
                  :value="b.scores[a]"
                  :disabled="b.method === 'roll' && !b.rolls"
                  @change="setScore(a, Number(($event.target as HTMLSelectElement).value))"
                >
                  <option
                    v-for="n in b.method === 'point'
                      ? [8, 9, 10, 11, 12, 13, 14, 15]
                      : b.method === 'roll'
                        ? Array.from(new Set(b.rolls?.totals || [b.scores[a]])).sort(
                            (a, b) => b - a,
                          )
                        : ARRAY"
                    :key="n"
                    :value="n"
                  >
                    {{ n }}{{ b.method === 'point' ? '（' + POINT_COST[n] + controlText('expressionFour.points') : '' }}
                  </option></select
                ><select
                  v-model.number="b.boosts[a]"
                  :disabled="!bg?.abilities.includes(a)"
                  :aria-label="uiLabel(ABILITY_NAMES[a]) + controlText('creation.backgroundBoosts')"
                >
                  <option :value="0">—</option>
                  <option :value="1">+1</option>
                  <option :value="2">+2</option></select
                ><b>{{ d.scores[a] }}</b
                ><span class="ability-mod">{{ signed(d.mods[a]) }}</span>
              </div>
            </div>
            <p class="info-strip">
              {{
                bg
                  ? controlText('expressionFour.backgroundBoostsLimitedTo') + abilityNames(bg.abilities) + controlText('expressionFour.chooseOrThreeSeparateBoosts')
                  : controlText('expressionFour.chooseABackgroundFirstToDetermineAllowedAbility')
              }}
            </p>
            <ul v-if="issues.some((x) => x.step === 2)" class="inline-issues">
              <li v-for="i in issues.filter((x) => x.step === 2)" :key="i.key">{{ buildIssuePresentation(i,b,store.content) }}</li>
            </ul></template
          >
          <template v-if="step === 3"
            ><p v-if="!cl || !bg || !sp" class="notice">
              {{ controlText('creation.chooseOriginFirst') }}
            </p>
            <p v-if="bg" class="info-strip">
              {{ controlText('creation.backgroundSkills') }}{{ skillNames(bg.skills) }}{{ controlText('creation.avoidKnown') }}
            </p>
            <ChoiceField :content="store.content"
              v-for="node in choices.filter((n) => n.step === 3)"
              :key="node.id"
              :node="node"
              :model-value="b.choices[node.id] || []"
              @update:model-value="updateChoice(node.id, $event)"
              @info="spellInfo"
          /></template>
          <template v-if="step === 4"
            ><div v-if="store.editor.editingId" class="notice">
              <strong>{{
                store.editor.rebuild ? controlText('expressionFour.initialAssetsWillRegenerate') : controlText('expressionFour.existingInventoryAndCoinsRetained')
              }}</strong>
              <p>{{ controlText('creation.regenerateEquipmentHelp') }}</p>
              <label class="check-label"
                ><input
                  v-model="store.editor.rebuild"
                  type="checkbox"
                />{{ controlText('creation.regenerateEquipment') }}</label
              >
            </div>
            <template v-if="store.editor.rebuild"
              ><h2>{{ controlText('creation.classEquipment') }}</h2>
              <div class="equipment-plans">
                <button
                  v-for="(plan, i) in cl?.equipment"
                  :key="i"
                  :class="['plan-tile', { selected: b.classEquipment === i }]"
                  @click="changeEquipment('classEquipment', i)"
                >
                  <strong>{{ plan.label }}</strong
                  ><span>{{
                    plan.items
                      .map(
                        (x) =>
                          (localizedEntryName(item(x.itemId)) || x.itemId) +
                          (x.quantity > 1 ? ' ×' + x.quantity : ''),
                      )
                      .join('、')
                  }}</span
                  ><small>{{ controlText('quantity.goldItems', {p0:(plan.gp)}) }}</small>
                </button>
              </div>
              <h2>{{ controlText('creation.backgroundEquipment') }}</h2>
              <div class="equipment-plans">
                <button
                  v-for="(plan, i) in bg?.equipment"
                  :key="i"
                  :class="['plan-tile', { selected: b.backgroundEquipment === i }]"
                  @click="changeEquipment('backgroundEquipment', i)"
                >
                  <strong>{{ plan.label }}</strong
                  ><span>{{
                    plan.items
                      .map(
                        (x) =>
                          (localizedEntryName(item(x.itemId)) || x.itemId) +
                          (x.quantity > 1 ? ' ×' + x.quantity : ''),
                      )
                      .join('、')
                  }}</span
                  ><small>{{ controlText('quantity.goldItems', {p0:(plan.gp)}) }}</small>
                </button>
              </div>
              <ChoiceField :content="store.content"
                v-for="node in equipmentChoices(b, store.content)"
                :key="node.id"
                :node="node"
                :model-value="b.equipmentChoices[node.id] || []"
                @update:model-value="b.equipmentChoices[node.id] = $event"
              />
              <section class="panel">
                <div class="section-heading">
                  <h2>{{ controlText('creation.buyExtra') }}</h2>
                  <b class="money">{{ initial.coins }} {{ controlText('creation.gpAvailable') }}</b>
                </div>
                <p class="muted small">{{ controlText('creation.purchaseHelp') }}</p>
                <div class="shop-row">
                  <input
                    v-model="purchaseSearch"
                    type="search"
                    :aria-label="controlText('creation.searchEquipment')"
                    :placeholder="controlText('creation.searchName')"
                  /><select v-model="purchaseId" :aria-label="controlText('creation.purchaseItem')">
                    <option value="">{{ controlText('game.item') }}</option>
                    <option v-for="i in purchaseOptions" :key="i.id" :value="i.id">
                      {{ localizedEntryName(i) }} · {{ i.cost }} GP
                    </option></select
                  ><input
                    v-model.number="purchaseQuantity"
                    type="number"
                    min="1"
                    max="1000"
                    :aria-label="controlText('creation.purchaseQuantity')"
                  /><button class="secondary" @click="purchase">{{ controlText('controls.add') }}</button>
                </div>
                <div v-for="(p, i) in b.purchases" :key="p.itemId" class="data-row">
                  <span>{{ localizedEntryName(item(p.itemId)) }} × {{ p.quantity }}</span
                  ><span>{{ ((item(p.itemId)?.cost || 0) * p.quantity).toFixed(2) }} GP</span
                  ><button class="text-button danger-text" @click="removePurchase(i)">{{ controlText('game.remove') }}</button>
                </div>
              </section></template
            >
            <section class="panel">
              <div class="section-heading">
                <h2>{{ controlText('creation.startingInventory') }}</h2>
                <span class="muted small"
                  >{{ store.editor.rebuild ? initial.weight.toFixed(2) + ' lb · ' : '' }}{{ controlText('creation.carryingLimit') }}
                  {{ d.capacity }} lb</span
                >
              </div>
              <p class="muted small">{{ controlText('creation.wearHelp') }}</p>
              <div v-for="row in actualInventory" :key="row.instanceId" class="inventory-row">
                <label class="check-label"
                  ><input
                    v-if="['armor', 'shield', 'weapon'].includes(item(row.itemId)?.kind || '')"
                    type="checkbox"
                    :checked="row.equipped"
                    :disabled="!store.editor.rebuild"
                    :aria-label="controlText('expressionFour.wear') + localizedEntryName(item(row.itemId))"
                    @change="wear(row.instanceId)"
                  /><span>{{ localizedEntryName(item(row.itemId)) || row.itemId }}</span></label
                ><b>× {{ row.quantity }}</b
                ><small>{{ row.source }}</small>
              </div>
              <p v-if="!actualInventory.length" class="muted">
                {{ controlText('creation.equipmentAfterOrigin') }}
              </p>
            </section>
            <p v-for="w in notice" :key="w" class="notice small">{{ w }}</p></template
          >
          <template v-if="step === 5"
            ><div class="panel story-form">
              <PortraitPicker
                :name="b.name"
                :portrait="store.editor.character.portrait"
                :disabled="busy || store.saving"
                @change="action(() => setDraftPortrait($event))"
              />
              <label
                >{{ controlText('creation.characterName') }} <span class="required">{{ controlText('controls.required') }}</span
                ><input
                  v-model="b.name"
                  maxlength="80"
                  :placeholder="controlText('creation.namePlaceholder')" /></label
              ><label
                >{{ controlText('game.side') }}<select v-model="b.alignment">
                  <option
                    v-for="a in [
                      '守序善良',
                      '中立善良',
                      '混乱善良',
                      '守序中立',
                      '中立',
                      '混乱中立',
                      '守序邪恶',
                      '中立邪恶',
                      '混乱邪恶',
                    ]"
                    :key="a"
                  >
                    {{ uiLabel(a) }}
                  </option>
                </select></label
              ><label
                >{{ controlText('creation.appearance') }}<textarea
                  v-model="b.appearance"
                  rows="3"
                  maxlength="4000"
                  :placeholder="controlText('creation.appearancePlaceholder')"
                ></textarea></label
              ><NpcPresentationEditor v-model="b.npcPresentation" /><label
                >{{ controlText('creation.storyMotivation') }}<textarea
                  v-model="b.story"
                  rows="6"
                  maxlength="12000"
                  :placeholder="controlText('creation.storyPlaceholder')"
                ></textarea>
              </label>
              <p class="muted small">{{ controlText('creation.storyLater') }}</p>
            </div></template
          >
          <template v-if="step === 6"
            ><div :class="['review-banner', issues.length ? 'incomplete' : 'ready']">
              <span>{{ issues.length ? '○' : '✓' }}</span>
              <div>
                <h2>
                  {{ issues.length ? controlText('inlineSummary.itemsStillNeedCompletion',{p0:(issues.length)}) : controlText('expressionFour.adventurerReady') }}
                </h2>
                <p>
                  {{
                    issues.length
                      ? controlText('expressionFour.clickAnIssueBelowToReturnToIts')
                      : controlText('expressionFour.allRequiredChoicesAndInitialAssetsPassedCharacter')
                  }}
                </p>
              </div>
            </div>
            <div v-if="issues.length" class="issue-list">
              <button v-for="i in issues" :key="i.key" @click="step = i.step">
                <span class="tag">{{ steps[i.step] }}</span
                >{{ buildIssuePresentation(i,b,store.content) }}<span>→</span>
              </button>
            </div>
            <p v-for="w in notice" :key="w" class="notice small">{{ w }}</p>
            <CharacterSheet
              :character="{
                ...store.editor.character,
                inventory: actualInventory,
                coins: store.editor.rebuild ? initial.coins : store.editor.character.coins,
              }"
              :content="store.content"
              @info="spellInfo"
            />
            <details class="panel custom-panel">
              <summary>{{ controlText('game.custom') }}</summary>
              <p class="muted small">{{ controlText('creation.customHelp') }}</p>
              <h3>{{ controlText('creation.customItems') }}</h3>
              <p class="small muted">{{ controlText('creation.customItemHelp') }}</p>
              <div class="custom-grid">
                <label>{{ controlText('controls.name') }}<input v-model="customName" maxlength="80" /></label
                ><label
                  >{{ controlText('creation.weight') }}<input v-model.number="customWeight" type="number" min="0" /></label
                ><label
                  >{{ controlText('creation.wearSlot') }}<select v-model="customWearSlot" :aria-label="controlText('creation.customWear')">
                    <option value="">{{ controlText('creation.notWorn') }}</option>
                    <option
                      v-for="slot in WEAR_SLOTS.filter((x) => x !== 'armor')"
                      :key="slot"
                      :value="slot"
                    >
                      {{ uiLabel(SLOT_NAMES[slot]) }}
                    </option>
                  </select></label
                >
                <label
                  >{{ controlText('game.inventoryCategory') }}<select v-model="customTag" :aria-label="controlText('creation.customCategory')">
                    <option v-for="id in INVENTORY_TAGS" :key="id" :value="id">
                      {{ uiLabel(TAG_NAMES[id]) }}
                    </option>
                  </select></label
                >
                <label class="inline-check"
                  ><input v-model="customHoldable" type="checkbox" />{{ controlText('creation.handheld') }}</label
                >
                <label class="wide">{{ controlText('controls.description') }}<input v-model="customNote" maxlength="1000" /></label
                ><button class="secondary" @click="addCustom">{{ controlText('creation.addCustom') }}</button>
              </div>
              <div v-for="(i, index) in b.customItems" :key="i.id" class="data-row">
                <span>{{ localizedEntryName(i) }} {{ controlText('creation.customSuffix') }}</span
                ><button class="text-button danger-text" @click="removeCustom(index)">{{ controlText('game.remove') }}</button>
              </div>
              <h3>{{ controlText('creation.gmNumbers') }}</h3>
              <div class="custom-grid">
                <label
                  >{{ controlText('creation.adjustment') }}<select v-model="adjustField">
                    <option v-for="a in ABILITIES" :key="a" :value="a">
                      {{ uiLabel(ABILITY_NAMES[a]) }}
                    </option>
                    <option value="hp">{{ controlText('game.maxHP') }}</option>
                    <option value="ac">AC</option>
                  </select></label
                ><label
                  >{{ controlText('game.modifier') }}<input
                    v-model.number="adjustAmount"
                    type="number"
                    min="-100"
                    max="100" /></label
                ><label class="wide"
                  >{{ controlText('domain.reason') }}<input
                    v-model="adjustReason"
                    maxlength="1000"
                    :placeholder="controlText('creation.adjustSource')" /></label
                ><button class="secondary" @click="addAdjustment">{{ controlText('creation.addGm') }}</button>
              </div>
              <div v-for="(a, i) in b.adjustments" :key="a.id" class="data-row">
                <span>{{ a.field }} {{ signed(a.amount) }} · {{ a.reason }}</span
                ><button class="text-button danger-text" @click="b.adjustments.splice(i, 1)">
                  {{ controlText('game.remove') }}
                </button>
              </div>
            </details></template
          >
          <footer class="wizard-footer">
            <button class="secondary" :disabled="step === 0" @click="step--">{{ controlText('creation.previous') }}</button
            ><span class="muted small">{{
              pendingAt(step) ? pendingAt(step) + controlText('expressionFour.itemsRemaining') : controlText('expressionFour.thisStepIsReady')
            }}</span
            ><button v-if="step < 6" class="primary" @click="step++">{{ controlText('creation.next') }}</button
            ><button
              v-else
              class="primary"
              :disabled="!!issues.length || busy"
              @click="action(finish)"
            >
              {{ store.editor.editingId ? controlText('expressionFour.saveCharacterChanges') : controlText('expressionFour.generateCharacterCard') }} →
            </button>
          </footer>
        </section>
        <CharacterSummary
          :build="b"
          :content="store.content"
          :inventory="actualInventory"
          :issue-count="issues.length"
        />
      </div>
    </template>
    <main v-else-if="page === 'sheet' && currentCharacter" class="sheet-page">
      <div class="sheet-toolbar">
        <button class="text-button" :disabled="store.saving" @click="page = 'library'">
          {{ controlText('game.myCharacters') }}
        </button>
        <div>
          <button class="secondary" @click="exportCharacter(currentCharacter)">{{ controlText('creation.exportJson') }}</button
          ><button
            class="primary"
            :disabled="store.saving"
            @click="action(() => edit(currentCharacter!))"
          >
            {{ controlText('creation.editCharacter') }}
          </button>
        </div>
      </div>
      <CharacterSheet
        :character="currentCharacter"
        :content="store.content"
        playing
        @info="spellInfo"
      >
        <RuntimePanel :character="currentCharacter" :content="store.content" @info="spellInfo" />
      </CharacterSheet>
    </main>
    <input
      ref="importCharacterInput"
      class="hidden-input"
      type="file"
      accept=".json,application/json"
      :aria-label="controlText('creation.importCharacterFile')"
      @change="importFile($event)"
    /><input
      ref="importPackInput"
      class="hidden-input"
      type="file"
      accept=".json,application/json"
      :aria-label="controlText('creation.importRuleFile')"
      @change="importFile($event, true)"
    />
    <NotificationHost />
    <dialog ref="modalElement" class="modal" @cancel="closeModal">
      <button class="modal-close icon-button" :aria-label="controlText('creation.closeDialog')" @click="closeModal">×</button>
      <template v-if="modal === 'summary' && store.editor">
        <h2>{{ controlText('creation.currentSummary') }}</h2>
        <CharacterSummary
          :build="b"
          :content="store.content"
          :inventory="actualInventory"
          :issue-count="issues.length"
        />
      </template>
      <template v-if="modal === 'source'"
        ><p class="eyebrow">RULES & CONTENT</p>
        <h2>{{ controlText('creation.ruleSources') }}</h2>
        <p>
          {{ controlText('creation.catalogueHelp') }}
        </p>
        <p class="muted small">
          {{ controlText('creation.translationHelp') }}
        </p>
        <div class="tag-row">
          <a
            class="secondary"
            href="https://www.dndbeyond.com/srd"
            target="_blank"
            rel="noopener noreferrer"
            >{{ controlText('creation.officialSrd') }}</a
          ><a
            class="secondary"
            href="https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf"
            target="_blank"
            rel="noopener noreferrer"
            >SRD 5.2.1 PDF ↗</a
          >
        </div>
        <h3>{{ controlText('creation.additionalPacks') }}</h3>
        <p class="small">
          {{ controlText('creation.extensionHelp') }}
        </p>
        <div v-for="p in store.allPacks" :key="p.id" class="data-row">
          <span>{{ localizedEntryName(p) }}</span
          ><span>{{ p.version }}</span>
        </div>
        <div class="tag-row">
          <button class="secondary" @click="importPackInput?.click()">{{ controlText('creation.importPack') }}</button
          ><button
            class="secondary"
            @click="download('example-pack.json', JSON.stringify(samplePack, null, 2))"
          >
            {{ controlText('creation.samplePack') }}
          </button>
        </div>
        <p class="attribution">{{ ATTRIBUTION }}</p>
        <p class="small muted">
          {{ controlText('creation.localStorageHelp') }}
        </p></template
      >
      <template v-if="modal === 'spell' && selectedSpell"
        ><p class="eyebrow">
          {{ selectedSpell.level === 0 ? controlText('controls.cantrips') : selectedSpell.level + controlText('expressionFour.levelSpells') }}
        </p>
        <h2>{{ localizedEntryName(selectedSpell) }}</h2>
        <p>{{ selectedSpell.english }} · {{ spellPresentation(selectedSpell).school }}</p>
        <div class="spell-metadata">
          <p><b>{{ controlText('domain.castingTime') }}</b>{{ spellPresentation(selectedSpell).castingTime }}</p>
          <p><b>{{ controlText('domain.distance') }}</b>{{ spellPresentation(selectedSpell).range }}</p>
          <p><b>{{ controlText('domain.components') }}</b>{{ spellPresentation(selectedSpell).components }}</p>
          <p><b>{{ controlText('controls.duration') }}</b>{{ spellPresentation(selectedSpell).duration }}</p>
        </div>
        <p class="spell-description">{{ spellPresentation(selectedSpell).description }}</p>
        <a
          :href="safeSource(selectedSpell.source.url) + '#page=' + selectedSpell.source.page"
          target="_blank"
          rel="noopener noreferrer"
          class="source-link"
          >{{ controlText('scriptSummary.pageEntry65', {p0:(selectedSpell.source.pack),p1:(selectedSpell.source.version),p2:(selectedSpell.source.page)}) }}</a
        ></template
      >
      <template v-if="modal === 'delete' && deleting"
        ><h2>{{ controlText('controls.remove') }} {{ localizedEntryName(deleting.build) || t('library.unnamed') }}？</h2>
        <p>{{ controlText('creation.deleteHelp') }}</p>
        <div class="modal-actions">
          <button class="secondary" @click="closeModal">{{ controlText('creation.keepCharacter') }}</button
          ><button
            class="danger"
            :disabled="busy"
            @click="
              action(async () => {
                await store.remove(deleting!.id)
                closeModal()
                message('角色已删除。')
              })
            "
          >
            {{ controlText('creation.confirmDelete') }}
          </button>
        </div></template
      >
      <template v-if="modal === 'change' && change"
        ><h2>{{ controlText('creation.updateChoices') }}</h2>
        <p>{{ controlText('creation.updateHelp') }}</p>
        <ul>
          <li v-for="s in change.removed" :key="s">{{ s }}</li>
        </ul>
        <p v-if="store.editor?.editingId && !store.editor.rebuild" class="notice small">
          {{ controlText('creation.keepAssets') }}
        </p>
        <div class="modal-actions">
          <button class="secondary" @click="closeModal">{{ controlText('creation.keepChoices') }}</button
          ><button class="primary" @click="confirmChange">{{ controlText('creation.confirmUpdate') }}</button>
        </div></template
      >
      <template v-if="modal === 'reroll'"
        ><h2>{{ controlText('creation.rerollQuestion') }}</h2>
        <p>{{ controlText('creation.rerollHelp') }}</p>
        <div class="modal-actions">
          <button class="secondary" @click="closeModal">{{ controlText('creation.keepRolls') }}</button
          ><button class="primary" @click="roll">{{ controlText('creation.reroll') }}</button>
        </div></template
      >
    </dialog>
  </div>
</template>
