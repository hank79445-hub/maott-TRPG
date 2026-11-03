<script setup lang="ts">

import { shallowRef } from 'vue'
import { i18n, setInterfaceLocale } from '../app/i18n'
import { localeSchema } from '../shared/localization/locale'
const { t, locale } = i18n.global
const failed = shallowRef(false)
function change(event: Event) { const result=localeSchema.safeParse((event.target as HTMLSelectElement).value); if(result.success) failed.value=!setInterfaceLocale(result.data) }
</script>
<template><label class="language-select">{{t('language.label')}}<select :value="locale" @change="change"><option value="zh-CN" lang="zh-CN" translate="no">简体中文</option><option value="en">English</option></select><small v-if="failed" role="status">{{t('language.unavailable')}}</small></label></template>
<style scoped>.language-select{display:inline-flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:100%}.language-select select{min-height:44px;max-width:100%}.language-select small{flex-basis:100%}</style>
