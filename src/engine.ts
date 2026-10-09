export type Fault = 'interrupt' | 'low-energy' | 'deadline' | 'scope-creep'
export type Phase = 'draft' | 'compiled' | 'sealed'

export interface ForgeState {
  v: 1
  seed: string
  intent: string
  phase: Phase
  faults: Fault[]
}

export interface Step {
  id: string
  verb: string
  object: string
  minutes: number
  guard: string
}

export interface Protocol {
  name: string
  steps: Step[]
  resilience: number
  firstCommand: string
  proof: string[]
}

export const FAULTS: readonly Fault[] = ['interrupt', 'low-energy', 'deadline', 'scope-creep']
export const MAX_INTENT = 80
export const MAX_SEED = 24
export const MAX_FAULTS = 3

const split = (value: string) => Array.from(value)
const hash = (value: string) => {
  let h = 2166136261
  for (const char of value) h = Math.imul(h ^ char.codePointAt(0)!, 16777619)
  return h >>> 0
}

export function validateSeed(seed: unknown): string {
  if (typeof seed !== 'string' || !/^[A-Za-z0-9_-]{1,24}$/.test(seed)) throw new Error('seedは英数字・_-で1〜24文字です')
  return seed
}

export function validateIntent(intent: unknown): string {
  if (typeof intent !== 'string') throw new Error('意図は文字列で指定してください')
  const clean = intent.trim()
  const size = split(clean).length
  if (size < 1 || size > MAX_INTENT) throw new Error(`意図は1〜${MAX_INTENT}文字です`)
  return clean
}

export function initial(seed = 'dawn-1010'): ForgeState {
  return { v: 1, seed: validateSeed(seed), intent: '', phase: 'draft', faults: [] }
}

export function compile(state: ForgeState, intent: unknown): ForgeState {
  return { ...state, intent: validateIntent(intent), phase: 'compiled', faults: [] }
}

export function inject(state: ForgeState, fault: unknown): ForgeState {
  if (state.phase === 'draft') throw new Error('先に意図をコンパイルしてください')
  if (typeof fault !== 'string' || !FAULTS.includes(fault as Fault)) throw new Error('未知の故障です')
  if (state.faults.includes(fault as Fault)) throw new Error('同じ故障は1回だけ注入できます')
  if (state.faults.length >= MAX_FAULTS) throw new Error(`故障は最大${MAX_FAULTS}件です`)
  return { ...state, faults: [...state.faults, fault as Fault], phase: 'compiled' }
}

export function seal(state: ForgeState): ForgeState {
  if (state.phase === 'draft') throw new Error('未コンパイルです')
  return { ...state, phase: 'sealed' }
}

export function derive(state: ForgeState): Protocol | null {
  if (state.phase === 'draft') return null
  const n = hash(`${state.seed}:${state.intent}`)
  const artifact = /コード|実装|アプリ|build/i.test(state.intent) ? '動く最小断面' : /資料|企画|提案|文章/.test(state.intent) ? '読める最初の1枚' : '第三者が確認できる最小成果'
  let minutes = [7, 12, 6]
  let verbs = ['境界を切る', '形にする', '外へ出す']
  const guards = ['完成条件を1行で固定', '途中でも成果物を保存', '反応か実行ログを残す']
  const proof: string[] = ['trigger: いま開く', `artifact: ${artifact}`, 'finish: 他者が確認できる']

  for (const fault of state.faults) {
    if (fault === 'interrupt') {
      guards[1] = '3分ごとに再開地点を刻む'
      proof.push('PATCH interrupt → checkpointを追加')
    }
    if (fault === 'low-energy') {
      verbs = ['1つだけ選ぶ', '雛形に置く', '見える場所へ出す']
      minutes = [3, 7, 3]
      proof.push('PATCH low-energy → 判断回数を削減')
    }
    if (fault === 'deadline') {
      minutes = minutes.map((m) => Math.max(2, Math.ceil(m * 0.55)))
      guards[2] = '期限時点の断面をそのまま提出'
      proof.push('PATCH deadline → 時間を圧縮')
    }
    if (fault === 'scope-creep') {
      guards[0] = `${artifact}以外を隔離`
      proof.push('PATCH scope-creep → 成果物を単一化')
    }
  }

  const steps: Step[] = verbs.map((verb, i) => ({ id: `S${i + 1}`, verb, object: i === 0 ? state.intent : i === 1 ? artifact : '証拠つきの断面', minutes: minutes[i], guard: guards[i] }))
  const resilience = Math.min(99, 42 + state.faults.length * 17 + (n % 7))
  return {
    name: `PF-${(n % 65535).toString(16).toUpperCase().padStart(4, '0')}`,
    steps,
    resilience,
    firstCommand: `${steps[0].minutes}分だけ：${steps[0].object} — ${steps[0].verb}`,
    proof,
  }
}

export function parseState(value: unknown): ForgeState {
  if (!value || typeof value !== 'object') throw new Error('共有データが不正です')
  const x = value as Record<string, unknown>
  if (x.v !== 1 || !['draft', 'compiled', 'sealed'].includes(String(x.phase))) throw new Error('共有データの版が不正です')
  const seed = validateSeed(x.seed)
  const intent = x.phase === 'draft' ? '' : validateIntent(x.intent)
  if (!Array.isArray(x.faults) || x.faults.length > MAX_FAULTS || new Set(x.faults).size !== x.faults.length || x.faults.some((f) => typeof f !== 'string' || !FAULTS.includes(f as Fault))) throw new Error('故障履歴が不正です')
  return { v: 1, seed, intent, phase: x.phase as Phase, faults: x.faults as Fault[] }
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
const base64ToBytes = (token: string) => {
  if (!/^[A-Za-z0-9_-]{1,1800}$/.test(token)) throw new Error('共有トークンが不正です')
  const binary = atob(token.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
export function encode(state: ForgeState): string {
  const compact = { v: 1, seed: state.seed, intent: state.intent, phase: state.phase, faults: state.faults }
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(compact)))
}
export function decode(token: string): ForgeState {
  try { return parseState(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(token)))) }
  catch { throw new Error('共有プロトコルを復元できません') }
}
