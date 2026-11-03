import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
const args = process.argv.slice(2),
  get = (k) => args[args.indexOf(k) + 1]
if (!args.includes('--output') || !args.includes('--username'))
  throw Error('Usage: node scripts/create-access.mjs --output <private-new-file> --username <name>')
const output = path.resolve(get('--output')),
  username = get('--username')
if (!/^[a-zA-Z0-9_-]{1,40}$/.test(username)) throw Error('Invalid username')
const password = randomBytes(18).toString('base64url'),
  salt = randomBytes(16).toString('hex'),
  hash = scryptSync(password, Buffer.from(salt, 'hex'), 32).toString('hex')
await mkdir(path.dirname(output), { recursive: true })
await writeFile(
  output,
  JSON.stringify(
    {
      version: 2,
      signingKey: randomBytes(32).toString('base64url'),
      accounts: [{ accountId: randomUUID(), username, salt, hash, enabled: true }],
    },
    null,
    2,
  ),
  { flag: 'wx', mode: 0o600 },
)
console.log(
  'Created a new private access config. Save the following generated password locally; it is shown only once.',
)
console.log('Username: ' + username + '\nPassword: ' + password)
