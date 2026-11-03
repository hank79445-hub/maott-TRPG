/** Explicitly reviewed UI presentation; business data is unchanged. */
export const tableLabelControls={
  "placeInteraction": [
    "放置互动点",
    "Place interaction"
  ],
  "alignGrid": [
    "网格对齐",
    "Align grid"
  ],
  "highGround": [
    "高点",
    "High ground"
  ],
  "impassable": [
    "禁止通行",
    "Impassable"
  ],
  "hazardousArea": [
    "危险区域",
    "Hazardous area"
  ],
  "entrance": [
    "入口",
    "Entrance"
  ]
} as const
export const tableLabelZh=Object.fromEntries(Object.entries(tableLabelControls).map(([key,p])=>[key,p[0]]))
export const tableLabelEn=Object.fromEntries(Object.entries(tableLabelControls).map(([key,p])=>[key,p[1]]))
