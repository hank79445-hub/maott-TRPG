/** Explicitly reviewed UI presentation; business data is unchanged. */
export const finalFieldControls={
  "character": [
    "人物",
    "Character"
  ],
  "stableCorpseRecord": [
    "稳定遗体记录",
    "Stable corpse record"
  ],
  "selectAnObjectSLocationOnTheMap": [
    "在地图选择物件登记位置",
    "Select an object’s location on the map"
  ],
  "selectAConversationTargetOnTheMap": [
    "在地图选择交谈对象",
    "Select a conversation target on the map"
  ],
  "npcKnownInformationExistingFields": [
    "NPC 已知信息（既有字段）",
    "NPC known information (existing fields)"
  ],
  "publicWordingDraftAwaitingApplication": [
    "待应用的公开表达草稿",
    "Public wording draft awaiting application"
  ],
  "forSafePublicDialogueOnlyDoNotEnter": [
    "公开安全对话可用；请勿填写未公开秘密",
    "For safe public dialogue only; do not enter unrevealed secrets"
  ],
  "publicRoleplayingSummary": [
    "公开扮演摘要",
    "Public roleplaying summary"
  ],
  "personalKnowledge": [
    "本人认知内容",
    "Personal knowledge"
  ],
  "sourceEvidence": [
    "来源／依据",
    "Source / evidence"
  ],
  "directorSNotes": [
    "导演资料",
    "Director’s notes"
  ],
  "notSentToNpcModelsOrIncludedIn": [
    "不会发送给NPC模型，不进入生图包",
    "Not sent to NPC models or included in image packages"
  ],
  "reasonsAndCurrentInterests": [
    "缘由与当前利益",
    "Reasons and current interests"
  ],
  "eventsThatCouldChangeRelationships": [
    "可能改变关系的事件",
    "Events that could change relationships"
  ],
  "builtInCustomTemplates": [
    "内置与自定义模板",
    "Built-in & custom templates"
  ],
  "copyAnExistingOrdinaryNpcConfiguration": [
    "复制已有普通NPC配置",
    "Copy an existing ordinary NPC configuration"
  ],
  "adjustPublicMapHeight": [
    "调整公开地图高度",
    "Adjust public map height"
  ],
  "selectAReservedPassageCellOnTheMap": [
    "在地图选择保留通道格",
    "Select a reserved passage cell on the map"
  ],
  "npcSource": [
    "NPC来源",
    "NPC source"
  ],
  "stageNotesAuthorAndGmMaterial": [
    "阶段说明（创作与GM资料）",
    "Stage notes (author and GM material)"
  ],
  "completeDesign": [
    "完整设计内容",
    "Complete design"
  ],
  "noAdditionalAction": [
    "无需额外动作",
    "No additional action"
  ],
  "adventurer": [
    "冒险者",
    "Adventurer"
  ],
  "characterAbility": [
    "角色能力",
    "Character ability"
  ],
  "levelSpellSlot": [
    "一级法术位",
    "Level-1 spell slot"
  ],
  "ritualOutsideCombat": [
    "仪式（战斗外）",
    "Ritual (outside combat)"
  ],
  "possess": [
    "持有",
    "Possess"
  ],
  "notConsumedOnUse": [
    "使用不消耗",
    "Not consumed on use"
  ],
  "consumedOnSuccess": [
    "成功时消耗",
    "Consumed on success"
  ],
  "awaitingGmReview": [
    "待 GM 审核",
    "Awaiting GM review"
  ],
  "approved": [
    "已批准",
    "Approved"
  ],
  "playerRequestsHelp": [
    "玩家请求帮助",
    "Player requests help"
  ],
  "playerRefusesOffends": [
    "玩家拒绝／冒犯",
    "Player refuses / offends"
  ],
  "characterSInterestsAreThreatened": [
    "人物利益受威胁",
    "Character’s interests are threatened"
  ],
  "standardArray": [
    "标准数组",
    "Standard array"
  ],
  "pointBuy": [
    "27 点购点",
    "27-point buy"
  ],
  "dDropTheLowest": [
    "4d6 去最低",
    "4d6, drop the lowest"
  ]
} as const
export const finalFieldZh=Object.fromEntries(Object.entries(finalFieldControls).map(([key,p])=>[key,p[0]]))
export const finalFieldEn=Object.fromEntries(Object.entries(finalFieldControls).map(([key,p])=>[key,p[1]]))
