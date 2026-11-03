import {SPELL_AUDIT_RULES} from './spell-audit-rules'
export const S_SPELL_IDS=['summon-beast','summon-fey','summon-undead','find-familiar','find-steed','phantom-steed','animate-dead','unseen-servant'] as const
export type SummonSpell=typeof S_SPELL_IDS[number]
export const S_NATIVE_SPIRITS=['summon-beast','summon-fey','summon-undead'] as const
export const FAMILIAR_NAMED_FORMS=['Bat','Cat','Frog','Hawk','Lizard','Octopus','Owl','Rat','Raven','Spider','Weasel'] as const
export const S_RULE_VERSION='SRD5.2.1-public/S-foundation-v01'
export const S_RULES:Record<SummonSpell,{kind:'creature'|'steed'|'phantom'|'force';forms:string[];material?:{name:string;gp:number;consume:boolean};concentration:boolean;hours:number;controlHours?:number;vanishOnZero:boolean;vanishOnSourceDeath:boolean;stage:string;implementation:'world-v01';unimplemented:string[]}>={
 'summon-beast':{kind:'creature',forms:['air','land','water'],material:{name:'镀金橡果',gp:200,consume:false},concentration:true,hours:1,vanishOnZero:true,vanishOnSourceDeath:true,stage:'S-2',implementation:'world-v01',unimplemented:[]},
 'summon-fey':{kind:'creature',forms:['fuming','mirthful','tricksy'],material:{name:'镀金花',gp:300,consume:false},concentration:true,hours:1,vanishOnZero:true,vanishOnSourceDeath:true,stage:'S-2',implementation:'world-v01',unimplemented:[]},
 'summon-undead':{kind:'creature',forms:['ghostly','putrid','skeletal'],material:{name:'镀金头骨',gp:300,consume:false},concentration:true,hours:1,vanishOnZero:true,vanishOnSourceDeath:true,stage:'S-2',implementation:'world-v01',unimplemented:[]},
 'find-familiar':{kind:'creature',forms:[...FAMILIAR_NAMED_FORMS],material:{name:'焚香',gp:10,consume:true},concentration:false,hours:0,vanishOnZero:true,vanishOnSourceDeath:false,stage:'S-3',implementation:'world-v01',unimplemented:[]},
 'find-steed':{kind:'steed',forms:['celestial','fey','fiend'],concentration:false,hours:0,vanishOnZero:true,vanishOnSourceDeath:true,stage:'S-4',implementation:'world-v01',unimplemented:[]},
 'phantom-steed':{kind:'phantom',forms:['riding-horse'],concentration:false,hours:1,vanishOnZero:false,vanishOnSourceDeath:false,stage:'S-5',implementation:'world-v01',unimplemented:[]},
 'animate-dead':{kind:'creature',forms:['skeleton','zombie'],concentration:false,hours:0,controlHours:24,vanishOnZero:false,vanishOnSourceDeath:false,stage:'S-6',implementation:'world-v01',unimplemented:[]},
 'unseen-servant':{kind:'force',forms:['force'],concentration:false,hours:1,vanishOnZero:true,vanishOnSourceDeath:false,stage:'S-7',implementation:'world-v01',unimplemented:[]},
}
export function summonRuleSource(id:SummonSpell){return SPELL_AUDIT_RULES[id]!.ruleSource}
/** A candidate is not a usable familiar template until its executable traits are audited in S-3. */
export function familiarTemplateCandidate(template:{body:{creatureType?:string};metadata?:{englishName:string;cr?:string}}){return template.body.creatureType==='beast'&&(FAMILIAR_NAMED_FORMS.includes(template.metadata?.englishName as typeof FAMILIAR_NAMED_FORMS[number])||template.metadata?.cr==='0')}
