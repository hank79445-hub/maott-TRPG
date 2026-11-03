import { createI18n } from 'vue-i18n'
import { watch } from 'vue'
import { en, zhCN } from '../../content/locales/interface'
import { normalizeLocale, type Locale } from '../../shared/localization/locale'
import {interfaceLocaleCookie,interfaceLocaleFromCookie} from '../../shared/localization/interface-preference'
const storageKey = 'trpg-interface-locale-v1'
let initial: Locale = 'zh-CN'
try {
  const stored = localStorage.getItem(storageKey)
  // Preserve existing Chinese behaviour unless this user explicitly chooses a language.
  initial = normalizeLocale(stored) ?? 'zh-CN'
} catch { /* Private mode/storage restrictions must not prevent startup. */ }
try { initial=interfaceLocaleFromCookie(document.cookie)??initial } catch { /* Non-browser or denied cookies. */ }
try { if(!interfaceLocaleFromCookie(document.cookie))document.cookie=interfaceLocaleCookie(initial,location.protocol==='https:') } catch { /* Preserve the local preference even when cookies are unavailable. */ }
export const i18n = createI18n({ legacy: false, locale: initial, fallbackLocale: 'zh-CN', messages: { 'zh-CN': zhCN, en } })
export function setInterfaceLocale(value: Locale): boolean {
  i18n.global.locale.value = value
  let saved=false
  try { localStorage.setItem(storageKey, value);saved=true } catch { /* Try the public UI cookie. */ }
  try { document.cookie=interfaceLocaleCookie(value,location.protocol==='https:');saved=interfaceLocaleFromCookie(document.cookie)===value||saved } catch { /* Storage may be fully disabled. */ }
  return saved
}
watch(i18n.global.locale, locale => { if (typeof document !== 'undefined') document.documentElement.lang = locale }, { immediate: true })
