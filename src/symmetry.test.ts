import { describe, expect, it } from 'vitest'
import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import fixtureJson from '../scripts/__fixtures__/spending-fixture.json'
import {
  buildAllRaces,
  buildNationalView,
  buildRaceView,
  fillFraction,
  PARTY_DISPLAY,
  type RaceView,
  type RowView,
} from './computeSpending'
import { countFecIdClaims } from './incomplete'
import type { Candidate, ExpenditureTotals, NomineesFile, Party, SpendingFile } from './types'

const nominees = nomineesJson as unknown as NomineesFile
const spending = spendingJson as unknown as SpendingFile
const fixture = fixtureJson as unknown as SpendingFile

const swapParty = (p: Party): Party => (p === 'D' ? 'R' : p === 'R' ? 'D' : 'I')
const swapFecCode = (code: string): string => (code === 'DEM' || code === 'DFL' ? 'REP' : code === 'REP' ? 'DEM' : code)

function swapCandidate(c: Candidate): Candidate {
  return {
    ...c,
    party: swapParty(c.party),
    fecMatches: c.fecMatches?.map((m) => ({ ...m, fecParty: swapFecCode(m.fecParty) })),
  }
}

function mirrorRow(row: RowView): RowView {
  const party = swapParty(row.party)
  return { ...row, party, partyLabel: PARTY_DISPLAY[party].label, partyColor: PARTY_DISPLAY[party].color }
}

function mirrorRace(race: RaceView): RaceView {
  const mirroredMissing = race.missingMajor.map(swapParty)
  return {
    ...race,
    rows: race.rows.map(mirrorRow),
    missingMajor: (['D', 'R'] as Party[]).filter((p) => mirroredMissing.includes(p)),
  }
}

// Real Ohio nominees and real fixture totals (Husted R, Brown D), plus one queried-zero
// and one unmatched independent so every data state goes through the swap.
function fixtureRace() {
  const race = nominees.races.find((r) => r.id === 'OH-2026')!
  const real = nominees.candidates.filter((c) => fixture.totals.some((t) => t.candidateId === c.id))
  const zero: Candidate = { ...nominees.candidates.find((c) => c.id === 'OH-2026--BILL-REDPATH')! }
  const unmatched: Candidate = {
    ...nominees.candidates.find((c) => c.id === 'OH-2026--GREG-LEVY')!,
    fecIds: [],
    fecMatches: [],
  }
  const sourceUrl = 'https://www.fec.gov/data/'
  const asOf = fixture.fetchedAt
  const totals: ExpenditureTotals[] = [
    ...fixture.totals,
    {
      candidateId: zero.id,
      status: 'queried_zero_rows',
      fecIds: zero.fecIds,
      support: { value: 0, sourceUrl, asOf },
      oppose: { value: 0, sourceUrl, asOf },
      topSupportCommittees: [],
      topOpposeCommittees: [],
    },
    {
      candidateId: unmatched.id,
      status: 'unmatched',
      fecIds: [],
      support: { value: null, sourceUrl, asOf },
      oppose: { value: null, sourceUrl, asOf },
      topSupportCommittees: [],
      topOpposeCommittees: [],
    },
  ]
  return { race, candidates: [...real, zero, unmatched], totals: new Map(totals.map((t) => [t.candidateId, t])) }
}

function view(candidates: Candidate[]) {
  const { race, totals } = fixtureRace()
  return buildRaceView(race, candidates, totals, countFecIdClaims(candidates))
}

