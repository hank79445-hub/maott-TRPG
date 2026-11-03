import { BUILTIN_PACKS } from '../content/builtin-packs'
import { isBuiltinPack } from '../content/builtin-ids'
import { applyOriginParty } from '../core/origins'
import { explorationRuntime } from '../core/exploration'
import { remapComplexReferences } from '../persistence/combat-references'
import { reconcileWorld } from '../core/combat-lifecycle'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Character, Pack } from '../core/types'
import {
  catalogue,
  clone,
  derived,
  newCharacter,
  startingInventory,
  validate,
} from '../core/engine'
import { srd } from '../content/srd'
import { repository, type EditorSession } from '../persistence/repository'
import { archiveSchema, parsePack } from '../persistence/schema'
import { SKILLS } from '../core/types'
import type { CombatCommand, Encounter } from '../core/combat-types'
import { applyCombat, newEncounter, validateEncounter } from '../core/combat'
import { encounterArchiveSchema, parseEncounter } from '../persistence/combat-schema'
import type { Adventure, MapAsset, MapCommand, MapCombatOptions, MapWorld } from '../core/map-types'
import { applyMap, newAdventure } from '../core/map'
import { parseAdventure, validateMapWorld } from '../persistence/map-schema'
import {
  assetReferences,
  encodeAsset,
  exportMap,
  importMap,
  validateImageData,
} from '../persistence/map-archive'
import {
  applyRuntime,
  runtimeState,
  validateInventory,
  validateRuntimeArchive,
  type RuntimeCommand,
} from '../core/runtime'
export const useWorkshop = defineStore('workshop', () => {
  const adventures = ref<Adventure[]>([]),
    assets = ref<MapAsset[]>([])
  const encounters = ref<Encounter[]>([])
  const characters = ref<Character[]>([]),
    packs = ref<Pack[]>([]),
    editor = ref<EditorSession | null>(null)
  const loaded = ref(false),
    storageError = ref(''),
    savedAt = ref(''),
    viewId = ref<string | null>(null),
    saving = ref(false),
    readFailure = ref(false)
  const allPacks = computed(() => [...BUILTIN_PACKS, ...packs.value]),
    content = computed(() => catalogue(allPacks.value))
  let savingChain = Promise.resolve()
  async function save() {
    if (readFailure.value)
      throw new Error('本地存档尚未成功读取，已阻止覆盖，请先导出原始存档备份。')
    // Serialize snapshots so an older save can never overwrite a newer one.
    const snapshot = clone({
      characters: characters.value,
      packs: packs.value,
      editor: editor.value,
      encounters: encounters.value,
      adventures: adventures.value,
    })
    const imageSnapshot = assets.value.map((asset) => ({ ...asset }))
    saving.value = true
    savingChain = savingChain
      .catch(() => {})
      .then(() =>
        repository.write(
          snapshot.characters,
          snapshot.packs,
          snapshot.editor,
          snapshot.encounters,
          snapshot.adventures,
          imageSnapshot,
        ),
      )
    try {
      await savingChain
      savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      storageError.value = ''
    } catch (e) {
      storageError.value = '本地保存失败，请导出备份。' + String(e)
      throw e
    } finally {
      saving.value = false
    }
  }
  async function load() {
    try {
      const data = await repository.read()
      const cat = catalogue([srd, ...data.packs])
      for (const character of data.characters.filter((c) => c.status === 'complete')) {
        validateInventory(character, cat)
        validateRuntimeArchive(character, cat)
      }
      characters.value = data.characters
      packs.value = data.packs
      editor.value = data.editor
      encounters.value = data.encounters ?? []
      adventures.value = data.adventures ?? []
      assets.value = data.assets ?? []
      for (const asset of assets.value) await validateImageData(asset, false)
      validateMapWorld(mapWorld(), assets.value)
      for (const encounter of encounters.value) validateEncounter(encounter, data.characters, cat)
      if (encounters.value.filter((e) => e.phase === 'active').length > 1)
        throw new Error('本地同时只能运行一个遭遇')
      loaded.value = true
    } catch (e) {
      readFailure.value = true
      storageError.value = '无法读取本地存档，已阻止覆盖。请导出原始存档并检查版本或数据完整性。'
      if (e instanceof Error) storageError.value += ' ' + e.message
      loaded.value = true
    }
  }
  function create() {
    editor.value = { character: newCharacter(), editingId: null, rebuild: true, step: 0 }
    viewId.value = null
  }
  async function setPurpose(id: string, purpose: NonNullable<Character['purpose']>) {
    const c = characters.value.find((c) => c.id === id)
    if (!c || c.npcOwnerId) throw Error('已绑定 NPC 的角色用途不能改为玩家；请创建独立玩家副本')
    const previous = clone(c)
    c.purpose = purpose
    c.revision++
    c.updatedAt = new Date().toISOString()
    try {
      await save()
    } catch (error) {
      Object.assign(c, previous)
      throw error
    }
  }
  function edit(character: Character) {
    if (character.level > 1)
      throw new Error('成长角色请在运行面板的职业成长中升级；一级构筑已作为成长依据保存')
    if (
      encounters.value.some(
        (e) => e.phase === 'active' && e.actors.some((a) => a.characterId === character.id),
      )
    )
      throw new Error('角色正在战斗中，请先结束遭遇再编辑')
    const copy = clone(character)
    copy.status = 'draft'
    editor.value = {
      character: copy,
      editingId: character.status === 'complete' ? character.id : null,
      rebuild: character.status !== 'complete',
      step: 0,
    }
    viewId.value = null
  }
  async function draft() {
    if (!editor.value) return
    const session = editor.value
    session.character.updatedAt = new Date().toISOString()
    session.character.packs = allPacks.value.map((p) => ({ id: p.id, version: p.version }))
    if (!session.editingId) {
      session.character.status = 'draft'
      const i = characters.value.findIndex((c) => c.id === session.character.id)
      if (i < 0) characters.value.push(clone(session.character))
      else characters.value[i] = clone(session.character)
    }
    await save()
  }
  async function finish() {
    if (!editor.value) return
    const session = editor.value,
      character = clone(session.character)
    if (validate(character.build, content.value).length) throw new Error('请先完成规则检查')
    const initial = startingInventory(character.build, content.value)
    if (session.rebuild) {
      character.inventory = initial.inventory
      character.coins = initial.coins
    }
    character.status = 'complete'
    character.revision++
    character.updatedAt = new Date().toISOString()
    character.packs = allPacks.value.map((p) => ({ id: p.id, version: p.version }))
    if (!character.runtime)
      character.runtime = {
        hp: derived(character.build, content.value, character.inventory).hp,
        temporaryHp: 0,
        resources: {},
        conditions: [],
      }
    // A build change invalidates undo snapshots from the earlier build.
    if (character.journal?.length)
      character.journal.forEach((e) => {
        e.before = null
      })
    if (character.runtime?.version === 2) {
      const old = characters.value.find((c) => c.id === character.id)
      const keepPreparation =
        old?.build.classId === character.build.classId &&
        JSON.stringify(old.build.choices['class-spells']) ===
          JSON.stringify(character.build.choices['class-spells']) &&
        JSON.stringify(old.build.choices.spellbook) ===
          JSON.stringify(character.build.choices.spellbook)
      character.runtime = runtimeState(character, content.value)
      if (!keepPreparation) character.runtime.preparedSpells = null
    }
    const before = clone(characters.value),
      previous = clone(editor.value)
    const index = characters.value.findIndex((c) => c.id === character.id)
    if (index < 0) characters.value.push(character)
    else characters.value[index] = character
    editor.value = null
    try {
      await save()
      viewId.value = character.id
    } catch (e) {
      characters.value = before
      editor.value = previous
      throw e
    }
  }
  async function cancel() {
    const previous = editor.value
    editor.value = null
    try {
      await save()
    } catch (e) {
      editor.value = previous
      throw e
    }
  }
  let runtimeChain = Promise.resolve()
  async function operate(id: string, command: RuntimeCommand) {
    const task = runtimeChain
      .catch(() => {})
      .then(async () => {
        if (readFailure.value) throw new Error('本地存档读取失败，无法提交操作')
        if (editor.value?.editingId === id) throw new Error('请先保存或取消角色编辑')
        if (
          command.type !== 'portrait-set' &&
          encounters.value.some(
            (e) => e.phase === 'active' && e.actors.some((a) => a.characterId === id),
          )
        )
          throw new Error('角色正在战斗中，请在战斗桌提交操作；角色面板保持同步查看')
        const index = characters.value.findIndex((c) => c.id === id)
        if (index < 0) throw new Error('角色已不存在')
        const previous = clone(characters.value[index]!)
        const previousParty = clone(characters.value)
        const continuousBefore = clone({
          encounters: encounters.value,
          adventures: adventures.value,
        })
        const explorationCandidate = {
          characters: previousParty,
          encounters: encounters.value,
          adventures: clone(adventures.value),
          packs: packs.value,
        }
        for (const a of explorationCandidate.adventures)
          explorationRuntime(explorationCandidate, a, id, command, content.value)
        if (command.type === 'origin') {
          if (
            encounters.value.some(
              (e) =>
                e.phase === 'active' &&
                e.actors.some((a) => a.characterId && command.targets.includes(a.characterId)),
            )
          )
            throw new Error('目标正在战斗中，请通过战斗桌处理')
          characters.value = applyOriginParty(characters.value, id, content.value, command)
        } else characters.value[index] = applyRuntime(previous, content.value, command)
        adventures.value = explorationCandidate.adventures
        const next = characters.value[index]!
        reconcileWorld({
          characters: characters.value,
          encounters: encounters.value,
          adventures: adventures.value,
          packs: packs.value,
        })
        try {
          await save()
        } catch (e) {
          characters.value = previousParty
          encounters.value = continuousBefore.encounters
          adventures.value = continuousBefore.adventures
          throw e
        }
        return next
      })
    runtimeChain = task.then(
      () => {},
      () => {},
    )
    return task
  }
  async function duplicate(character: Character) {
    const copy = clone(character)
    copy.id = crypto.randomUUID()
    for (const row of copy.inventory) if (row.craftedBy === character.id) row.craftedBy = copy.id
    for (const event of copy.journal ?? [])
      for (const row of event.before?.inventory ?? [])
        if (row.craftedBy === character.id) row.craftedBy = copy.id
    for (const effect of copy.runtime?.effects ?? [])
      if (effect.sourceId === character.id) effect.sourceId = copy.id
    for (const event of copy.journal ?? [])
      for (const effect of event.before?.runtime?.effects ?? [])
        if (effect.sourceId === character.id) effect.sourceId = copy.id
    copy.build.name = (copy.build.name || '未命名角色') + ' · 副本'
    copy.createdAt = new Date().toISOString()
    copy.updatedAt = copy.createdAt
    copy.revision = 0
    characters.value.push(copy)
    await save()
  }
  async function remove(id: string) {
    if (adventures.value.some((a) => a.party.includes(id)))
      throw new Error('角色被冒险队伍引用，请先退出并调整队伍或移除冒险')
    if (encounters.value.some((e) => e.actors.some((a) => a.characterId === id)))
      throw new Error('角色被遭遇引用，请先移除对应遭遇再删除角色')
    characters.value = characters.value.filter((c) => c.id !== id)
    if (editor.value?.character.id === id) editor.value = null
    if (viewId.value === id) viewId.value = null
    await save()
  }
  function exportArchive(character: Character) {
    return JSON.stringify(
      {
        format: 'trpg-character',
        version: 1,
        character: clone(character),
        packs: packs.value.filter((p) => character.packs.some((x) => x.id === p.id)),
      },
      null,
      2,
    )
  }
  function checkPack(pack: Pack, existing: Pack[]) {
    if (
      !/^[a-z][a-z0-9-]+$/.test(pack.id) ||
      isBuiltinPack(pack.id) ||
      ['custom', 'local-custom'].includes(pack.id)
    )
      throw new Error('规则包 ID 需为小写字母、数字和连字符，且不能使用内置或自定义物品保留 ID')
    const installed = existing.find((p) => p.id === pack.id)
    if (
      installed &&
      (installed.version !== pack.version || JSON.stringify(installed) !== JSON.stringify(pack))
    )
      throw new Error('同名规则包版本或内容冲突，请保留现有版本或使用新的包 ID')
    const entries = [
      ...pack.backgrounds,
      ...pack.species,
      ...pack.feats,
      ...(pack.subclasses ?? []),
      ...pack.spells,
      ...pack.items,
    ]
    if (new Set(entries.map((x) => x.id)).size !== entries.length)
      throw new Error('扩展条目 ID 重复')
    for (const e of entries)
      if (
        !e.id.startsWith(pack.id + '/') ||
        e.source.pack !== pack.id ||
        e.source.version !== pack.version
      )
        throw new Error('条目 ID 必须以“包ID/”开头，来源必须与包一致')
    const cat = catalogue([...existing.filter((p) => p.id !== pack.id), srd, pack])
    for (const bg of pack.backgrounds) {
      if (
        bg.skills.some((s) => !SKILLS[s]) ||
        ![
          'alert',
          'savage-attacker',
          'skilled',
          'magic-initiate-cleric',
          'magic-initiate-druid',
          'magic-initiate-wizard',
          'crafter',
          'healer',
          'lucky',
          'musician',
          'tavern-brawler',
          'tough',
          ...pack.feats.filter((f) => f.category === 'origin').map((f) => f.id),
        ].includes(bg.feat) ||
        (!cat.items.some((i) => i.id === bg.tool && i.kind === 'tool') &&
          !['gaming', 'artisan', 'instrument'].includes(bg.tool))
      )
        throw new Error('背景引用了不支持的技能、工具或专长')
      for (const e of bg.equipment) {
        for (const i of e.items)
          if (!cat.items.some((x) => x.id === i.itemId)) throw new Error('背景装备引用缺失')
        for (const choice of e.choices || [])
          if (
            choice.options.length < choice.count ||
            choice.options.some((id) => !cat.items.some((i) => i.id === id))
          )
            throw new Error('背景装备选择引用缺失或数量不足')
      }
    }
    for (const sub of pack.subclasses ?? [])
      for (const grant of sub.spellGrants ?? [])
        if (grant.ids.some((id) => !cat.spells.some((s) => s.id === id)))
          throw new Error('子职业法术引用缺失')
    const heights = new Map<string, number>()
    const walk = (id: string, path: string[]): number => {
      if (path.includes(id)) throw new Error('装备包存在循环引用')
      if (heights.has(id)) return heights.get(id)!
      const item = cat.items.find((x) => x.id === id)
      if (!item) throw new Error('装备包引用缺失')
      if (path.length > 5) throw new Error('装备包嵌套超过 5 层')
      const height =
        1 + Math.max(0, ...(item.contents || []).map((x) => walk(x.itemId, [...path, id])))
      if (height > 6) throw new Error('装备包嵌套超过 5 层')
      heights.set(id, height)
      return height
    }
    pack.items.forEach((i) => walk(i.id, []))
  }
  async function importPack(value: unknown) {
    const pack = parsePack(value)
    checkPack(pack, packs.value)
    if (packs.value.some((p) => p.id === pack.id)) throw new Error('该规则包已安装')
    packs.value.push(pack)
    await save()
  }
  async function importArchive(value: unknown) {
    const parsed = archiveSchema.parse(value),
      incoming = parsed.packs as Pack[],
      next = clone(packs.value)
    for (const pack of incoming) {
      checkPack(pack, next)
      if (!next.some((p) => p.id === pack.id)) next.push(pack)
    }
    const character = parsed.character as Character
    for (const used of character.packs)
      if (![...BUILTIN_PACKS, ...next].some((p) => p.id === used.id && p.version === used.version))
        throw new Error(`缺少规则包或版本不一致：${used.id} ${used.version}`)
    const cat = catalogue([...BUILTIN_PACKS, ...next])
    if (
      new Set(character.build.customItems.map((i) => i.id)).size !==
        character.build.customItems.length ||
      character.build.customItems.some(
        (i) => !i.id.startsWith('custom/') || cat.items.some((known) => known.id === i.id),
      )
    )
      throw new Error('自定义物品 ID 重复或命名空间不正确')
    if (
      character.inventory.some(
        (i) => ![...cat.items, ...character.build.customItems].some((item) => item.id === i.itemId),
      )
    )
      throw new Error('背包中存在未知物品')
    if (new Set(character.inventory.map((i) => i.instanceId)).size !== character.inventory.length)
      throw new Error('物品实例 ID 重复')
    validateInventory(character, cat)
    validateRuntimeArchive(character, cat)
    // An imported undo snapshot must never smuggle unknown or cyclic inventory.
    for (const event of character.journal ?? [])
      if (event.before) {
        const previous = {
          ...character,
          ...event.before,
          build: {
            ...character.build,
            growth: event.before.growth ?? character.build.growth,
            choices: event.before.choices ?? character.build.choices,
          },
        }
        validateInventory(previous, cat)
        validateRuntimeArchive(previous, cat)
      }
    if (
      character.status === 'complete' &&
      validate(character.build, cat, { existingCharacter: true }).length
    )
      throw new Error('已完成角色未通过建角规则校验；请检查存档或导出为草稿')
    const originalId = character.id
    character.id = crypto.randomUUID()
    for (const row of character.inventory)
      if (row.craftedBy === originalId) row.craftedBy = character.id
    for (const event of character.journal ?? [])
      for (const row of event.before?.inventory ?? [])
        if (row.craftedBy === originalId) row.craftedBy = character.id
    for (const effect of character.runtime?.effects ?? [])
      if (effect.sourceId === originalId) effect.sourceId = character.id
    for (const event of character.journal ?? [])
      for (const effect of event.before?.runtime?.effects ?? [])
        if (effect.sourceId === originalId) effect.sourceId = character.id
    character.createdAt = new Date().toISOString()
    character.updatedAt = character.createdAt
    packs.value = next
    characters.value.push(character)
    await save()
    return character
  }
  async function encounterTask<T>(fn: () => Promise<T>) {
    const task = runtimeChain.catch(() => {}).then(fn)
    runtimeChain = task.then(
      () => {},
      () => {},
    )
    return task
  }
  async function createEncounter(name: string) {
    return encounterTask(async () => {
      if (encounters.value.filter((e) => e.phase !== 'ended').length >= 20)
        throw new Error('最多 20 个准备或运行中的战斗，请取消闲置准备')
      if (encounters.value.length >= 1020) throw new Error('历史已达存储上限，请导出归档')
      const encounter = newEncounter(name)
      encounters.value.push(encounter)
      try {
        await save()
      } catch (e) {
        encounters.value = encounters.value.filter((x) => x.id !== encounter.id)
        throw e
      }
      return encounter.id
    })
  }
  async function combat(id: string, command: CombatCommand, options?: MapCombatOptions) {
    return encounterTask(async () => {
      const bound = adventures.value
        .flatMap((a) => a.scenes.map((s) => ({ adventure: a, scene: s })))
        .find((x) => x.scene.encounterId === id)
      if (bound) {
        await mutateMap(
          bound.adventure.id,
          command.type === 'undo'
            ? { type: 'undo' }
            : { type: 'combat', sceneId: bound.scene.id, command, options },
        )
        return encounters.value.find((e) => e.id === id)!
      }
      const index = encounters.value.findIndex((e) => e.id === id)
      if (index < 0) throw new Error('遭遇不存在')
      const original = clone(encounters.value[index]!),
        previousCharacters = clone(characters.value)
      if (
        command.type === 'start' &&
        encounters.value.some((e) => e.id !== id && e.phase === 'active')
      )
        throw new Error('请先结束当前运行的遭遇')
      if (
        editor.value?.editingId &&
        (original.actors.some((a) => a.characterId === editor.value!.editingId) ||
          (command.type === 'add-character' && command.characterId === editor.value.editingId))
      )
        throw new Error('请先保存或取消参与角色的编辑')
      const next = applyCombat(original, characters.value, content.value, command)
      encounters.value[index] = parseEncounter(next.encounter)
      characters.value = next.characters
      try {
        await save()
      } catch (e) {
        encounters.value[index] = original
        characters.value = previousCharacters
        throw e
      }
      return next.encounter
    })
  }
  async function removeEncounter(id: string) {
    return encounterTask(async () => {
      if (adventures.value.some((a) => a.scenes.some((s) => s.encounterId === id)))
        throw new Error('遭遇已被地图引用，请先结束并在地图解除关联')
      const old = clone(encounters.value),
        encounter = old.find((e) => e.id === id)
      if (encounter?.phase === 'active') throw new Error('请先结束遭遇再移除')
      encounters.value = old.filter((e) => e.id !== id)
      try {
        await save()
      } catch (e) {
        encounters.value = old
        throw e
      }
    })
  }
  function exportEncounter(id: string) {
    const encounter = encounters.value.find((e) => e.id === id)
    if (!encounter) throw new Error('遭遇不存在')
    const selected = characters.value.filter((c) =>
      encounter.actors.some((a) => a.characterId === c.id),
    )
    return JSON.stringify(
      {
        format: 'trpg-encounter',
        version: 1,
        encounter: clone(encounter),
        characters: clone(selected),
        packs: packs.value.filter((p) => selected.some((c) => c.packs.some((x) => x.id === p.id))),
      },
      null,
      2,
    )
  }
  async function importEncounter(value: unknown) {
    return encounterTask(async () => {
      const parsed = encounterArchiveSchema.parse(value),
        nextPacks = clone(packs.value)
      for (const pack of parsed.packs) {
        checkPack(pack as Pack, nextPacks)
        if (!nextPacks.some((p) => p.id === pack.id)) nextPacks.push(pack as Pack)
      }
      const encounter = parsed.encounter as Encounter,
        incoming = parsed.characters as Character[],
        cat = catalogue([srd, ...nextPacks])
      if (new Set(incoming.map((c) => c.id)).size !== incoming.length)
        throw new Error('遭遇归档包含重复角色 ID')
      validateEncounter(encounter, incoming, cat)
      if (encounter.phase === 'active' && encounters.value.some((e) => e.phase === 'active'))
        throw new Error('请先结束当前运行的遭遇再导入运行中的遭遇')
      if (
        encounter.phase !== 'ended' &&
        encounters.value.filter((e) => e.phase !== 'ended').length >= 20
      )
        throw new Error('最多 20 个准备或运行中的战斗')
      if (encounters.value.length >= 1020) throw new Error('历史已达存储上限，请导出归档')
      const mapping = new Map(incoming.map((c) => [c.id, crypto.randomUUID()])),
        actorMapping = new Map(
          encounter.actors.map((a) => [
            a.id,
            mapping.get(a.characterId ?? '') ?? crypto.randomUUID(),
          ]),
        )
      encounter.id = crypto.randomUUID()
      for (const c of incoming) {
        if (c.status !== 'complete' || validate(c.build, cat, { existingCharacter: true }).length)
          throw new Error('遭遇角色未通过一级建角规则校验')
        for (const p of c.packs)
          if (
            ![...BUILTIN_PACKS, ...nextPacks].some((x) => x.id === p.id && x.version === p.version)
          )
            throw new Error('遭遇缺少规则包或版本不一致：' + p.id)
        validateInventory(c, cat)
        validateRuntimeArchive(c, cat)
        c.id = mapping.get(c.id)!
        for (const row of c.inventory)
          if (row.craftedBy) row.craftedBy = mapping.get(row.craftedBy) ?? row.craftedBy
        c.journal?.forEach((x) => (x.before = null))
        for (const effect of c.runtime?.effects ?? []) {
          effect.encounterId = encounter.id
          effect.sourceId = actorMapping.get(effect.sourceId) ?? effect.sourceId
        }
      }
      for (const a of encounter.actors) {
        a.id = actorMapping.get(a.id)!
        if (a.characterId) a.characterId = mapping.get(a.characterId)!
        for (const x of a.npc?.effects ?? []) {
          x.sourceId = actorMapping.get(x.sourceId) ?? x.sourceId
          x.encounterId = encounter.id
        }
      }
      if (encounter.pending) {
        encounter.pending.actorId = actorMapping.get(encounter.pending.actorId)!
        encounter.pending.targets.forEach((t) => (t.id = actorMapping.get(t.id)!))
      }
      remapComplexReferences(encounter, actorMapping)
      if (encounter.pending) encounter.pending.id = crypto.randomUUID()
      for (const z of encounter.zones ?? []) z.id = crypto.randomUUID()
      validateEncounter(encounter, incoming, cat)
      encounter.slotSpent = encounter.slotSpent.map((id) => actorMapping.get(id)!)
      if (encounter.lastDamage) {
        encounter.lastDamage.actorId = actorMapping.get(encounter.lastDamage.actorId)!
        encounter.lastDamage.sourceId = actorMapping.get(encounter.lastDamage.sourceId) ?? ''
      }
      encounter.log.forEach((x) => {
        x.before = null
        x.revisions = {}
      })
      const old = clone({
        characters: characters.value,
        packs: packs.value,
        encounters: encounters.value,
      })
      characters.value.push(...incoming)
      packs.value = nextPacks
      encounters.value.push(encounter)
      try {
        await save()
      } catch (e) {
        characters.value = old.characters
        packs.value = old.packs
        encounters.value = old.encounters
        throw e
      }
      return encounter.id
    })
  }
  function mapWorld(): MapWorld {
    return {
      adventures: adventures.value,
      characters: characters.value,
      encounters: encounters.value,
      packs: packs.value,
    }
  }
  async function commitMap(next: MapWorld, images: MapAsset[] = assets.value) {
    const referenced = new Set(next.adventures.flatMap((a) => [...assetReferences(a)]))
    images = images.filter((image) => referenced.has(image.id))
    validateMapWorld(next, images)
    for (const pack of next.packs) checkPack(pack, next.packs)
    const previous = mapWorld(),
      oldAssets = assets.value
    adventures.value = next.adventures.map(parseAdventure)
    characters.value = next.characters
    encounters.value = next.encounters.map(parseEncounter)
    packs.value = next.packs
    assets.value = images
    try {
      await save()
    } catch (e) {
      adventures.value = previous.adventures
      characters.value = previous.characters
      encounters.value = previous.encounters
      packs.value = previous.packs
      assets.value = oldAssets
      throw e
    }
  }
  async function mutateMap(id: string, command: MapCommand, images?: MapAsset[]) {
    if (readFailure.value) throw new Error('本地存档读取失败，无法提交操作')
    if (
      editor.value?.editingId &&
      adventures.value.find((a) => a.id === id)?.party.includes(editor.value.editingId)
    )
      throw new Error('请先保存或取消队伍角色编辑')
    await commitMap(applyMap(mapWorld(), id, command, content.value), images)
    return adventures.value.find((a) => a.id === id)!
  }
  async function mapOperate(id: string, command: MapCommand) {
    return encounterTask(() => mutateMap(id, command))
  }
  async function createAdventure(name: string) {
    return encounterTask(async () => {
      if (readFailure.value) throw new Error('本地存档读取失败')
      const next = clone(mapWorld()),
        a = newAdventure(name,'enclosed')
      next.adventures.push(a)
      await commitMap(next)
      return a.id
    })
  }
  async function removeAdventure(id: string) {
    return encounterTask(async () => {
      const a = adventures.value.find((a) => a.id === id)
      if (a?.activeSceneId) throw new Error('请先让队伍退出冒险')
      if (
        a?.scenes.some(
          (s) => encounters.value.find((e) => e.id === s.encounterId)?.phase === 'active',
        )
      )
        throw new Error('请先结束相关遭遇')
      const next = clone(mapWorld())
      next.adventures = next.adventures.filter((a) => a.id !== id)
      const referenced = new Set(next.adventures.flatMap((a) => [...assetReferences(a)]))
      await commitMap(
        next,
        assets.value.filter((a) => referenced.has(a.id)),
      )
    })
  }
  async function mapBackground(
    id: string,
    sceneId: string,
    asset: MapAsset,
    configuration?: import('../core/map-types').MapScene,
  ) {
    return encounterTask(async () => {
      const s = adventures.value.find((a) => a.id === id)?.scenes.find((s) => s.id === sceneId)
      if (!s) throw new Error('场景不存在')
      await validateImageData(asset)
      const scene = clone(configuration ?? s),
        width = scene.grid.columns
      if (!configuration)
        scene.background = {
          assetId: asset.id,
          x: 0,
          y: 0,
          width,
          height: (width * asset.height) / asset.width,
          rotation: 0,
          locked: true,
          clip: true,
        }
      return mutateMap(id, { type: 'scene-edit', scene }, [...assets.value, asset])
    })
  }
  async function exportAdventure(id: string) {
    return exportMap(mapWorld(), assets.value, id)
  }
  async function importAdventure(value: unknown) {
    return encounterTask(async () => {
      const next = await importMap(value, mapWorld(), assets.value)
      await commitMap(next.world, next.assets)
      return next.id
    })
  }
  async function rawBackup() {
    const raw = await repository.raw()
    return { ...raw, assets: await Promise.all((raw.assets ?? []).map(encodeAsset)) }
  }
  async function addScriptInstance(instance: { world: MapWorld; assets: MapAsset[] }) {
    return encounterTask(async () => {
      if (readFailure.value) throw Error('本地存档读取失败，不能创建冒险')
      if (adventures.value.length >= 10) throw Error('本地冒险数量达到上限，请先导出并清理旧冒险')
      const next = clone(mapWorld())
      for (const pack of instance.world.packs) {
        const existing = next.packs.find((p) => p.id === pack.id)
        if (existing && JSON.stringify(existing) !== JSON.stringify(pack))
          throw Error('本地规则包冲突：' + pack.id)
        if (!existing) next.packs.push(pack)
      }
      next.adventures.push(...instance.world.adventures)
      next.characters.push(...instance.world.characters)
      await commitMap(next, [...assets.value, ...instance.assets])
      return instance.world.adventures[0]!.id
    })
  }
  return {
    adventures,
    assets,
    mapOperate,
    mapBackground,
    createAdventure,
    removeAdventure,
    exportAdventure,
    importAdventure,
    addScriptInstance,
    encounters,
    createEncounter,
    combat,
    removeEncounter,
    exportEncounter,
    importEncounter,
    characters,
    setPurpose,
    packs,
    editor,
    content,
    allPacks,
    loaded,
    storageError,
    readFailure,
    savedAt,
    saving,
    viewId,
    load,
    save,
    create,
    edit,
    draft,
    finish,
    cancel,
    duplicate,
    remove,
    exportArchive,
    importPack,
    importArchive,
    rawBackup,
    operate,
  }
})
