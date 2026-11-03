import {inlineSummaryZh,inlineSummaryEn} from './inline-summary-controls'
import {validationZh,validationEn} from './validation-controls'
import {finalFieldZh,finalFieldEn} from './final-field-controls'
import {confirmationZh,confirmationEn} from './confirmation-controls'
import {runtimeDetailZh,runtimeDetailEn} from './runtime-detail-controls'
import {operationResultZh,operationResultEn} from './operation-result-controls'
import {projectionZh,projectionEn} from './projection-controls'
import {tableLabelZh,tableLabelEn} from './table-label-controls'
import {expressionFourZh,expressionFourEn} from './expression-four-controls'
import {expressionThreeZh,expressionThreeEn} from './expression-three-controls'
import {expressionTwoZh,expressionTwoEn} from './expression-two-controls'
import {expressionOneZh,expressionOneEn} from './expression-one-controls'
import {remainingFieldZh,remainingFieldEn} from './remaining-field-controls'
import {interactionFieldZh,interactionFieldEn} from './interaction-field-controls'
import {configurationFieldZh,configurationFieldEn} from './configuration-field-controls'
import {fieldZh,fieldEn} from './field-controls'
import {scriptSummaryZh,scriptSummaryEn} from './script-summary-controls'
import {progressSummaryZh,progressSummaryEn} from './progress-summary-controls'
import {liveSummaryZh,liveSummaryEn} from './live-summary-controls'
import {resourceFlowZh,resourceFlowEn} from './resource-flow-controls'
import {authoringFlowZh,authoringFlowEn} from './authoring-flow-controls'
import {adjudicationZh,adjudicationEn} from './adjudication-controls'
import {workspaceZh,workspaceEn} from './workspace-controls'
import {configurationZh,configurationEn} from './configuration-controls'
import {operationsZh,operationsEn} from './operations-controls'
import {quantityZh,quantityEn} from './quantity-controls'
import {dialogueReviewZh,dialogueReviewEn} from './dialogue-review-controls'
import {stateZh,stateEn} from './state-controls'
import {workflowZh,workflowEn} from './workflow-controls'
import {spatialZh,spatialEn} from './spatial-controls'
import {inventoryZh,inventoryEn} from './inventory-controls'
import {reviewZh,reviewEn} from './review-controls'
import {mapExperienceZh,mapExperienceEn} from './map-experience-controls'
import {broadcastZh,broadcastEn} from './broadcast-controls'
import {knowledgeZh,knowledgeEn} from './knowledge-controls'
import {aiZh,aiEn} from './ai-controls'
import {combatZh,combatEn} from './combat-controls'
import {runtimeZh,runtimeEn} from './runtime-controls'
import {mapZh,mapEn} from './map-controls'
import {builderZh,builderEn} from './builder-controls'
import {ruleZh,ruleEn} from './rule-controls'
import {roomZh,roomEn} from './room-controls'
import {domainZh,domainEn} from './domain-controls'
import {gameZh,gameEn} from './game-controls'
import {workbenchEn,workbenchZh} from './workbench'
import {controlEn,controlZh} from './common-controls'
export const zhCN = {
  library: { title:'我的冒险者',tagline:'每一段传奇，都从一张角色卡开始。',import:'导入角色',empty:'下一位冒险者，会是谁？',guide:'从 12 个职业中选择方向，通过七步引导完成一级角色。',first:'创建第一位角色 →',classes:'12 职业',species:'SRD 物种',spells:'SRD 法术目录',local:'独立本地模式 · 角色保存在此浏览器',backup:'定期导出 JSON 可备份或迁移角色。',draft:'草稿',unnamed:'未命名冒险者',speciesPending:'物种待选',classPending:'职业待选',level:'{level} 级',updated:'更新于 {date}',purpose:'角色用途',player:'玩家角色',npc:'NPC 专用模板',shared:'玩家／NPC 共用模板',continue:'继续创建',view:'查看角色',resumeEdit:'继续未提交的编辑',resumeBuild:'继续当前建角',resumeStep:'第 {step} 步：{name} →',workshop:'角色工坊' },
  builderHints:{class:'选择你的冒险方式',origin:'过去与血脉塑造了你',abilities:'每一种长处都有用武之地',features:'把天赋变成你的本领',equipment:'准备好出发所需的一切',story:'让数值拥有自己的故事',check:'确认这位冒险者的第一步'},
  mapExperience:mapExperienceZh,
  review:reviewZh,
  inventory:inventoryZh,
  spatial:spatialZh,
  workflow:workflowZh,
  state:stateZh,
  dialogueReview:dialogueReviewZh,
  quantity:quantityZh,
  operations:operationsZh,
  adjudication:adjudicationZh,
  authoringFlow:authoringFlowZh,
  resourceFlow:resourceFlowZh,
  liveSummary:liveSummaryZh,
  progressSummary:progressSummaryZh,
  scriptSummary:scriptSummaryZh,
  field:fieldZh,
  configurationField:configurationFieldZh,
  interactionField:interactionFieldZh,
  remainingField:remainingFieldZh,
  expressionOne:expressionOneZh,
  expressionTwo:expressionTwoZh,
  expressionThree:expressionThreeZh,
  expressionFour:expressionFourZh,
  tableLabel:tableLabelZh,
  projection:projectionZh,
  operationResult:operationResultZh,
  runtimeDetail:runtimeDetailZh,
  confirmation:confirmationZh,
  finalField:finalFieldZh,
  validation:validationZh,
  inlineSummary:inlineSummaryZh,
  workspace:workspaceZh,
  configuration:configurationZh,
  broadcast:broadcastZh,
  knowledge:knowledgeZh,
  ai:aiZh,
  combat:combatZh,
  runtime:runtimeZh,
  map:mapZh,
  creation:builderZh,
  rules:ruleZh,
  room:roomZh,
  domain:domainZh,
  game:gameZh,
  controls: controlZh,
  workbench:workbenchZh,
  language: { legacyHelp:'兼容模式仅让未设置新内容语言的旧房间采用旧约束。跟随房间会明确忽略技能语言；明确覆盖会保留上方自定义规则。', legacy:'旧配置兼容', legacyRule:'旧语言约束（原样保留）', narrationPolicy:'旁白语言来源', queued:'本次任务语言：{language}',changed:'新生成目标已更改；已有正文保留原文，请核对前后阶段。', label: '界面语言', saved: '语言已保存', unavailable: '语言已切换，但无法保存到此浏览器', room: '房间内容语言', creation: '作品语言', future: '只影响后续新内容；历史、已有正文和进行中的任务保留原语言。', follow: '跟随房间', override: '本旁白明确覆盖', missing: '缺少目标语言译文，显示原文' },
  navigation: { scripts: '剧本库', room: '多人房间', map: '地图与场景', battle: '战斗桌', rules: '规则与来源', create: '＋ 新建角色', light: '切换浅色主题', dark: '切换深色主题' },
  common: { save: '保存', cancel: '取消', close: '关闭', confirm: '确认', loading: '正在读取本地角色…', error: '操作失败', empty: '暂无内容', yes: '是', no: '否' },
  builder: { class: '职业', origin: '出身', abilities: '属性', features: '能力', equipment: '初始装备', story: '故事', check: '检查' },
} as const
export const en: typeofMessage = {
  library: { title:'My adventurers',tagline:'Every legend starts with a character sheet.',import:'Import character',empty:'Who will your next adventurer be?',guide:'Choose from 12 classes and create a level-one character with seven guided steps.',first:'Create your first character →',classes:'12 classes',species:'SRD species',spells:'SRD spell catalogue',local:'Local mode · Characters are stored in this browser',backup:'Export JSON regularly to back up or transfer characters.',draft:'Draft',unnamed:'Unnamed adventurer',speciesPending:'Choose species',classPending:'Choose class',level:'Level {level}',updated:'Updated {date}',purpose:'Character use',player:'Player character',npc:'NPC template',shared:'Player / NPC template',continue:'Continue creating',view:'View character',resumeEdit:'Continue unsaved edits',resumeBuild:'Continue character creation',resumeStep:'Step {step}: {name} →',workshop:'Character workshop' },
  builderHints:{class:'Choose your path of adventure',origin:'Your past and ancestry shape you',abilities:'Every strength has a purpose',features:'Turn potential into skills',equipment:'Prepare for the road ahead',story:'Give the numbers a story',check:'Review your adventurer’s first steps'},
  mapExperience:mapExperienceEn,
  review:reviewEn,
  inventory:inventoryEn,
  spatial:spatialEn,
  workflow:workflowEn,
  state:stateEn,
  dialogueReview:dialogueReviewEn,
  quantity:quantityEn,
  operations:operationsEn,
  adjudication:adjudicationEn,
  authoringFlow:authoringFlowEn,
  resourceFlow:resourceFlowEn,
  liveSummary:liveSummaryEn,
  progressSummary:progressSummaryEn,
  scriptSummary:scriptSummaryEn,
  field:fieldEn,
  configurationField:configurationFieldEn,
  interactionField:interactionFieldEn,
  remainingField:remainingFieldEn,
  expressionOne:expressionOneEn,
  expressionTwo:expressionTwoEn,
  expressionThree:expressionThreeEn,
  expressionFour:expressionFourEn,
  tableLabel:tableLabelEn,
  projection:projectionEn,
  operationResult:operationResultEn,
  runtimeDetail:runtimeDetailEn,
  confirmation:confirmationEn,
  finalField:finalFieldEn,
  validation:validationEn,
  inlineSummary:inlineSummaryEn,
  workspace:workspaceEn,
  configuration:configurationEn,
  broadcast:broadcastEn,
  knowledge:knowledgeEn,
  ai:aiEn,
  combat:combatEn,
  runtime:runtimeEn,
  map:mapEn,
  creation:builderEn,
  rules:ruleEn,
  room:roomEn,
  domain:domainEn,
  game:gameEn,
  controls: controlEn,
  workbench:workbenchEn,
  language: { legacyHelp:'Compatibility uses the old constraint only in rooms without the new content-language setting. Follow room explicitly ignores the Skill language; explicit override retains the custom rule above.', legacy:'Legacy compatibility', legacyRule:'Legacy language constraint (preserved)', narrationPolicy:'Narration language source', queued:'Task output language: {language}',changed:'The target for new content has changed. Existing text is preserved; review language consistency across stages.', label: 'Interface language', saved: 'Language saved', unavailable: 'Language changed, but this browser could not save it', room: 'Room content language', creation: 'Creation language', future: 'Applies to new content only. History, existing text and tasks already queued retain their original language.', follow: 'Follow room', override: 'Explicit narration override', missing: 'Translation unavailable; showing original text' },
  navigation: { scripts: 'Scripts', room: 'Multiplayer room', map: 'Maps & scenes', battle: 'Combat table', rules: 'Rules & sources', create: '+ New character', light: 'Switch to light theme', dark: 'Switch to dark theme' },
  common: { save: 'Save', cancel: 'Cancel', close: 'Close', confirm: 'Confirm', loading: 'Loading local characters…', error: 'Operation failed', empty: 'Nothing here yet', yes: 'Yes', no: 'No' },
  builder: { class: 'Class', origin: 'Origin', abilities: 'Abilities', features: 'Features', equipment: 'Starting equipment', story: 'Story', check: 'Review' },
}
type Values<T> = { [K in keyof T]: T[K] extends string ? string : Values<T[K]> }
type typeofMessage = Values<typeof zhCN>
