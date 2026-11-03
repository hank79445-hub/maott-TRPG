import { computed, shallowRef, watch } from 'vue'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>
type SpellGroupPreferences = Partial<Record<number, boolean>>
const preferenceKey = (characterId: string) => 'trpg-spell-groups-v1:' + characterId

function browserStorage(): PreferenceStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

function loadPreferences(characterId: string, storage?: PreferenceStorage): SpellGroupPreferences {
  try {
    const value: unknown = JSON.parse(storage?.getItem(preferenceKey(characterId)) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        ([level, open]) => /^[0-9]$/.test(level) && typeof open === 'boolean',
      ),
    )
  } catch {
    return {}
  }
}

export function useSpellGroupPreferences(
  characterId: () => string,
  query: () => string,
  storage = browserStorage(),
) {
  const preferences = shallowRef<SpellGroupPreferences>({})
  const temporaryLevels = shallowRef<number[]>([])
  const searching = computed(() => !!query().trim())
  watch(
    characterId,
    (id) => {
      preferences.value = loadPreferences(id, storage)
      temporaryLevels.value = []
    },
    { immediate: true, flush: 'sync' },
  )
  watch(
    query,
    () => {
      temporaryLevels.value = []
    },
    { flush: 'sync' },
  )

  function isExpanded(level: number) {
    return (
      searching.value || temporaryLevels.value.includes(level) || preferences.value[level] !== false
    )
  }
  function save(next: SpellGroupPreferences) {
    preferences.value = next
    try {
      storage?.setItem(preferenceKey(characterId()), JSON.stringify(next))
    } catch {
      // Storage can be unavailable; the current panel still retains the choice.
    }
  }
  function toggle(level: number) {
    if (searching.value) return
    const open = !isExpanded(level)
    temporaryLevels.value = temporaryLevels.value.filter((n) => n !== level)
    save({ ...preferences.value, [level]: open })
  }
  function setAll(levels: number[], open: boolean) {
    if (searching.value) return
    temporaryLevels.value = []
    save({ ...preferences.value, ...Object.fromEntries(levels.map((level) => [level, open])) })
  }
  function expandForDescriptions(levels: number[], open: boolean) {
    temporaryLevels.value = open ? levels : []
  }
  return { searching, isExpanded, toggle, setAll, expandForDescriptions }
}
