import {i18n} from '../app/i18n'
import {uiLabel} from './ui-label'
import {errorPresentation} from '../shared/localization/errors'
import {safeFeedback,type NoticeKind} from '../app/notifications'
/** Presentation only. Deduplication, priority, history and sanitization use the original notice. */
export function displayFeedback(text:string|null|undefined,kind:NoticeKind){
  if(!text)return ''
  text=safeFeedback(text)
  if(i18n.global.locale.value!=='en')return text
  const known=uiLabel(text)
  const translated=known!==text?known:kind==='error'?errorPresentation(text,'en'):text
  return (translated===text&&/\p{Script=Han}/u.test(text)?'[Original notice · translation unavailable] '+text:translated)
    .replaceAll('[已隐藏凭证]','[credential hidden]').replaceAll('[已隐藏密钥]','[key hidden]').replaceAll('[已隐藏]','[hidden]')
}
