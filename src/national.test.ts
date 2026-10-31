import { describe, expect, it } from 'vitest'
import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import { buildNationalCard } from './computeNational'
import { buildAllRaces, PARTY_DISPLAY, type RaceView, type RowView } from './computeSpending'
import type { Candidate, NomineesFile, Party, SpendingFile } from './types'

const nominees = nomineesJson as unknown as NomineesFile
const spending = spendingJson as unknown as SpendingFile

function row(id: string, party: Party, support: number, oppose: number): RowView {
  const display = PARTY_DISPLAY[party]
  return {
    candidateId: id, name: id, party, partyLabel: display.label, partyColor: display.color, incomplete: false, reason: null,
    support: { value: support, widthPct: 0 }, oppose: { value: oppose, widthPct: 0 },
    topSupportCommittees: [], topOpposeCommittees: [], sourceUrl: null, asOf: null,
  }
}

function race(state: string, rows: RowView[], incompleteCount = 0): RaceView {
  return { raceId: `${state}-2026`, state, raceName: state, isSpecial: false, rows, scaleMax: 0, total: 0, incompleteCount, missingMajor: [] }
}

const group = (card: ReturnType<typeof buildNationalCard>, party: Party) => card.groups.find((g) => g.party === party)

describe('party card formula', () => {
  const races = [race('AA', [row('a', 'D', 30, 10), row('b', 'R', 20, 40)])]
  const card = buildNationalCard(races, null)

  it('counts support for the party plus opposition to the other side, as separate parts', () => {
    expect(group(card, 'D')?.supporting.dollars).toBe(30)
    expect(group(card, 'D')?.opposing.dollars).toBe(40)
    expect(group(card, 'D')?.total).toBe(70)
    expect(group(card, 'R')?.supporting.dollars).toBe(20)
    expect(group(card, 'R')?.opposing.dollars).toBe(10)
    expect(group(card, 'R')?.total).toBe(30)
  })

  it('accounts for all four amounts exactly once', () => {
    expect(card.groups.reduce((n, g) => n + g.total, 0)).toBe(30 + 10 + 20 + 40)
  })

  it('draws both bars on one scale', () => {
    expect(card.scaleMax).toBe(70)
    expect(group(card, 'D')?.supporting.widthPct).toBeCloseTo((30 / 70) * 100)
    expect(group(card, 'D')!.supporting.widthPct + group(card, 'D')!.opposing.widthPct).toBeCloseTo(100)
  })

  it('shows the selected state\'s part of each bar', () => {
    const picked = buildNationalCard(races, 'AA')
    expect(group(picked, 'D')?.stateTotal).toBe(70)
    expect(group(buildNationalCard(races, 'ZZ'), 'D')?.stateTotal).toBe(0)
    expect(group(picked, 'D')!.supporting.statePct).toBeCloseTo(100)
  })
})

describe('party card scope', () => {
  it('leaves out races with incomplete data and says how many', () => {
    const races = [race('AA', [row('a', 'D', 30, 10), row('b', 'R', 20, 40)]), race('BB', [row('c', 'D', 999, 999), row('d', 'R', 999, 999)], 1)]
    const card = buildNationalCard(races, null)
    expect(card.excludedRaces).toBe(1)
    expect(card.includedRaces).toBe(1)
    expect(card.groups.reduce((n, g) => n + g.total, 0)).toBe(100)
  })

  it('adds an independent bar only where an independent nominee has spending', () => {
    const withSpend = buildNationalCard([race('AA', [row('a', 'R', 5, 1), row('i', 'I', 9, 2)])], null)
    expect(withSpend.groups.map((g) => g.party)).toEqual(['D', 'R', 'I'])
    expect(group(withSpend, 'I')?.supporting.dollars).toBe(9)
    expect(group(withSpend, 'I')?.opposing.dollars).toBe(5 * 0 + 1)
    // Opposition to the Republican counts toward the independent's aligned total, but a bar needs the
    // independent's own reported spending.
    const noSpend = buildNationalCard([race('AA', [row('a', 'R', 5, 1), row('i', 'I', 0, 0)])], null)
    expect(noSpend.groups.map((g) => g.party)).toEqual(['D', 'R'])
  })
})

describe('party card symmetry', () => {
  const swapParty = (p: Party): Party => (p === 'D' ? 'R' : p === 'R' ? 'D' : 'I')
  const swapFecCode = (code: string): string => (code === 'DEM' || code === 'DFL' ? 'REP' : code === 'REP' ? 'DEM' : code)
  const swapCandidate = (c: Candidate): Candidate => ({
    ...c,
    party: swapParty(c.party),
    fecMatches: c.fecMatches?.map((m) => ({ ...m, fecParty: swapFecCode(m.fecParty) })),
  })

  it('mirrors the two bars when the labels are swapped (synthetic)', () => {
    const original = buildNationalCard([race('AA', [row('a', 'D', 30, 10), row('b', 'R', 20, 40)])], 'AA')
    const swapped = buildNationalCard([race('AA', [row('a', 'R', 30, 10), row('b', 'D', 20, 40)])], 'AA')
    for (const party of ['D', 'R'] as Party[]) {
      const mine = group(swapped, party)!
      const theirs = group(original, swapParty(party))!
      expect(mine.supporting).toEqual(theirs.supporting)
      expect(mine.opposing).toEqual(theirs.opposing)
      expect(mine.label).toBe(PARTY_DISPLAY[party].label)
      expect(mine.color).toBe(PARTY_DISPLAY[party].color)
    }
    expect(swapped.groups.map((g) => g.party)).toEqual(original.groups.map((g) => g.party))
  })

  for (const state of [null, 'TX', 'OH']) {
    it(`mirrors every bar across all real races (${state ?? 'no state selected'})`, () => {
      const original = buildNationalCard(buildAllRaces(nominees, spending).races, state)
      const swapped = buildNationalCard(buildAllRaces({ ...nominees, candidates: nominees.candidates.map(swapCandidate) }, spending).races, state)
      for (const party of ['D', 'R'] as Party[]) {
        expect(group(swapped, party)?.supporting).toEqual(group(original, swapParty(party))?.supporting)
        expect(group(swapped, party)?.opposing).toEqual(group(original, swapParty(party))?.opposing)
      }
      expect(swapped.excludedRaces).toBe(original.excludedRaces)
      expect(swapped.scaleMax).toBe(original.scaleMax)
    })
  }
})

describe('party card on real data', () => {
  const races = buildAllRaces(nominees, spending).races
  const card = buildNationalCard(races, null)

  it('excludes exactly the races flagged incomplete', () => {
    expect(card.excludedRaces).toBe(races.filter((r) => r.incompleteCount > 0).length)
    expect(card.includedRaces + card.excludedRaces).toBeLessThanOrEqual(races.length)
  })

  it('lists Democratic before Republican and never nets supporting against opposing', () => {
    expect(card.groups.slice(0, 2).map((g) => g.party)).toEqual(['D', 'R'])
    for (const g of card.groups) {
      expect(Object.keys(g)).not.toContain('net')
      expect(g.total).toBeCloseTo(g.supporting.dollars + g.opposing.dollars, 2)
    }
  })
})
