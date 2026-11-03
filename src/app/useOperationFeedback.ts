import { watch, onBeforeUnmount, type Ref } from 'vue'
import { notifyOperation, notifications } from './notifications'
let sequence = 0
export function useOperationFeedback(
  text: Ref<string>,
  failed: Ref<boolean> = { value: false } as Ref<boolean>,
  busy?: Ref<boolean>,
  progressText?: Ref<string>,
) {
  const key = `operation-${++sequence}`
  let timer: ReturnType<typeof setTimeout> | undefined,
    progress = 0
  watch(
    text,
    (value) => {
      if (value) {
        notifyOperation(value, failed.value, progress ? key : undefined)
        progress = 0
      }
    },
    { flush: 'post' },
  )
  if (busy)
    watch(
      busy,
      (value) => {
        clearTimeout(timer)
        if (value)
          timer = setTimeout(() => {
            progress = notifications.push(progressText?.value || '正在处理，请稍候…', 'progress', {
              key,
            })
          }, 700)
        else
          queueMicrotask(() => {
            if (progress) {
              notifications.dismiss(progress)
              progress = 0
            }
          })
      },
      { flush: 'post' },
    )
  if (progressText)
    watch(progressText, (value) => {
      if (value && progress) notifications.push(value, 'progress', { key })
    })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    if (progress) notifications.dismiss(progress)
  })
}
