<script setup lang="ts">
import {uiLabel} from '../ui-label'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import { computed, ref,watch } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { Catalogue } from '../../core/engine'
import type { SceneEffectAction } from '../../persistence/scene-effects-schema'
import SceneEffectPointPicker from '../SceneEffectPointPicker.vue'
const props = defineProps<{ view: RoomView; busy: boolean; actorId: string; content: Catalogue }>()
const emit = defineEmits<{ action: [SceneEffectAction] }>()
const selected = ref(''),
  target = ref(''),
  angle = ref(0),
  to = ref({ x: 0, y: 0, height: 0 }),
  metal = ref(''),
  contacts = ref<string[]>([]),
  cannotDrop = ref<string[]>([]),
  gearObject = ref(''),
  gearItem = ref(''),
  gearAttack = ref<string[]>([]),
  gearHeld = ref(true),
  gearProficient = ref(false),
  gearMagical = ref(false),
  material = ref<'metal' | 'wood' | 'other'>('metal')
const gm = computed(() => props.view.self.role === 'gm'),
  data = computed(() => props.view.scene?.sceneEffects?.m5),
  abilities = computed(() =>
    (data.value?.abilities ?? []).filter((e) => e.actorId === props.actorId),
  ),
  current = computed(
    () => abilities.value.find((e) => e.effectId === selected.value) ?? abilities.value[0],
  ),
  npc = computed(
    () => props.view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === props.actorId)?.body,
  ),
  note = '确认原法术、实际来源、后续动作及当前场景'
