import type {Combatant,Encounter,PendingAction,Environment} from './combat-types'
import type {Character} from './types'
import type {Catalogue} from './engine'
import {clone} from './engine'
import {combatStats,defaultEnvironment,rollDamage,savingRoll} from './combat-rules'
export const M5A_SPELLS=['divine-smite','ice-knife','acid-arrow','lightning-arrow'] as const
export const isM5Appendix=(id:string)=>(M5A_SPELLS as readonly string[]).includes(id)
export interface IceBurst {targetIds:string[];envs:Record<string,Environment>;slot:number;dc:number}
export function lightningReplacement(e:Encounter,a:Combatant,old:PendingAction,targets:Combatant[],envs:Record<string,Environment>,slot:number,dc:number,cs:Character[],cat:Catalogue,dice:(n:number)=>number):PendingAction{
 const primary=old.targets[0]!
 if(!targets.some(t=>t.id===primary.id))throw Error('闪电箭矢范围须包含原攻击目标')
 const up=Math.max(0,slot-3)
 return {id:crypto.randomUUID(),kind:'save',actorId:a.id,name:'闪电箭矢',page:0,spellId:'lightning-arrow',slotLevel:slot,attack:null,targets:[{...clone(primary),roll:null,damageOverride:[{type:'lightning',roll:rollDamage((4+up)+'d8',dice,primary.critical&&primary.hit)}]},...targets.map(t=>{const env=envs[t.id]??defaultEnvironment(),roll=savingRoll(t,'dex',env,cs,cat,dice);return {id:t.id,env:clone(env),roll,hit:roll.autoFail||roll.total<dc,critical:false,ac:combatStats(t,cs,cat).ac,damageOverride:[{type:'lightning' as const,roll:rollDamage((2+up)+'d8',dice)}]}})],damage:[],save:'dex',dc,half:true,effectKey:null,modifier:0,mode:'lightning-replacement',notes:['替换原远程武器攻击伤害及其他效果；原目标另参与10尺范围豁免'],sneak:false,mastery:false,startedAt:e.tick}
}
export function iceBurstPending(e:Encounter,p:PendingAction,a:Combatant,cs:Character[],cat:Catalogue,dice:(n:number)=>number):PendingAction|undefined{
 const burst=p.iceBurst
 if(!burst)return
 return {id:crypto.randomUUID(),castingId:p.castingId??p.id,kind:'save',actorId:a.id,name:'冰刀 · 爆裂',page:p.page,spellId:'ice-knife',slotLevel:burst.slot,notCasting:true,attack:null,targets:burst.targetIds.map(id=>{const t=e.actors.find(t=>t.id===id);if(!t)throw Error('已保存爆裂目标失效，请GM接管');const env=burst.envs[id]??defaultEnvironment(),roll=savingRoll(t,'dex',env,cs,cat,dice);return {id,env:clone(env),roll,hit:roll.autoFail||roll.total<burst.dc,critical:false,ac:combatStats(t,cs,cat).ac}}),damage:[{type:'cold',roll:rollDamage((burst.slot+1)+'d6',dice)}],save:'dex',dc:burst.dc,half:false,effectKey:null,modifier:p.modifier,mode:'ice-burst',notes:['无论首段命中与否都爆裂；此阶段不是重新施法，不重复扣费'],sneak:false,mastery:false,startedAt:e.tick}
}
