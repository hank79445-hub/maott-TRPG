<script setup lang="ts">
import type { OpeningPresentation } from '../../persistence/opening-reading-schema'
import { openingText } from './opening-labels'
const model = defineModel<OpeningPresentation>({ required: true })
defineProps<{ characters: { id: string; name: string }[]; disabled?: boolean }>()
function setIdentity(id: string, text: string) {
  model.value = {
    ...model.value,
    identities: [
      ...model.value.identities.filter((i) => i.characterId !== id),
      ...(text.trim() ? [{ characterId: id, text }] : []),
    ],
  }
}
</script>
<template>
  <fieldset class="opening-editor" :disabled="disabled">
    <label
      >{{ openingText('opening')
      }}<textarea
        :value="model.opening"
        @input="model = { ...model, opening: ($event.target as HTMLTextAreaElement).value }"
        rows="4"
        maxlength="12000"
      />
    </label>
    <label
      >{{ openingText('background')
      }}<textarea
        :value="model.background"
        @input="model = { ...model, background: ($event.target as HTMLTextAreaElement).value }"
        rows="4"
        maxlength="12000"
      />
    </label>
    <details>
      <summary>{{ openingText('identity') }}</summary>
      <label v-for="character in characters" :key="character.id"
        >{{ character.name
        }}<textarea
          :value="model.identities.find((i) => i.characterId === character.id)?.text ?? ''"
          rows="3"
          maxlength="12000"
          @input="setIdentity(character.id, ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </details>
    <label
      >{{ openingText('origin')
      }}<textarea
        :value="model.origin"
        @input="model = { ...model, origin: ($event.target as HTMLTextAreaElement).value }"
        rows="4"
        maxlength="12000"
      />
    </label>
  </fieldset>
</template>
<style scoped>
.opening-editor {
  border: 0;
  padding: 0;
  min-width: 0;
  display: grid;
  gap: 10px;
}
.opening-editor label {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.opening-editor textarea {
  max-width: 100%;
  min-width: 0;
}
.opening-editor details label {
  margin-top: 8px;
}
</style>
