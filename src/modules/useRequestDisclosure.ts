import { ref, watch } from 'vue'

/** Fold only on an acknowledged submission; regular room polling never changes manual expansion. */
export function useRequestDisclosure(scope: () => string, submitted: () => boolean) {
  const open = ref(true)
  watch(
    scope,
    () => {
      open.value = !submitted()
    },
    { immediate: true },
  )
  function acknowledge(success: boolean, ticket = scope()) {
    if (success && ticket === scope()) open.value = false
  }
  return { open, acknowledge, ticket: scope }
}
