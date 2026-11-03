import type { ActiveEffect } from './types'
import { rememberEndedCharms } from './social-effects'
import type { Encounter, PersistentZone } from './combat-types'
import type { Character } from './types'
/** A removed area cannot cancel a newer casting or a legacy source we cannot identify. */
export function endDispelledZoneSource(zone:PersistentZone,encounter:Encounter,characters:Character[]){
  if(!zone.castId)return
  const actor=encounter.actors.find(a=>a.id===zone.sourceId)
  const character=characters.find(c=>c.id===actor?.characterId||c.id===zone.sourceId)
  const state=character?.runtime??actor?.npc
  if(state?.concentration?.castId===zone.castId&&state.concentration.spellId===zone.spellId)state.concentration=null
}
/** One check per casting, not one per status fragment. Legacy/nonspell effects are never guessed. */
export function dispelSpellEffects(effects:ActiveEffect[],slot:number,check:(dc:number,spellId:string)=>number) {
  const groups=new Map<string,ActiveEffect[]>()
  for(const f of effects){
    if(!f.spellId||f.spellLevel===undefined||!f.castId)continue
    const rows=groups.get(f.castId)??[];rows.push(f);groups.set(f.castId,rows)
  }
  const removed=new Set<string>(),results:string[]=[]
  for(const rows of groups.values()){
    const level=Math.max(...rows.map(f=>f.spellLevel!)),id=rows[0]!.spellId!
    const total=level<=slot?null:check(10+level,id),success=total===null||total>=10+level
    if(success)for(const f of rows)removed.add(f.id)
    results.push(id+(total===null?'：直接解除': '：检定'+total+'/DC'+(10+level)+(success?'成功':'失败')))
  }
  return {effects:rememberEndedCharms(effects,effects.filter(f=>!removed.has(f.id))),removed:[...removed],
    text:results.join('；')||'没有可自动识别的法术来源；旧记录或其他魔法效果请GM核实'}
}
