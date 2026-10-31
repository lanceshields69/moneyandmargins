import { describe, expect, it } from 'vitest'
import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import { buildAllRaces, type RaceView } from './computeSpending'
import { initialSelection, parseHashState, pickDefaultState } from './defaultState'
import type { Candidate, NomineesFile, Party, SpendingFile } from './types'

const nominees = nomineesJson as unknown as NomineesFile
const spending = spendingJson as unknown as SpendingFile

const swapParty = (p: Party): Party => (p === 'D' ? 'R' : p === 'R' ? 'D' : 'I')
const swapFecCode = (code: string): string => (code === 'DEM' || code === 'DFL' ? 'REP' : code === 'REP' ? 'DEM' : code)
const swapCandidate = (c: Candidate): Candidate => ({
  ...c,
  party: swapParty(c.party),
  fecMatches: c.fecMatches?.map((m) => ({ ...m, fecParty: swapFecCode(m.fecParty) })),
})

function race(state: string, total: number | null, incompleteCount = 0): RaceView {
  return { raceId: `${state}-2026`, state, raceName: `${state} Senate 2026`, isSpecial: false, rows: [], scaleMax: 0, total, incompleteCount, missingMajor: [] }
}

describe('default state rule', () => {
  const real = buildAllRaces(nominees, spending).races

  it('picks the same state when the party labels are swapped', () => {
    const swapped = buildAllRaces({ ...nominees, candidates: nominees.candidates.map(swapCandidate) }, spending).races
    expect(pickDefaultState(swapped)).toBe(pickDefaultState(real))
    expect(pickDefaultState(real)).not.toBeNull()
  })

  it('skips a state flagged incomplete, even when it has the most spending', () => {
    const races = [race('AA', 100, 1), race('BB', 50), race('CC', 70)]
    expect(pickDefaultState(races)).toBe('CC')
  })

  it('picks the highest-spending complete race in the real data, whatever the data currently is', () => {
    const eligible = real.filter((r) => r.incompleteCount === 0 && r.total !== null)
    const best = [...eligible].sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || a.state.localeCompare(b.state))[0]
    expect(pickDefaultState(real)).toBe(best.state)
    expect(real.find((r) => r.state === pickDefaultState(real))?.incompleteCount).toBe(0)
  })

  it('breaks a tie by state code and returns null when nothing is eligible', () => {
    expect(pickDefaultState([race('ZZ', 10), race('AA', 10)])).toBe('AA')
    expect(pickDefaultState([race('AA', null), race('BB', 5, 2)])).toBeNull()
    expect(pickDefaultState([])).toBeNull()
  })
})

describe('hash links', () => {
  const real = buildAllRaces(nominees, spending).races
  const valid = new Set(real.map((r) => r.state))
  const fallback = pickDefaultState(real)

  it('reads #TX and #tx, and ignores anything that is not a state with a race', () => {
    expect(parseHashState('#TX', valid)).toBe('TX')
    expect(parseHashState('#tx', valid)).toBe('TX')
    expect(parseHashState('#map', valid)).toBeNull()
    expect(parseHashState('#CA', valid)).toBeNull()
    expect(parseHashState('', valid)).toBeNull()
  })

  it('lets a hash override the default on desktop', () => {
    const picked = initialSelection({ hash: '#OH', isMobile: false, races: real })
    expect(picked).toEqual({ state: 'OH', isDefault: false })
    expect(picked.state).not.toBe(fallback)
  })

  it('uses the rule when there is no usable hash', () => {
    expect(initialSelection({ hash: '', isMobile: false, races: real })).toEqual({ state: fallback, isDefault: true })
    expect(initialSelection({ hash: '#nonsense', isMobile: false, races: real })).toEqual({ state: fallback, isDefault: true })
  })

  it('starts closed on a phone with no hash, but opens a hash link', () => {
    expect(initialSelection({ hash: '', isMobile: true, races: real })).toEqual({ state: null, isDefault: false })
    expect(initialSelection({ hash: '#TX', isMobile: true, races: real })).toEqual({ state: 'TX', isDefault: false })
  })
})
