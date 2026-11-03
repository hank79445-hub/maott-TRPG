/** Explicitly reviewed UI presentation; business data is unchanged. */
export const inlineSummaryControls={
  "remaining": [
    "剩余 {p0} {p1}",
    "Remaining {p0} {p1}"
  ],
  "durationMinutes": [
    " · 持续 {p0} 分钟",
    " · Duration {p0} minutes"
  ],
  "itemsRemaining": [
    "{p0} 项待完成",
    "{p0} items remaining"
  ],
  "dieD": [
    "第{p0}颗d{p1}：{p2}",
    "Die {p0}, d{p1}: {p2}"
  ],
  "dieDRawValue": [
    "第{p0}颗d{p1}原始点数",
    "Die {p0}, d{p1} raw value"
  ],
  "roundFreePartyOrder": [
    "第 {p0} 轮 · 全队自由顺序",
    "Round {p0} · Free party order"
  ],
  "explorationRound": [
    "探索第 {p0} 轮",
    "Exploration round {p0}"
  ],
  "ft": [
    "{p0} 尺 · {p1}",
    "{p0} ft · {p1}"
  ],
  "ftAlias8": [
    "{p0} · {p1} 尺",
    "{p0} · {p1} ft"
  ],
  "cellDoorHoverToPreviewThenClickA": [
    "{p0}格{p1}门：悬停预览，点击一个起点加入草稿；保存后生效。",
    "{p0}-cell {p1} door: hover to preview, then click a starting point to add it to the draft. Takes effect after saving."
  ],
  "startSelectedClickTheEndpointToFinishThis": [
    "起点 ({p0},{p1}) 已选；点击终点完成一段，保存后生效。",
    "Start ({p0},{p1}) selected. Click the endpoint to finish this segment; takes effect after saving."
  ],
  "groupMarkerAwaitingConfirmation": [
    "待确认群标记：{p0}",
    "Group marker awaiting confirmation: {p0}"
  ],
  "target": [
    "{p0} · {p1} · 目标{p2}",
    "{p0} · {p1} · Target {p2}"
  ],
  "useTarget": [
    "使用{p0} · {p1} · 目标{p2}",
    "Use {p0} · {p1} · Target {p2}"
  ],
  "quickReviewPending": [
    "快捷审核，{p0} 项待处理",
    "Quick review, {p0} pending"
  ],
  "dTotal": [
    "d20 {p0}，总计 {p1}",
    "d20 {p0}, total {p1}"
  ],
  "spellRangeFtDashedOutline": [
    "施法射程 {p0} 尺（虚线框）",
    "Spell range {p0} ft (dashed outline)"
  ],
  "existsForUpToHours": [
    "存在最多{p0}小时",
    "Exists for up to {p0} hours"
  ],
  "controlledForHoursTheBodyRemainsAfterControl": [
    "；控制{p0}小时，过期不删除肉身",
    "; controlled for {p0} hours; the body remains after control expires"
  ],
  "itemsStillNeedCompletion": [
    "还有 {p0} 项需要完成",
    "{p0} items still need completion"
  ]
} as const
export const inlineSummaryZh=Object.fromEntries(Object.entries(inlineSummaryControls).map(([key,p])=>[key,p[0]]))
export const inlineSummaryEn=Object.fromEntries(Object.entries(inlineSummaryControls).map(([key,p])=>[key,p[1]]))
