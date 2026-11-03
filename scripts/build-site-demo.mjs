import {build} from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const root=process.cwd(),base=path.join(root,'.local/site-demo')
await fs.mkdir(base,{recursive:true})
await build({root,configFile:false,envDir:false,publicDir:false,logLevel:'error',build:{ssr:'scripts/site-demo-data.ts',outDir:base+'/tool',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'data.mjs'}}}})
const {writeDemoData}=await import(pathToFileURL(base+'/tool/data.mjs').href);console.log(await writeDemoData(root))
const entry=`import {createApp,defineComponent,h} from 'vue';import {createPinia} from 'pinia';import {i18n} from '../../src/app/i18n';import {useWorkshop} from '../../src/app/store';import RoomPanel from '../../src/modules/RoomPanel.vue';import App from '../../src/app/App.vue';import '../../src/app/style.css';import '../../src/app/inventory.css';import '../../src/app/combat.css';import '../../src/app/map.css';import '../../src/app/room.css';import '../../src/app/i18n/layout.css';import '../../src/app/character.css';import '../../src/app/gm-workspace.css';const p=new URLSearchParams(location.search),role=p.get('role')==='gm'?'gm':'player',prefix=p.has('battle')?'battle-':'';const view=await(await fetch('./'+prefix+role+'.json')).json(),gm=role==='gm'?view:await(await fetch('./'+prefix+'gm.json')).json();const pinia=createPinia(),store=useWorkshop(pinia);Object.assign(store,{characters:gm.world.characters,adventures:gm.world.adventures,encounters:gm.world.encounters,packs:view.packs,loaded:true});document.documentElement.dataset.theme=p.get('theme')==='dark'?'dark':'light';createApp(p.get('surface')==='app'?App:defineComponent({setup(){return()=>h(RoomPanel,{active:true,createdRoom:{roomId:view.id,token:'offline-demo',invite:'DEMO-ONLY',view}})}})).use(pinia).use(i18n).mount('#app');`
await fs.writeFile(base+'/entry.ts',entry);await fs.writeFile(base+'/index.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="./entry.ts"></script>')
await build({root,configFile:false,envDir:false,publicDir:false,plugins:[vue()],build:{outDir:base+'/dist',emptyOutDir:true,rollupOptions:{input:base+'/index.html'}}})
await fs.copyFile(base+'/dist/.local/site-demo/index.html',base+'/dist/index.html')
for(const f of ['gm.json','player.json','battle-gm.json','battle-player.json','contents.json','sources.json'])await fs.copyFile(base+'/'+f,base+'/dist/'+f)
for(const f of (await fs.readdir(base)).filter(f=>f.startsWith('asset-')&&f.endsWith('.png')))await fs.copyFile(base+'/'+f,base+'/dist/'+f)
