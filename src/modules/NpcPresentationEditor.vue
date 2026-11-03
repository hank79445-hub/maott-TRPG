<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import { computed } from 'vue'
import type { Build } from '../core/types'
type Presentation = NonNullable<Build['npcPresentation']>
const model = defineModel<Presentation | undefined>()
const value = computed(
  () => model.value ?? { publicClass: false, publicSpecies: false, apparentSpecies: '' },
)
function update(key: keyof Presentation, input: string | boolean) {
  model.value = { ...value.value, [key]: input }
}
</script>
<template>
  <details>
    <summary>{{ controlText('workspace.characterInformationPerceptibleToNpcs') }}</summary>
    <p>{{ controlText('workspace.visibleNpcsInTheSameSceneMayReference') }}</p>
    <label class="check"
      ><input
        type="checkbox"
        :checked="value.publicClass"
        @change="update('publicClass', ($event.target as HTMLInputElement).checked)"
      />{{ controlText('configurationField.discloseClassTitleToNpcs') }}</label
    >
    <label class="check"
      ><input
        type="checkbox"
        :checked="value.publicSpecies"
        @change="update('publicSpecies', ($event.target as HTMLInputElement).checked)"
      />{{ controlText('configurationField.useSelectedSpeciesNameAsVisibleAppearanceCue') }}</label
    >
    <label
      >{{ controlText('configurationField.apparentSpeciesCueOptionalOverridesAbove') }}<input
        :value="value.apparentSpecies"
        maxlength="200"
        :placeholder="controlText('configurationField.forExampleHoodedAndAppearsHumanDoNot')"
        @input="update('apparentSpecies', ($event.target as HTMLInputElement).value)"
    /></label>
    <p>{{ controlText('workspace.thisIsAppearanceAndSelfIntroductionItNeither') }}</p>
  </details>
</template>
<style scoped>
details {
  margin: 8px 0;
}
label {
  display: block;
  margin: 8px 0;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
}
p {
  font-size: 0.85rem;
}
</style>
