import { describe, expect, it } from 'vitest'
import { feedRows, feedStatus, matchesNominee, sanityViolations, type CivicRace, type RaceRows } from './civicapi'
import type { NomineesFile } from './types'

const nominees: NomineesFile = {
  fetchedAt: '2026-10-01T00:00:00Z',
  source: 'test',
  races: [{ id: 'XX-2026', state: 'XX', raceName: 'Test Senate 2026', isSpecial: false, incumbentName: null, incumbentParty: null, sourceUrl: 'https://x.test', sourceTier: 'official', retrievedAt: '2026-10-01' }],
  candidates: [
    { id: 'XX-2026--BARR', raceId: 'XX-2026', name: 'Andy Barr', party: 'R', fecIds: [] },
    { id: 'XX-2026--BOOKER', raceId: 'XX-2026', name: 'Charles Booker', party: 'D', fecIds: [] },
    { id: 'XX-2026--CAMPBELL', raceId: 'XX-2026', name: 'Christopher Todd Campbell', party: 'I', fecIds: [] },
  ],
}

const race = (over: Partial<CivicRace> = {}): CivicRace => ({
  id: 1,
  percent_reporting: 40,
  candidates: [
    { name: 'Andy Barr', votes: 600 },
    { name: 'Charles Booker', votes: 400 },
    { name: 'Christopher Campbell', votes: 20 },
    { name: 'Write-in', votes: 5 },
  ],
  ...over,
})

describe('feedStatus', () => {
  it('returns null for test data, whatever the counts', () => {
    expect(feedStatus(race({ test_data: true }))).toBeNull()
  })
  it('returns null when no votes are in yet', () => {
    expect(feedStatus(race({ percent_reporting: 0, candidates: [{ name: 'Andy Barr', votes: 0 }] }))).toBeNull()
  })
  it('is Counting below 100 percent reporting, and Unofficial at 100', () => {
    expect(feedStatus(race({ percent_reporting: 99.9 }))).toBe('Counting')
    expect(feedStatus(race({ percent_reporting: 100 }))).toBe('Unofficial')
  })
  it('never returns Certified', () => {
    for (const pct of [0, 50, 100]) expect(feedStatus(race({ percent_reporting: pct }))).not.toBe('Certified')
  })
})

describe('matchesNominee', () => {
  it('matches an exact name', () => {
    expect(matchesNominee('Andy Barr', 'Andy Barr')).toBe(true)
  })
  it('matches a name with a middle name on one side only', () => {
    expect(matchesNominee('Christopher Campbell', 'Christopher Todd Campbell')).toBe(true)
  })
  it('ignores accents and case', () => {
    expect(matchesNominee('JOSÉ garcia', 'Jose Garcia')).toBe(true)
  })
  it('does not match a write-in or a different person', () => {
    expect(matchesNominee('Write-in', 'Andy Barr')).toBe(false)
    expect(matchesNominee('Andy Brown', 'Andy Barr')).toBe(false)
  })
})

describe('feedRows', () => {
  const asOf = '2026-11-03T21:00:00Z'

  it('maps a counting race to a Counting row with party from nominees.json, not civicAPI', () => {
    const result = feedRows('XX-2026', race(), nominees, null, asOf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows.race).toMatchObject({ race_id: 'XX-2026', status: 'Counting', percent_reporting: '40', as_of: asOf })
    expect(result.rows.votes.map((v) => [v.candidate, v.party, v.votes])).toEqual([
      ['Andy Barr', 'R', '600'],
      ['Charles Booker', 'D', '400'],
      ['Christopher Todd Campbell', 'I', '20'],
    ])
  })

  it('uses the official URL when one is set, else the civicAPI page', () => {
    const official = feedRows('XX-2026', race(), nominees, 'https://state.test/results', asOf)
    const fallback = feedRows('XX-2026', race(), nominees, null, asOf)
    expect(official.ok && official.rows.race.source_url).toBe('https://state.test/results')
    expect(fallback.ok && fallback.rows.race.source_url).toBe('https://civicapi.org/decision-2026')
  })

  it('holds a race that civicAPI marks as test data', () => {
    const result = feedRows('XX-2026', race({ test_data: true }), nominees, null, asOf)
    expect(result).toEqual({ ok: false, reason: 'civicAPI marks this race as test data' })
  })

  it('holds a race when a nominee has no matching candidate', () => {
    const missing = race({ candidates: [{ name: 'Andy Barr', votes: 600 }, { name: 'Charles Booker', votes: 400 }] })
    const result = feedRows('XX-2026', missing, nominees, null, asOf)
    expect(result).toEqual({ ok: false, reason: 'no civicAPI candidate matches Christopher Todd Campbell' })
  })

  it('applies the same rules whichever party a candidate belongs to', () => {
    const swapped: NomineesFile = { ...nominees, candidates: nominees.candidates.map((c) => (c.name === 'Andy Barr' ? { ...c, party: 'D' } : c.name === 'Charles Booker' ? { ...c, party: 'R' } : c)) }
    const a = feedRows('XX-2026', race(), nominees, null, asOf)
    const b = feedRows('XX-2026', race(), swapped, null, asOf)
    if (!a.ok || !b.ok) throw new Error('expected both to map')
    expect(a.rows.race).toEqual(b.rows.race)
    expect(a.rows.votes.map((v) => [v.candidate, v.votes])).toEqual(b.rows.votes.map((v) => [v.candidate, v.votes]))
  })
})

describe('sanityViolations', () => {
  const rows = (pct: number, barr: number, booker: number): RaceRows => ({
    race: { race_id: 'XX-2026', status: 'Counting', percent_reporting: String(pct), note: '', source_url: 'https://x.test', as_of: '2026-11-03T20:00:00Z' },
    votes: [
      { race_id: 'XX-2026', candidate: 'Andy Barr', party: 'R', votes: String(barr) },
      { race_id: 'XX-2026', candidate: 'Charles Booker', party: 'D', votes: String(booker) },
    ],
  })

  it('passes with no previous row', () => {
    expect(sanityViolations(undefined, rows(10, 50, 40))).toEqual([])
  })
  it('flags votes or reporting that go down', () => {
    expect(sanityViolations(rows(40, 600, 400), rows(35, 600, 400))[0]).toMatch(/percent_reporting fell/)
    expect(sanityViolations(rows(40, 600, 400), rows(50, 500, 400))[0]).toMatch(/Andy Barr votes fell/)
  })
  it('holds a margin that flips by more than 15 points on under 5 more points reporting', () => {
    const before = rows(40, 600, 400) // Barr +20
    const after = rows(42, 400, 600) // Booker +20, a 40-point swing on 2 more points
    expect(sanityViolations(before, after).some((v) => v.includes('margin flipped'))).toBe(true)
  })
  it('allows a flip when enough more reporting came in to explain it', () => {
    const before = rows(40, 600, 400)
    const after = rows(60, 500, 600)
    expect(sanityViolations(before, after).some((v) => v.includes('margin flipped'))).toBe(false)
  })
})