watch(()=>abilities.value.map(e=>e.effectId),ids=>{if(!ids.includes(selected.value))selected.value=ids[0]??''},{immediate:true})
watch(()=>current.value?.effectId,()=>{target.value='';if(current.value?.point)to.value={...current.value.point}},{immediate:true})
const uses = computed(() =>
  current.value?.spellId === 'flame-blade'
    ? ['attack', 'put-away', 'resummon']
    : current.value?.spellId === 'dragon-s-breath'
      ? ['breathe']
      : ['heat-metal', 'witch-bolt'].includes(current.value?.spellId ?? '')
        ? ['heat']
        : ['attack', 'move-attack'],
)
const labels: Record<string, string> = {
  attack: '魔法攻击',
  breathe: '15尺锥形吐息（魔法动作）',
  heat: '引导伤害（附赠动作）',
  'move-attack': '移动最多20尺并攻击（附赠动作）',
  'put-away': '放下火焰刀',
  resummon: '重新唤出（附赠动作）',
}
function use(use: string) {
  if (!current.value) return
  emit('action', {
    operation: 'm5-use',
    effectId: current.value.effectId,
    actorId: props.actorId,
    targetIds: target.value ? [target.value] : [],
    use: use as Extract<SceneEffectAction, { operation: 'm5-use' }>['use'],
    to: to.value,
    angle: angle.value,
    receipt: crypto.randomUUID(),
    note,
  })
}
function breathAt(direction=angle.value) {
  const t = props.view.scene?.tokens.find((t) =>
    [t.id, t.characterId, t.npcId, t.actorId].includes(props.actorId),
  )
  if (!t || current.value?.spellId !== 'dragon-s-breath') return undefined
  return {
    shape: 'cone' as const,
    x: t.x,
    y: t.y,
    height: t.spatial?.height ?? 0,
    size: 15,
    width: 5,
    heightFeet: 15,
    angle: direction,
    originSpan: t.span,
  }
}
const breathPreview=computed(()=>breathAt())
function aimAngle(p:{x:number;y:number}){const t=props.view.scene?.tokens.find(t=>[t.id,t.characterId,t.npcId,t.actorId].includes(props.actorId));return t?Math.atan2(p.y+.5-t.y-t.span/2,p.x+.5-t.x-t.span/2)*180/Math.PI:angle.value}
</script>
<template>
  <details
    class="m5-operations"
    v-if="abilities.length || data?.marks.length || data?.knownPositions.length || gm"
  >
    <summary>{{ controlText('adjudication.followUpSpellAbilitiesAndActualEquipment') }}</summary>
    <div
      v-for="mark in (data?.marks ?? []).filter((m) => m.actorId === actorId)"
      :key="mark.effectId"
    >
      <strong>{{ localizedEntryName(mark) }}</strong
      ><template v-if="mark.canTransfer"
        ><label
          >{{ controlText('interactionField.transferToCurrentlyVisibleTarget') }}<MapFieldPicker kind="entity"><select v-model="target">
            <option value="">{{ controlText('game.choose') }}</option>
            <option
              v-for="t in view.scene?.tokens ?? []"
              :key="t.id"
              :value="t.characterId ?? t.npcId ?? t.actorId ?? t.id"
            >
              {{ localizedEntryName(t) }}
            </option>
          </select></MapFieldPicker></label
        ><button
          :disabled="busy || !target"
          @click="
            emit('action', {
              operation: 'm5-mark',
              actorId,
              effectId: mark.effectId,
              targetId: target,
              note: '原目标归零后附赠转移，不重新施法',
            })
          "
        >
          {{ controlText('adjudication.transferExistingMarkBonusAction') }}
        </button></template
      ><template v-if="gm && mark.spellId === 'hunter-s-mark'"
        ><button
          :disabled="busy"
          @click="
            emit('action', {
              operation: 'm5-search',
              actorId,
              effectId: mark.effectId,
              skill: 'perception',
              note: 'GM确认本次检定为寻找原印记目标',
            })
          "
        >
          {{ controlText('adjudication.findOriginalTargetWithPerceptionAdvantage') }}</button
        ><button
          :disabled="busy"
          @click="
            emit('action', {
              operation: 'm5-search',
              actorId,
              effectId: mark.effectId,
              skill: 'survival',
              note: 'GM确认本次检定为追踪原印记目标',
            })
          "
        >
          {{ controlText('adjudication.trackOriginalTargetWithSurvivalAdvantage') }}
        </button></template
      >
    </div>
    <template v-if="abilities.length"
      ><label
        >{{ controlText('interactionField.myCurrentFollowUpAbilities') }}<select v-model="selected">
          <option v-for="e in abilities" :key="e.effectId" :value="e.effectId">{{ localizedEntryName(e) }}</option>
        </select></label
      >
      <p v-if="current?.point">{{ controlText('progressSummary.actualEffectPosition', {p0:(current.point.x),p1:(current.point.y),p2:(localizedEntryName(current))}) }}
      </p>
      <label
        v-if="current && !['heat-metal', 'witch-bolt', 'dragon-s-breath'].includes(current.spellId)"
        >{{ controlText('interactionField.thisAttackSTarget') }}<MapFieldPicker kind="entity"><select v-model="target">
          <option value="">{{ controlText('adjudication.noneMoveOnly') }}</option>
          <option
            v-for="t in view.scene?.tokens ?? []"
            :key="t.id"
            :value="t.characterId ?? t.npcId ?? t.actorId ?? t.id"
          >
            {{ localizedEntryName(t) }}
          </option>
        </select></MapFieldPicker></label
      >
      <label v-if="current?.spellId === 'dragon-s-breath'"
        >{{ controlText('interactionField.breathDirectionDegrees') }}<input v-model.number="angle" type="number" min="-360" max="360"
      /></label>
      <template v-if="current?.spellId === 'spiritual-weapon'"
        ><label
          >{{ controlText('interactionField.movementDestinationX') }}<input
            v-model.number="to.x"
            type="number"
            min="0"
            :max="(view.scene?.grid.columns ?? 1) - 1" /></label
        ><label
          >{{ controlText('interactionField.movementDestinationY') }}<input
            v-model.number="to.y"
            type="number"
            min="0"
            :max="(view.scene?.grid.rows ?? 1) - 1" /></label
      ></template>
      <SceneEffectPointPicker
        v-if="view.scene && (breathPreview || current?.spellId === 'spiritual-weapon')"
        :scene="view.scene"
        :points="[to]"
        :preview="breathPreview" :disabled="busy" :preview-at="(_,p)=>breathAt(aimAngle(p))"
        @select="(_, p) => {to=p;if(current?.spellId==='dragon-s-breath')angle=aimAngle(p)}"
      />
      <div class="m5-buttons">
        <button
          v-for="useId in uses"
          :key="useId"
          :disabled="
            busy ||
            (current?.spellId === 'flame-blade' &&
              (useId === 'resummon' ? current.held : !current.held))
          "
          @click="use(useId)"
        >
          {{ uiLabel(labels[useId]) }}
        </button>
      </div>
      <p class="muted">{{ controlText('adjudication.followUpAbilitiesUseTheOriginalSpellS') }}</p>
    </template>
    <p v-for="p in data?.knownPositions ?? []" :key="p.targetId">{{ controlText('progressSummary.privateLocationHeightFt', {p0:(p.x),p1:(p.y),p2:(p.height),p3:(p.note)}) }}
    </p>
    <p v-for="p in data?.waiting ?? []" :key="p.id" role="status">
      {{ controlText('progressSummary.damageReactionAwaitsFinalGmResolution', {p0:(localizedEntryName(p))}) }}</p>
    <details v-if="gm">
      <summary>{{ controlText('adjudication.gmRegistersManufacturedMetalFacts') }}</summary>
      <label
        >{{ controlText('game.actualObject') }}<select v-model="metal">
          <option value="">{{ controlText('game.choose') }}</option>
          <option v-for="o in view.scene?.spatialObjects ?? []" :key="o.id" :value="o.id">
            {{ localizedEntryName(o) }}
          </option>
        </select></label
      ><label
        >{{ controlText('interactionField.currentContactsMultipleSelection') }}<select v-model="contacts" multiple>
          <option
            v-for="t in view.scene?.tokens ?? []"
            :key="t.id"
            :value="t.characterId ?? t.npcId ?? t.actorId ?? t.id"
          >
            {{ localizedEntryName(t) }}
          </option>
        </select></label
      ><label
        >{{ controlText('interactionField.cannotImmediatelyDropSuchAsWornArmor') }}<select v-model="cannotDrop" multiple>
          <option v-for="id in contacts" :key="id" :value="id">
            {{
              localizedEntryName(view.scene?.tokens.find((t) => [t.id, t.characterId, t.npcId, t.actorId].includes(id)))
            }}
          </option>
        </select></label
      ><button
        :disabled="busy || !metal"
        @click="
          emit('action', {
            operation: 'm5-metal',
            objectId: metal,
            manufactured: true,
            contactIds: contacts,
            cannotDropIds: cannotDrop,
            note: 'GM核实人造金属及实际接触关系',
          })
        "
      >
        {{ controlText('adjudication.saveActualMetalFacts') }}
      </button>
    </details>
    <details v-if="gm && npc">
      <summary>{{ controlText('adjudication.currentOrdinaryNpcSActualWeapon') }}</summary>
      <div v-for="gear in npc.equipment ?? []" :key="gear.id">
        <span
          >{{ localizedEntryName(content.items.find((i) => i.id === gear.itemId)) ?? gear.itemId }} ·
          {{ gear.held ? controlText('expressionThree.held') : controlText('expressionThree.notHeld') }}</span
        ><button
          :disabled="busy || !gear.held"
          @click="
            emit('action', {
              operation: 'm5-equipment-drop',
              actorId,
              equipmentId: gear.id,
              note: 'GM确认将真实NPC装备放到地面供实际拾取',
            })
          "
        >
          {{ controlText('adjudication.placeOnGround') }}
        </button>
      </div>
      <label
        >{{ controlText('game.actualObject') }}<select v-model="gearObject">
          <option value="">{{ controlText('game.choose') }}</option>
          <option v-for="o in view.scene?.spatialObjects ?? []" :key="o.id" :value="o.id">
            {{ localizedEntryName(o) }}
          </option>
        </select></label
      ><label
        >{{ controlText('interactionField.correspondingRulesWeapon') }}<select v-model="gearItem">
          <option value="">{{ controlText('game.choose') }}</option>
          <option
            v-for="i in content.items.filter((i) => i.kind === 'weapon')"
            :key="i.id"
            :value="i.id"
          >
            {{ localizedEntryName(i) }}
          </option>
        </select></label
      ><label
        >{{ controlText('interactionField.correspondingActualAttack') }}<select v-model="gearAttack" multiple>
          <option v-for="at in npc.attacks" :key="at.id" :value="at.id">{{ localizedEntryName(at) }}</option>
        </select></label
      ><label
        >{{ controlText('interactionField.material') }}<select v-model="material">
          <option value="metal">{{ controlText('adjudication.metal') }}</option>
          <option value="wood">{{ controlText('adjudication.wood') }}</option>
          <option value="other">{{ controlText('game.other') }}</option>
        </select></label
      ><label><input v-model="gearHeld" type="checkbox" />{{ controlText('interactionField.actualGrip') }}</label
      ><label><input v-model="gearProficient" type="checkbox" />{{ controlText('interactionField.weaponProficiencyVerified') }}</label
      ><label><input v-model="gearMagical" type="checkbox" />{{ controlText('interactionField.itemItselfIsAMagicWeapon') }}</label
      ><button
        :disabled="busy || !gearObject || !gearItem || !gearAttack.length"
        @click="
          emit('action', {
            operation: 'm5-equipment',
            actorId,
            equipment: {
              id: gearObject,
              objectId: gearObject,
              itemId: gearItem,
              attackIds: gearAttack,
              held: gearHeld,
              proficient: gearProficient,
              magical: gearMagical,
              material,
            },
            note: 'GM核实实际NPC武器，不创建免费物品',
          })
        "
      >
        {{ controlText('adjudication.registerUpdateActualWeapon') }}
      </button>
    </details>
  </details>
</template>
<style scoped>
.m5-operations {
  margin: 0.5rem 0;
  min-width: 0;
}
.m5-operations label {
  display: grid;
  gap: 0.2rem;
  margin: 0.4rem 0;
}
.m5-operations label:has(input[type='checkbox']) {
  display: flex;
  align-items: center;
}
.m5-operations select,
.m5-operations input:not([type='checkbox']) {
  width: 100%;
  min-width: 0;
}
.m5-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.m5-buttons button {
  min-height: 36px;
}
@media (max-width: 600px) {
  .m5-buttons button {
    min-height: 44px;
  }
}
</style>