describe('party symmetry on the saved fixture', () => {
  const { candidates } = fixtureRace()
  const original = view(candidates)
  const swapped = view(candidates.map(swapCandidate))

  it('the fixture has a Democrat, a Republican and an independent to swap', () => {
    expect(new Set(candidates.map((c) => c.party))).toEqual(new Set(['D', 'R', 'I']))
  })

  it('swapping D and R mirrors every value, label, color and the whole row', () => {
    expect(swapped).toEqual(mirrorRace(original))
  })

  it('keeps the same sort order', () => {
    expect(swapped.rows.map((r) => r.candidateId)).toEqual(original.rows.map((r) => r.candidateId))
  })

  it('keeps bar widths, the shared scale, the race total and the map fill identical', () => {
    expect(swapped.scaleMax).toBe(original.scaleMax)
    expect(swapped.total).toBe(original.total)
    expect(fillFraction(swapped.total, 50_000_000)).toBe(fillFraction(original.total, 50_000_000))
    expect(swapped.rows.map((r) => [r.support, r.oppose])).toEqual(original.rows.map((r) => [r.support, r.oppose]))
  })

  it('takes every label and color from the party table', () => {
    for (const row of [...original.rows, ...swapped.rows]) {
      expect(row.partyLabel).toBe(PARTY_DISPLAY[row.party].label)
      expect(row.partyColor).toBe(PARTY_DISPLAY[row.party].color)
    }
  })

  it('treats a real $0 and an incomplete nominee differently, the same for both', () => {
    for (const race of [original, swapped]) {
      const zero = race.rows.find((r) => r.candidateId === 'OH-2026--BILL-REDPATH')!
      const missing = race.rows.find((r) => r.candidateId === 'OH-2026--GREG-LEVY')!
      expect(zero.incomplete).toBe(false)
      expect(zero.support?.value).toBe(0)
      expect(missing.incomplete).toBe(true)
      expect(missing.reason).toBe('No FEC match')
      expect(missing.support).toBeNull()
    }
  })

  it('notes a missing major-party nominee the same way for either party', () => {
    const withoutD = candidates.filter((c) => c.party !== 'D')
    const withoutR = candidates.filter((c) => c.party !== 'R')
    expect(view(withoutD).missingMajor).toEqual(['D'])
    expect(view(withoutR).missingMajor).toEqual(['R'])
    expect(view(withoutD.map(swapCandidate))).toEqual(mirrorRace(view(withoutD)))
  })

  it('keeps Support and oppose separate: no net figure exists on a row', () => {
    for (const row of original.rows) expect(Object.keys(row)).not.toContain('net')
  })
})

describe('party symmetry on all races', () => {
  const original = buildAllRaces(nominees, spending)
  const swapped = buildAllRaces(
    { ...nominees, candidates: nominees.candidates.map(swapCandidate) },
    spending,
  )

  it('mirrors every race', () => {
    expect(swapped.races).toEqual(original.races.map(mirrorRace))
  })

  it('keeps the map scale identical', () => {
    expect(swapped.maxTotal).toBe(original.maxTotal)
  })
})

describe('party symmetry in the national chart', () => {
  const original = buildAllRaces(nominees, spending)
  const swapped = buildAllRaces({ ...nominees, candidates: nominees.candidates.map(swapCandidate) }, spending)
  const group = (view: ReturnType<typeof buildNationalView>, party: Party) => view.groups.find((g) => g.party === party)!

  for (const state of [null, 'OH', 'TX']) {
    const a = buildNationalView(original.races, state)
    const b = buildNationalView(swapped.races, state)

    it(`mirrors every bar when D and R are swapped (${state ?? 'no state selected'})`, () => {
      for (const party of ['D', 'R'] as Party[]) {
        const mine = group(b, party)
        const theirs = group(a, swapParty(party))
        expect(mine.support).toEqual(theirs.support)
        expect(mine.oppose).toEqual(theirs.oppose)
        expect(mine.total).toBe(theirs.total)
        expect(mine.stateTotal).toBe(theirs.stateTotal)
        expect(mine.nominees).toBe(theirs.nominees)
        expect(mine.label).toBe(PARTY_DISPLAY[party].label)
        expect(mine.color).toBe(PARTY_DISPLAY[party].color)
        expect(mine.tint).toBe(PARTY_DISPLAY[party].tint)
      }
      expect(b.scaleMax).toBe(a.scaleMax)
    })

    it(`keeps the same group order (${state ?? 'no state selected'})`, () => {
      expect(b.groups.map((g) => g.party)).toEqual(a.groups.map((g) => g.party))
    })
  }

  it('keeps supporting and opposing separate and the state part within each bar', () => {
    const view = buildNationalView(original.races, 'OH')
    for (const g of view.groups) {
      expect(Object.keys(g)).not.toContain('net')
      for (const bar of [g.support, g.oppose]) {
        expect(bar.statePortion).toBeLessThanOrEqual(bar.total)
        expect(bar.widthPct).toBeLessThanOrEqual(100)
      }
      expect(g.support.widthPct + g.oppose.widthPct).toBeLessThanOrEqual(100.0000001)
      expect(g.total).toBeCloseTo(g.support.total + g.oppose.total, 2)
    }
    expect(buildNationalView(original.races, null).groups.every((g) => g.support.statePortion === 0)).toBe(true)
  })

  it('counts only complete, major-party nominees', () => {
    const view = buildNationalView(original.races, null)
    const rows = original.races.flatMap((r) => r.rows)
    for (const party of ['D', 'R'] as Party[]) {
      const expected = rows.filter((r) => r.party === party && !r.incomplete)
      expect(group(view, party).nominees).toBe(expected.length)
      expect(group(view, party).support.total).toBeCloseTo(expected.reduce((n, r) => n + (r.support?.value ?? 0), 0), 2)
    }
  })
})
