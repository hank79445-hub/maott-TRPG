import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import TutorialVideo from './components/TutorialVideo.vue'
import './style.css'
export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('TutorialVideo', TutorialVideo)
  },
} satisfies Theme
