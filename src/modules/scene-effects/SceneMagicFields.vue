<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapRoutePicker from '../map-selection/MapRoutePicker.vue'
import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import { computed, ref, watch } from 'vue'
import type { SceneMagicChoice } from '../../persistence/scene-magic-schema'
import { sceneMagicChoiceSchema, sceneMagicTypes } from '../../persistence/scene-magic-schema'
import type { SceneEffectAction } from '../../persistence/scene-effects-schema'
import type { PublicScene } from '../../online/protocol'
import { STORED_SPELLS } from '../../core/scene-magic-storage'
const model = defineModel<SceneMagicChoice>({ required: true })
const props = defineProps<{
  spellId: string
  scene: PublicScene
  sourceId: string
  gm: boolean
  busy: boolean
  materials: { id: string; name: string; quantity: number }[]
  grants: { key: string; id: string; name: string; modes: string[] }[]
}>()
const emit = defineEmits<{ action: [SceneEffectAction]; validity: [boolean] }>()
const storedOptions = computed(
  () =>
    (
      ({
        'protection-from-energy': ['acid', 'cold', 'fire', 'lightning', 'thunder'],
        'enhance-ability': ['str', 'dex', 'int', 'wis', 'cha'],
        'blindness-deafness': ['blinded', 'deafened'],
        'lesser-restoration': ['blinded', 'deafened', 'paralyzed', 'poisoned'],
      }) as Record<string, string[]>
    )[model.value.stored?.spellId ?? ''] ?? [],
)
const path = ref(''),
  pathError = ref(''),
  value = ref(200),
  chosenMaterial = ref(''),
  chosenStored = ref('')
const costs: Record<
  string,
  { kind: 'gold-dust' | 'jade-dust' | 'diamond-dust' | 'silver-salt'; value: number; name: string }
> = {
  'arcane-lock': { kind: 'gold-dust', value: 25, name: '金粉' },
  'magic-mouth': { kind: 'jade-dust', value: 10, name: '玉石粉' },
  'glyph-of-warding': { kind: 'diamond-dust', value: 200, name: '钻石粉' },
  'magic-circle': { kind: 'silver-salt', value: 100, name: '盐与银粉' },
}
const cost = computed(() => costs[props.spellId]),
  people = computed(() =>
    props.scene.tokens.map((t) => ({
      id: t.characterId ?? t.npcId ?? t.actorId ?? t.id,
      name: t.name,
    })),
  ),
  stored = computed(() =>
    props.grants.filter((g) => (STORED_SPELLS as readonly string[]).includes(g.id)),
  )
