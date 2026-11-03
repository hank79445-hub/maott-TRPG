<script setup lang="ts">
import {currentValidationText} from '../build-issue-presentation'
import {displayFeedback} from '../feedback-presentation'
import {uiLabel} from '../ui-label'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {clone} from '../../core/engine'
import { computed, ref, shallowRef, nextTick } from 'vue'
import { AUTHORING_BRIEF_CHARACTERS } from '../../core/configuration-limits'
import {
  type AuthoringPipeline,
  newPipeline,
  SECTION_LABELS,
  stageFiles,
  stageIssues,
  readStage,
  attachNotebook,
  attachmentSummary,
  stageCoverage,
  impacted,
} from '../../core/authoring-stages'
import { type StageDocument } from '../../persistence/authoring-stage-schema'
import { newPersona } from '../../core/npc-persona'
import { textFilesZip } from '../../core/scene-art-pack'
import { saveBlob } from '../../online/script-client'
import LongTextField from '../LongTextField.vue'
import NpcPersonaEditor from '../NpcPersonaEditor.vue'
const model = defineModel<AuthoringPipeline>({ required: true })
const props = defineProps<{ brief: string; json: string; ready: boolean; contentLocale?: import('../../shared/localization/locale').Locale }>()
const emit = defineEmits<{ 'update:json': [string]; 'update:brief': [string]; 'update:contentLocale':[import('../../shared/localization/locale').Locale] }>()
const languageMismatch=computed(()=>[model.value.story,model.value.specification].some(d=>d?.contentLocale&&d.contentLocale!==(props.contentLocale??'zh-CN')))
const coverage=ref<string[]>([])
const attachment=ref<ReturnType<typeof attachmentSummary>>()
const acknowledged=shallowRef(false), applied=shallowRef('')
let previewSource='',previewDesign=''
const requireAcknowledgement=computed(()=>!!attachment.value&&(attachment.value.titleMismatch||(attachment.value.characters>0&&attachment.value.matched===0)))
const selected = shallowRef(''),
  error = shallowRef(''),
  pending = ref<StageDocument | null>(null),
  formal = shallowRef(''),
  importText = ref(''),
  outlineOpen = shallowRef(true),
  checksOpen = shallowRef(true)
