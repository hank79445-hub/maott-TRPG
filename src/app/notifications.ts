import { reactive } from 'vue'
export type NoticeKind = 'success' | 'info' | 'review' | 'warning' | 'error' | 'progress'
type Options = { persistent?: boolean; details?: string; key?: string }
export type Notice = {
  id: number
  text: string
  kind: NoticeKind
  details: string
  count: number
  remaining: number
  paused: boolean
  key?: string
}
// Never retain raw errors. Even the session history only receives sanitized strings.
export function safeFeedback(value: string) {
  return value
    .replace(/-----BEGIN [\s\S]*?-----END [^-]+-----/g, '[已隐藏凭证]')
    .replace(/(Authorization["']?\s*:\s*["']?)(?:Bearer\s+)?[^\s,;"'}]+/gi, '$1[已隐藏]')
    .replace(
      /((?:room[_-]?Token|access_token|refresh_token|app[_-]?Secret|api[_-]?Key|password|secret|token|密钥|密码)["']?\s*[=:：]\s*["']?)[^\s&"',;}]+/gi,
      '$1[已隐藏]',
    )
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[已隐藏凭证]')
    .replace(/\bsk-[a-zA-Z0-9_-]{12,}\b/g, '[已隐藏密钥]')
    .slice(0, 1600)
}
export function createNotifications() {
  let sequence = 0
  const state = reactive({
    entries: [] as Notice[],
    history: [] as Notice[],
    get visible(): Notice[] {
      return this.entries.slice(0, 3)
    },
    push(text: string, kind: NoticeKind = 'info', options: Options = {}) {
      if (!text) return 0
      text = safeFeedback(text)
      const details = safeFeedback(options.details ?? '')
      const duration =
        options.persistent || kind === 'progress'
          ? Infinity
          : kind === 'error'
            ? 8000
            : kind === 'review'
              ? 5000
              : 3000
      const old = this.entries.find((n) =>
        options.key ? n.key === options.key : n.text === text && n.kind === kind,
      )
      if (old) {
        Object.assign(old, {
          text,
          kind,
          details,
          remaining: duration,
          count: options.key ? 1 : old.count + 1,
        })
        const h = this.history.find((n) => n.id === old.id)
        if (h) Object.assign(h, { ...old })
        return old.id
      }
      const n: Notice = {
        id: ++sequence,
        text,
        kind,
        details,
        count: 1,
        remaining: duration,
        paused: false,
        key: options.key,
      }
      this.entries.push(n)
      if (this.entries.length > 60) this.entries.splice(0, this.entries.length - 60)
      this.history.unshift({ ...n })
      this.history.splice(30)
      return n.id
    },
    dismiss(id: number) {
      this.entries = this.entries.filter((n) => n.id !== id)
    },
    pause(id: number, value: boolean) {
      const n = this.entries.find((n) => n.id === id)
      if (n) n.paused = value
    },
    tick(ms: number) {
      const showing = new Set(this.visible.map((n) => n.id))
      this.entries = this.entries.filter((n) => {
        if (!n.paused && showing.has(n.id)) n.remaining -= ms
        return n.remaining > 0
      })
    },
  })
  return state
}
export const notifications = createNotifications()
export function notifyOperation(text: string, error = false, key?: string, persistent = false) {
  const critical = persistent || /保存|存档|读档|导入|读取|格式不兼容/.test(text)
  const technical = /^\s*\[?\s*\{|unrecognized_keys|ZodError|stack trace|^Error:/i.test(text)
  return notifications.push(
    technical ? '操作未完成，请展开详情查看原因' : text,
    error ? 'error' : /申请|待审|审核/.test(text) ? 'review' : 'success',
    { persistent: error && critical, details: technical ? text : '', key },
  )
}
