<script setup lang="ts">
import {skillDisplayName} from './rule-presentation'
import {ruleText,ruleLabel} from './rule-presentation'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {abilityDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import { isBuiltinPack } from '../content/builtin-ids'
import type { Character, Feat } from '../core/types'
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../core/types'
import { derived, acquiredFeatIds, getChoices, signed, type Catalogue } from '../core/engine'
import { slotLevels, currentFeatureText } from '../core/growth-rules'
import { LANGUAGES } from '../content/srd'
import { runtimeDerived } from '../core/runtime'
import CharacterAvatar from './CharacterAvatar.vue'
const props = defineProps<{ character: Character; content: Catalogue; playing?: boolean }>()
const emit = defineEmits<{ info: [string] }>()
const d = computed(() =>
  props.playing
    ? runtimeDerived(props.character, props.content)
    : derived(props.character.build, props.content, props.character.inventory),
)
const cl = computed(() => props.content.classes.find((x) => x.id === props.character.build.classId))
const sp = computed(() =>
  props.content.species.find((x) => x.id === props.character.build.speciesId),
)
const bg = computed(() =>
  props.content.backgrounds.find((x) => x.id === props.character.build.backgroundId),
)
const selected = computed(() =>
  getChoices(props.character.build, props.content).filter(
    (n) => n.kind !== 'spell' && !['languages', 'rogue-language'].includes(n.id),
  ),
)
const feats = computed(() =>
  acquiredFeatIds(props.character.build, props.content)
    .map((id) =>
      props.content.feats.find(
        (f) => f.id === id || (id.startsWith('magic-initiate') && f.id === 'magic-initiate'),
      ),
    )
    .filter((f): f is Feat => !!f),
)
const languageNames = (ids: string[]) => ids.map((id) => ruleLabel(LANGUAGES[id])||id).join(controlI18n.global.locale.value==='en'?', ':'、')
const item = (id: string) =>
  [...props.content.items, ...props.character.build.customItems].find((x) => x.id === id)
</script>
<template>
  <article class="sheet" :class="{ playing }">
    <div class="sheet-heading">
      <div>
        <p class="eyebrow">CHARACTER RECORD · LEVEL {{ character.level }}</p>
        <h1>{{ localizedEntryName(character.build) || controlText('expressionOne.unnamedAdventurer') }}</h1>
        <p>
          {{ localizedEntryName(sp) }} / {{ localizedEntryName(cl) }} / {{ localizedEntryName(bg) }}
          <span class="muted">· {{ ruleLabel(character.build.alignment) }}</span>
        </p>
      </div>
      <CharacterAvatar :name="character.build.name" :portrait="character.portrait" :size="80" />
    </div>
    <div class="sheet-stats">
      <div v-for="a in ABILITIES" :key="a">
        <span>{{ abilityDisplayName(a) }}</span
        ><b>{{ signed(d.mods[a]) }}</b
        ><small>{{ d.scores[a] }}</small>
      </div>
    </div>
    <div class="metrics">
      <div>
        <span>{{ controlText('game.maxHP') }}</span><strong>{{ d.hp }}</strong>
      </div>
      <div>
        <span>AC</span><strong>{{ d.ac }}</strong>
      </div>
      <div>
        <span>{{ controlText('controls.initiative') }}</span><strong>{{ signed(d.initiative) }}</strong>
      </div>
      <div>
        <span>{{ controlText('controls.speed') }}</span><strong>{{ d.speed }} <small>{{ controlText('game.feet') }}</small></strong>
      </div>
      <div>
        <span>{{ controlText('domain.proficiency') }}</span><strong>+{{ d.pb }}</strong>
      </div>
      <div>
        <span>{{ controlText('domain.passivePerception') }}</span><strong>{{ d.passivePerception }}</strong>
      </div>
    </div>
    <slot />
    <details class="panel">
      <summary>{{ controlText('operations.statisticsSourcesAndRulesVersion') }}</summary>
      <p>{{ d.hpSource }}</p>
      <p>{{ d.acSource }}</p>
      <p v-for="p in character.packs" :key="p.id" class="small">{{ p.id }} · {{ p.version }}</p>
      <p class="muted small">
        {{ controlText('quantity.classScope', {p0:(playing
            ? controlText('expressionOne.runtimeOperationsSaveLocallyTheGmConfirmsTarget')
            : controlText('expressionOne.buildPreviewSaveToOpenTheAdventurePanel'))}) }}</p>
    </details>
    <div class="sheet-columns">
      <section v-if="!playing" class="panel">
        <h2>{{ controlText('ai.checksTab') }}</h2>
        <div class="skill-grid">
          <div v-for="(s, id) in SKILLS" :key="id" class="skill-row">
            <span
              :class="[
                'proficiency-dot',
                {
                  trained: d.skills.includes(String(id)),
                  expert: d.expertise.includes(String(id)),
                },
              ]"
              >{{
                d.expertise.includes(String(id)) ? '◆' : d.skills.includes(String(id)) ? '●' : '○'
              }}</span
            ><span>{{ skillDisplayName(id) }}</span
            ><b>{{ signed(d.skillValues[String(id)]!) }}</b>
          </div>
        </div>
        <h3>{{ controlText('rules.checkSaves') }}</h3>
        <div class="tag-row">
          <span v-for="a in ABILITIES" :key="a" class="tag"
            >{{ abilityDisplayName(a) }} {{ signed(d.saves[a]!)
            }}{{ cl?.saves.includes(a) ? ' ●' : '' }}</span
          >
        </div>
      </section>
      <section class="panel">
        <h2>{{ controlText('rules.featuresProficiencies') }}</h2>
        <template
          v-for="sub in content.subclasses.filter(
            (s) => s.id === character.build.choices.subclass?.[0],
          )"
          :key="sub.id"
          ><p
            v-for="f in sub.features.filter((f) => f.level <= character.level)"
            :key="f.name"
            class="feature"
          >
            {{ localizedEntryName(f) }} · {{ ruleText(f.summary) }}（{{
              isBuiltinPack(sub.source.pack)
                ? controlText('expressionOne.phbResolveThroughRuntimePanelAndGmTrigger')
                : controlText('expressionOne.customSourceUndeclaredEffectsRequireGmAdjudication')
            }}）
          </p></template
        >
        <p v-for="f in cl?.features" :key="f" class="feature">
          {{ ruleText(currentFeatureText(character.build, f)) }}
        </p>
        <p v-for="f in sp?.features" :key="f" class="feature">
          {{ ruleText(currentFeatureText(character.build, f)) }}
        </p>
        <div v-for="node in selected" :key="node.id" class="selection-detail">
          <b>{{ ruleLabel(node.label) }}</b
          ><span>{{
            (character.build.choices[node.id] || [])
              .map((id) => localizedEntryName(node.options.find((x) => x.id === id)) || id)
              .join('、')
          }}</span>
        </div>
        <p v-for="(feat, index) in feats" :key="feat.id + '-' + index" class="feature">
          {{ localizedEntryName(feat) }} · {{ ruleText(feat.summary) }}
          <small v-if="!isBuiltinPack(feat.source.pack)" class="muted"
            >{{ controlText('quantity.customSource', {p0:(feat.source.pack),p1:(feat.source.version)}) }}</small
          >
        </p>
        <p class="small">
          {{ controlText('field.armorTraining') }}{{ d.training.armor.join('、') || controlText('controls.none') }}<br />{{ controlText('field.weaponProficiencies') }}{{
            d.training.weapons.join('、')
          }}<br />{{ controlText('field.tools') }}{{ d.tools.map((id) => localizedEntryName(item(id)) || id).join('、') || controlText('controls.none')
          }}<br />{{ controlText('field.languages') }}{{ languageNames(d.languages) }}
        </p>
      </section>
    </div>
    <section v-if="d.attacks.length" class="panel">
      <h2>{{ playing ? controlText('expressionOne.currentEquippedAttackBaseline') : controlText('expressionOne.initialEquipmentAttackReference') }}</h2>
      <div v-for="(attack, i) in d.attacks" :key="i" class="data-row">
        <span>{{ localizedEntryName(attack.item) }}</span
        ><b>{{ controlText('controls.attack') }} {{ signed(attack.bonus) }}</b
        ><span>{{
          attack.ready ? attack.damage + ' ' + attack.item.damageType : controlText('expressionOne.requiresTwoHandsToAttack')
        }}</span>
      </div>
      <p class="muted small">{{ controlText('workspace.showsBaseAttackBonusAndDamageForThe') }}</p>
    </section>
    <section
      v-if="!playing && (d.spells.length || character.build.choices.spellbook?.length)"
      class="panel"
    >
      <h2>{{ controlText('operations.spellsAndCastingSources') }}</h2>
      <p v-if="cl?.slots" class="muted">
        {{ cl.id === 'warlock' ? controlText('expressionOne.pactMagicSlots') : controlText('controls.slots') }}：{{
          slotLevels(character.build)
            .map((n, i) => (n ? `${i + 1} 环 ×${n}` : ''))
            .filter(Boolean)
            .join('、')
        }}
        ·
        {{ cl.id === 'warlock' ? controlText('expressionOne.restoresOnShortOrLongRest') : controlText('expressionOne.restoresOnLongRest') }}
      </p>
      <div v-for="(g, i) in d.spells" :key="i" class="spell-row">
        <button class="text-button" @click="emit('info', g.spell.id)">
          {{ localizedEntryName(g.spell) }} <small v-if="controlI18n.global.locale.value==='zh-CN'">{{ g.spell.english }}</small></button
        ><span>{{ g.source }}</span
        ><span
          >{{ controlText('quantity.attackStats', {p0:(g.ability ? abilityDisplayName(g.ability) : controlText('expressionOne.selectionPending')),p1:(g.ability ? 8 + d.pb + d.mods[g.ability] : '—'),p2:(g.ability ? signed(d.pb + d.mods[g.ability]) : '—')}) }}</span
        ><small>{{ g.usage }}</small>
      </div>
      <details v-if="character.build.choices.spellbook?.length">
        <summary>{{ controlText('quantity.spellbookCount', {p0:(character.build.choices.spellbook.length)}) }}</summary>
        <div class="tag-row">
          <button
            v-for="id in character.build.choices.spellbook"
            :key="id"
            class="tag"
            @click="emit('info', id)"
          >
            {{ localizedEntryName(content.spells.find((s) => s.id === id)) }}
          </button>
        </div>
      </details>
    </section>
    <section v-if="!playing" class="panel">
      <h2>
        {{ controlText('controls.inventory') }}
        <span class="count">{{ controlText('quantity.itemsGold', {p0:(character.inventory.length),p1:(character.coins)}) }}</span>
      </h2>
      <div v-for="row in character.inventory" :key="row.instanceId" class="inventory-row">
        <span
          >{{ localizedEntryName(item(row.itemId)) || row.itemId }}
          <small>{{ row.equipped ? controlText('expressionOne.equippedWielded') : '' }}</small></span
        ><b>× {{ row.quantity }}</b
        ><small>{{ row.source }}</small>
      </div>
    </section>
    <section class="panel">
      <h2>{{ controlText('operations.characterStory') }}</h2>
      <p class="story-text">{{ character.build.appearance || controlText('expressionOne.noAppearanceWrittenYet') }}</p>
      <p class="story-text">{{ character.build.story || controlText('expressionOne.theStoryBeginsWithTheNextAdventure') }}</p>
    </section>
    <section
      v-if="character.build.adjustments.length || character.build.customItems.length"
      class="panel custom-panel"
    >
      <h2>{{ controlText('game.custom') }}</h2>
      <p v-for="a in character.build.adjustments" :key="a.id">
        {{ a.field }} {{ signed(a.amount) }} · {{ a.reason }}
      </p>
      <p v-for="i in character.build.customItems" :key="i.id">{{ controlText('quantity.customItem', {p0:(localizedEntryName(i)),p1:(i.summary)}) }}
      </p>
      <p class="muted small">{{ controlText('operations.localMarkerGrantsNoMultiplayerPermissions') }}</p>
    </section>
  </article>
</template>
