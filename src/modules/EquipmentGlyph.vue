<script setup lang="ts">
defineProps<{ name: string }>()
const paths: Record<string, string> = {
  weapons: 'M5 20 18 7l1-4-4 1L2 17m1-4 8 8m-6-3-3 3',
  armor: 'm7 3 5 2 5-2 4 5-4 3v10H7V11L3 8Z',
  head: 'M4 15V9a8 8 0 0 1 16 0v6M3 15h18M7 15v6m10-6v6M12 3v8',
  cloak: 'm9 3-6 17 9-3 9 3L15 3Zm0 0h6M12 6v11',
  clothing: 'm8 3-5 4 3 5 2-1v10h8V11l2 1 3-5-5-4-4 3Z',
  hands:
    'M7 11V5a1 1 0 0 1 2 0v6-8a1 1 0 0 1 2 0v8-7a1 1 0 0 1 2 0v7-5a1 1 0 0 1 2 0v7l2-2a2 2 0 0 1 3 2l-4 7H8l-4-8a2 2 0 0 1 3-1Z',
  feet: 'M7 3h9v10l5 4v4H3v-5l4-3Zm0 6h9M3 17h18',
  accessories: 'M6 4a10 10 0 0 0 12 0M6 4v6a6 6 0 0 0 12 0V4M12 13l-4 4 4 4 4-4Z',
  'main-hand': 'M5 20 18 7l1-4-4 1L2 17m1-4 8 8m-6-3-3 3',
  'off-hand': 'M4 4h16v8c0 4-4 7-8 9-4-2-8-5-8-9ZM12 7v10M7 10h10',
  consumables: 'M9 3h6M10 3v5l-5 6v6h14v-6l-5-6V3M6 15h12M12 16v3m-2-1h4',
  tools: 'm3 19 9-9M14 3a6 6 0 0 0-5 8l-6 6a2 2 0 0 0 4 4l6-6a6 6 0 0 0 8-5l-4 2-4-4Z',
  materials: 'm12 2 8 10-8 10-8-10Zm0 0v20M4 12h16',
  containers: 'M6 6h12l2 15H4ZM8 6V3h8v3M7 11h10v6H7Z',
  misc: 'm3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10',
}
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.misc" />
  </svg>
</template>
