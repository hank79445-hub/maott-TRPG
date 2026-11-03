import type { Character } from './types'
import { clone, getChoices, validate, type Catalogue } from './engine'
import { growthBaseline } from './growth-choice-policy'
import { alwaysPrepared } from './growth-rules'

export const REST_SPELL_CHOICE_KEYS = ['class-cantrips','tome-cantrips','tome-rituals'] as const
export function restSpellBuild(c: Character, choices?: Record<string,string[]>) {
  const b = clone(c.build)
  b.choices = {...b.choices, ...c.runtime?.restSpellChoices, ...choices}
  if (c.runtime?.preparedSpells) b.choices['class-spells'] = [...c.runtime.preparedSpells]
  return b
}
export function restSpellNodes(c: Character, cat: Catalogue, choices?: Record<string,string[]>) {
  const b=restSpellBuild(c,choices)
  return getChoices(b,cat).filter(n=>
    n.id==='class-cantrips' ? c.build.classId==='wizard' :
    ['tome-cantrips','tome-rituals'].includes(n.id) && (b.choices.invocation??[]).includes('tome'))
}
export function restSpellSelectionIssues(c:Character,cat:Catalogue,selection:Record<string,string[]>,kind?:'short'|'long') {
  const issues:string[]=[],nodes=restSpellNodes(c,cat,selection),baseline=growthBaseline(c)
  const build=restSpellBuild(c,selection)
  const otherPrepared=new Set([
    ...getChoices(build,cat).filter(n=>n.kind==='spell'&&!n.id.startsWith('tome-')&&n.id!=='spellbook').flatMap(n=>build.choices[n.id]??[]),
    ...alwaysPrepared(build,cat.subclasses).map(s=>s.id),
  ])
  for(const [key,ids]of Object.entries(selection)){
    const node=nodes.find(n=>n.id===key)
    if(!node || ids.length!==node.count || new Set(ids).size!==ids.length || ids.some(id=>!node.options.some(o=>o.id===id))) {issues.push('休息法术选择的来源、数量或选项无效：'+key);continue}
    if(key.startsWith('tome-')&&ids.some(id=>otherPrepared.has(id))) issues.push('影之书不能选择已由其他来源准备的法术')
    if(kind && key==='class-cantrips'){
      if(kind!=='long') issues.push('法师更换职业戏法必须完成长休')
      if((baseline[key]??[]).filter(id=>!ids.includes(id)).length>1) issues.push('法师每次长休最多替换1道职业戏法')
    }
  }
  if(kind && ('tome-cantrips'in selection || 'tome-rituals'in selection) && (!selection['tome-cantrips'] || !selection['tome-rituals'])) issues.push('重建影之书须同时明确3道戏法及2道一环仪式')
  if(!issues.length) issues.push(...validate(restSpellBuild(c,selection),cat,{existingCharacter:true}).map(i=>i.message))
  return [...new Set(issues)]
}
