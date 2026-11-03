/** Reviewed adjudication guidance; no rule, cost or authorization change. */
export const adjudicationControls={
  "theSystemRecordsActualResourcesRulesDiceAnd": [
    "系统记录真实资源、规则骰与持续来源；移动、场景物件及未自动处理的触发结果由 GM 按本能力条文结算。检定前能力必须先登记。",
    "The system records actual resources, rules dice and ongoing sources. The GM resolves movement, scene objects and unautomated triggers under this ability’s rules. Register the ability before the check."
  ],
  "restoresRoomCharactersAndNpcsHpResourcesInventory": [
    "所有房间角色与 NPC 的生命、资源、背包、金币，以及场景、互动点、效果和游戏时间都会恢复。准备后新增的角色、NPC 和背景资产会移除；成员权限和模型配置保留。旧广播与已结束历史保留，旧意图和 AI 任务失效。",
    "Restores room characters’ and NPCs’ HP, resources, inventory and coins, plus scenes, interactions, effects and game time. Removes characters, NPCs and backgrounds added after preparation. Member permissions and model configuration remain. Old broadcasts and completed history remain; old intents and AI tasks become invalid."
  ],
  "theAdditionalD4For0508IsSaved": [
    "05–08 的追加 d4 已保存，选择二元魔冢／呋噜／单元魔冢／独角兽对应的数据。以下数值为自定义占位，GM 须按数据卡填写；不重新掷浪涌，不花第二次法术位。生物独立先攻、由 GM 操控，使用原结果的一分钟期限。",
    "The additional d4 for 05–08 is saved. Choose the corresponding Duodrone, Flumph, Monodrone or Unicorn data. Values below are custom placeholders for the GM to fill from the stat block. Do not reroll the surge or spend another slot. The creature has its own initiative, is GM-controlled and retains the original one-minute duration."
  ],
  "theGmVerifiesRoutesIllusionHazardsAndDistances": [
    "路线、幻象的危险／距离、自然语言活动与目击条件须GM核对；真实骰值、动作和伤害仍由服务器结算。幻象不生成真正障碍，诚实之域不自动识谎。",
    "The GM verifies routes, illusion hazards and distances, natural-language activities and witnessing conditions. The server still resolves actual dice, actions and damage. Illusions create no physical barriers; Zone of Truth does not automatically detect lies."
  ],
  "chooseASpecificActionAndPublicTargetRoll": [
    "选择具体行动和公开目标。GM 确认名单与突袭条件后掷先攻，轮到你时再次确认执行；请求不扣资源、不掷伤害。已确认的75项辅助法术不在此申请开场，请使用地图普通／专用探索施法；控制和伤害类仍沿用原策略。",
    "Choose a specific action and public target. Roll initiative after the GM confirms the roster and surprise conditions, then confirm execution on your turn. Requests spend no resources and roll no damage. The 75 designated utility spells use ordinary or dedicated exploration casting on the map; control and damage spells retain their existing policy."
  ],
  "acidAlchemistSFireAndHolyWaterUse": [
    "强酸、炽火胶与圣水按 2024 规则自动处理；其他物品的动作、射程和效果由 GM 按原文明确裁定。攻击物体可在说明中写明，由 GM 在探索中处理。",
    "Acid, Alchemist’s Fire and Holy Water use automatic 2024 rules. The GM explicitly adjudicates other items’ actions, range and effects from their text. Describe object attacks for GM handling during exploration."
  ],
  "startExplorationRoundsAndIncludeTheSourceAnd": [
    "需要回合预算的动作请先开启探索回合，并将来源／受术者加入名单。敌对攻击转入战斗与先攻；不能用此面板凭文字制造攻击结果。假死不代表真正死亡，暗示不允许任意改卡或花费资源。",
    "Start exploration rounds and include the source and recipient before budgeted actions. Hostile attacks use combat and initiative. This panel cannot create attack outcomes from text. Feign Death is not actual death; Suggestion does not permit arbitrary character edits or resource spending."
  ],
  "characterHeldObjectsActuallyDropDuringMapResolution": [
    "角色持有物在地图结算时实际落地；无物品实例的普通NPC持有物由GM核对。安全路线不由模型猜测，记录只适用于当前回合。",
    "Character-held objects actually drop during map resolution. The GM verifies ordinary-NPC possessions without item instances. The model does not guess safe routes; records apply to the current turn only."
  ],
  "registerActualObjectsWithSceneSpatialToolsThis": [
    "实际物件由场景空间工具登记。此处只确认事实与已施放实例，不凭空创造物品、法术位或知识。长时间施法确认表示连续施法已完成。",
    "Register actual objects with scene spatial tools. This panel confirms facts and existing cast instances only; it creates no items, spell slots or knowledge. Confirming a long casting means continuous casting has finished."
  ],
  "newDeathsAutomaticallyRecordGameTimeTheGm": [
    "新死亡自动记录游戏时间。旧遗体无可靠时间时须GM核对；回生不恢复缺失肢体。核对年龄不能早于当前游戏时钟，必要时先明确推进冒险时间。",
    "New deaths automatically record game time. The GM must verify legacy remains with unknown timing. Revivify does not restore missing limbs. Age verification cannot precede the current game clock; explicitly advance adventure time first if needed."
  ],
  "generatedFromActualAurasDisguisedTypesAndDetection": [
    "按实际灵光、类型伪装与回避侦测生成。仍须核实法术范围、障碍材质与感知资格；不代表真实生物类型改变，也不自动发布。",
    "Generated from actual auras, disguised types and detection avoidance. Still verify spell range, barrier materials and perception eligibility. This does not change actual creature type or publish automatically."
  ],
  "theBudgetIncludesInputOutputAndWrapperOverhead": [
    "预算含输入、输出与封装余量，按 UTF-8 字节保守估算。旧记录可裁剪，必要身份／权限／固定记忆超限会停止调用。",
    "The budget includes input, output and wrapper overhead, conservatively estimated from UTF-8 bytes. Older records may be trimmed. Calls stop if required identity, permissions or fixed memories exceed the budget."
  ],
  "savingDoesNotCallAModelValidateSelected": [
    "保存不调用模型；“验证选中配置”发送不含游戏内容的测试请求，结果见任务列表，调用计入用量。密钥只在后端保存，不进入导出文件。模型库最多20套。",
    "Saving does not call a model. Validate selected configuration sends a test without game content; results appear in tasks and count toward usage. Keys remain on the backend and are excluded from exports. Maximum 20 model configurations."
  ],
  "conditionChecksDoNotCallAModelDraft": [
    "条件检查不调用模型；测试草稿计入用量，仅 GM 可见，禁止发布、执行或写入记忆／好感度。不会占正式冷却或挡住 NPC 回合。",
    "Condition checks do not call a model. Draft tests count toward usage, are GM-only and cannot publish, execute or update memory or affinity. They neither consume normal cooldown nor block NPC turns."
  ],
  "buildsTestAssumptionsFromConfiguredStoryLinksOr": [
    "使用配置的剧情关联或健康结果构造测试假设，实际房间状态保持。仍检查开关、感知、交谈范围、忙碌与冷却；解救等模板须先关联互动点。",
    "Builds test assumptions from configured story links or health outcomes without changing room state. Still checks switches, perception, conversation range, busy state and cooldown. Rescue and similar templates require an interaction link first."
  ],
  "publicDescriptionsKnowledgeBelowAndAuthorizedPublicExperiences": [
    "公开描述、以下知识及授权公开经历会进入免审输入。原性格、目标、SKILL、已知信息、秘密和 GM 备注不会自动复制。",
    "Public descriptions, knowledge below and authorized public experiences enter review-exempt input. Existing personality, goals, SKILL, known information, secrets and GM notes are not automatically copied."
  ],
  "editTheAuthorSInitialConfigurationForCopying": [
    "这里编辑作者初始设定，供复制或新开团使用；实际经历与当前关系在 GM 运行记忆面板管理。固定记忆优先保留，不能装入模型预算时会提示。",
    "Edit the author’s initial configuration for copying or new games here. Manage actual experiences and current relationships in GM runtime memory. Fixed memories have priority; a warning appears if they cannot fit the model budget."
  ],
  "spendsTheMonsterStatBlockSBudgetAnd": [
    "按怪物数据块扣预算／次数，不使用玩家法术位。范围、GM能力及特殊移动需确认；自动结算能力仍在原伤害／效果窗口完成。",
    "Spends the monster stat block’s budget and uses, not player spell slots. Confirm areas, GM abilities and special movement. Automatic abilities still resolve in the original damage or effect window."
  ],
  "abilitySourcesRemainInTheDataSnapshotEdits": [
    "能力来源保留在数据快照；修改以下内容是GM自定义调整。不能把尚未支持的效果改成自动实现。运行中次数在战斗桌管理。",
    "Ability sources remain in the data snapshot. Edits below are GM custom adjustments and cannot make unsupported effects automatic. Manage runtime uses at the combat table."
  ],
  "theGmVerifiesSkillsSpecialMovementAndSenses": [
    "技能、特殊移动及感官资料由GM核对；不得据此自动穿墙或探知隐藏单位。需GM处理的特殊能力应在结束回合前完成裁定。",
    "The GM verifies skills, special movement and senses. These do not automatically allow passing through walls or detecting hidden units. Adjudicate GM-managed special abilities before ending the turn."
  ],
  "protectionMustBeApprovedBeforeTheTriggeringAttack": [
    "守护须在触发攻击掷骰前获批。之后每次攻击检查保护者仍在 5 尺内；地图自动核对，单独战斗桌由 GM 勾选环境条件。",
    "Protection must be approved before the triggering attack roll. Each later attack checks that the protector remains within 5 ft. The map checks automatically; the GM confirms environmental conditions at the standalone combat table."
  ],
  "successTriggersOnlyAfterTheFirstOpeningSolution": [
    "成功只在首次打开／解决／解除后触发；失败需有本次失败检定。多步机关在最终步骤配置。标签不自动治疗、移动或改变阵营。",
    "Success triggers only after the first opening, solution or disarming. Failure requires this attempt’s failed check. Configure multistep mechanisms at their final step. Labels do not automatically heal, move or change sides."
  ],
  "oneRowPerBotDedicatedAndSharedModes": [
    "每个Bot一行。专用与共享互斥；共享可同时负责重要与普通NPC。切换模式时先清空原选择。已被其他Bot分配的NPC不可重复选择。",
    "One row per Bot. Dedicated and shared modes are exclusive; shared Bots can serve important and ordinary NPCs together. Clear existing selections before switching modes. NPCs assigned to another Bot cannot be selected again."
  ],
  "enabledByDefaultInNewRoomsExistingRoom": [
    "新房间默认开启；旧房间当前开关、暂停和NPC明确人工审稿设置均保留。未配置策略的重要NPC改为继承房间类别；不会自动发布旧积压回复。",
    "Enabled by default in new rooms. Existing room switches, pauses and explicit NPC manual-review settings remain. Important NPCs without a policy inherit room categories. Old queued replies are not automatically published."
  ],
  "appliesToPublicPlayerDialogueOnWebAnd": [
    "Web／QQ玩家公开对话均适用。NPC 可继承、自定义或始终审核；检定、秘密、交易、承诺及行动独立审核。普通 NPC 使用固定台词，不调用分类模型。",
    "Applies to public player dialogue on Web and QQ. NPCs may inherit, customize or always require review. Checks, secrets, trades, commitments and actions are reviewed separately. Ordinary NPCs use fixed dialogue without a classification call."
  ],
  "commandSyntaxRemainsChineseXYZeroBased": [
    "行动 移动 x,y（从 0 开始）；行动 攻击 目标 使用 武器；行动 施法 来源编号 模式 模式编号 目标 目标编号 [敌对]；行动 使用 药水；行动 结束回合。",
    "Command syntax remains Chinese: 行动 移动 x,y (zero-based); 行动 攻击 <target> 使用 <weapon>; 行动 施法 <source-ID> 模式 <mode-ID> 目标 <target-ID> [敌对]; 行动 使用 <potion>; 行动 结束回合."
  ],
  "writeAchievableSuccessAndFailureConsequencesFirstAuthorization": [
    "先写可兑现的成功与失败后果。此处授权不自动启用房间策略；没有适用规则时仍交GM。模型只选现有结果，不生成奖励、人物或权限。",
    "Write achievable success and failure consequences first. Authorization here does not enable the room policy automatically. Without an applicable rule, defer to the GM. The model selects existing outcomes, not new rewards, people or permissions."
  ],
  "enemySide": [
    "敌对方",
    "Enemy side"
  ],
  "neutralSide": [
    "中立方",
    "Neutral side"
  ],
  "executesOnlyWithTheCorrespondingRoomPolicyEnabled": [
    "只有房间对应策略已启用时执行。先冻结名单，再投先攻；玩家的先攻能力与交换须本人选择。增援不重掷旧成员；“无攻击目标”不是胜利条件。",
    "Executes only with the corresponding room policy enabled. Freeze the roster before initiative. Players choose their own initiative abilities and swaps. Reinforcements do not reroll existing members. No attack target is not a victory condition."
  ],
  "dedicatedCastingRemainsObjectsAndProtection": [
    "专用法术申请 · 遗体、物件与防护",
    "Dedicated casting · Remains, objects and protection"
  ],
  "registerActualMaterialsAndRemainsFactsFirstObtain": [
    "实际材料和遗体事实须已登记。受术者同意另行取得；战斗中保留反制与原资源结算。",
    "Register actual materials and remains facts first. Obtain recipient consent separately. Combat retains counterspells and normal resource resolution."
  ],
  "notRequiredAwaitingGmRegistration": [
    "不需要／待GM登记",
    "Not required / awaiting GM registration"
  ],
  "requestCasting": [
    "申请施法",
    "Request casting"
  ],
  "waitingForAllPhysicalDiceInTheOriginal": [
    "正在等待原模式的完整实体骰，不重复选择或施法。",
    "Waiting for all physical dice in the original mode. Do not select or cast again."
  ],
  "theControllerChoosesWhetherToUseTheActual": [
    "本人可选择是否使用实际魔宠反应；未送达或离线不计时。",
    "The controller chooses whether to use the actual familiar reaction. Undelivered or offline requests have no running timeout."
  ],
  "useInkCloudReaction": [
    "使用墨云反应",
    "Use Ink Cloud reaction"
  ],
  "declineThisReaction": [
    "放弃本次反应",
    "Decline this reaction"
  ],
  "chooseActualMapCoordinatesExistingRulesRecheckRange": [
    "按实际地图坐标选择，原机制复核范围、空位、支撑及伤害。必要落点不会因超时跳过；坠落可先使用合法羽落反应。",
    "Choose actual map coordinates. Existing rules recheck range, vacancy, support and damage. Required destinations are not skipped on timeout. Falling permits a legal Feather Fall reaction first."
  ],
  "confirmDestinationAndResolve": [
    "确认落点并结算",
    "Confirm destination and resolve"
  ],
  "consentThisTime": [
    "同意本次",
    "Consent this time"
  ],
  "beginContinuousCastingEndsExistingConcentration": [
    "开始连续施法（结束原专注）",
    "Begin continuous casting (ends existing concentration)"
  ],
  "cancelContinuousCasting": [
    "取消连续施法",
    "Cancel continuous casting"
  ],
  "keepsOriginalInitiativeDiceAlertSwapsRequireThe": [
    "保留原先攻骰。警觉交换须对方同意；同值顺序可以调整。完成选择后继续开战。",
    "Keeps original initiative dice. Alert swaps require the other participant’s consent; tied order can be adjusted. Finish selections to start combat."
  ],
  "heroicInspirationReroll": [
    "英雄激励重掷",
    "Heroic Inspiration reroll"
  ],
  "placeBeforeThisParticipant": [
    "排在其前",
    "Place before this participant"
  ],
  "requestSwap": [
    "申请交换",
    "Request swap"
  ],
  "acceptSwap": [
    "同意交换",
    "Accept swap"
  ],
  "finishKeepCurrentInitiative": [
    "完成／保持当前先攻",
    "Finish / keep current initiative"
  ],
  "finishSelectionsDeclineRemainingOptions": [
    "完成选择／放弃其余选项",
    "Finish selections / decline remaining options"
  ],
  "enabledSeparatelyForThisRoomSubjectToManual": [
    "本房间单独启用，仍服从上方真人／影子／辅助模式及暂停开关。公开文本不再二次语义审稿；实际操作须满足规则和逐项授权。影子模式只记录建议。",
    "Enabled separately for this room, subject to manual, shadow or assisted mode and pause settings above. Public text does not receive a second semantic review. Actual operations require rules compliance and individual authorization. Shadow mode records suggestions only."
  ],
  "proactive": [
    "积极",
    "Proactive"
  ],
  "savingPolicyDoesNotSwitchReviewModeRemove": [
    "保存策略不会切换审核模式、放开NPC的明确限制、补骰或执行积压任务。缺事实、超授权及不支持机制继续交GM。购买仍须玩家确认最新报价。",
    "Saving policy does not switch review mode, remove explicit NPC limits, fill missing dice or execute queued tasks. Missing facts, excess authorization and unsupported mechanics remain with the GM. Players must still confirm current purchase offers."
  ],
  "confirmAndSavePolicy": [
    "确认保存策略",
    "Confirm and save policy"
  ],
  "confirmationUpdatesTheObjectiveWithoutAutomaticallyGrantingRewards": [
    "确认后更新小目标；不会自动发奖或升级。后续步骤只按已配置的激活选项推进。",
    "Confirmation updates the objective without automatically granting rewards or levels. Subsequent steps advance only under configured activation options."
  ],
  "confirmCompletion": [
    "确认完成",
    "Confirm completion"
  ],
  "assistedReviewBasis": [
    "辅助审核依据",
    "Assisted-review basis"
  ],
  "gmTakeover": [
    "GM接管",
    "GM takeover"
  ],
  "sendForAssistedReview": [
    "送辅助审核",
    "Send for assisted review"
  ],
  "shadowReviewSuggestionsOnly": [
    "影子审核（只给建议）",
    "Shadow review (suggestions only)"
  ],
  "assistedReviewLimitedExecution": [
    "辅助审核（受限执行）",
    "Assisted review (limited execution)"
  ],
  "theReviewModelIsNotReadyModelDependent": [
    "审核模型未就绪，模型事项交GM；纯程序项仅按已授权范围处理。",
    "The review model is not ready. Model-dependent matters go to the GM; program-only operations stay within their authorized scope."
  ],
  "onlyNewRequestsEnterThisChannelSendQueued": [
    "仅后续新申请进入通道；积压项需逐条送审。首次建议影子模式。战斗结算、反应、奖励和秘密仍交GM；暂停不影响手动处理。",
    "Only new requests enter this channel; send queued items individually. Start with shadow mode. Combat resolution, reactions, rewards and secrets remain with the GM. Pausing does not prevent manual handling."
  ],
  "settingsBelongToThisRoomEnableThemSeparately": [
    "设置属于当前房间，新剧本创建的新房间需单独启用；不会从其他房间自动复制审核权限或密钥。",
    "Settings belong to this room. Enable them separately in rooms created from new scripts. Review permissions and keys are not copied from other rooms automatically."
  ],
  "categoriesModelAndReviewPolicy": [
    "类别、模型与审核规范",
    "Categories, model and review policy"
  ],
  "individuallyAuthorizedInteractions": [
    "已逐点授权的互动清单",
    "Individually authorized interactions"
  ],
  "categoryExemptionsAndIndependentAiReviewWorkSeparately": [
    "分类免审与独立AI审稿分别生效。关闭分类免审仍可使用AI审稿；NPC明确设为人工审核时仍交GM。旁白审稿仅处理已确认公开事实；通过后遵循旁白自动发布设置，非公开旁白及失败事项进入快速审核。",
    "Category exemptions and independent AI review work separately. AI review remains available with category exemptions off; explicit manual NPC review still goes to the GM. Narration review covers confirmed public facts only. Approved narration follows auto-publication settings; private narration and failures enter quick review."
  ],
  "checksPublicDialogueOnlyActionProposalsRemainWith": [
    "仅核对公开台词；行为提议仍交GM。跟随、参战、交易、资源、秘密及战斗结果不自动批准。普通NPC固定台词、直接移动不增加审核调用。",
    "Checks public dialogue only; action proposals remain with the GM. Following, combat entry, trades, resources, secrets and combat outcomes are not automatically approved. Ordinary-NPC fixed dialogue and direct movement add no review calls."
  ],
  "npcReviewRecordsTimingAndManualReferralReasons": [
    "NPC审稿记录、耗时及转人工原因显示在对应会话与快速审核中；下方记录为固定互动审核。",
    "NPC review records, timing and manual-referral reasons appear in the conversation and quick review. Records below cover fixed interactions."
  ],
  "existingDefaultModel": [
    "现有默认模型",
    "Existing default model"
  ],
  "manageModelsInAiConfigurationProgramOnlyPaths": [
    "模型在AI配置中管理。纯程序路径不调用模型；影子及模型路径需可用模型，否则转GM。",
    "Manage models in AI configuration. Program-only paths make no model calls. Shadow and model paths require an available model or defer to the GM."
  ],
  "alsoAuthorizeTheMapInteractionAndFillIts": [
    "需同时在地图互动点勾选授权并填写固定结果。更改设置会将正在处理的旧版本申请交回GM。",
    "Also authorize the map interaction and fill its fixed outcomes. Changing settings returns in-progress requests using the old version to the GM."
  ],
  "saveAssistedReviewSettings": [
    "保存辅助审核设置",
    "Save assisted-review settings"
  ],
  "noRecordsYet": [
    "暂无记录。",
    "No records yet."
  ],
  "markSuggestionIncorrect": [
    "标记建议错误",
    "Mark suggestion incorrect"
  ],
  "markInsufficientBasis": [
    "标记依据不足",
    "Mark insufficient basis"
  ],
  "containsCustomItemsGmAdjustmentsOrExpandedRule": [
    "包含自定义物品、GM 调整或扩展规则包，请检查角色明细。",
    "Contains custom items, GM adjustments or expanded rule packs. Check character details."
  ],
  "rulePacksAndSubmissionSnapshot": [
    "规则包与提交快照",
    "Rule packs and submission snapshot"
  ],
  "keepsSubmittedHpResourcesConditionsAndInventoryBy": [
    "默认保留提交时的生命、资源、状态和背包。初始化保留建角配置、装备与物品；批准后创建独立副本并分配给提交者，队伍与入场由 GM 安排。",
    "Keeps submitted HP, resources, conditions and inventory by default. Initialization retains build, equipment and items. Approval creates an independent copy assigned to the submitter. The GM arranges party and scene entry."
  ],
  "approveCharacterEntry": [
    "批准角色入房",
    "Approve character entry"
  ],
  "rejectCharacterRequest": [
    "拒绝角色申请",
    "Reject character request"
  ],
  "theSubmitterSPermissionWasRevokedThisRequest": [
    "提交者权限已撤销，可拒绝该申请。",
    "The submitter’s permission was revoked. This request may be rejected."
  ],
  "withdrawCharacterRequest": [
    "撤回角色申请",
    "Withdraw character request"
  ],
  "chooseACompletedCharacterFromThisBrowserS": [
    "选择当前浏览器工坊中已完成的角色，提交快照供 GM 审核。批准后分配控制权；队伍与场景位置由 GM 配置。",
    "Choose a completed character from this browser’s workshop and submit its snapshot for GM review. Approval assigns control; the GM configures party membership and scene position."
  ],
  "noCompletedPlayerCharactersYet": [
    "暂无已完成玩家角色",
    "No completed player characters yet"
  ],
  "submitCharacterToGm": [
    "提交角色给 GM",
    "Submit character to GM"
  ],
  "openCharacterWorkshop": [
    "前往角色工坊",
    "Open character workshop"
  ],
  "thisCharacterIsPendingReviewOrAlreadyIn": [
    "此角色已待审或已带入房间。待审时可先撤回，再提交新快照。",
    "This character is pending review or already in the room. Withdraw a pending request before submitting a new snapshot."
  ],
  "noCharacterRequestsYet": [
    "暂无角色申请。",
    "No character requests yet."
  ],
  "message1Hour": [
    "1小时",
    "1 hour"
  ],
  "message24Hours": [
    "24小时",
    "24 hours"
  ],
  "message3Days": [
    "3天",
    "3 days"
  ],
  "message7Days": [
    "7天",
    "7 days"
  ],
  "generateResetInvitationCode": [
    "生成／重置邀请码",
    "Generate / reset invitation code"
  ],
  "extendEnable": [
    "延长／启用",
    "Extend / enable"
  ],
  "disableNewInvitations": [
    "停用新邀请",
    "Disable new invitations"
  ],
  "enableDisableLanEntryOnTheGmHost": [
    "在 GM 主机开启／关闭局域网入口",
    "Enable / disable LAN entry on the GM host"
  ],
  "refreshEntryAddresses": [
    "刷新入口",
    "Refresh entry addresses"
  ],
  "openTheLocalAdministrationPageOnTheGm": [
    "仅在 GM 电脑打开本机管理页。核心玩法可断网使用；QQ 与模型需要外部连接。",
    "Open the local administration page on the GM computer only. Core play works without internet; QQ and models require external connectivity."
  ],
  "copyJoinLink": [
    "复制加入链接",
    "Copy join link"
  ],
  "shareWithParticipantsItContainsNoGmOr": [
    "可交给参与者；不包含 GM 或成员身份。局域网新玩家须等待批准。",
    "Share with participants; it contains no GM or member identity. New LAN players must await approval."
  ],
  "approveAsPlayer": [
    "批准为玩家",
    "Approve as player"
  ],
  "backupEntryMyRoomIdentity": [
    "备用入口 · 本人房间身份",
    "Backup entry · My room identity"
  ],
  "afterChangingAddressesLogIntoTheTestAccount": [
    "换网址后先登录测试账号，再恢复本人身份，可接回原房间与角色。请提前保存；身份文件等同房间钥匙，仅本人私下保管，不发到群。",
    "After changing addresses, log into the test account and restore your identity to reconnect to your room and character. Save it beforehand. The identity file is a room key: keep it private and do not post it to the group."
  ],
  "saveMyRoomIdentity": [
    "保存本人房间身份",
    "Save my room identity"
  ],
  "restoreMyRoomIdentity": [
    "恢复本人房间身份",
    "Restore my room identity"
  ],
  "factsSuppliedRecheckOriginalRequest": [
    "事实已补齐，重新核验原申请",
    "Facts supplied; recheck original request"
  ],
  "actor": [
    "行动者：",
    "Actor:"
  ],
  "actionAndSource": [
    "行动与来源：",
    "Action and source:"
  ],
  "expectedCost": [
    "预计消耗：",
    "Expected cost:"
  ],
  "targetIsFixedToSelf": [
    "目标固定为自身。",
    "Target is fixed to self."
  ],
  "environmentAndTriggersForThisRuling": [
    "本次裁定的环境与触发条件",
    "Environment and triggers for this ruling"
  ],
  "theMapStillCalculatesDistanceAndHighGround": [
    "地图继续计算距离与高点。此处确认视线、掩护、触发和范围；通过时保存为房间默认环境。",
    "The map still calculates distance and high ground. Confirm sight, cover, triggers and area here. Approval saves these as room environmental defaults."
  ],
  "areaOriginAndPropagationRuling": [
    "本次范围原点与传播裁定",
    "Area origin and propagation ruling"
  ],
  "thisTemplateAppliesWithApprovalEditingItsPreview": [
    "本次模板随审批一并应用；编辑预览不改变世界版本、不掷骰或消耗资源。",
    "This template applies with approval. Editing its preview changes no world revision, rolls no dice and spends no resources."
  ],
  "createAreaTemplateForThisEffect": [
    "按本次效果建立范围模板",
    "Create area template for this effect"
  ],
  "thisPreviewsConditionsAndCostsOnlyNoDice": [
    "这是条件与消耗预览，没有实际掷骰或扣除资源。执行时服务端会再次校验全部规则。",
    "This previews conditions and costs only: no dice are rolled and no resources spent. The server rechecks all rules during execution."
  ],
  "approveAndExecute": [
    "审核通过并执行",
    "Approve and execute"
  ],
  "copyUnavailabilityReasonsIntoReviewNotes": [
    "将不能执行原因填入审核说明",
    "Copy unavailability reasons into review notes"
  ],
  "viewActionDetails": [
    "查看具体行动数据",
    "View action details"
  ],
  "aiNarrationSkillAndQqAreOptionalOpening": [
    "AI、旁白SKILL与QQ是可选服务。进入地图不会改变现有模型或QQ设置；不使用这些服务也能由真人GM主持。",
    "AI, narration SKILL and QQ are optional. Opening the map changes no model or QQ settings. A human GM can host without these services."
  ],
  "latestSubmissionTiming": [
    "最近提交耗时",
    "Latest submission timing"
  ],
  "lineOfSight": [
    "视线",
    "Line of sight"
  ],
  "targetPropagation": [
    "目标传播",
    "Target propagation"
  ],
  "rulesPp1718": [
    "规则 p.17–18",
    "Rules pp.17–18"
  ],
  "rulesP183": [
    "规则 p.183",
    "Rules p.183"
  ],
  "rulesP179": [
    "规则 p.179",
    "Rules p.179"
  ],
  "rulesPp68": [
    "规则 p.6–8",
    "Rules pp.6–8"
  ],
  "sanctuaryWisdomSaveFailedChooseAnotherTarget": [
    "庇护术：感知豁免失败，重选目标",
    "Sanctuary: Wisdom save failed; choose another target"
  ],
  "spendNoAdditionalActionOrSpellSlotThe": [
    "无需再次消耗行动或法术位。同一施法中不能重复选择已阻止的目标刷豁免；直接确认结算将放弃被阻止的部分。",
    "Spend no additional action or spell slot. The same casting cannot repeatedly select blocked targets for new saves. Confirming resolution directly declines the blocked portion."
  ],
  "chooseAReplacementTarget": [
    "请选择替代目标",
    "Choose a replacement target"
  ],
  "confirmReplacementTarget": [
    "确认重选此目标",
    "Confirm replacement target"
  ],
  "actualRecipientAndInitialAttack": [
    "实际受术与初始攻击",
    "Actual recipient and initial attack"
  ],
  "requiresAnActualFreeHandCreationIncludesNo": [
    "需要真实空手；创建不附带攻击。后续魔法动作攻击，放下后可用附赠动作重新唤出。",
    "Requires an actual free hand. Creation includes no attack. Later attacks use the Magic action; summon it again with a Bonus Action after dropping it."
  ],
  "theGmMustFirstRegisterActualManufacturedMetal": [
    "先由GM在下方登记真实人造金属与接触者；攻击物件不等于凭名称假定金属。",
    "The GM must first register actual manufactured metal and its contacts below. Attacking an object does not establish that it is metal from its name."
  ],
  "chooseADestinationWithin60FtTheInitial": [
    "选一个60尺内落点，初始可攻击武器5尺内目标；这是专注法术效应，不生成生物。",
    "Choose a destination within 60 ft. The initial attack may target a creature within 5 ft of the weapon. This is a concentration spell effect, not a creature."
  ],
  "followUpSpellAbilitiesAndActualEquipment": [
    "后续法术能力与实际装备",
    "Follow-up spell abilities and actual equipment"
  ],
  "transferExistingMarkBonusAction": [
    "附赠转移原印记",
    "Transfer existing mark · Bonus Action"
  ],
  "findOriginalTargetWithPerceptionAdvantage": [
    "察觉寻找原目标（优势）",
    "Find original target with Perception (advantage)"
  ],
  "trackOriginalTargetWithSurvivalAdvantage": [
    "求生追踪原目标（优势）",
    "Track original target with Survival (advantage)"
  ],
  "noneMoveOnly": [
    "无（仅移动）",
    "None (move only)"
  ],
  "followUpAbilitiesUseTheOriginalSpellS": [
    "后续能力按原法术计算，实际扣动作、不再次扣法术位。待结算时进入快速审核。",
    "Follow-up abilities use the original spell’s rules, spend the actual action and no additional slot. Pending resolution enters quick review."
  ],
  "gmRegistersManufacturedMetalFacts": [
    "GM登记人造金属事实",
    "GM registers manufactured-metal facts"
  ],
  "saveActualMetalFacts": [
    "保存实际金属事实",
    "Save actual metal facts"
  ],
  "currentOrdinaryNpcSActualWeapon": [
    "当前普通NPC实际武器",
    "Current ordinary NPC’s actual weapon"
  ],
  "placeOnGround": [
    "放到地面",
    "Place on ground"
  ],
  "metal": [
    "金属",
    "Metal"
  ],
  "wood": [
    "木",
    "Wood"
  ],
  "registerUpdateActualWeapon": [
    "登记／更新实际武器",
    "Register / update actual weapon"
  ],
  "confirmReactionAndReturnToOriginalAttack": [
    "确认反应并回到原攻击",
    "Confirm reaction and return to original attack"
  ],
  "confirmDamageAndSpellConsequences": [
    "确认本次伤害与法术后果",
    "Confirm damage and spell consequences"
  ],
  "keepsOriginalSpellSlotsActionsAndDiceRepeated": [
    "保留原法术位、动作与骰值；重复提交不会再次结算。战斗中仍可在原攻击窗口处理其他合法反应。",
    "Keeps original spell slots, actions and dice. Repeated submission does not resolve twice. Other legal reactions remain available in the original combat attack window."
  ],
  "terminateInvalidFollowUp": [
    "终止失效的后续",
    "Terminate invalid follow-up"
  ],
  "terminateUnresolvedFollowUpRetainCosts": [
    "终止未结算后续（保留费用）",
    "Terminate unresolved follow-up (retain costs)"
  ],
  "executeContinueActualDisplacement": [
    "执行／继续实际位移",
    "Execute / continue actual displacement"
  ],
  "declineThisPull": [
    "放弃本次拉近",
    "Decline this pull"
  ],
  "gmHandlesComplexRoutesInvalidConsequences": [
    "复杂路线／失效后果由GM处理",
    "GM handles complex routes / invalid consequences"
  ],
  "recordAsGmHandled": [
    "记录已由GM处理",
    "Record as GM-handled"
  ],
  "cancelInvalidConsequenceKeepOriginalDamage": [
    "取消失效后果（保留原伤害）",
    "Cancel invalid consequence (keep original damage)"
  ],
  "recordsTakeoverResultsOnlyDoesNotAutomaticallyMove": [
    "只记录接管结果，不自动移动、补伤害或重触发区域。",
    "Records takeover results only. Does not automatically move, add damage or retrigger areas."
  ],
  "actualAreasAndDevices": [
    "真实区域与装置配置",
    "Actual areas and devices"
  ],
  "chooseAreaOrigin": [
    "选择区域起点",
    "Choose area origin"
  ],
  "chooseAnActualInventoryEntry": [
    "选择真实库存条目",
    "Choose an actual inventory entry"
  ],
  "registerMaterialFacts": [
    "登记材料事实",
    "Register material facts"
  ],
  "audibleBellWithin60Ft": [
    "60尺可听铃声",
    "Audible bell within 60 ft"
  ],
  "mentalAlarmWithin1Mile": [
    "1英里心灵警报",
    "Mental alarm within 1 mile"
  ],
  "enter": [
    "进入",
    "Enter"
  ],
  "touch": [
    "触碰",
    "Touch"
  ],
  "open": [
    "打开",
    "Open"
  ],
  "uncover": [
    "揭开",
    "Uncover"
  ],
  "speakSpecifiedWords": [
    "说出指定话语",
    "Speak specified words"
  ],
  "gmConfirmsComplexConditions": [
    "复杂条件交GM确认",
    "GM confirms complex conditions"
  ],
  "visible": [
    "可见",
    "Visible"
  ],
  "audible": [
    "可听",
    "Audible"
  ],
  "either": [
    "任一",
    "Either"
  ],
  "explosiveRunes": [
    "爆炸符文",
    "Explosive Runes"
  ],
  "spellStoragePayActualAdditionalCasting": [
    "储存法术（额外支付真实施法）",
    "Spell storage (pay actual additional casting)"
  ],
  "chooseASupportedSpell": [
    "选择已适配法术",
    "Choose a supported spell"
  ],
  "requiredSelection": [
    "必须选择",
    "Required selection"
  ],
  "unsupportedComplexOrSummoningSpellsAreRejectedBefore": [
    "未适配的复杂／召唤法术会在扣费前拒绝，不生成空效果。",
    "Unsupported complex or summoning spells are rejected before spending resources; no empty effect is created."
  ],
  "verifySelectedStormFacts": [
    "核实所选风暴事实",
    "Verify selected storm facts"
  ],
  "setFirstLightningStrike": [
    "设置首次雷击",
    "Set first lightning strike"
  ],
  "chooseActualArrowsOrBoltsIndividuallySixAt": [
    "逐支选择真实箭／弩矢；三环6支，二环4支，可重复同一堆叠。",
    "Choose actual arrows or bolts individually: six at level 3, four at level 2. The same stack may be selected repeatedly."
  ],
  "addOneArrowBolt": [
    "增加一支",
    "Add one arrow / bolt"
  ],
  "removeLastArrowBolt": [
    "移除末支",
    "Remove last arrow / bolt"
  ],
  "persistentAreasMovementDirectionAndDevices": [
    "持续区域 · 移动、转向与装置",
    "Persistent areas · Movement, direction and devices"
  ],
  "useThePickerAboveForActualDestinationsThe": [
    "使用上方选点器选择实际落点；动作、距离、资格及重复使用由服务器复核。",
    "Use the picker above for actual destinations. The server rechecks actions, distance, eligibility and repeated use."
  ],
  "dimLightInside": [
    "内部微光",
    "Dim light inside"
  ],
  "darknessInside": [
    "内部黑暗",
    "Darkness inside"
  ],
  "transferExecutionControlDoNotRerollHistory": [
    "移交执行权（不重掷历史）",
    "Transfer execution control (do not reroll history)"
  ]
} as const
export const adjudicationZh=Object.fromEntries(Object.entries(adjudicationControls).map(([key,p])=>[key,p[0]]))
export const adjudicationEn=Object.fromEntries(Object.entries(adjudicationControls).map(([key,p])=>[key,p[1]]))
