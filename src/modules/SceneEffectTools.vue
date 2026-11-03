<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import M5CastFields from './scene-effects/M5CastFields.vue'
import M5Operations from './scene-effects/M5Operations.vue'
import M5ReviewCard from './scene-effects/M5ReviewCard.vue'
import {M5_WORLD_SPELLS,M5_OBJECT_SPELLS,isM5WorldSpell,isM5ObjectSpell} from '../core/m5-spell-rules'
import {m5ChoiceSchema} from '../persistence/scene-m5-schema'
import SceneSupplyFields from './scene-effects/SceneSupplyFields.vue'
import SceneSupplyInventory from './scene-effects/SceneSupplyInventory.vue'
import {isSupplySpell} from '../core/scene-supplies'
import {supplyCastSchema} from '../persistence/scene-supply-schema'
import SceneMagicFields from './scene-effects/SceneMagicFields.vue'
import SceneMagicOperations from './scene-effects/SceneMagicOperations.vue'
import {sceneMagicChoiceSchema} from '../persistence/scene-magic-schema'
import {MAGIC_RULES,isMagicSceneSpell} from '../core/scene-magic-rules'
import SceneTerrainFields from './scene-effects/SceneTerrainFields.vue'
import SceneTerrainOperations from './scene-effects/SceneTerrainOperations.vue'
import SceneTerrainReviewCard from './scene-effects/SceneTerrainReviewCard.vue'
import { terrainGeometry } from '../core/scene-terrain'
import { TERRAIN_RULES } from '../core/scene-terrain-rules'
import { isTerrainSpell } from '../core/scene-terrain-rules'
import { computed, ref, watch, nextTick } from 'vue'
import type { RoomAction, RoomCommand, RoomView } from '../online/protocol'
import type { Catalogue } from '../core/engine'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { m1Entity } from '../core/m1-utility'
import { runtimeSpells } from '../core/runtime'
import { M4_SCENE_SPELLS } from '../core/scene-effects'
import type { SceneEffectAction, SceneEffectCast } from '../persistence/scene-effects-schema'
import M3DestinationPreview from './m3/M3DestinationPreview.vue'
import SceneEffectPointPicker from './SceneEffectPointPicker.vue'
const props = defineProps<{
  view: RoomView
  busy: boolean
  content?: Catalogue
  characterId?: string
}>()
const emit = defineEmits<{ command: [RoomCommand]; request: [RoomAction, boolean, string] }>()
const panel = ref<HTMLDetailsElement | null>(null)
async function focusSpell(spellKey: string) {
  operation.value = 'cast'
  await nextTick()
  key.value = spellKey
  if (panel.value) {
    panel.value.open = true
    await nextTick()
    panel.value.scrollIntoView({ block: 'center' })
    panel.value.querySelector('select')?.focus()
  }
}
defineExpose({ focusSpell })
const gm = computed(() => props.view.self.role === 'gm'),
  world = computed(() => props.view.world),
  adventure = computed(() => world.value?.adventures[0]),
  cat = computed(() => props.content ?? catalogue([srd, ...(world.value?.packs ?? [])]))
const source = ref(''),
  key = ref(''),
  mode = ref(''),
  objectId = ref(''),
  inventoryId = ref(''),
  materialId = ref(''),
  effectId = ref(''),
  operation = ref<'cast' | 'move-lights' | 'dispel' | 'throw-flame'>('cast'),
  targetId = ref(''),
  combined = ref(false),
  color = ref('#f3ce6b'),
  note = ref('已核实实际位置、成分及反应时机'),
  materialValue = ref(50),
  legacySize = ref(20),
  legacyHeight = ref(0),
  fixtureObject = ref(''),
  fixtureBright = ref(20),
  fixtureFlame = ref(false),
  fixtureProtected=ref(false),objectCombustible=ref(false),
  fixtureDim = ref(20),
  objectAC = ref(10),
  objectHP = ref(10),
  objectFire = ref<'normal' | 'resistant' | 'immune' | 'vulnerable'>('normal'),
  legacyShape = ref<'sphere' | 'cylinder' | 'emanation' | 'cube'>('sphere')
