import {build} from 'vite'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
const root=process.cwd(),out=path.join(root,'.local/example-tool')
await build({root,configFile:false,envDir:false,publicDir:false,logLevel:'error',build:{ssr:'scripts/example-entry.ts',outDir:out,emptyOutDir:true,rollupOptions:{output:{entryFileNames:'example.mjs'}}}})
const {writeExample}=await import(pathToFileURL(out+'/example.mjs').href)
console.log(JSON.stringify(await writeExample(root)))
