import {mkdir,writeFile} from 'node:fs/promises'
import {buildExample} from './example-entry'
import {containerFixture} from '../tests/experience-v22-fixture'
import {executeCommand,projectRoom} from '../src/server/room-engine'
import {pointContainerView} from '../src/server/point-container'
import {newEncounter,applyCombat} from '../src/core/combat'
import {catalogue} from '../src/core/engine'
import {customNpc} from '../src/core/combat-rules'
export async function writeDemoData(root=process.cwd()) {
  const out=root+'/.local/site-demo',f=await containerFixture(),d=await buildExample()
  await mkdir(out,{recursive:true});f.room.world=d.world;f.room.name='暮灯驿站 · 教学冒险'
  const pcs=d.world.characters.filter(c=>c.purpose!=='npc'),wizard=pcs.find(c=>c.build.classId==='wizard')!
  wizard.inventory.push({instanceId:'demo-scroll',itemId:'scroll-magic-missile',quantity:1,source:'原创教学',equipped:false,note:''})
  f.player.nickname='墨岚的玩家';f.player.characterIds=[wizard.id];f.player.actorIds=[]
  f.second.nickname='晨铃的玩家';f.second.characterIds=pcs.filter(c=>c.id!==wizard.id).map(c=>c.id);f.second.actorIds=[]
  const initial=f.room.world.adventures[0]!.scenes.find(s=>s.id===f.room.world.adventures[0]!.activeSceneId)!,wt=initial.tokens.find(t=>t.characterId===wizard.id)!;wt.x=3;wt.y=2;initial.points.find(p=>p.kind==='chest')!.state='open';
  f.gm.nickname='暮灯GM';executeCommand(f.room,f.gm,{kind:'opening',operation:'start'})
  for(const asset of d.assets)await writeFile(out+'/asset-'+asset.id+'.png',new Uint8Array(await asset.blob.arrayBuffer()))
  const views={gm:projectRoom(f.room,f.gm,d.assets),player:projectRoom(f.room,f.player,d.assets)}
  for(const[role,v]of Object.entries(views))await writeFile(out+'/'+role+'.json',JSON.stringify(v))
  const scene=f.room.world.adventures[0]!.scenes.find(s=>s.id===f.room.world.adventures[0]!.activeSceneId)!,point=scene.points.find(p=>p.kind==='chest')!
  // Open through the actual rule path in fixture data only; screenshots never contact a live service.
  point.state='open'
  const contents=pointContainerView(f.room,f.player,scene.id,point.id,wizard.id)
  await writeFile(out+'/contents.json',JSON.stringify(contents))
  await writeFile(out+'/sources.json',JSON.stringify({pointId:point.id,itemKey:'item:demo-scroll:magic-missile'}))
  let e=newEncounter('驿站切磋'),chars=f.room.world.characters
  const cmd=(command:Parameters<typeof applyCombat>[3])=>{const r=applyCombat(e,chars,catalogue(),command,()=>12);e=r.encounter;chars=r.characters}
  for(const c of pcs)cmd({type:'add-character',characterId:c.id,side:'party'})
  const n=customNpc();n.name='切磋伙伴';cmd({type:'add-npc',npc:n,side:'enemy'})
  for(const[i,actor]of e.actors.entries())cmd({type:'initiative',actorId:actor.id,value:20-i,surprised:false})
  cmd({type:'start'});f.room.world.characters=chars;f.room.world.encounters=[e];scene.encounterId=e.id
  for(const t of scene.tokens)if(t.characterId)t.actorId=e.actors.find(a=>a.characterId===t.characterId)?.id??null
  f.player.actorIds=e.actors.filter(a=>a.characterId===wizard.id).map(a=>a.id)
  for(const[role,m]of [['gm',f.gm],['player',f.player]]as const)await writeFile(out+'/battle-'+role+'.json',JSON.stringify(projectRoom(f.room,m,d.assets)))
  return {views:2,party:pcs.length,scene:scene.name}
}
