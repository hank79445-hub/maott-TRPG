import type { ActiveEffect, Ability } from './types'

export interface ControlSelection {
 gmChoice?:import('../persistence/gm-spell-choice-schema').GmSpellChoice
 m3Choice?:import('./m3-spells').M3CastChoice
  supportChoice?: string
  controlChoices?: Record<string,string>
  controlTargets?: string[]
  controlText?: string
}
/** Map tokens and combat actors have different identities; adapt references once at that boundary. */
export function controlSelectionForActors(selection:ControlSelection,resolve:(id:string)=>string):ControlSelection{
 return {...(selection.gmChoice?{gmChoice:selection.gmChoice}:{}),...(selection.m3Choice?{m3Choice:selection.m3Choice}:{}),...(selection.supportChoice!==undefined?{supportChoice:selection.supportChoice}:{}),...(selection.controlText!==undefined?{controlText:selection.controlText}:{}),
  ...(selection.controlChoices?{controlChoices:Object.fromEntries(Object.entries(selection.controlChoices).map(([id,value])=>[resolve(id),value]))}:{}),
  ...(selection.controlTargets?{controlTargets:selection.controlTargets.map(resolve)}:{})}
}
export const CURSE_CHOICES=['str','dex','con','int','wis','cha','attacks','dodge','damage'] as const
export function validateControlSelection(id:string,selection:ControlSelection,targets:string[]){
  if(selection.controlChoices&&Object.keys(selection.controlChoices).some(key=>!targets.includes(key)))throw Error('分目标效果包含本次未选中的目标')
  const choices=targets.map(t=>selection.controlChoices?.[t]??selection.supportChoice??'')
  if(id==='calm-emotions'){
    if(choices.some(v=>!['suppress','indifferent'].includes(v)))throw Error('安定心神须为每个目标选择压制魅惑／恐惧或对指定生物冷漠')
    if(choices.includes('indifferent')&&!selection.controlTargets?.length)throw Error('冷漠效果须明确原本敌视的生物，由GM确认敌意关系')
  }
  if(id==='bestow-curse'&&choices.some(v=>!CURSE_CHOICES.includes(v as typeof CURSE_CHOICES[number])))throw Error('降咒须选择规则效果；自定义诅咒另由GM裁定')
  if(['suggestion','phantasmal-force'].includes(id)&&!selection.controlText?.trim())throw Error('请填写GM已核对的暗示活动或仅受术者感知的幻象')
  if(id==='suggestion'&&selection.controlText!.trim().split(/\s+/).length>25)throw Error('暗示术活动不得超过25词；中文亦须由GM核对等价简短指令')
}
export function socialControlEffect(id:string,dc:number,choice?:string,targets?:string[],text?:string):Partial<ActiveEffect>|null{
  const control={dc,targets:targets??[],text:text??''}
  if(id==='calm-emotions')return {supportChoice:choice,control,visibility:'owner',...(choice==='suppress'?{conditionImmunities:['charmed','frightened']}:{note:'对指定的原敌视生物冷漠；受伤或目击盟友受伤提前结束，不改变阵营'})}
  if(id==='suggestion')return {condition:'charmed',control,visibility:'owner',note:'遵循GM确认的可实现且不明显造成目标／盟友伤害的活动；完成活动或来源／其盟友造成伤害即结束'}
  if(id==='compelled-duel')return {control,visibility:'owner',note:'攻击非来源生物劣势；不能自愿远离来源超过30尺；来源改攻其他生物、对其他敌人施法、盟友伤害／有害施法或来源回合末超距即结束'}
  if(id==='phantasmal-force')return {control,visibility:'owner',note:'仅受术者感知十尺立方幻象；研究动作调查对抗法术DC；危险幻象在来源每回合可造成2d8心灵伤害，位置／合理性由GM确认'}
  if(id==='bestow-curse')return {control,supportChoice:choice,curse:true,visibility:'owner',...(CURSE_CHOICES.slice(0,6).includes(choice as Ability)?{ability:choice as Ability}:{}),note:'降咒：'+choice+'；按来源解除，不自动扩成其他诅咒'}
  return null
}
/** Suppression never deletes the original charm/fear. The original duration still elapses. */
export function charmEffective(effects:readonly ActiveEffect[]){
  return !effects.some(e=>e.key==='calm-emotions'&&e.supportChoice==='suppress')
}
