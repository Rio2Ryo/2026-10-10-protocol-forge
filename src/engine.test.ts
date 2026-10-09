import { describe, expect, it } from 'vitest'
import { compile, decode, derive, encode, initial, inject, parseState, seal } from './engine'

describe('protocol forge engine', () => {
  it('is deterministic and faults change mechanics', () => {
    const base = compile(initial('same-seed'), '新しいアプリを公開する')
    expect(derive(base)).toEqual(derive(compile(initial('same-seed'), '新しいアプリを公開する')))
    const hardened = inject(inject(base, 'low-energy'), 'deadline')
    expect(derive(hardened)?.steps.map((s) => s.minutes)).not.toEqual(derive(base)?.steps.map((s) => s.minutes))
    expect(derive(hardened)?.firstCommand).not.toEqual(derive(base)?.firstCommand)
  })

  it('round trips a sealed maximum unicode state', () => {
    const phrase = '🧪'.repeat(80)
    const state = seal(inject(inject(inject(compile(initial('x'.repeat(24)), phrase), 'interrupt'), 'deadline'), 'scope-creep'))
    expect(decode(encode(state))).toEqual(state)
  })

  it('rejects malformed nested state and duplicate faults', () => {
    expect(() => parseState({ v: 1, seed: 'ok', intent: 'x', phase: 'compiled', faults: [null] })).toThrow()
    expect(() => parseState({ v: 1, seed: 'ok', intent: 'x', phase: 'compiled', faults: ['deadline', 'deadline'] })).toThrow()
    expect(() => decode('e30')).toThrow()
  })

  it('rejects over-limit input and unknown faults', () => {
    expect(() => compile(initial(), 'a'.repeat(81))).toThrow()
    expect(() => inject(compile(initial(), 'x'), '__proto__')).toThrow()
  })
})
