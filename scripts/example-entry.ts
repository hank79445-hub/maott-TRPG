import {copyFile,writeFile,mkdir} from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {compileAuthoring} from '../src/core/script-authoring'
import {instantiateScript,inspectScript,scriptAssetMeta} from '../src/core/script'
import {originalMaps} from './original-map'
import {exportMap} from '../src/persistence/map-archive'
import {archiveSchema} from '../src/persistence/schema'
import {catalogue} from '../src/core/engine'
import {applyMap} from '../src/core/map'
import {browserScriptPack} from '../src/persistence/script-pack-browser'
import {teachingCharacter} from './example-fixture'
import {exportNpcConfig} from '../src/core/npc-config'
import {writeNpcXlsx} from '../src/persistence/npc-config-xlsx'
export const authoring={format:'trpg-authoring',version:1,title:'暮灯驿站的失物',level:1,players:2,start:'courtyard',opening:'雨夜里，暮灯驿站的铜铃响了。出发前的补给少了一箱，请你们帮忙找回。',openingPresentation:{opening:'雨停之前，补给必须装回商车。管事端来热茶，向你们说明眼下的委托。',background:'暮灯驿站位于两条商路交会处，庭院、大厅与地窖互相连通。今晚的货物有一箱被搬错了位置。',origin:'午后搬运时灯架倒下，新的货物标签被雨水打湿。管事需要你们找到证据，确认补给的去向。',identities:[{characterId:'player-1',text:'你曾替商队护送过这批货物，认得箱角的铜钉。请把发现告诉同伴，是否提到旧委托由你决定。'},{characterId:'player-2',text:'你来驿站取回导师寄存的一张教学卷轴。你还不知道它与丢失的补给是否放在一起。'}]},scenes:[
 {key:'courtyard',name:'驿站庭院',intro:'灯光照着雨后的石板路，管事在门前等待。',width:16,height:12,landing:{x:2,y:2},floors:[{x:0,y:0,width:16,height:12}],points:[{key:'hall',kind:'exit',name:'进入大厅',x:13,y:8,exit:{scene:'hall',point:'yard'}},{key:'supply',kind:'chest',name:'补给箱',x:4,y:2,repeatAccess:true,container:{items:[{itemId:'torch',quantity:3},{itemId:'scroll-magic-missile',quantity:1}],coins:5,gmNote:'教学容器；允许反复访问，库存不会再生。'}},{key:'notice',name:'查看搬运记录',x:5,y:5,text:'记录上写着：备用物资临时放在地窖门边。',success:'你们找到了新的搬运方向。'}]},
 {key:'hall',name:'暖灯大厅',intro:'大厅里有长桌、灯架与一扇通往地窖的门。',width:16,height:12,landing:{x:3,y:3},floors:[{x:0,y:0,width:16,height:12}],points:[{key:'yard',kind:'exit',name:'返回庭院',x:2,y:8,exit:{scene:'courtyard',point:'hall'}},{key:'stairs',kind:'exit',name:'走下地窖',x:13,y:8,exit:{scene:'cellar',point:'stairs'}},{key:'label',name:'调查湿标签',x:7,y:4,check:{skill:'investigation',dc:10},success:'标签留下的压痕与补给箱的编号一致。',failure:'纸面太湿，管事建议你们带上灯去地窖核对。'}]},
 {key:'cellar',name:'小地窖',intro:'整齐的木箱排在墙边，巡夜者举起灯向你们示意。',width:16,height:12,landing:{x:3,y:3},floors:[{x:0,y:0,width:16,height:12}],points:[{key:'stairs',kind:'exit',name:'返回大厅',x:2,y:8,exit:{scene:'hall',point:'stairs'}},{key:'lost',kind:'chest',name:'找回的物资',x:5,y:4,repeatAccess:true,container:{items:[{itemId:'rope',quantity:1}],coins:0},success:'管事核对了标签，确认这就是那箱物资。'},{key:'practice',name:'可选切磋',x:10,y:7,battle:'practice',text:'巡夜者建议在安全边界内练习一次战斗，是否开始由GM确认。'}]}
],npcs:[{key:'keeper',name:'管事青叶',scene:'courtyard',x:6,y:2,template:'srd-commoner',side:'neutral',type:'important',description:'认真记账的驿站管事。',dialogue:'先喝口茶，我们再一起找。',knowledge:'知道三个场景的连接。'},{key:'watcher',name:'巡夜者小岚',scene:'cellar',x:8,y:3,template:'srd-guard',side:'neutral',type:'important',dialogue:'我守在这里，箱子没有离开驿站。'},{key:'guard-a',name:'切磋伙伴甲',scene:'cellar',x:11,y:5,template:'srd-guard',side:'enemy'},{key:'guard-b',name:'切磋伙伴乙',scene:'cellar',x:12,y:5,template:'srd-guard',side:'enemy'}],battles:[{key:'practice',scene:'cellar',name:'自愿切磋',npcs:['guard-a','guard-b'],intro:'确认参与者和非致命约定后，由GM开始。'}],broadcasts:[{title:'收尾提醒',text:'核对物资、库存和角色状态，保存后结束本次教学冒险。',trigger:'manual',audience:'gm'}]}
export async function buildExample() {
  const compiled=compileAuthoring(authoring),characters=[teachingCharacter('fighter','晨铃'),teachingCharacter('wizard','墨岚')],maps=await originalMaps()
  compiled.definition.assets=maps.map(m=>scriptAssetMeta(m.asset))
  for(const [i,s]of compiled.definition.scenes.entries())s.background={assetId:maps[i]!.asset.id,x:0,y:0,width:16,height:12,rotation:0,locked:true,clip:true}
  const bindings=Object.fromEntries(compiled.definition.roles.map((r,i)=>[r.id,characters[i]!.id]))
  const instance=instantiateScript(compiled.definition,maps.map(m=>m.asset),characters,bindings)
  let world=instance.world,a=world.adventures[0]!,cat=catalogue()
  world=applyMap(world,a.id,{type:'enter',sceneId:a.activeSceneId??a.scenes[0]!.id,landing:{x:2,y:2}},cat)
  return {compiled,characters,world,assets:instance.assets,templateAssets:maps.map(m=>m.asset)}
}
export async function writeExample(root=process.cwd()) {
  const {compiled,characters,world,assets,templateAssets}=await buildExample(),dest=path.join(root,'website/public/downloads')
  await mkdir(dest,{recursive:true});const outputs:Record<string,Uint8Array|string>={
    'lamplit-inn.authoring.json':JSON.stringify(compiled.source,null,2),
    'lamplit-inn.trpg-script.zip':new Uint8Array(await(await browserScriptPack(compiled.definition,templateAssets)).arrayBuffer()),
    'lamplit-inn.trpg-map.json':await exportMap(world,assets,world.adventures[0]!.id),
    'lamplit-inn-characters.zip':zipSync(Object.fromEntries(characters.map((c,i)=>['character-'+(i+1)+'.json',strToU8(JSON.stringify(archiveSchema.parse({format:'trpg-character',version:1,character:c,packs:[]})))])))
  }
  await mkdir(path.join(root,'public/examples'),{recursive:true});const adventure=world.adventures[0]!,config=exportNpcConfig(world,adventure,adventure.ai!.npcs.map(n=>n.id));await writeFile(path.join(root,'public/examples/lamplit-inn-npcs.json'),JSON.stringify(config,null,2));await writeFile(path.join(root,'public/examples/lamplit-inn-npcs.xlsx'),new Uint8Array(await writeNpcXlsx(config,true)));
  const sums=[];for(const [name,value] of Object.entries(outputs)){await writeFile(path.join(dest,name),value);sums.push(createHash('sha256').update(value).digest('hex')+'  '+name)}await writeFile(path.join(dest,'SHA256SUMS.txt'),sums.join('\n')+'\n')
  const sourceDir=path.join(root,'examples/lamplit-inn');await mkdir(sourceDir,{recursive:true});for(const name of [...Object.keys(outputs),'SHA256SUMS.txt'])await copyFile(path.join(dest,name),path.join(sourceDir,name));
  return {files:Object.keys(outputs),scenes:world.adventures[0]!.scenes.length,characters:characters.length,scriptValid:!inspectScript(compiled.definition).missingDependencies.length}
}
