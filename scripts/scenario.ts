import { compile, derive, encode, initial, inject, seal, type Fault } from '../src/engine'

const argv = process.argv.slice(2)
const allowed = new Set(['seed', 'intent', 'fault', 'seal'])
const readArgs = () => {
  const out = new Map<string, string[]>()
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    if (!raw.startsWith('--')) throw new Error(`未知の引数: ${raw}`)
    const [key, inline] = raw.slice(2).split(/=(.*)/s, 2)
    if (!allowed.has(key)) throw new Error(`未知のオプション: --${key}`)
    let value = inline
    if (value === undefined) {
      if (key === 'seal') value = 'true'
      else {
        value = argv[++i]
        if (!value || value.startsWith('--')) throw new Error(`--${key} の値がありません`)
      }
    }
    out.set(key, [...(out.get(key) ?? []), value])
  }
  return out
}

try {
  const args = readArgs()
  if (args.get('seed')?.length !== 1 || args.get('intent')?.length !== 1) throw new Error('--seed と --intent を1つずつ指定してください')
  let state = compile(initial(args.get('seed')![0]), args.get('intent')![0])
  for (const fault of args.get('fault') ?? []) state = inject(state, fault as Fault)
  if (args.has('seal')) state = seal(state)
  const protocol = derive(state)!
  const token = encode(state)
  process.stdout.write(`${JSON.stringify({ state, protocol, token, sharePath: `#p=${token}`, tokenLength: token.length }, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`scenario error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 2
}