const terrainFacts = ref<NonNullable<SceneEffectCast['terrain']>>({
  plantIds: [],
  supportIds: [],
  excludedCells: [],
  enrichment: false,
  webSupport: 'unsupported',
})
const supplyFacts=ref(supplyCastSchema.parse({branch:'create-water'}))
const m5Facts=ref(m5ChoiceSchema.parse({}))
const subtle=ref(false)
const magicFacts=ref(sceneMagicChoiceSchema.parse({})),magicInvalid=ref(false)
const terrainInvalid = ref(false)
const pendingTerrain = computed(() =>
  (adventure.value?.sceneEffects?.hazards ?? []).filter((h) => h.status === 'pending'),
)
const points = ref([{ x: 0, y: 0, height: 0 }])
const people = computed(() =>
  gm.value
    ? (props.view.scene?.tokens ?? []).flatMap((t) => {
        const entity =
          world.value &&
          adventure.value &&
          m1Entity(world.value, adventure.value, t.characterId ?? t.npcId ?? t.actorId ?? t.id)
        return entity
          ? [{ id: entity.id, name: t.name, token: t, c: entity.c, n: entity.n, body: entity.body }]
          : []
      })
    : (props.view.ownCharacters ?? [])
        .filter((c) => !props.characterId || c.id === props.characterId)
        .flatMap((c) => {
          const token = props.view.scene?.tokens.find((t) => t.characterId === c.id)
          return token
            ? [{ id: c.id, name: c.build.name, token, c, n: undefined, body: undefined }]
            : []
        }),
)
watch(
  people,
  (rows) => {
    if (!rows.some((p) => p.id === source.value)) source.value = rows[0]?.id ?? ''
  },
  { immediate: true },
)
const caster = computed(() => people.value.find((p) => p.id === source.value))
const grants = computed(() => {
  const p = caster.value,
    ids = operation.value === 'dispel' ? ['dispel-magic'] : [...M4_SCENE_SPELLS,...M5_WORLD_SPELLS,...M5_OBJECT_SPELLS]
  return p?.c
    ? runtimeSpells(p.c, cat.value)
        .filter((g) => ids.includes(g.spell.id))
        .map((g) => ({ key: g.key, name: g.spell.name, id: g.spell.id, modes: g.modes }))
    : (p?.body?.abilities
        ?.filter((b) => b.spellId && ids.includes(b.spellId))
        .map((b) => ({ key: b.id, name: b.name, id: b.spellId!, modes: ['npc'] })) ?? [])
})
const grant = computed(() => grants.value.find((g) => g.key === key.value))
watch(
  grants,
  (g) => {
    if (!g.some((g) => g.key === key.value)) key.value = g[0]?.key ?? ''
  },
  { immediate: true },
)
watch(
  () => source.value + ':' + key.value,
  () => {
    mode.value = grant.value?.modes[0] ?? ''
    combined.value = grant.value?.id === 'dancing-lights'
    objectId.value = ''
    inventoryId.value = ''
    points.value = [
      {
        x: caster.value?.token.x ?? 0,
        y: caster.value?.token.y ?? 0,
        height: caster.value?.token.spatial?.height ?? 0,
      },
    ]
  },
  { immediate: true },
)
const objects = computed(() => props.view.scene?.spatialObjects ?? []),
  effects = computed(() => props.view.scene?.sceneEffects?.regions ?? []),
  effect = computed(() => effects.value.find((e) => e.id === effectId.value))
