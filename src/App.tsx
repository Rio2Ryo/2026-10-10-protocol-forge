import { useEffect, useRef, useState } from 'react'
import { compile, decode, derive, encode, initial, inject, seal, type Fault, type ForgeState } from './engine'

const faultMeta: Record<Fault, { label: string; mark: string; note: string }> = {
  interrupt: { label: '割り込み', mark: '↯', note: '再開地点を奪う' },
  'low-energy': { label: '低エネルギー', mark: '◒', note: '判断力を半分にする' },
  deadline: { label: '締切前倒し', mark: '⧖', note: '使える時間を潰す' },
  'scope-creep': { label: '範囲膨張', mark: '↗', note: '成果物を増殖させる' },
}

const loadInitial = (): { state: ForgeState; notice: string } => {
  const match = location.hash.match(/^#p=([A-Za-z0-9_-]+)$/)
  if (!match) return { state: initial(), notice: '' }
  try { return { state: decode(match[1]), notice: '共有プロトコルを復元しました' } }
  catch { history.replaceState(null, '', location.pathname + location.search); return { state: initial(), notice: '壊れた共有データを隔離しました' } }
}

export default function App() {
  const [loaded] = useState(() => loadInitial())
  const [state, setReactState] = useState(loaded.state)
  const stateRef = useRef(state)
  const [draft, setDraft] = useState(state.intent || '今日の新しい体験を、誰かが触れる形まで出す')
  const [notice, setNotice] = useState(loaded.notice)
  const [copied, setCopied] = useState(false)
  const setState = (next: ForgeState) => { stateRef.current = next; setReactState(next) }
  const protocol = derive(state)
  const baseline = state.phase === 'draft' ? null : derive({ ...state, faults: [] })

  const action = (fn: () => ForgeState, message: string) => {
    try { setState(fn()); setNotice(message); setCopied(false) }
    catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
  }
  const compileDraft = () => action(() => compile(stateRef.current, draft), '構文検査完了。壊して強度を見てください')
  const injectFault = (fault: Fault) => action(() => inject(stateRef.current, fault), `${faultMeta[fault].label}を注入。プロトコルを再配線しました`)
  const sealProtocol = () => action(() => seal(stateRef.current), 'プロトコルを封印。最初の命令だけ実行してください')
  const share = async () => {
    try {
      const token = encode(stateRef.current)
      const url = `${location.origin}${location.pathname}#p=${token}`
      history.replaceState(null, '', `#p=${token}`)
      await navigator.clipboard.writeText(url)
      setCopied(true); setNotice(`共有URLをコピーしました（${url.length}文字）`)
    } catch { setNotice('URLはアドレス欄に生成しました。手動でコピーしてください') }
  }
  const reset = (seed = 'dawn-1010') => { const next = initial(seed); setState(next); setDraft('今日の新しい体験を、誰かが触れる形まで出す'); history.replaceState(null, '', location.pathname); setNotice('炉を冷却しました') }

  const apiRef = useRef({
    version: 1 as const,
    getState: () => structuredClone(stateRef.current),
    compile: (intent: unknown) => { const next = compile(stateRef.current, intent); setState(next); return structuredClone(next) },
    inject: (fault: unknown) => { const next = inject(stateRef.current, fault); setState(next); return structuredClone(next) },
    seal: () => { const next = seal(stateRef.current); setState(next); return structuredClone(next) },
    reset: (seed?: string) => { reset(seed); return structuredClone(stateRef.current) },
    exportToken: () => encode(stateRef.current),
    getProtocol: () => structuredClone(derive(stateRef.current)),
  })
  useEffect(() => {
    window.__PROTOCOL_FORGE__ = apiRef.current
  }, [])

  return <main>
    <header className="masthead">
      <div><p className="eyebrow">DAWN SYSTEMS / BUILD 1010</p><h1>PROTOCOL<br/><i>FORGE</i></h1></div>
      <div className="status"><span className={`lamp ${state.phase}`} />{state.phase.toUpperCase()}<small>SEED {state.seed}</small></div>
    </header>

    <section className="hero" aria-labelledby="forge-title">
      <div className="hero-copy"><p>励まさない。<br/><strong>壊れても動く手順</strong>にする。</p><span>意図をコンパイルし、現実の故障を注入して、朝の最初の命令を取り出します。</span></div>
      <div className="input-rig">
        <label htmlFor="intent">01 / 今朝、何を現実に出す？</label>
        <div className="input-line"><textarea id="intent" value={draft} maxLength={160} rows={2} onChange={(e) => setDraft(Array.from(e.target.value).slice(0, 80).join(''))} disabled={state.phase === 'sealed'} /><button className="compile" onClick={compileDraft} disabled={state.phase === 'sealed'}>COMPILE <b>↵</b></button></div>
        <div className="meter"><span>{Array.from(draft).length}/80 GLYPHS</span><span>NO CLOUD / DETERMINISTIC</span></div>
      </div>
    </section>

    {state.phase === 'draft' ? <section className="empty-rig"><div className="crosshair" /><p>意図を入れると、ここに実行回路が鋳造されます。</p><b>最初の10秒：COMPILE → 故障を注入 → 変化を見る</b></section> : <>
      <section className="fault-bench" aria-labelledby="fault-title"><div><p className="section-no">02 / BREAK IT</p><h2 id="fault-title">現実を注入する</h2><p>美しい計画は要らない。壊した後に残る手順を作る。</p></div><div className="faults">{(Object.keys(faultMeta) as Fault[]).map((fault) => { const active = state.faults.includes(fault); return <button key={fault} className={active ? 'fault active' : 'fault'} aria-pressed={active} disabled={active || state.faults.length >= 3 || state.phase === 'sealed'} onClick={() => injectFault(fault)}><b>{faultMeta[fault].mark}</b><span>{faultMeta[fault].label}<small>{active ? 'PATCHED' : faultMeta[fault].note}</small></span></button> })}</div></section>

      <section className="protocol-area"><div className="protocol-head"><div><p className="section-no">03 / HARDENED PROTOCOL</p><h2>{protocol?.name}</h2></div><div className="resilience"><span>RESILIENCE</span><strong>{protocol?.resilience}</strong><i style={{ '--score': `${protocol?.resilience}%` } as React.CSSProperties} /></div></div>
        <div className="steps">{protocol?.steps.map((step, index) => <article className="step" key={step.id}><div className="step-index">{step.id}<span>{step.minutes}m</span></div><div><small>{index === 0 ? 'TRIGGER' : index === 1 ? 'BUILD' : 'PROVE'}</small><h3>{step.verb}</h3><p>{step.object}</p><em>IF FAIL → {step.guard}</em></div></article>)}</div>
        {state.faults.length > 0 && <div className="diff"><span>BEFORE <b>{baseline?.steps.reduce((sum, s) => sum + s.minutes, 0)}m</b></span><i>→</i><span>HARDENED <b>{protocol?.steps.reduce((sum, s) => sum + s.minutes, 0)}m</b></span><p>{protocol?.proof.at(-1)}</p></div>}
      </section>

      <section className="console"><div><p className="section-no">PATCH TRACE</p>{protocol?.proof.map((line, index) => <code key={`${line}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{line}</code>)}</div><div className="seal"><p>故障を最低1つ注入すると、朝の命令を封印できます。</p><button onClick={sealProtocol} disabled={state.faults.length < 1 || state.phase === 'sealed'}>{state.phase === 'sealed' ? 'SEALED ✓' : 'SEAL PROTOCOL'}</button></div></section>
    </>}

    {state.phase === 'sealed' && protocol && <section className="receipt" aria-live="polite"><p>EXECUTE FIRST / これだけやる</p><h2>{protocol.firstCommand}</h2><div><button onClick={share}>{copied ? 'COPIED ✓' : 'COPY REPLAY URL'}</button><button className="ghost" onClick={() => reset()}>NEW FORGE</button></div></section>}
    <footer><span aria-live="polite">{notice || '炉は待機中です'}</span><span>CLI / DEBUG / SHARE READY</span></footer>
  </main>
}

declare global {
  interface Window { __PROTOCOL_FORGE__: { version: 1; getState(): ForgeState; compile(intent: unknown): ForgeState; inject(fault: unknown): ForgeState; seal(): ForgeState; reset(seed?: string): ForgeState; exportToken(): string; getProtocol(): ReturnType<typeof derive> } }
}
