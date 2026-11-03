/** Explicitly reviewed UI presentation; business data is unchanged. */
export const confirmationControls={
  "removeThisEncounterAndItsCombatRecordsCharacters": [
    "移除此遭遇及其战斗记录？角色将保留。",
    "Remove this encounter and its combat records? Characters will be kept."
  ],
  "restoreAllOfPartyHpInventoryResourcesScene": [
    "整体恢复“{p0}”？队伍生命、背包、资源、场景互动和遭遇将一起回到入场时，旧撤销会失效。",
    "Restore all of “{p0}”? Party HP, inventory, resources, scene interactions and encounters will return to their entry state. Previous undo records will become invalid."
  ],
  "unlinkingStopsDeliveryButKeepsRecordsExistingQq": [
    "解除群关联后停止投递，保留记录；已发群消息不会撤回。继续？",
    "Unlinking stops delivery but keeps records. Existing QQ group messages will not be recalled. Continue?"
  ],
  "checkTheActualQqGroupFirstRetryingCan": [
    "请先查看真实 QQ 群。重发可能产生重复消息，仍不会重新执行游戏行动。继续？",
    "Check the actual QQ group first. Retrying can duplicate messages, but will not repeat game actions. Continue?"
  ],
  "remove": [
    "移除 {p0} ×{p1}？",
    "Remove {p0} ×{p1}?"
  ],
  "undoTheMostRecentReversibleRuntimeOperationHp": [
    "撤销最近一项可撤销的运行时操作？生命、物品、金币和资源会一起恢复。",
    "Undo the most recent reversible runtime operation? HP, items, coins and resources will be restored together."
  ],
  "thereAreUnsyncedOrUnsubmittedChangesCloseThe": [
    "仍有未同步或未提交修改。关闭编辑？已缓存的草稿下次可恢复。",
    "There are unsynced or unsubmitted changes. Close the editor? Cached drafts can be restored next time."
  ],
  "loadingAnExampleReplacesTheCurrentAuthoringJson": [
    "载入示例将替换当前创作JSON。请先下载备份，是否继续？",
    "Loading an example replaces the current authoring JSON. Download a backup first. Continue?"
  ],
  "replaceThisAuthoringDraftWithTheExampleAnd": [
    "用示例替换当前创作草稿，并清除场景锁与替代图片？",
    "Replace this authoring draft with the example and clear scene locks and replacement images?"
  ],
  "permanentlyDeleteAndAllItsLibraryVersionsExisting": [
    "永久删除“{p0}”及库中全部版本？已创建的冒险与房间继续保留。",
    "Permanently delete “{p0}” and all its library versions? Existing adventures and rooms will be kept."
  ],
  "deleteTheSelectedSavedVersionDraftsAndExisting": [
    "删除所选保存版本？此操作不会删除草稿或既有开团实例。",
    "Delete the selected saved version? Drafts and existing campaign instances will be kept."
  ],
  "totalContextBudgetConservativeTokens": [
    "总上下文预算（保守 token）",
    "Total context budget (conservative tokens)"
  ],
  "outputTokenLimit": [
    "输出 token 上限",
    "Output token limit"
  ],
  "noAdditionalLimit": [
    "不额外设限",
    "No additional limit"
  ],
  "useProviderDefault": [
    "使用服务默认",
    "Use provider default"
  ],
  "notGenerated": [
    "未生成",
    "Not generated"
  ],
  "noImageAdopted": [
    "未采用图片",
    "No image adopted"
  ],
  "sourceMetadataMissingGmVerificationRequired": [
    "来源信息未携带，待GM核对",
    "Source metadata missing; GM verification required"
  ],
  "verifiedAndAdopted": [
    "已核对采用",
    "Verified and adopted"
  ],
  "backgroundNeedsGmCalibrationCheckTheGameplayLayout": [
    "背景待GM校准：请检查玩法布局后确认",
    "Background needs GM calibration: check the gameplay layout before confirming"
  ],
  "layoutOrBackgroundTransformChangedReviewRequired": [
    "布局或背景变换已变化，需要复核",
    "Layout or background transform changed; review required"
  ],
  "dialogueExemptionEnabled": [
    "分类免审已开启",
    "Dialogue exemption enabled"
  ],
  "disconnected": [
    "未连接",
    "Disconnected"
  ],
  "confirmRosterAndPrepareCombat": [
    "确认名单并准备战斗",
    "Confirm roster and prepare combat"
  ],
  "roomCreatedFromASavedScriptExplicitlyStart": [
    "已从保存剧本创建房间；请明确开始故事并进入场景",
    "Room created from a saved script; explicitly start the story and enter a scene"
  ],
  "onlyPublicIndividuallyAuthorizedFixedExplorationInteractionsWith": [
    "仅公开、逐点授权且无额外后果的固定探索互动；依据不足交GM。",
    "Only public, individually authorized fixed exploration interactions with no additional consequences; refer insufficient evidence to the GM."
  ]
,
"rosterCounts":["已选 {selected} 人 · 队伍方 {party}／敌对方 {enemy}／中立方 {neutral}","Selected {selected} · Party {party} / Enemy {enemy} / Neutral {neutral}"],
"changeEquipmentSlot":["更换{slot}","Change {slot}"],
"itemStackCaption":["{name} 等 {count} 件","{name} and others · {count} items"],
"playerCharacterKind":["玩家角色","Player character"],
"importantNpcKind":["重要 NPC","Important NPC"],
"unarmedStrike":["徒手打击","Unarmed Strike"],
"carriedItems":["随身","Carried"]} as const
export const confirmationZh=Object.fromEntries(Object.entries(confirmationControls).map(([key,p])=>[key,p[0]]))
export const confirmationEn=Object.fromEntries(Object.entries(confirmationControls).map(([key,p])=>[key,p[1]]))
