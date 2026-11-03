<script setup lang="ts">
defineProps<{ id: string; gamma: number }>()
</script>
<template>
  <filter :id="id" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feComponentTransfer>
      <feFuncR type="gamma" :exponent="1 / gamma" />
      <feFuncG type="gamma" :exponent="1 / gamma" />
      <feFuncB type="gamma" :exponent="1 / gamma" />
    </feComponentTransfer>
  </filter>
</template>
