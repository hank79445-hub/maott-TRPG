<script setup lang="ts">
import {uiLabel} from './ui-label'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {clone} from '../core/engine'
import { computed, ref, shallowRef } from 'vue'
import type { NpcPersona } from '../persistence/npc-persona-schema'
import {
  newPersona,
  personaBasis,
  publicPersona,
  selfPersona,
  PERSONA_LABELS,
} from '../core/npc-persona'
import LongTextField from './LongTextField.vue'
const model = defineModel<NpcPersona>()
const props = defineProps<{ legacyPersonality?: string }>()
const scope = shallowRef('public'),
  migration = shallowRef(false),
  preview = ref('')
const stale = computed(
  () => !!model.value && model.value.summaryBasis !== personaBasis(model.value),
)
function suggest() {
  preview.value = props.legacyPersonality ?? ''
  migration.value = true
}
function apply() {
  const p = model.value ?? newPersona()
  p.public.voice = preview.value
  model.value = clone(p)
  migration.value = false
}
function addKnowledge() {
  model.value?.self.push({ key: crypto.randomUUID(), kind: 'fact', text: '', source: '' })
}
</script>
<template>
  <section class="persona-editor">
    <h3>{{ controlText('configuration.personaAndRoleplay') }}</h3>
    <p>{{ controlText('configuration.publicSelfOnlyAndGmInformationAreSaved') }}</p>
    <button v-if="!model" type="button" @click="model = newPersona()">{{ controlText('configuration.createLayeredPersonaDraft') }}</button
    ><button type="button" @click="suggest">{{ controlText('configuration.previewLegacyPersonalityMigration') }}</button>
    <section v-if="migration">
      <p>{{ controlText('configuration.loadsLegacyPersonalityOnlyWithoutGmNotesCheck') }}</p>
      <LongTextField v-model="preview" :label="controlText('finalField.publicWordingDraftAwaitingApplication')" /><button
        type="button"
        @click="apply"
      >
        {{ controlText('configuration.confirmWritingToPublicVoiceReplaceThisField') }}</button
      ><button type="button" @click="migration = false">{{ controlText('controls.cancel') }}</button>
    </section>
    <template v-if="model"
      ><nav class="runtime-tabs" :aria-label="controlText('configurationField.personaPermissionLayer')">
        <button
          v-for="(label, key) in {
            public: '公开可表演',
            self: 'NPC本人自知',
            director: '仅GM导演资料',
          }"
          :key="key"
          :aria-pressed="scope === key"
          @click="scope = key"
        >
          {{ label }}
        </button>
      </nav>
      <template v-if="scope === 'public'"
        ><LongTextField
          v-for="(label, key) in PERSONA_LABELS"
          :key="key"
          v-model="model.public[key]"
          :label="uiLabel(label)"
          :hint="controlText('finalField.forSafePublicDialogueOnlyDoNotEnter')"
        /><LongTextField v-model="model.summary" :label="controlText('finalField.publicRoleplayingSummary')" />
        <p role="status">
          {{ stale ? controlText('expressionTwo.sourceAndSummaryAreOutOfSyncThe') : controlText('expressionTwo.summaryVerifiedAgainstPublicSource') }}
        </p>
        <button @click="model.summaryBasis = personaBasis(model)">{{ controlText('workspace.confirmSummaryMatchesCurrentPublicSourceText') }}</button></template
      ><template v-else-if="scope === 'self'"
        ><p>{{ controlText('workspace.usedOnlyForControlledSelfKnowledgeRequestsNot') }}</p>
        <article v-for="(k, i) in model.self" :key="k.key">
          <label
            >{{ controlText('configurationField.knowledgeType') }}<select v-model="k.kind">
              <option
                v-for="(label, key) in {
                  fact: '已知事实',
                  hearsay: '听闻',
                  misbelief: '本人误解',
                  lie: '主动谎言',
                  goal: '私密目标',
                }"
                :key="key"
                :value="key"
              >
                {{ label }}
              </option>
            </select></label
          ><LongTextField v-model="k.text" :label="controlText('finalField.personalKnowledge')" /><LongTextField
            v-model="k.source"
            :label="controlText('finalField.sourceEvidence')"
          /><button @click="model.self.splice(i, 1)">{{ controlText('workspace.deleteThisBelief') }}</button>
        </article>
        <button @click="addKnowledge">{{ controlText('workspace.addBelief') }}</button></template
      ><LongTextField
        v-else
        v-model="model.director"
        :label="controlText('finalField.directorSNotes')"
        :hint="controlText('finalField.notSentToNpcModelsOrIncludedIn')"
      />
      <details>
        <summary>{{ controlText('workspace.relationshipsMarkKnowledgePermissionsSeparately') }}</summary>
        <article v-for="(r, i) in model.relations" :key="i">
          <label>{{ controlText('configurationField.nameUsedForOtherPerson') }}<input v-model="r.target" /></label
          ><label>{{ controlText('configurationField.stableReferenceOptional') }}<input v-model="r.ref" /></label
          ><label>{{ controlText('configurationField.relationshipType') }}<input v-model="r.kind" /></label
          ><label
            >{{ controlText('configurationField.knowledgePermission') }}<select v-model="r.visibility">
              <option value="public">{{ controlText('controls.public') }}</option>
              <option value="self">{{ controlText('workspace.knownToSelf') }}</option>
              <option value="director">{{ controlText('game.gmOnly') }}</option>
            </select></label
          ><LongTextField v-model="r.reason" :label="controlText('finalField.reasonsAndCurrentInterests')" /><LongTextField
            v-model="r.change"
            :label="controlText('finalField.eventsThatCouldChangeRelationships')"
          /><button @click="model.relations.splice(i, 1)">{{ controlText('workspace.deleteRelationship') }}</button>
        </article>
        <button
          @click="
            model.relations.push({
              target: '',
              ref: '',
              kind: '',
              reason: '',
              change: '',
              visibility: 'self',
            })
          "
        >{{ controlText('workspace.addRelationship') }}</button>
      </details>
      <details>
        <summary>{{ controlText('workspace.actualPersonaProjectionExcludingOtherExistingContext') }}</summary>
        <h4>{{ controlText('workspace.publicPath') }}</h4>
        <pre>{{ JSON.stringify(publicPersona(model), null, 2) }}</pre>
        <h4>{{ controlText('workspace.controlledSelfPath') }}</h4>
        <pre>{{ JSON.stringify(selfPersona(model), null, 2) }}</pre>
        <p>{{ controlText('workspace.directorInformationIsNeverProjectedSelfKnowledgeDoes') }}</p>
      </details></template
    >
  </section>
</template>
<style scoped>
.persona-editor {
  grid-column: 1/-1;
  min-width: 0;
}
.persona-editor pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--surface);
  padding: 12px;
  max-height: 360px;
  overflow: auto;
}
.persona-editor article {
  border: 1px solid var(--line);
  padding: 12px;
  margin: 10px 0;
  border-radius: 12px;
}
.persona-editor button {
  min-height: 44px;
}
</style>
