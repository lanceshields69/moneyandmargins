import { describe, expect, it } from 'vitest'
import knownJson from '../data/known-incomplete.json'
import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import { countFecIdClaims, incompleteCodes, knownIncompleteProblems, reasonFor, type KnownIncomplete } from './incomplete'
import type { Candidate, FecMatch, NomineesFile, Party, SpendingFile } from './types'

const PARTIES: Party[] = ['D', 'R', 'I']
const FEC_CODE: Record<Party, string> = { D: 'DEM', R: 'REP', I: 'IND' }
const otherParty = (p: Party): Party => (p === 'D' ? 'R' : p === 'R' ? 'D' : 'D')

function candidate(party: Party, over: Partial<Candidate> = {}, match: Partial<FecMatch> = {}): Candidate {
  const m: FecMatch = { id: 'S0XX00001', fecName: 'DOE, JANE', fecParty: FEC_CODE[party], cycles: [2024, 2026], method: '2a-name-match', ...match }
  return { id: `XX-2026--${party}`, raceId: 'XX-2026', name: 'Jane Doe', party, fecIds: [m.id], fecMatches: [m], ...over }
}

const codesOf = (c: Candidate, all: Candidate[] = [c], hasSpending = true) =>
  incompleteCodes(c, countFecIdClaims(all), hasSpending)

describe('incomplete-data rules apply identically to every party', () => {
  const scenarios: { name: string; build: (p: Party) => Candidate; expected: string[] }[] = [
    { name: 'clean match', build: (p) => candidate(p), expected: [] },
    { name: 'no FEC ID', build: (p) => candidate(p, { fecIds: [], fecMatches: [] }), expected: ['no-fec-match'] },
    { name: 'FEC party differs from ballot party', build: (p) => candidate(p, {}, { fecParty: FEC_CODE[otherParty(p)] }), expected: ['party-mismatch'] },
    { name: 'fuzzy match corroborated by party', build: (p) => candidate(p, {}, { method: 'fec-name-search' }), expected: [] },
    { name: 'fuzzy match with unresolvable FEC party', build: (p) => candidate(p, {}, { method: 'fec-name-search', fecParty: 'UNK' }), expected: ['uncorroborated-name-match'] },
    { name: 'exact match with unresolvable FEC party', build: (p) => candidate(p, {}, { fecParty: 'UNK' }), expected: [] },
    { name: 'ID not in 2026 cycle', build: (p) => candidate(p, {}, { cycles: [2022, 2024] }), expected: ['id-not-in-2026-cycle'] },
    {
      name: 'two IDs',
      build: (p) => candidate(p, { fecIds: ['S0XX00001', 'S0XX00002'], fecMatches: [{ id: 'S0XX00001', fecName: 'A', fecParty: FEC_CODE[p], cycles: [2026], method: '2a-name-match' }, { id: 'S0XX00002', fecName: 'B', fecParty: FEC_CODE[p], cycles: [2026], method: '2a-name-match' }] }),
      expected: ['multiple-ids'],
    },
  ]

  for (const s of scenarios) {
    it(`${s.name}: same result for D, R and I`, () => {
      for (const p of PARTIES) expect(codesOf(s.build(p)).sort()).toEqual([...s.expected].sort())
    })
  }

  it('an ID claimed by two nominees flags both, whatever their parties', () => {
    for (const [a, b] of [['D', 'D'], ['R', 'R'], ['D', 'R'], ['R', 'I']] as [Party, Party][]) {
      const first = candidate(a, { id: 'one' }, { fecParty: FEC_CODE[a] })
      const second = candidate(b, { id: 'two' }, { fecParty: FEC_CODE[b] })
      expect(codesOf(first, [first, second])).toContain('id-claimed-twice')
      expect(codesOf(second, [first, second])).toContain('id-claimed-twice')
    }
  })

  it('a missing spending record flags every party', () => {
    for (const p of PARTIES) expect(codesOf(candidate(p), undefined, false)).toEqual(['missing-spending-record'])
  })

  it('shows "No FEC match" ahead of "ID needs review"', () => {
    expect(reasonFor(['party-mismatch', 'no-fec-match'])).toBe('No FEC match')
    expect(reasonFor(['party-mismatch'])).toBe('ID needs review')
    expect(reasonFor([])).toBeNull()
  })
})

describe('reviewed list gate', () => {
  const flagged = (p: Party) => candidate(p, { id: `flag-${p}`, fecIds: [], fecMatches: [] })

  it('requires a reviewed entry for a flagged D or R, and not for a flagged I', () => {
    const ids = new Set<string>()
    expect(knownIncompleteProblems([flagged('D')], ids, [])).toHaveLength(1)
    expect(knownIncompleteProblems([flagged('R')], ids, [])).toHaveLength(1)
    expect(knownIncompleteProblems([flagged('I')], ids, [])).toHaveLength(0)
  })

  it('accepts a listed entry with a reason, rejects an empty reason or a stale entry', () => {
    const ids = new Set<string>()
    expect(knownIncompleteProblems([flagged('D')], ids, [{ candidateId: 'flag-D', reason: 'Checked FEC: no filing' }])).toEqual([])
    expect(knownIncompleteProblems([flagged('D')], ids, [{ candidateId: 'flag-D', reason: ' ' }])).toHaveLength(1)
    expect(knownIncompleteProblems([candidate('D')], new Set(['XX-2026--D']), [{ candidateId: 'XX-2026--D', reason: 'old' }])).toHaveLength(1)
  })
})

describe('real data', () => {
  const nominees = nomineesJson as unknown as NomineesFile
  const spendingIds = new Set((spendingJson as unknown as SpendingFile).totals.map((t) => t.candidateId))
  const flaggedMap = (candidates: Candidate[]) => {
    const claims = countFecIdClaims(candidates)
    return candidates.map((c) => incompleteCodes(c, claims, spendingIds.has(c.id)).sort().join(',')).join('|')
  }

  it('has no unreviewed Democratic or Republican flags', () => {
    expect(knownIncompleteProblems(nominees.candidates, spendingIds, knownJson as KnownIncomplete[])).toEqual([])
  })

  it('flags the same nominees when D and R are swapped throughout', () => {
    const swap = (p: Party): Party => (p === 'D' ? 'R' : p === 'R' ? 'D' : 'I')
    const swapCode = (code: string) => (code === 'DEM' ? 'REP' : code === 'REP' ? 'DEM' : code === 'DFL' ? 'REP' : code)
    const swapped = nominees.candidates.map((c) => ({
      ...c,
      party: swap(c.party),
      fecMatches: c.fecMatches?.map((m) => ({ ...m, fecParty: swapCode(m.fecParty) })),
    }))
    expect(flaggedMap(swapped)).toBe(flaggedMap(nominees.candidates))
  })
})
