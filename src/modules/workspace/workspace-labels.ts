import { i18n } from '../../app/i18n'
const labels = {
  toolsWidth: ['工具侧栏宽度', 'Tool-sidebar width'],
  toolsHelp: [
    '九个界面共用；拖动侧栏边缘，或在这里调整。',
    'Shared by all nine tabs. Drag the sidebar edge or adjust here.',
  ],
  messagesWidth: ['消息侧栏宽度', 'Message-sidebar width'],
  messagesHelp: [
    '宽屏常驻消息栏独立调宽；缩屏自动恢复浮窗。',
    'Resize the docked message sidebar independently. Smaller screens use the message window.',
  ],
  resizeTools: ['调整工具侧栏宽度', 'Resize tool sidebar'],
  resizeMessages: ['调整消息侧栏宽度', 'Resize message sidebar'],
  toolNumber: ['工具侧栏宽度数值', 'Tool-sidebar width value'],
  messageNumber: ['消息侧栏宽度数值', 'Message-sidebar width value'],
  messageRail: ['消息侧栏', 'Message sidebar'],
} as const
export function workspaceText(key: keyof typeof labels) {
  return labels[key][i18n.global.locale.value === 'en' ? 1 : 0]
}
