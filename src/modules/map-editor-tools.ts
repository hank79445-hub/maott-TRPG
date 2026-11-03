export const EDITOR_TOOL_NAMES = {
  select: '选择',
  move: '移动棋子',
  path: '路径',
  rect: '框选',
  brush: '笔刷',
  point: '放置互动点',
  annotation: '放置名称',
  measure: '测距',
  grid: '网格对齐',
  wall: '绘制墙体',
  door: '绘制门段',
  sight: '视线检测',
} as const
export type MapPanelTool = keyof typeof EDITOR_TOOL_NAMES
