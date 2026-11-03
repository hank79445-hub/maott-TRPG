import { createApp } from 'vue'
import { i18n } from './app/i18n'
import './app/browser-capabilities'
import { createPinia } from 'pinia'
import App from './app/App.vue'
import './app/style.css'
import './app/inventory.css'
import './app/combat.css'
import './app/map.css'
createApp(App).use(createPinia()).use(i18n).mount('#app')

import './app/room.css'

import './app/i18n/layout.css'