watch(
  () => props.spellId,
  () => {
    model.value = sceneMagicChoiceSchema.parse({
      damageType: props.spellId === 'glyph-of-warding' ? 'fire' : 'radiant',
    })
    path.value = ''
    chosenMaterial.value = ''
    chosenStored.value = ''
    value.value = cost.value?.value ?? 200
    emit('validity', true)
  },
  { immediate: true },
)
watch(path, (v) => {
  try {
    const points = v.trim()
      ? v
          .trim()
          .split(/\n|;/)
          .map((line) => {
            const fields = line.split(/[,，\s]+/).map(Number)
            if (fields.length < 2 || fields.length > 3 || fields.some((n) => !Number.isFinite(n)))
              throw Error('每行填写X,Y,高度（尺），至少两个点')
            return { x: fields[0]!, y: fields[1]!, height: fields[2] ?? 0 }
          })
      : []
    model.value.path = points
    pathError.value = ''
    emit('validity', true)
  } catch (e) {
    pathError.value = (e as Error).message
    emit('validity', false)
  }
})
watch(chosenMaterial, (id) => {
  model.value.materialIds = id ? [id] : []
})
watch(chosenStored, (key) => {
  const g = stored.value.find((g) => g.key === key)
  model.value.stored = g ? { key: g.key, spellId: g.id, mode: g.modes[0]! } : undefined
})
function triggerDefault() {
  if (!model.value.trigger)
    model.value.trigger = { kind: 'enter', range: 30, description: '', sense: 'either', types: [] }
}
watch(
  () => props.spellId,
  (id) => {
    if (['alarm', 'magic-mouth', 'glyph-of-warding'].includes(id)) triggerDefault()
  },
  { immediate: true },
)
</script>
<template>
  <fieldset class="magic-fields">
    <legend>{{ controlText('adjudication.actualAreasAndDevices') }}</legend>
    <label v-if="['gust-of-wind', 'wind-wall'].includes(spellId)"
      >{{ controlText('interactionField.windDirectionDegrees') }}<input v-model.number="model.angle" type="number" min="-360" max="360"
    /></label>
    <MapRoutePicker v-if="spellId==='wind-wall'" :points="model.path" :scene-id="scene.id" vertices :disabled="busy" @select="ps=>path=ps.map(p=>`${p.x},${p.y},${p.height}`).join('\n')" />
      <label v-if="spellId === 'wind-wall'"
      >{{ controlText('interactionField.continuousGroundPathXYHeightPerLine') }}<textarea
        v-model="path"
        rows="3"
        placeholder="6,4,0&#10;6,8,0"
      /><small role="alert">{{ pathError }}</small></label
    >
    <label
      v-if="['arcane-lock', 'knock', 'alarm', 'magic-mouth', 'glyph-of-warding'].includes(spellId)"
      >{{ controlText('interactionField.actualDoorContainerAlarmMayUseASeparate') }}<MapFieldPicker kind="point"><select v-model="model.pointId">
        <option :value="undefined">{{ controlText('adjudication.chooseAreaOrigin') }}</option>
        <option
          v-for="p in scene.points.filter((p) => ['door', 'chest'].includes(p.kind))"
          :key="p.id"
          :value="p.id"
        >
          {{ localizedEntryName(p) }}
        </option>
      </select></MapFieldPicker></label
    >
    <label
      v-if="
        [
          'arcane-lock',
          'spirit-guardians',
          'cordon-of-arrows',
          'alarm',
          'glyph-of-warding',
        ].includes(spellId)
      "
      >{{ controlText('interactionField.authorizedExcludedCharacters') }}<select v-model="model.excludedIds" multiple size="3">
        <option v-for="p in people" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
      </select></label
    >
    <template v-if="cost"
      ><label
        >{{ controlText('interactionField.actual') }}{{ localizedEntryName(cost) }}{{ controlText('interactionField.atLeast') }}{{ cost.value }}GP）<select v-model="chosenMaterial">
          <option value="">{{ controlText('adjudication.chooseAnActualInventoryEntry') }}</option>
          <option v-for="m in materials.filter((m) => m.quantity > 0)" :key="m.id" :value="m.id">
            {{ localizedEntryName(m) }} ×{{ m.quantity }}
          </option>
        </select></label
      ><template v-if="gm"
        ><label
          >{{ controlText('interactionField.verifyGpValuePerPortion') }}<input v-model.number="value" type="number" :min="cost.value" /></label
        ><button
          :disabled="busy || !chosenMaterial || value < cost.value"
          @click="
            emit('action', {
              operation: 'material',
              ownerId: sourceId,
              instanceId: chosenMaterial,
              kind: cost.kind,
              valueGP: value,
              note: 'GM核实实际材料种类与每份价值',
            })
          "
        >
          {{ controlText('adjudication.registerMaterialFacts') }}
        </button></template
      ></template
    >
    <label v-if="['arcane-lock', 'glyph-of-warding'].includes(spellId)"
      >{{ controlText('interactionField.privatePassword') }}<input v-model="model.password" autocomplete="off" maxlength="200"
    /></label>
    <label v-if="spellId === 'alarm'"
      >{{ controlText('state.alarm') }}<select v-model="model.alarm">
        <option value="audible">{{ controlText('adjudication.audibleBellWithin60Ft') }}</option>
        <option value="mental">{{ controlText('adjudication.mentalAlarmWithin1Mile') }}</option>
      </select></label
    >
    <template v-if="['magic-mouth', 'glyph-of-warding', 'alarm'].includes(spellId) && model.trigger"
      ><label
        >{{ controlText('interactionField.triggerType') }}<select v-model="model.trigger.kind">
          <option value="enter">{{ controlText('adjudication.enter') }}</option>
          <option value="touch">{{ controlText('adjudication.touch') }}</option>
          <option value="open">{{ controlText('adjudication.open') }}</option>
          <option value="uncover">{{ controlText('adjudication.uncover') }}</option>
          <option value="speak">{{ controlText('adjudication.speakSpecifiedWords') }}</option>
          <option value="gm">{{ controlText('adjudication.gmConfirmsComplexConditions') }}</option>
        </select></label
      ><label
        >{{ controlText('interactionField.triggerDescriptionGmPrivate') }}<input v-model="model.trigger.description" maxlength="2000" /></label
      ><label
        >{{ controlText('interactionField.perceptionBasis') }}<select v-model="model.trigger.sense">
          <option value="sight">{{ controlText('adjudication.visible') }}</option>
          <option value="sound">{{ controlText('adjudication.audible') }}</option>
          <option value="either">{{ controlText('adjudication.either') }}</option>
        </select></label
      ><label v-if="model.trigger.kind === 'speak'"
        >{{ controlText('interactionField.matchingWords') }}<input v-model="model.trigger.phrase" maxlength="200" /></label
    ></template>
    <template v-if="spellId === 'magic-mouth'"
      ><label
        >{{ controlText('interactionField.originalTextNoAutomaticTruncation') }}<textarea v-model="model.message" maxlength="2000" rows="3" /></label
      ><label
        ><input
          v-model="model.wordCountConfirmed"
          type="checkbox"
        />{{ controlText('interactionField.gmVerifiesOriginalTextWithinWordsRulesLimit') }}</label
      ><label><input v-model="model.repeat" type="checkbox" />{{ controlText('interactionField.repeatTrigger') }}</label></template
    >
    <template v-if="spellId === 'glyph-of-warding'"
      ><label
        >{{ controlText('interactionField.glyph') }}<select v-model="model.glyph">
          <option value="explosive">{{ controlText('adjudication.explosiveRunes') }}</option>
          <option value="spell">{{ controlText('adjudication.spellStoragePayActualAdditionalCasting') }}</option>
        </select></label
      ><label v-if="model.glyph === 'explosive'"
        >{{ controlText('controls.damage') }}<select v-model="model.damageType">
          <option v-for="type in ['acid', 'cold', 'fire', 'lightning', 'thunder']" :key="type">
            {{ type }}
          </option>
        </select></label
      ><template v-else
        ><label
          >{{ controlText('interactionField.storedActualSource') }}<select v-model="chosenStored">
            <option value="">{{ controlText('adjudication.chooseASupportedSpell') }}</option>
            <option v-for="g in stored" :key="g.key" :value="g.key">{{ localizedEntryName(g) }}</option>
          </select></label
        ><label v-if="model.stored"
          >{{ controlText('interactionField.storedCastingMethod') }}<select v-model="model.stored.mode">
            <option v-for="m in stored.find((g) => g.key === chosenStored)?.modes ?? []" :key="m">
              {{ m }}
            </option>
          </select></label
        ><label v-if="model.stored && storedOptions.length"
          >{{ controlText('interactionField.actualSpellOptions') }}<MapFieldPicker kind="surface"><select v-model="model.stored.supportChoice">
            <option :value="undefined">{{ controlText('adjudication.requiredSelection') }}</option>
            <option v-for="choice in storedOptions" :key="choice">{{ choice }}</option>
          </select></MapFieldPicker></label
        ><label v-if="model.stored"
          ><input
            v-model="model.stored.willing"
            type="checkbox"
          />{{ controlText('interactionField.gmStillConfirmsWillingRecipientsAtTriggerTime') }}</label
        ><label
          >{{ controlText('interactionField.storedAreaDirectionDegrees') }}<input
            v-model.number="model.angle"
            type="number"
            min="-360"
            max="360" /></label
        ><small>{{ controlText('adjudication.unsupportedComplexOrSummoningSpellsAreRejectedBefore') }}</small></template
      ></template
    >
    <template v-if="spellId === 'magic-circle'"
      ><label
        >{{ controlText('interactionField.detectionType') }}<select v-model="model.types" multiple size="5">
          <option v-for="type in sceneMagicTypes" :key="type">{{ type }}</option>
        </select></label
      ><label><input v-model="model.reverse" type="checkbox" />{{ controlText('interactionField.reversedRestrictLeaving') }}</label></template
    >
    <label v-if="spellId === 'tiny-hut'"
      >{{ controlText('interactionField.interiorLighting') }}<select v-model="model.hutLight">
        <option value="dim">{{ controlText('domain.dimLight') }}</option>
        <option value="dark">{{ controlText('domain.darkness') }}</option>
      </select></label
    >
    <template v-if="spellId === 'call-lightning'"
      ><button
        v-if="gm"
        :disabled="busy"
        @click="
          emit('action', {
            operation: 'weather',
            sceneId: scene.id,
            storm: model.storm,
            note: 'GM核实现有室外风暴事实',
          })
        "
      >
        {{ controlText('adjudication.verifySelectedStormFacts') }}</button
      ><label><input v-model="model.storm" type="checkbox" />{{ controlText('interactionField.gmVerifiesAnExistingOutdoorStormExtraD') }}</label
      ><button @click="model.strike ??= { x: 0, y: 0, height: 0 }">{{ controlText('adjudication.setFirstLightningStrike') }}</button
      ><template v-if="model.strike"
        ><label v-for="axis in ['x', 'y', 'height'] as const" :key="axis"
          >{{ controlText('interactionField.lightningStrike') }}{{ axis
          }}<input v-model.number="model.strike[axis]" type="number" /></label></template
    ></template>
    <template v-if="spellId === 'cordon-of-arrows'"
      ><p>{{ controlText('adjudication.chooseActualArrowsOrBoltsIndividuallySixAt') }}</p>
      <label v-for="(_, i) in model.ammunitionIds" :key="i"
        >{{ controlText('interactionField.ammunition') }}{{ i + 1
        }}<select v-model="model.ammunitionIds[i]">
          <option value="">{{ controlText('domain.stock') }}</option>
          <option v-for="m in materials.filter((m) => m.quantity > 0)" :key="m.id" :value="m.id">
            {{ localizedEntryName(m) }}
          </option>
        </select></label
      ><button :disabled="model.ammunitionIds.length >= 6" @click="model.ammunitionIds.push('')">
        {{ controlText('adjudication.addOneArrowBolt') }}</button
      ><button :disabled="!model.ammunitionIds.length" @click="model.ammunitionIds.pop()">
        {{ controlText('adjudication.removeLastArrowBolt') }}
      </button></template
    >
  </fieldset>
</template>
<style scoped>
.magic-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border: 1px solid var(--line);
  padding: 10px;
  border-radius: 8px;
}
.magic-fields label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 150px;
  min-width: 0;
}
.magic-fields input,
.magic-fields select,
.magic-fields textarea {
  min-width: 0;
  max-width: 100%;
}
.magic-fields p,
.magic-fields small {
  flex-basis: 100%;
}
</style>
