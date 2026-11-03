import type {CombatNpc} from './combat-types'
import type {Ability} from './types'
import type {NpcTemplateMetadata} from './npc-template-types'
import {spiritSummonBody} from './phb-companions'
import {S_NATIVE_SPIRITS,S_RULE_VERSION} from './summon-rules'

const keys:Ability[]=['str','dex','con','int','wis','cha']
export function summonMetadata(name:string,movement:NpcTemplateMetadata['movement'],senses:string[],passive:number,skills:Record<string,number>={},traits:string[]=[]):NpcTemplateMetadata{
 return {englishName:name,category:'beast',sourceKind:'summon',sourceVersion:S_RULE_VERSION,templateVersion:S_RULE_VERSION,proficiencyBonus:2,alignment:'按原数据卡',hitDice:'见规则正文',skills,senses,passivePerception:passive,languages:[],movement,gear:[],abilities:traits.map(id=>({id,name:id,support:'automatic',detail:'按召唤机制与实际空间校验执行'}))}
}
function body(name:string,ac:number,hp:number,speed:number,values:number[]):CombatNpc{
 const scores=Object.fromEntries(keys.map((k,n)=>[k,values[n]!])) as Record<Ability,number>,saves=Object.fromEntries(keys.map(k=>[k,Math.floor((scores[k]-10)/2)])) as Record<Ability,number>
 return {name,ac,hp,maxHp:hp,temporaryHp:0,speed,scores,saves,initiativeBonus:saves.dex,attacks:[],resistances:[],vulnerabilities:[],immunities:[],conditionImmunities:[],conditions:[],effects:[],dead:false,source:S_RULE_VERSION}
}
type FamiliarRow={name:string;ac:number;hp:number;speed:number;values:number[];movement:NpcTemplateMetadata['movement'];senses:string[];passive:number;skills?:Record<string,number>;traits?:string[];small?:boolean;bonus:number;damage:string;type:'piercing'|'slashing'|'bludgeoning'}
/** PHB2024 Appendix B explicitly points to SRD5.2.1（动物数据卡） after errata. No model-written stat blocks. */
export const S_FAMILIARS:Record<string,FamiliarRow>={
 Bat:{name:'蝙蝠',ac:12,hp:1,speed:5,values:[2,15,8,2,12,4],movement:[{kind:'fly',feet:30}],senses:['盲视60尺'],passive:11,bonus:4,damage:'1',type:'piercing'},
 Cat:{name:'猫',ac:12,hp:2,speed:40,values:[3,15,10,3,12,7],movement:[{kind:'climb',feet:40}],senses:['黑暗视觉60尺'],passive:13,skills:{perception:3,stealth:4},traits:['dex-jump'],bonus:4,damage:'1',type:'slashing'},
 Frog:{name:'蛙',ac:11,hp:1,speed:20,values:[1,13,8,1,8,3],movement:[{kind:'swim',feet:20}],senses:['黑暗视觉30尺'],passive:11,skills:{perception:1,stealth:3},traits:['amphibious','standing-leap'],bonus:3,damage:'1',type:'piercing'},
 Hawk:{name:'隼',ac:13,hp:1,speed:10,values:[5,16,8,2,14,6],movement:[{kind:'fly',feet:60}],senses:[],passive:16,skills:{perception:6},bonus:5,damage:'1',type:'slashing'},
 Lizard:{name:'蜥蜴',ac:10,hp:2,speed:20,values:[2,11,10,1,8,3],movement:[{kind:'climb',feet:20}],senses:['黑暗视觉30尺'],passive:9,traits:['spider-climb'],bonus:2,damage:'1',type:'piercing'},
 Octopus:{name:'章鱼',ac:12,hp:3,speed:5,values:[4,15,11,3,10,4],movement:[{kind:'swim',feet:30}],senses:['黑暗视觉30尺'],passive:12,skills:{perception:2,stealth:6},traits:['compression','water-breathing','ink-cloud'],small:true,bonus:4,damage:'1',type:'bludgeoning'},
 Owl:{name:'猫头鹰',ac:11,hp:1,speed:5,values:[3,13,8,2,12,7],movement:[{kind:'fly',feet:60}],senses:['黑暗视觉120尺'],passive:15,skills:{perception:5,stealth:5},traits:['flyby'],bonus:3,damage:'1',type:'slashing'},
 Rat:{name:'鼠',ac:10,hp:1,speed:20,values:[2,11,9,2,10,4],movement:[{kind:'climb',feet:20}],senses:['黑暗视觉30尺'],passive:12,skills:{perception:2},traits:['agile'],bonus:2,damage:'1',type:'piercing'},
 Raven:{name:'渡鸦',ac:12,hp:2,speed:10,values:[2,14,10,5,13,6],movement:[{kind:'fly',feet:50}],senses:[],passive:13,skills:{perception:3},traits:['mimicry'],bonus:4,damage:'1',type:'piercing'},
 Spider:{name:'蜘蛛',ac:12,hp:1,speed:20,values:[2,14,8,1,10,2],movement:[{kind:'climb',feet:20}],senses:['黑暗视觉30尺'],passive:10,skills:{stealth:4},traits:['spider-climb','web-walker'],bonus:4,damage:'1',type:'piercing'},
 Weasel:{name:'鼬',ac:13,hp:1,speed:30,values:[3,16,8,2,12,3],movement:[{kind:'climb',feet:30}],senses:['黑暗视觉60尺'],passive:13,skills:{acrobatics:5,perception:3,stealth:5},bonus:5,damage:'1',type:'piercing'},
}
export function summonBody(spell:string,slot:number,form:string,attack:number,type:'celestial'|'fey'|'fiend'='fey'):CombatNpc|null{
 if((S_NATIVE_SPIRITS as readonly string[]).includes(spell)){
  const b=spiritSummonBody(spell,slot,form,attack),movement:NpcTemplateMetadata['movement']=[],traits:string[]=[]
  b.size=spell==='summon-undead'?'medium':'small'
  if(spell==='summon-beast'){if(form==='air'){movement.push({kind:'fly',feet:60});traits.push('flyby')}else{movement.push({kind:form==='land'?'climb':'swim',feet:30});b.packTactics=true;if(form==='water')traits.push('water-breathing')}}
  if(spell==='summon-fey')movement.push({kind:'fly',feet:30})
  if(spell==='summon-undead'&&form==='ghostly'){movement.push({kind:'fly',feet:40});traits.push('hover','incorporeal')}
  b.templateMetadata=summonMetadata(form,movement,['黑暗视觉60尺'],spell==='summon-beast'?12:10,{},traits)
  b.multiattack=Array(Math.floor(slot/2)).fill(b.attacks[0]!.id);return b
 }
 if(spell==='unseen-servant')return null
 if(spell==='find-familiar'){
  const r=S_FAMILIARS[form];if(!r)throw Error('未审计的魔宠形态，不能用任意CR0名称替代完整数据')
  const b=body('魔宠 · '+r.name,r.ac,r.hp,r.speed,r.values);b.size=r.small?'small':'tiny';b.creatureType=type
  b.templateMetadata=summonMetadata(form,r.movement,r.senses,r.passive,r.skills,r.traits);b.templateMetadata.cr='0'
  b.attacks=[{id:'natural',name:'天然攻击（普通魔宠禁止攻击）',bonus:r.bonus,damage:r.damage,damageType:r.type,reach:5,range:0,longRange:0}]
  if(form==='Spider')b.attacks[0]!.extraDamage=[{formula:'1d4',type:'poison'}]
  if(form==='Cat')b.saves.dex=4
  return b
 }
 if(spell==='find-steed'){
  if(!['celestial','fey','fiend'].includes(form))throw Error('非法异界坐骑类型')
  const b=body('异界坐骑 · '+({celestial:'天族',fey:'妖精',fiend:'邪魔'}[form]??form),10+slot,5+10*slot,60,[18,12,14,6,12,8]);b.size='large';b.creatureType=form as typeof type
  b.templateMetadata=summonMetadata('Otherworldly Steed',slot>=4?[{kind:'fly',feet:60}]:[],[],11);b.templateMetadata.hitDice=slot+'d10'
  b.attacks=[{id:'steed-slam',name:'猛击',bonus:attack,damage:'1d8+'+slot,damageType:form==='celestial'?'radiant':form==='fey'?'psychic':'necrotic',reach:5,range:0,longRange:0}];return b
 }
 if(spell==='phantom-steed'){
  const b=body('魅影驹',11,13,100,[16,13,12,2,11,7]);b.creatureType='beast';b.size='large';b.templateMetadata=summonMetadata('Riding Horse',[],[],10)
  b.attacks=[{id:'hooves',name:'蹄击',bonus:5,damage:'1d8+3',damageType:'bludgeoning',reach:5,range:0,longRange:0}];return b
 }
 if(spell==='animate-dead'){
  const skeleton=form==='skeleton',b=body(skeleton?'骷髅':'丧尸',skeleton?14:8,skeleton?13:15,skeleton?30:20,skeleton?[10,16,15,6,8,5]:[13,6,16,3,6,5]);b.size='medium';b.creatureType='undead';b.immunities=['poison'];b.conditionImmunities=['exhaustion','poisoned'];b.templateMetadata=summonMetadata(form,[],['黑暗视觉60尺'],skeleton?9:8)
  if(skeleton){b.vulnerabilities=['bludgeoning'];b.attacks=[];b.source+='；原尸体实际装备登记后才提供武器攻击'}
  else{b.undeadFortitude=true;b.attacks=[{id:'slam',name:'猛击',bonus:3,damage:'1d8+1',damageType:'bludgeoning',reach:5,range:0,longRange:0}]}
  return b
 }
 throw Error('未注册的召唤数据卡')
}
