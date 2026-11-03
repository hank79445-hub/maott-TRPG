// crypto.getRandomValues works on trusted LAN HTTP too; randomUUID requires HTTPS in many browsers.
if (typeof crypto.randomUUID !== 'function') {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => {
      const data = crypto.getRandomValues(new Uint8Array(16))
      data[6] = (data[6]! & 15) | 64
      data[8] = (data[8]! & 63) | 128
      const h = Array.from(data, (n) => n.toString(16).padStart(2, '0')).join('')
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
    },
  })
}
