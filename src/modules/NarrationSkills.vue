<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, shallowRef, watch } from 'vue'
import { clone } from '../core/engine'
import type { AiSettings } from '../core/ai-types'
import {
  narrationSkillPresets,
  parseNarrationSkill,
  resolveNarrationSkill,
  type NarrationSkill,
} from '../core/narration-skills'
import { narrationSkillSchema } from '../persistence/narration-skill-schema'
const props = defineProps<{
  settings: AiSettings
  scenes: { id: string; name: string }[]
  sceneId: string | null
  busy: boolean
}>()
const emit = defineEmits<{ save: [AiSettings]; test: [] }>()
const library = ref<NarrationSkill[]>(clone(props.settings.narrationSkills ?? [])),
  defaultId = shallowRef(props.settings.defaultNarrationSkill ?? ''),
  overrides = ref({ ...props.settings.sceneNarrationSkills }),
  selected = shallowRef(''),
  draft = ref<NarrationSkill | null>(null),
  error = shallowRef('')
watch(
  () => props.settings,
  () => {
    library.value = clone(props.settings.narrationSkills ?? [])
    defaultId.value = props.settings.defaultNarrationSkill ?? ''
    overrides.value = { ...props.settings.sceneNarrationSkills }
  },
  { deep: true },
)
const effective = computed(() => {
  try {
    return resolveNarrationSkill(
      {
        ...props.settings,
        narrationSkills: library.value,
        defaultNarrationSkill: defaultId.value || null,
        sceneNarrationSkills: overrides.value,
      },
      props.sceneId,
    )
  } catch {
    return null
  }
})
const sceneOverride = computed({
  get: () => (props.sceneId ? (overrides.value[props.sceneId] ?? '') : ''),
  set: (value: string) => {
    if (props.sceneId) overrides.value[props.sceneId] = value
  },
})
function edit() {
  draft.value = clone(library.value.find((s) => s.id === selected.value) ?? null)
}
function add() {
  const s = { ...narrationSkillPresets()[0]!, id: crypto.randomUUID(), name: '自定义叙事规范' }
  library.value.push(s)
  selected.value = s.id
  edit()
}
function presets() {
  library.value.push(...narrationSkillPresets().map((s) => ({ ...s, id: crypto.randomUUID() })))
}
function copy() {
  if (!draft.value) return
  const next = {
    ...clone(draft.value),
    id: crypto.randomUUID(),
    name: draft.value.name + '（副本）',
  }
  library.value.push(next)
  selected.value = next.id
  edit()
}
function apply() {
  try {
    if (!draft.value) return
    const old = library.value.find((s) => s.id === draft.value!.id)
    if (old && JSON.stringify(old) === JSON.stringify(draft.value)) {
      error.value = ''
      return
    }
    const s = narrationSkillSchema.parse({ ...draft.value, version: (old?.version ?? 0) + 1 })
    library.value = library.value.map((x) => (x.id === s.id ? s : x))
    draft.value = clone(s)
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Skill配置错误'
  }
}
function save() {
  try {
    if (draft.value) apply()
    if (error.value) return
    emit('save', {
      ...clone(props.settings),
      narrationSkills: clone(library.value),
      defaultNarrationSkill: defaultId.value || null,
      sceneNarrationSkills: Object.fromEntries(
        Object.entries(overrides.value).filter(([, v]) => !!v),
      ),
    })
  } catch (e) {
    error.value = String(e)
  }
}
function remove() {
  library.value = library.value.filter((s) => s.id !== selected.value)
  if (defaultId.value === selected.value) defaultId.value = ''
  for (const [id, s] of Object.entries(overrides.value))
    if (s === selected.value) delete overrides.value[id]
  draft.value = null
  selected.value = ''
}
function download() {
  if (!draft.value) return
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ format: 'trpg.narration-skill.v1', skill: draft.value }, null, 2)], {
      type: 'application/json',
    }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = 'narration-skill.json'
  a.click()
  URL.revokeObjectURL(url)
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 128000) throw Error('文件超过128KB')
    const s = parseNarrationSkill(
      await file.text(),
      file.name.toLowerCase().endsWith('.json') ? 'json' : 'md',
    )
    if (library.value.some((x) => x.id === s.id)) {
      s.id = crypto.randomUUID()
      s.name += '（导入副本）'
    }
    library.value.push(s)
    selected.value = s.id
    edit()
    error.value = ''
  } catch (e) {
    error.value = String(e)
  } finally {
    input.value = ''
  }
}
</script>
<template>
  <details class="room-card narration-skills">
    <summary>{{ controlText('ai.skillTitle') }}</summary>
    <p class="muted">
      {{ controlText('ai.skillHelp') }}
    </p>
    <fieldset :disabled="busy" class="ai-form">
      <label
        >{{ controlText('ai.defaultSkill') }}<select v-model="defaultId">
          <option value="">{{ controlText('ai.legacyNarration') }}</option>
          <option v-for="s in library" :key="s.id" :value="s.id">
            {{ localizedEntryName(s) }} · v{{ s.version }}
          </option>
        </select></label
      >
      <label v-if="sceneId"
        >{{ controlText('ai.sceneSkill') }}<select v-model="sceneOverride">
          <option value="">{{ controlText('ai.inheritRoom') }}</option>
          <option v-for="s in library" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
        </select></label
      >
      <label
        >{{ controlText('ai.editSkill') }}<select v-model="selected" @change="edit">
          <option value="">{{ controlText('ai.chooseSkill') }}</option>
          <option v-for="s in library" :key="s.id" :value="s.id">
            {{ localizedEntryName(s) }} · v{{ s.version }}
          </option>
        </select></label
      >
      <div class="room-row">
        <button type="button" :disabled="library.length >= 27" @click="presets">
          {{ controlText('domain.addTemplate') }}</button
        ><button type="button" :disabled="library.length >= 30" @click="add">{{ controlText('domain.newSkill') }}</button
        ><button type="button" :disabled="!draft || library.length >= 30" @click="copy">
          {{ controlText('domain.copySkill') }}
        </button>
      </div>
      <template v-if="draft">
        <label>{{ controlText('domain.skillName') }}<input v-model="draft.name" maxlength="100" /></label
        ><label>{{ controlText('controls.description') }}<input v-model="draft.description" maxlength="2000" /></label
        ><label>{{ controlText('domain.authorSource') }}<input v-model="draft.author" maxlength="200" /></label>
        <label>{{ controlText('language.narrationPolicy') }}<select v-model="draft.languageMode"><option :value="undefined">{{ controlText('language.legacy') }}</option><option value="follow">{{ controlText('language.follow') }}</option><option value="override">{{ controlText('language.override') }}</option></select></label>
        <label v-if="draft.languageMode !== 'follow'">{{ controlText('language.legacyRule') }}<input v-model="draft.language" maxlength="80" /></label>
        <p class="muted">{{ controlText('language.legacyHelp') }}</p>
        <p class="muted">{{ controlText('language.future') }}</p>
        ><label
          >{{ controlText('domain.perspective') }}<select v-model="draft.perspective">
            <option value="third">{{ controlText('domain.thirdPerson') }}</option>
            <option value="second">{{ controlText('domain.secondPerson') }}</option>
          </select></label
        ><label>{{ controlText('domain.tone') }}<input v-model="draft.tone" maxlength="500" /></label>
        <label
          >{{ controlText('domain.targetLength') }}<input
            v-model.number="draft.targetCharacters"
            type="number"
            min="80"
            max="2000" /></label
        ><label
          >{{ controlText('domain.paragraphs') }}<input v-model.number="draft.paragraphs" type="number" min="1" max="10" /></label
        ><label
          >{{ controlText('domain.detailLevel') }}<select v-model="draft.detail">
            <option value="restrained">{{ controlText('domain.restrained') }}</option>
            <option value="standard">{{ controlText('domain.standard') }}</option>
            <option value="vivid">{{ controlText('domain.vivid') }}</option>
          </select></label
        ><label class="check"
          ><input v-model="draft.includeNumbers" type="checkbox" />{{ controlText('ai.includeNumbers') }}</label
        >
        <label class="ai-wide"
          >{{ controlText('ai.skillMarkdown') }}<textarea
            v-model="draft.instructions"
            rows="5"
            maxlength="16000"
          /></label
        ><label class="ai-wide"
          >{{ controlText('ai.styleExamples') }}<textarea v-model="draft.examples" rows="3" maxlength="6000" />
        </label>
        <div class="room-row">
          <button type="button" @click="apply">{{ controlText('ai.applySkillDraft') }}</button
          ><button type="button" @click="download">{{ controlText('ai.exportSkill') }}</button
          ><button type="button" @click="remove">{{ controlText('ai.removeSkill') }}</button>
        </div>
      </template>
      <label
        >{{ controlText('ai.importSkill') }}<input
          type="file"
          accept=".json,.md,.markdown"
          @change="upload"
      /></label>
      <div class="room-row">
        <button type="button" @click="save">{{ controlText('ai.saveSkill') }}</button
        ><button type="button" @click="emit('test')">{{ controlText('ai.skillTrial') }}</button>
      </div>
    </fieldset>
    <p v-if="error" role="alert">{{ displayFeedback(error,'error') }}</p>
    <details>
      <summary>{{ controlText('ai.activeSkillPreview') }}</summary>
      <pre>{{ effective ? JSON.stringify(effective, null, 2) : controlText('ai.legacyNarration') }}</pre>
    </details>
  </details>
</template>
<style scoped>
.narration-skills fieldset {
  border: 0;
  padding: 0;
}
.narration-skills pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.narration-skills summary {
  min-height: 44px;
}
.narration-skills .room-row {
  flex-wrap: wrap;
}
</style>
