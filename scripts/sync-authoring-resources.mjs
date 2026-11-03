import { build } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

// No HTTP listener, user data, credentials or runtime configuration.
const root = fileURLToPath(new URL('../', import.meta.url))
const option=process.argv.find(v=>v.startsWith('--output-root='))?.slice('--output-root='.length)
const out = path.resolve(root,option??'.local/authoring-workbench-sync-v01/resource-tool')
if(!out.startsWith(path.join(root,'.local')+path.sep))throw Error('资源工具构建只能位于本仓库.local隔离目录')
await build({
  root,
  configFile: false,
  envDir: false,
  publicDir: false,
  logLevel: 'error',
  build: {
    ssr: path.join(root, 'scripts/authoring-resource-entry.ts'),
    outDir: out,
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: 'resources.mjs' } },
  },
})
{
  const { authoringModelFiles, authoringExample, authoringWorkbenchExample, authoringPrompt,localizeSyntheticAuthoringExample } =
    await import(pathToFileURL(path.join(out, 'resources.mjs')).href)
  const modelFiles = authoringModelFiles(
    '按需求生成原创冒险；基础人数、等级与时长未指定时由模型建议。',
  )
  const outputs = {
    'public/examples/authoring-schema.json': modelFiles['schema.json'],
    'public/examples/authoring-capabilities.json': modelFiles['capabilities.json'],
    'public/examples/generation-sample.json': JSON.stringify(authoringExample(), null, 2),
    'public/examples/workbench-sample.json': JSON.stringify(authoringWorkbenchExample(), null, 2),
    'public/examples/generation-prompt.txt': authoringPrompt(
      '按需求生成原创冒险；基础人数、等级与时长未指定时由模型建议。',
      authoringExample(),
    ),
  }
  const englishRequirements={contentLocale:'en'},englishBrief='Create an original adventure. Recommend party size, level and duration when unspecified.'
  const englishFiles=authoringModelFiles(englishBrief,englishRequirements,[],undefined,'en')
  const englishExample=localizeSyntheticAuthoringExample(authoringExample(),'en')
  Object.assign(outputs,{
    'public/examples/generation-sample.en.json':JSON.stringify(englishExample,null,2),
    'public/examples/workbench-sample.en.json':JSON.stringify(localizeSyntheticAuthoringExample(authoringWorkbenchExample(),'en'),null,2),
    'public/examples/generation-prompt.en.txt':authoringPrompt(englishBrief,englishExample,englishRequirements,[],undefined,'en'),
    'public/examples/authoring-capabilities.en.json':englishFiles['capabilities.json'],
  })
  const mismatches = []
  for (const [path, text] of Object.entries(outputs)) {
    const expected = text + '\n'
    if (process.argv.includes('--check')) {
      if (
        (await readFile(new URL('../' + path, import.meta.url), 'utf8').catch(() => '')) !==
        expected
      )
        mismatches.push(path)
    } else await writeFile(new URL('../' + path, import.meta.url), expected, 'utf8')
  }
  if (mismatches.length)
    throw Error(
      '静态创作资源已漂移，请运行 node scripts/sync-authoring-resources.mjs：' +
        mismatches.join('、'),
    )
  console.log(
    `${process.argv.includes('--check') ? '已核对' : '已同步'} ${Object.keys(outputs).length} 份静态创作资源`,
  )
}
