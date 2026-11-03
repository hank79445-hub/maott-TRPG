<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import type {RoomView,RoomCommand} from '../online/protocol'
import M3EnvironmentForm from './m3/M3EnvironmentForm.vue'
import M3WorldCastForm from './m3/M3WorldCastForm.vue'
import M3SpatialActions from './m3/M3SpatialActions.vue'
defineProps<{view:RoomView;busy:boolean}>()
const emit=defineEmits<{command:[RoomCommand]}>()
</script>
<template>
 <details v-if="view.self.role==='gm'" class="m3-tools"><summary>{{ controlText('configuration.m3SpatialMovementAndObjectSpells') }}</summary><M3EnvironmentForm :view="view" :busy="busy" @command="emit('command',$event)" /><M3WorldCastForm :view="view" :busy="busy" @command="emit('command',$event)" /><M3SpatialActions :view="view" :busy="busy" @command="emit('command',$event)" /></details>
</template>
<style scoped>.m3-tools{min-width:0}.m3-tools :deep(details){margin:.55rem 0}.m3-tools :deep(label){display:grid;gap:.25rem;margin:.4rem 0;min-width:0}.m3-tools :deep(select),.m3-tools :deep(textarea),.m3-tools :deep(input:not([type=checkbox])){width:100%;min-width:0;max-width:100%}.m3-tools :deep(.m3-form-grid){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem .7rem}.m3-tools :deep(button){margin:.25rem .4rem .25rem 0}.m3-tools :deep(.m3-object-list){padding-left:1.2rem;font-size:.85rem}@media(max-width:600px){.m3-tools :deep(.m3-form-grid){grid-template-columns:1fr}.m3-tools :deep(button){min-height:44px}}</style>