function exportHistory(d: StageDocument) {
  saveBlob(
    new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }),
    d.stage + '-r' + d.revision + '.json',
  )
}
const stage = computed(() => (model.value.active === 2 ? 'specification' : 'story'))
const document = computed(() => model.value[stage.value])
const node = computed(
  () => document.value?.nodes.find((n) => n.key === selected.value) ?? document.value?.nodes[0],
)
const issues = computed(() =>
  document.value
    ? stageIssues(document.value, stage.value === 'specification' ? model.value.story : undefined)
    : [],
)
function change(active: 1 | 2 | 3) {
  model.value = { ...model.value, active }
}
function create() {
  const section = stage.value === 'story' ? 'conflict' : 'specification'
  model.value = {
    ...model.value,
    [stage.value]: {
      format: 'trpg-design-stage',
      version: 1,
      stage: stage.value,
      title: '新的设计资料',
      revision: 1,
      sourceRevision:
        stage.value === 'specification' ? (model.value.story?.revision ?? null) : null,
      nodes: [
        {
          key: section + '-' + crypto.randomUUID().slice(0, 8),
          section,
          title: SECTION_LABELS[section],
          body: '',
          refs: [],
          locked: false,
        },
      ],
      notes: '',
    },
  }
}
function touch() {
  const d = document.value
  if (!d) return
  d.revision++
  model.value.affected = [
    ...new Set([...model.value.affected, ...impacted({...d,nodes:[...(model.value.story?.nodes??[]),...(model.value.specification?.nodes??[])]}, node.value ? [node.value.key] : [])]),
  ]
  if (model.value.specification && stage.value === 'story')
    model.value.affected = [
      ...new Set([
        ...model.value.affected,
        ...model.value.specification.nodes
          .filter((n) => n.refs.some((r) => model.value.affected.includes(r)))
          .map((n) => n.key),
        '跑团规格与最终配置需复核',
      ]),
    ]
}
function add() {
  const d = document.value
  if (!d) return
  const section = stage.value === 'story' ? 'character' : 'quest',
    key = section + '-' + crypto.randomUUID().slice(0, 8)
  d.nodes.push({
    key,
    section,
    title: '新的' + SECTION_LABELS[section],
    body: '',
    refs: [],
    locked: false,
  })
  selected.value = key
  touch()
}
function download() {
  saveBlob(
    textFilesZip(
      stageFiles(
        stage.value,
        props.brief,
        stage.value === 'specification' ? model.value.story : undefined,
        props.contentLocale,
        controlI18n.global.locale.value,
      ),
    ),
    stage.value + '-model-files.zip',
  )
}
function exportDoc() {
  if (document.value)
    saveBlob(
      new Blob([JSON.stringify(document.value, null, 2)], { type: 'application/json' }),
      stage.value + '-design.json',
    )
}
async function load(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 2 * 1024 * 1024) throw Error('文件超过2MiB')
    importText.value = await file.text()
    previewImport()
  } catch (e) {
    error.value = String(e)
  } finally {
    input.value = ''
  }
}
function previewImport() {
  error.value = ''
  try {
    pending.value = readStage(importText.value, stage.value, document.value)
    const bad = stageIssues(
      pending.value,
      stage.value === 'specification' ? model.value.story : undefined,
    ).filter((i) => i.level === 'error')
    if (bad.length) throw Error(bad.map((i) => i.path + ': ' + i.message).join('；'))
  } catch (e) {
    pending.value = null
    error.value = e instanceof Error ? e.message : String(e)
  }
}
function applyImport() {
  if (!pending.value) return
  const old = document.value
  pending.value.revision = Math.max(pending.value.revision, (old?.revision ?? 0) + 1)
  model.value = {
    ...model.value,
    history: [...(model.value.history ?? []), ...(old ? [clone(old)] : [])].slice(-5),
    [stage.value]: clone(pending.value),
    affected: [
      ...new Set([
        ...model.value.affected,
        ...(old?.nodes ?? [])
          .filter(
            (n) =>
              JSON.stringify(n) !==
              JSON.stringify(pending.value!.nodes.find((m) => m.key === n.key)),
          )
          .map((n) => n.key),
        '下游配置需复核',
      ]),
    ],
  }
  pending.value = null
  selected.value = ''
}
function repair() {
  if (!document.value) return
  const files = stageFiles(stage.value, props.brief, model.value.story, props.contentLocale, controlI18n.global.locale.value)
  files['current-stage.json'] = JSON.stringify(document.value, null, 2)
  files['repair.txt'] = controlI18n.global.locale.value==='en'
    ? 'Repair only the selected node and explicitly affected content. Preserve stable keys, all other nodes and locked content. Return the complete JSON for the same stage.\nSelected: '+(node.value?.key??'All')+'\nOriginal validation issues: '+JSON.stringify(issues.value)
    :
    '只修复选中节点及明确受影响内容，保留稳定key、其他节点和锁定内容。返回完整同阶段JSON。\n选中：' +
    (node.value?.key ?? '全部') +
    '\n检查：' +
    JSON.stringify(issues.value)
  saveBlob(textFilesZip(files), 'stage-repair.zip')
}
function prepare() {
  error.value = ''
  try {
    applied.value='';acknowledged.value=false
    attachment.value=attachmentSummary(props.json,model.value)
    previewSource=props.json;previewDesign=JSON.stringify({story:model.value.story,specification:model.value.specification})
    coverage.value=stageCoverage(props.json,model.value)
    formal.value = attachNotebook(props.json, model.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
async function applyFormal() {
  if(!formal.value)return
  if(requireAcknowledgement.value&&!acknowledged.value){error.value='请先核对作品及编号不匹配提示';return}
  if(props.json!==previewSource||previewDesign!==JSON.stringify({story:model.value.story,specification:model.value.specification})){error.value='配置或设计资料已变化，请重新预览；未覆盖新内容';return}
  const next=formal.value
  emit('update:json', next)
  await nextTick()
  if(props.json!==next){error.value='写入未得到父工作台确认，原预览已保留，请勿重复覆盖';return}
  applied.value='已写入创作JSON：附入设计书，补入'+(attachment.value?.added??0)+'位NPC人设；未匹配'+(attachment.value?.unmatched??0)+'位。未替换剧情、人物或场景，尚需编译预检。'
  formal.value='';error.value=''
}
</script>
<template>
  <section class="authoring-stages">
    <label class="stage-language">{{controlText('language.creation')}}<select :value="contentLocale??'zh-CN'" @change="emit('update:contentLocale',($event.target as HTMLSelectElement).value as 'en'|'zh-CN')"><option value="zh-CN">{{ controlText('domain.chinese') }}</option><option value="en">English</option></select></label>
    <p v-if="languageMismatch" role="status">{{controlText('language.changed')}}</p>
    <nav class="stage-nav" :aria-label="controlText('workbench.stages')">
      <button
        v-for="(title, i) in [controlText('domain.storyStage'), controlText('domain.specificationStage'), controlText('domain.configurationStage')]"
        :key="title"
        :aria-pressed="model.active === i + 1"
        :class="{ active: model.active === i + 1 }"
        @click="change((i + 1) as 1 | 2 | 3)"
      >
        {{ i + 1 }} · {{ title }}
      </button>
    </nav>
    <details>
      <summary>{{ controlText('workbench.requirement') }}</summary>
      <LongTextField
        :model-value="brief"
        @update:model-value="emit('update:brief', $event)"
        :label="controlText('domain.briefTitle')"
        :limit="AUTHORING_BRIEF_CHARACTERS"
      />
    </details>
    <p class="muted">
      {{ controlText('workbench.constraintsHelp') }}
    </p>
    <details v-if="model.history?.length">
      <summary>{{ controlText('workbench.history') }}</summary>
      <button v-for="(d, i) in model.history" :key="i" @click="exportHistory(d)">
        {{ controlText('progressSummary.rDownload', {p0:(d.title),p1:(d.revision)}) }}</button>
    </details>
    <p v-if="error" class="error" role="alert">{{ displayFeedback(error,'error') }}</p>
    <slot v-if="model.active===2" name="specification-options" />
    <template v-if="model.active !== 3"
      ><div class="stage-actions"><button :aria-expanded="outlineOpen" @click="outlineOpen=!outlineOpen">{{outlineOpen?controlText('expressionFour.collapseCatalogue'):controlText('expressionFour.showCatalogue')}}</button><button :aria-expanded="checksOpen" @click="checksOpen=!checksOpen">{{checksOpen?controlText('expressionFour.collapseInspectionSidebar'):controlText('expressionFour.showInspectionSidebar')}}</button>
        <button :disabled="!ready" @click="download">{{ controlText('workbench.stagePack') }}</button
        ><label>{{ controlText('workbench.stageImport') }}<input type="file" accept=".json" @change="load" /></label
        ><button :disabled="!document" @click="exportDoc">{{ controlText('workbench.designDownload') }}</button
        ><button :disabled="!document" @click="repair">{{ controlText('workbench.repairDownload') }}</button>
      </div>
      <details>
        <summary>{{ controlText('workbench.paste') }}</summary>
        <LongTextField v-model="importText" :label="controlText('domain.stageJson')" :limit="2000000" /><button
          @click="previewImport"
        >
          {{ controlText('workbench.previewImport') }}
        </button>
      </details>
      <section v-if="pending" class="stage-card">
        <strong
          >{{ controlText('progressSummary.pendingImportEntriesPreviously', {p0:(pending.title),p1:(pending.nodes.length),p2:(document?.nodes.length ?? 0)}) }}</strong
        >
        <p>{{ controlText('workbench.importHelp') }}</p>
        <pre>{{ JSON.stringify(pending, null, 2) }}</pre>
        <button @click="applyImport">{{ controlText('workbench.applyStage') }}</button
        ><button @click="pending = null">{{ controlText('controls.cancel') }}</button>
      </section>
      <button v-if="!document" @click="create">{{ controlText('workbench.createStage') }}</button>
      <div v-else class="stage-layout" :class="{'no-outline':!outlineOpen,'no-checks':!checksOpen}">
        <aside v-if="outlineOpen" class="stage-outline">
          <strong>{{ controlText('workbench.outline') }}</strong
          ><button
            v-for="n in document.nodes"
            :key="n.key"
            :class="{ active: n.key === node?.key }"
            @click="selected = n.key"
          >
            {{ n.title }}{{ n.locked ? controlText('expressionFour.locked') : '' }}</button
          ><button @click="add">{{ controlText('workbench.addNode') }}</button>
        </aside>
        <main class="stage-main">
          <section class="stage-card">
            <h2>{{ document.title }}</h2>
            <label>{{ controlText('workbench.designTitle') }}<input v-model="document.title" @change="touch" /></label
            ><details><summary>{{ controlText('workbench.notes') }}</summary><LongTextField v-model="document.notes" :label="controlText('finalField.stageNotesAuthorAndGmMaterial')" :limit="30000" @update:model-value="touch"/></details><span>{{ controlText('progressSummary.revisionSource', {p0:(document.revision),p1:(document.sourceRevision ?? controlText('controls.none'))}) }}</span>
          </section>
          <section v-if="node" class="stage-card">
            <label
              ><input
                v-model="node.locked"
                type="checkbox"
              />{{ controlText('workbench.lock') }}</label
            >
            <fieldset :disabled="node.locked" @change="touch">
              <label
                >{{ controlText('controls.type') }}<select v-model="node.section">
                  <option v-for="(label, key) in SECTION_LABELS" :key="key" :value="key">
                    {{ uiLabel(label) }}
                  </option>
                </select></label
              ><label>{{ controlText('workbench.titleLabel') }}<input v-model="node.title" /></label>
              <p>{{ controlText('progressSummary.stableId', {p0:(node.key)}) }}</p>
              <LongTextField v-model="node.body" :label="controlText('finalField.completeDesign')" :limit="30000" /><label
                >{{ controlText('workbench.references') }}<select v-model="node.refs" multiple>
                  <option
                    v-for="n in [
                      ...(model.story?.nodes ?? []),
                      ...(model.active === 2 ? document.nodes : []),
                    ].filter((n) => n.key !== node?.key)"
                    :key="n.key"
                    :value="n.key"
                  >
                    {{ n.title }} · {{ n.key }}
                  </option>
                </select></label
              ><template v-if="node.section === 'character'"
                ><button v-if="!node.persona" @click="node.persona = newPersona()">
                  {{ controlText('workbench.persona') }}</button
                ><NpcPersonaEditor v-model="node.persona" /><template v-if="node.persona"
                  ><h3>{{ controlText('workbench.scenarioCheck') }}</h3>
                  <button
                    v-if="node.persona.scenarios.length === 0"
                    @click="
                      node.persona.scenarios = [
                        { kind: 'help', response: '' },
                        { kind: 'offense', response: '' },
                        { kind: 'threat', response: '' },
                      ]
                    "
                  >
                    {{ controlText('workbench.scenarioDraft') }}</button
                  ><LongTextField
                    v-for="s in node.persona.scenarios"
                    :key="s.kind"
                    v-model="s.response"
                    :label="
                      { help: controlText('finalField.playerRequestsHelp'), offense: controlText('finalField.playerRefusesOffends'), threat: controlText('finalField.characterSInterestsAreThreatened') }[
                        s.kind
                      ]
                    " /></template
              ></template>
            </fieldset>
          </section>
        </main>
        <aside v-if="checksOpen" class="stage-check">
          <details open>
            <summary>{{ controlText('progressSummary.checksAndImpact', {p0:(issues.length)}) }}</summary>
            <p v-for="(i, index) in issues" :key="index" :class="{ error: i.level === 'error' }">
              {{ i.level === 'error' ? controlText('expressionFour.mustFix') : controlText('expressionFour.creationSuggestion') }} · {{ i.path }}：{{ currentValidationText(i.message) }}
            </p>
            <p v-if="!issues.length">{{ controlText('workbench.structureHelp') }}</p>
            <p v-for="id in model.affected" :key="id">{{ controlText('progressSummary.needsReview', {p0:(id)}) }}</p>
            <button @click="model.affected = []">{{ controlText('workbench.acknowledged') }}</button>
          </details>
        </aside>
      </div>
      <button
        class="primary"
        :disabled="issues.some((i) => i.level === 'error')"
        @click="change(model.active === 1 ? 2 : 3)"
      >
        {{ controlText('workbench.nextStage') }}
      </button></template
    >
    <section v-else class="stage-card">
      <h2>{{ controlText('workbench.projectTitle') }}</h2>
      <slot name="project-tools" />
      <p>
        {{ controlText('workbench.projectHelp') }}
      </p>
      <details><summary>{{ controlText('workbench.attachment') }}</summary>
      <p v-if="!model.story&&!model.specification" role="status">{{ controlText('workbench.noDesign') }}</p>
      <p v-if="applied" role="status" class="attachment-success">{{applied}}</p><button type="button" :disabled="!json||(!model.story&&!model.specification)" @click="prepare">{{ controlText('workbench.attachmentPreview') }}</button
      ><template v-if="formal"
        ><p>{{ controlText('workbench.attachmentHelp') }}</p>
        <p v-if="attachment">{{ controlText('progressSummary.currentConfigurationStoryDesignCharactersMatchedPersonas', {p0:(attachment.configurationTitle),p1:(attachment.storyTitle||controlText('expressionFour.notProvided')),p2:(attachment.matched),p3:(attachment.characters),p4:(attachment.added)}) }}</p><p v-if="requireAcknowledgement" role="alert">{{ controlText('workbench.mismatch') }}</p><label v-if="requireAcknowledgement"><input type="checkbox" v-model="acknowledged"/>{{ controlText('workbench.allowMismatch') }}</label>
        <p v-for="message in coverage" :key="message" role="status">{{ controlText('progressSummary.configurationCoverageSuggestion', {p0:(message)}) }}</p><details><summary>{{ controlText('workbench.fullCandidate') }}</summary><pre>{{ formal }}</pre></details>
        <button
          type="button" :disabled="requireAcknowledgement&&!acknowledged" @click="applyFormal"
        >
          {{ controlText('workbench.applyJSON') }}</button
        ><button @click="formal = ''">{{ controlText('controls.cancel') }}</button></template
      >
      </details>
    </section>
  </section>
</template>
<style scoped>
.stage-nav {
  display: flex;
  border-bottom: 1px solid var(--line);
  gap: 8px;
  overflow-x: auto;
}
.stage-nav button {
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-bottom: 3px solid transparent;
  border-radius: 0;
  padding: 12px 18px;
  min-height: 44px;
}
.stage-nav button.active {
  border-bottom-color: var(--accent);
  color: var(--accent);
  font-weight: 650;
}
.stage-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) 280px;
  gap: 16px;
  margin: 16px 0;
  align-items: start;
}
.stage-layout.no-outline{grid-template-columns:minmax(0,1fr) 280px}.stage-layout.no-checks{grid-template-columns:180px minmax(0,1fr)}.stage-layout.no-outline.no-checks{grid-template-columns:minmax(0,1fr)}
.stage-main {
  min-width: 0;
}
.stage-card,
.stage-outline,
.stage-check {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
  min-width: 0;
}
.stage-card h2 {
  font-family: Georgia, 'Songti SC', serif;
}
.stage-outline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stage-outline .active {
  background: var(--accent-soft);
  color: var(--accent);
}
.stage-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 12px 0;
}
.authoring-stages button {
  min-height: 44px;
}
.authoring-stages pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 420px;
  overflow: auto;
  background: var(--surface);
  padding: 12px;
}
.authoring-stages fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
.authoring-stages input,
.authoring-stages select {
  background: var(--surface);
  color: var(--ink);
}
@media (max-width: 1400px) {
  .stage-layout {
    grid-template-columns: minmax(0, 1fr) 280px;
  }
  .stage-outline {
    grid-column: 1/-1;
    flex-direction: row;
    overflow-x: auto;
  }
  .stage-outline button {
    flex: none;
  }
}
@media (max-width: 900px) {
  .stage-layout {
    display: flex;
    flex-direction: column;
  }
  .stage-main,
  .stage-check,
  .stage-outline {
    width: 100%;
  }
  .stage-outline {
    flex-wrap: wrap;
  }
  .stage-check {
    order: 3;
  }
  .stage-actions > * {
    max-width: 100%;
  }
}
</style>
