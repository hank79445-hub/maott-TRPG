import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ignored = new Set([
  'node_modules',
  '.git',
  '.local',
  'dist',
  'test-results',
  'playwright-report',
])
const files = []
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || (entry.name === 'cache' && directory.endsWith('.vitepress')))
      continue
    const absolute = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw Error('Publication must not contain symlinks')
    if (entry.isDirectory()) await walk(absolute)
    else files.push(path.relative(root, absolute).replaceAll('\\', '/'))
  }
}
await walk(root)
const forbidden =
  /(?:^|\/)(?:\.env(?:\..*)?|\.sources|credentials?\.json|access\.json|.*\.(?:pem|pfx|p12|key|chm))$/i
const excluded = [
  'src/content/phb-spells.json',
  'src/content/phb-spells.ts',
  'src/content/phb-advanced.ts',
  'src/content/phb-items.ts',
  'src/content/phb-source.ts',
  'src/content/nautiloid-config.ts',
]
const secret =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/
const failures = []
const manifest = []
for (const file of files.sort()) {
  if (forbidden.test(file) || excluded.includes(file) || file.startsWith('docs/NEW-CHAT-'))
    failures.push(file + ': excluded path')
  const bytes = await fs.readFile(path.join(root, file))
  if (/\.(?:[cm]?[jt]sx?|vue|css|html|json|md|txt|ya?ml|svg)$/i.test(file)) {
    const text = bytes.toString('utf8')
    if (secret.test(text)) failures.push(file + ': credential pattern')
    if (
      /C:[\\/](?:Users|ProgramData)[\\/]|16082[\\/](?:Documents|\.codex)|192\.168\.\d+\.\d+/.test(
        text,
      )
    )
      failures.push(file + ': private machine address')
  }
  manifest.push({
    file,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
}
const packs = await fs.readFile(path.join(root, 'src/content/builtin-packs.ts'), 'utf8')
if (/from\s+['"].*phb|from\s+['"].*nautiloid/.test(packs)) failures.push('Non-SRD built-in import')
const details = JSON.parse(
  await fs.readFile(path.join(root, 'src/content/spell-details-zh.json'), 'utf8'),
)
if (Object.keys(details).length) failures.push('Private detailed spell corpus must be absent')
const licenses = JSON.parse(
  await fs.readFile(path.join(root, 'docs/licenses/dependencies.json'), 'utf8'),
)
for (const pkg of licenses) {
  if (/unknown|unlicensed/i.test(pkg.license) || !pkg.notices.length)
    failures.push('Missing license provenance: ' + pkg.name)
  for (const notice of pkg.notices)
    await fs.access(path.join(root, 'docs/licenses/packages', notice))
}
for (const file of [
  'README.md',
  'README.en.md',
  'LICENSE',
  'LICENSE-NOTICE.md',
  'website/tutorial-index.json',
  'examples/lamplit-inn/lamplit-inn.trpg-script.zip',
])
  await fs.access(path.join(root, file))
await fs.mkdir(path.join(root, '.local/audit'), { recursive: true })
await fs.writeFile(
  path.join(root, '.local/audit/file-manifest.json'),
  JSON.stringify(manifest, null, 2),
)
const result = { files: files.length, dependencyLicenses: licenses.length, failures }
await fs.writeFile(path.join(root, '.local/audit/result.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
if (failures.length) process.exitCode = 1
