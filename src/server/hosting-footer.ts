export function hostingFooter(record: string) {
  if (!record) return ''
  const text = record.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
  return `<footer class="trpg-hosting-footer"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">${text}</a></footer>`
}
export const footerStyle =
  '.trpg-hosting-footer{padding:18px;text-align:center;font:14px/1.6 system-ui,sans-serif}.trpg-hosting-footer a{color:inherit}'