watch(
  effects,
  (rows) => {
    if (!rows.some((e) => e.id === effectId.value)) effectId.value = rows[0]?.id ?? ''
  },
  { immediate: true },
)
const storageGrants=computed(()=>caster.value?.c?runtimeSpells(caster.value.c,cat.value).map(g=>({key:g.key,id:g.spell.id,name:g.spell.name,modes:g.modes})):(caster.value?.body?.abilities??[]).filter(b=>b.spellId).map(b=>({key:b.id,id:b.spellId!,name:b.name,modes:['npc']})))
function magicPreviewAt(p:{x:number;y:number;height:number}){const r=MAGIC_RULES[grant.value?.id??''];if(!r||r.shape==='wall'&&magicFacts.value.path.length<2)return undefined;return {...p,shape:r.shape,size:r.size,heightFeet:r.height,width:r.shape==='wall'?1:10,angle:magicFacts.value.angle,originSpan:1,...(r.shape==='wall'?{points:magicFacts.value.path}:{})}}
const magicPreview=computed(()=>points.value[0]?magicPreviewAt(points.value[0]):undefined)
const hasPoints = computed(
  () =>
    !(isM5WorldSpell(grant.value?.id??'')&&grant.value?.id!=='spiritual-weapon'||isM5ObjectSpell(grant.value?.id??'')) && !objectId.value &&
    !inventoryId.value &&
    (!['produce-flame', 'light', 'continual-flame','gust-of-wind','spirit-guardians','tiny-hut'].includes(grant.value?.id ?? '') ||
      operation.value === 'move-lights'),
)
const materials = computed(
  () =>
    caster.value?.c?.inventory.map((i) => ({
      id: i.instanceId,
      name: cat.value.items.find((x) => x.id === i.itemId)?.name ?? i.itemId,
      quantity: i.quantity,
    })) ??
    caster.value?.n?.consumables?.map((i) => ({
      id: i.id,
      name: i.itemId,
      quantity: i.quantity - (caster.value?.n?.consumablesUsed?.[i.id] ?? 0),
    })) ??
    [],
)
function send(action: SceneEffectAction) {
  if (gm.value) emit('command', { kind: 'scene-effect', action })
  else emit('request', { kind: 'scene-effect', action }, true, action.note)
}
function submit() {
  if (operation.value === 'dispel')
    send({
      operation: 'dispel',
      casterId: source.value,
      key: key.value,
      mode: mode.value,
      effectId: effectId.value,
      to: points.value[0],
      confirmed: true,
      note: note.value,
    })
  else if (operation.value === 'move-lights')
    send({
      operation: 'move-lights',
      actorId: source.value,
      effectId: effectId.value,
      points: points.value,
      combined: combined.value,
      note: note.value,
    })
  else if (operation.value === 'throw-flame')
    send({
      operation: 'throw-flame',
      casterId: source.value,
      effectId: effectId.value,
      targetId: targetId.value,
      confirmed: true,
      note: note.value,
    })
  else
    send({
      operation: 'cast',
      casterId: source.value,
      key: key.value,
      mode: mode.value,
      objectId: objectId.value || undefined,
      inventoryInstanceId: inventoryId.value || undefined,
      materialId: materialId.value || undefined,
      points: hasPoints.value ? points.value : [],
      combined: combined.value,
      color: color.value,
      subtle:subtle.value||undefined,
      m5:isM5WorldSpell(grant.value?.id??'')||isM5ObjectSpell(grant.value?.id??'')?m5Facts.value:undefined,
      supply:isSupplySpell(grant.value?.id??'')?supplyFacts.value:undefined,
      magic:isMagicSceneSpell(grant.value?.id??'')?magicFacts.value:undefined,
      terrain: isTerrainSpell(grant.value?.id ?? '') ? terrainFacts.value : undefined,
      confirmed: true,
      note: note.value,
    })
}
</script>
<template>
  <details v-if="view.scene" ref="panel" class="scene-effect-tools">
    <summary>
      {{ controlText('spatial.effectTools') }} <span v-if="effects.length">{{ effects.length }}</span>
    </summary>
    <div class="effect-form-grid">
      <label
        >{{ controlText('game.operation') }}<select v-model="operation">
          <option value="cast">{{ controlText('spatial.cast') }}</option>
          <option value="move-lights">{{ controlText('spatial.dancingLights') }}</option>
          <option value="throw-flame">{{ controlText('spatial.produceFlame') }}</option>
          <option value="dispel">{{ controlText('spatial.removeArea') }}</option>
        </select></label
      ><label
        >{{ controlText('spatial.actingCharacter') }}<MapFieldPicker kind="entity"><select v-model="source">
          <option v-for="p in people" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
        </select></MapFieldPicker></label
      >
      <template v-if="operation === 'cast' || operation === 'dispel'"
        ><label
          >{{ controlText('domain.actualSpellSource') }}<select v-model="key">
            <option v-for="g in grants" :key="g.key" :value="g.key">{{ localizedEntryName(g) }}</option>
          </select></label
        ><label
          >{{ controlText('domain.castingMode') }}<select v-model="mode">
            <option v-for="m in grant?.modes ?? []" :key="m">{{ m }}</option>
          </select></label
        ></template
      >
      <template v-if="operation === 'cast'"
        ><label
          v-if="['heat-metal','fire-bolt','starry-wisp','light', 'continual-flame', 'daylight', 'darkness','magic-mouth','glyph-of-warding'].includes(grant?.id ?? '')"
          >{{ controlText('game.actualObject') }}<MapFieldPicker kind="surface"><select v-model="objectId" @change="inventoryId = ''">
            <option value="">{{ controlText('spatial.noAnchor') }}</option>
            <option v-for="o in objects" :key="o.id" :value="o.id">{{ localizedEntryName(o) }}</option>
          </select></MapFieldPicker></label
        ><label v-if="['light', 'continual-flame'].includes(grant?.id ?? '') && caster?.c"
          >{{ controlText('spatial.inventoryAnchor') }}<select v-model="inventoryId" @change="objectId = ''">
            <option value="">{{ controlText('spatial.chooseEntry') }}</option>
            <option v-for="i in caster.c.inventory" :key="i.instanceId" :value="i.instanceId">
              {{ localizedEntryName(cat.items.find((x) => x.id === i.itemId)) ?? i.itemId }} ×{{ i.quantity }}
            </option>
          </select></label
        ><label
          v-if="
            !isMagicSceneSpell(grant?.id??'') && !isTerrainSpell(grant?.id ?? '') && !['darkness', 'fog-cloud'].includes(grant?.id ?? '')
          "
          >{{ controlText('spatial.lightColor') }}<input v-model="color" type="color" /></label
      ></template>
      <label v-if="operation !== 'cast'"
        >{{ controlText('spatial.activeAreas') }}<MapFieldPicker kind="region"><select v-model="effectId">
          <option v-for="e in effects" :key="e.id" :value="e.id">
            {{ localizedEntryName(e) }} {{ e.sourceId === source ? controlText('expressionFour.self') : '' }}
            {{ e.covered ? controlText('expressionFour.coveredAlias31') : '' }}
          </option>
        </select></MapFieldPicker></label
      ><label v-if="operation === 'throw-flame'"
        >{{ controlText('game.actualTarget') }}<MapFieldPicker kind="entity"><select v-model="targetId">
          <option
            v-for="t in view.scene.tokens.filter(
              (t) => t.characterId !== source && t.npcId !== source,
            )"
            :key="t.id"
            :value="t.characterId ?? t.npcId ?? t.actorId ?? t.id"
          >
            {{ localizedEntryName(t) }}
          </option>
          <option v-for="o in objects" :key="o.id" :value="o.id">{{ controlText('spatial.objectPrefix') }} {{ localizedEntryName(o) }}</option>
        </select></MapFieldPicker></label
      >
    </div>
    <label v-if="operation==='cast'&&caster?.c?.build.choices.metamagic?.includes('subtle')"><input v-model="subtle" type="checkbox">{{ controlText('spatial.subtleSpell') }}</label>
    <M5CastFields v-if="operation==='cast'&&isM5WorldSpell(grant?.id??'')" v-model="m5Facts" :spell-id="grant?.id??''" :view="view" :source-id="source"/>
    <M5Operations :view="view" :busy="busy" :content="cat" :actor-id="source" @action="send"/>
    <M5ReviewCard v-if="gm" :view="view" :busy="busy" @command="emit('command',$event)"/>
    <SceneSupplyFields v-if="operation==='cast'&&isSupplySpell(grant?.id??'')" v-model="supplyFacts" :spell-id="grant?.id??''" :view="view" />
    <SceneSupplyInventory :view="view" :busy="busy" :actor-id="source" @action="send"/>
    <SceneMagicFields v-if="operation==='cast'&&isMagicSceneSpell(grant?.id??'')" v-model="magicFacts" :spell-id="grant?.id??''" :scene="view.scene" :source-id="source" :gm="gm" :busy="busy" :materials="materials" :grants="storageGrants" @action="send" @validity="magicInvalid=!$event"/>
    <SceneMagicOperations :view="view" :busy="busy" :actor-id="source" :point="points[0]!" @action="send"/>
    <SceneTerrainFields
      v-if="operation === 'cast' && isTerrainSpell(grant?.id ?? '')"
      v-model="terrainFacts"
      :spell-id="grant?.id ?? ''"
      :objects="objects"
      @validity="terrainInvalid = !$event"
    />
    <details
      v-if="gm && view.encounter?.phase !== 'active' && view.exploration?.status !== 'active'"
    >
      <summary>{{ controlText('spatial.environmentTiming') }}</summary>
      <p class="muted">
        {{ controlText('spatial.environmentHint') }}
      </p>
      <button
        :disabled="busy"
        @click="
          send({ operation: 'environment-round', phase: 'start', note: 'GM明确当前环境回合开始' })
        "
      >
        {{ controlText('spatial.checkRoundStart') }}</button
      ><button
        :disabled="busy"
        @click="
          send({
            operation: 'environment-round',
            phase: 'end',
            note: 'GM明确结束环境回合并推进6秒',
          })
        "
      >
        {{ controlText('spatial.endEnvironmentRound') }}
      </button>
    </details>
    <SceneTerrainOperations
      :view="view"
      :busy="busy"
      :actor-id="source"
      :point="points[0]!"
      @action="send"
    />
    <details v-if="gm && pendingTerrain.length" open>
      <summary>{{ controlText('review.areaConsequences') }} {{ pendingTerrain.length }}</summary>
      <SceneTerrainReviewCard
        v-for="event in pendingTerrain"
        :key="event.id"
        :event="event"
        :view="view"
        :busy="busy"
        @command="emit('command', $event)"
      />
    </details>
    <template
      v-if="
        (hasPoints && operation === 'cast') || operation === 'move-lights' || operation === 'dispel'
      "
      ><label v-if="grant?.id === 'dancing-lights' || operation === 'move-lights'"
        ><input
          v-model="combined"
          type="checkbox"
          @change="combined && (points = points.slice(0, 1))"
        />
        {{ controlText('spatial.combineLights') }}</label
      >
      <div v-for="(p, i) in points" :key="i" class="effect-form-grid">
        <label
          >{{ controlText('spatial.lightOrigin') }} {{ i + 1 }} {{ controlText('game.x') }}<input
            v-model.number="p.x"
            type="number"
            min="0"
            :max="view.scene.grid.columns - 1" /></label
        ><label
          >{{ controlText('game.y') }}<input
            v-model.number="p.y"
            type="number"
            min="0"
            :max="view.scene.grid.rows - 1" /></label
        ><label>{{ controlText('game.actualHeight') }}<input v-model.number="p.height" type="number" /></label
        ><button v-if="points.length > 1" @click="points.splice(i, 1)">{{ controlText('spatial.removeLight') }}</button>
      </div>
      <button
        v-if="
          (grant?.id === 'dancing-lights' || operation === 'move-lights') &&
          !combined &&
          points.length < 4
        "
        @click="points.push({ ...points[0]! })"
      >
        {{ controlText('spatial.addLight') }}</button
      ><SceneEffectPointPicker :disabled="busy" :preview-at="(_,p)=>operation==='cast'&&isTerrainSpell(grant?.id??'')?terrainGeometry(grant!.id,p,terrainFacts.webSupport==='surface'):magicPreviewAt(p)"
        :preview="
          operation === 'cast' && isTerrainSpell(grant?.id ?? '')
            ? terrainGeometry(grant!.id, points[0]!, terrainFacts.webSupport === 'surface')
            : magicPreview
        "
        :color="MAGIC_RULES[grant?.id??'']?.color??TERRAIN_RULES[grant?.id ?? '']?.color"
        :scene="view.scene"
        :points="points"
        @select="(i, p) => (points[i] = p)" />
      <M3DestinationPreview :scene-id="view.scene?.id" :disabled="busy" @select="p=>points[0]=p"
        v-if="caster && points[0]"
        :from="caster.token"
        :to="points[0]"
        :feet="view.scene.grid.feet"
        :columns="view.scene.grid.columns"
        :rows="view.scene.grid.rows"
        :walls="view.scene.walls"
    /></template>
    <template v-if="grant?.id === 'continual-flame' && operation === 'cast'"
      ><label
        >{{ controlText('spatial.rubyDust') }}<select v-model="materialId">
          <option value="">{{ controlText('spatial.rubyValueHint') }}</option>
          <option v-for="m in materials.filter((m) => m.quantity > 0)" :key="m.id" :value="m.id">
            {{ localizedEntryName(m) }} ×{{ m.quantity }}
          </option>
        </select></label
      >
      <div v-if="gm" class="effect-form-grid">
        <label
          >{{ controlText('spatial.verifiedValue') }}<input v-model.number="materialValue" type="number" min="50" /></label
        ><button
          :disabled="busy || !materialId"
          @click="
            send({
              operation: 'material',
              ownerId: source,
              instanceId: materialId,
              kind: 'ruby-dust',
              valueGP: materialValue,
              note: 'GM核实实际红宝石尘种类、每份价值与数量',
            })
          "
        >
          {{ controlText('spatial.verifyMaterial') }}
        </button>
      </div></template
    >
    <label>{{ controlText('controls.description') }}<input v-model="note" maxlength="2000" /></label
    ><button
      :disabled="
        busy ||
        !source ||
        !note.trim() ||
        (operation === 'cast' && (isTerrainSpell(grant?.id ?? '') && terrainInvalid||isMagicSceneSpell(grant?.id??'')&&magicInvalid)) ||
        (['cast', 'dispel'].includes(operation) && !grant) ||
        (operation !== 'cast' && !effect)
      "
      @click="submit"
    >
      {{ gm ? controlText('expressionFour.confirmActualOperation') : controlText('expressionFour.requestGmConfirmation') }}
    </button>
    <p class="muted">
      {{
        operation === 'throw-flame'
          ? controlText('expressionFour.creatingTheFlameRequiresASeparateMagicAction')
          : controlText('expressionFour.resourcesAreSpentOnlyOnActualCastingCombat')
      }}
    </p>
    <details v-if="gm">
      <summary>{{ controlText('spatial.objectLight') }}</summary>
      <label
        >{{ controlText('spatial.registeredObject') }}<select v-model="fixtureObject">
          <option value="">{{ controlText('spatial.chooseRegistered') }}</option>
          <option v-for="o in objects" :key="o.id" :value="o.id">{{ localizedEntryName(o) }}</option>
        </select></label
      >
      <div class="effect-form-grid">
        <label
          >{{ controlText('spatial.brightRadius') }}<input
            v-model.number="fixtureBright"
            type="number"
            min="0"
            max="2000" /></label
        ><label
          >{{ controlText('spatial.dimRadius') }}<input v-model.number="fixtureDim" type="number" min="0" max="2000"
        /></label>
      </div>
      <label><input v-model="fixtureFlame" type="checkbox" /> {{ controlText('spatial.rainExtinguishes') }}</label>
      <label><input v-model="fixtureProtected" type="checkbox">{{ controlText('spatial.protectedFlame') }}</label>
      <button
        :disabled="busy || !fixtureObject"
        @click="
          send({
            operation: 'fixture-light',
            objectId: fixtureObject,
            bright: fixtureBright,
            flame: fixtureFlame,protected:fixtureProtected,
            dimExtra: fixtureDim,
            color,
            note: 'GM核实实际非魔法灯／火把及照明范围',
          })
        "
      >
        {{ controlText('spatial.registerLight') }}
      </button>
      <div class="effect-form-grid">
        <label>{{ controlText('spatial.objectAc') }}<input v-model.number="objectAC" type="number" min="0" max="40" /></label
        ><label
          >{{ controlText('spatial.objectHp') }}<input
            v-model.number="objectHP"
            type="number"
            min="1"
            max="100000" /></label
        ><label
          >{{ controlText('spatial.fireResistance') }}<select v-model="objectFire">
            <option value="normal">{{ controlText('spatial.normal') }}</option>
            <option value="resistant">{{ controlText('controls.resistance') }}</option>
            <option value="immune">{{ controlText('controls.immunity') }}</option>
            <option value="vulnerable">{{ controlText('spatial.vulnerable') }}</option>
          </select></label
        >
      </div>
      <label><input v-model="objectCombustible" type="checkbox">{{ controlText('spatial.flammable') }}</label>
      <button
        :disabled="busy || !fixtureObject"
        @click="
          send({
            operation: 'object-durability',combustible:objectCombustible,
            objectId: fixtureObject,
            ac: objectAC,
            hp: objectHP,
            maxHp: objectHP,
            fire: objectFire,
            note: 'GM核实实际物件材质、尺寸与AC／HP，不从图片推测',
          })
        "
      >
        {{ controlText('spatial.verifyDurability') }}
      </button>
      <p class="muted">{{ controlText('spatial.durabilityHint') }}</p>
    </details>
    <ul class="effect-list">
      <li v-for="e in effects" :key="e.id">
        <strong>{{ localizedEntryName(e) }}</strong> ·
        {{ e.covered ? controlText('expressionFour.fullyCovered') : e.requiresGeometry ? controlText('expressionFour.waitingForGmGeometryRegistration') : controlText('expressionTwo.active')
        }}<template v-if="e.sourceId === source || gm"
          ><button
            v-if="e.concentration && e.sourceId === source"
            :disabled="busy"
            @click="
              send({
                operation: 'end',
                actorId: source,
                effectId: e.id,
                note: '来源主动结束本人专注',
              })
            "
          >
            {{ controlText('spatial.endConcentration') }}
          </button></template
        ><button
          v-if="e.coverable"
          :disabled="busy"
          @click="
            send({
              operation: 'cover',
              actorId: source,
              effectId: e.id,
              covered: !e.covered,
              note: '用实际不透明物完全遮盖／移开遮盖',
            })
          "
        >
          {{ e.covered ? controlText('expressionFour.removeCovering') : controlText('expressionFour.coveringAnchor') }}</button
        ><button
          v-if="gm && ['fog-cloud', 'stinking-cloud'].includes(e.spellId)"
          :disabled="busy"
          @click="
            send({
              operation: 'disperse',
              effectId: e.id,
              reason: 'strong-wind',
              note: 'GM已核实强风吹散此雾云',
            })
          "
        >
          {{ controlText('spatial.windDispersal') }}
        </button>
        <details v-if="gm && e.requiresGeometry">
          <summary>{{ controlText('spatial.registerExisting') }}</summary>
          <label
            >{{ controlText('spatial.geometry') }}<select v-model="legacyShape">
              <option value="sphere">{{ controlText('spatial.sphere') }}</option>
              <option value="cylinder">{{ controlText('spatial.cylinder') }}</option>
              <option value="cube">{{ controlText('spatial.cube') }}</option>
              <option value="emanation">{{ controlText('spatial.aura') }}</option>
            </select></label
          ><label>{{ controlText('spatial.radiusSide') }}<input v-model.number="legacySize" type="number" min="1" /></label
          ><label
            >{{ controlText('spatial.height') }}<input v-model.number="legacyHeight" type="number" min="0" /></label
          ><button
            :disabled="busy"
            @click="
              send({
                operation: 'legacy-geometry',
                effectId: e.id,
                geometry: {
                  shape: legacyShape,
                  x: points[0]!.x,
                  y: points[0]!.y,
                  height: points[0]!.height,
                  size: legacySize,
                  heightFeet: legacyHeight,
                  width: 5,
                  angle: 0,
                  originSpan: 1,
                },
                note: 'GM核实原区域实际位置尺寸，保留所有弹药与时机记录',
              })
            "
          >
            {{ controlText('spatial.registerAtOrigin') }}
          </button>
        </details>
      </li>
    </ul>
  </details>
</template>
<style scoped>
.scene-effect-tools {
  min-width: 0;
  font-size: 0.86rem;
  margin: 0.5rem 0;
}
.scene-effect-tools label {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  margin: 0.35rem 0;
}
.scene-effect-tools label:has(input[type='checkbox']) {
  display: flex;
  align-items: center;
}
.scene-effect-tools input:not([type='checkbox']),
.scene-effect-tools select {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
.effect-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 0.6rem;
}
.scene-effect-tools button {
  margin: 0.25rem 0.35rem 0.25rem 0;
}
.effect-list {
  padding-left: 1.2rem;
}
.effect-list li {
  margin: 0.4rem 0;
}
.effect-list button {
  font-size: 0.8rem;
}
@media (max-width: 600px) {
  .effect-form-grid {
    grid-template-columns: 1fr;
  }
  .scene-effect-tools button {
    min-height: 44px;
  }
}
</style>
