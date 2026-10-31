import { describe, expect, it } from 'vitest'
import normalJson from './__fixtures__/callout/normal-tx.json'
import independentJson from './__fixtures__/callout/independent-ne.json'
import nullForecastJson from './__fixtures__/callout/null-forecast.json'
import hatchedJson from './__fixtures__/callout/incomplete-hatched-co.json'
import unmatchedJson from './__fixtures__/callout/unmatched-nominee.json'
import { adSpendShare, buildAllCallouts, buildCallout, latestSnapshot, wholePercents, type Callout } from './computeCallout'
import { buildRaceView, PARTY_DISPLAY } from './computeSpending'
import { countFecIdClaims } from './incomplete'
import { allRaces, forecastSnapshot } from './data'
import type { Candidate, ExpenditureTotals, Party, Race, RaceForecast } from './types'

interface Fixture {
  race: Race
  candidates: Candidate[]
  totals: ExpenditureTotals[]
  forecast: RaceForecast
}

const fixtures = {
  normal: normalJson as unknown as Fixture,
  independent: independentJson as unknown as Fixture,
  nullForecast: nullForecastJson as unknown as Fixture,
  hatched: hatchedJson as unknown as Fixture,
  unmatched: unmatchedJson as unknown as Fixture,
}

function calloutFor(f: Fixture, forecast: RaceForecast = f.forecast): Callout {
  const totals = new Map(f.totals.map((t) => [t.candidateId, t]))
  const race = buildRaceView(f.race, f.candidates, totals, countFecIdClaims(f.candidates))
  return buildCallout(race, forecast)
}

const swapParty = (p: Party): Party => (p === 'D' ? 'R' : p === 'R' ? 'D' : 'I')
const swapFecCode = (code: string): string => (code === 'DEM' || code === 'DFL' ? 'REP' : code === 'REP' ? 'DEM' : code)

/** The same candidates and money, with the Democratic and Republican labels exchanged. */
function swapFixture(f: Fixture): Fixture {
  return {
    ...f,
    candidates: f.candidates.map((c) => ({
      ...c,
      party: swapParty(c.party),
      fecMatches: c.fecMatches?.map((m) => ({ ...m, fecParty: swapFecCode(m.fecParty) })),
    })),
    forecast: {
      ...f.forecast,
      pDemWin: f.forecast.pDemWin === null ? null : 1 - f.forecast.pDemWin,
      candidates: f.forecast.candidates ? { democrat: f.forecast.candidates.republican, republican: f.forecast.candidates.democrat } : null,
    },
  }
}

describe('whole percentages', () => {
  it('always sum to 100', () => {
    for (const share of [0, 0.004, 0.125, 0.333, 0.5, 0.505, 0.6667, 0.99, 1]) {
      const [a, b] = wholePercents(share, 1 - share, 'a', 'b')
      expect(a + b).toBe(100)
      expect(Number.isInteger(a) && Number.isInteger(b)).toBe(true)
    }
  })

  it('splits an exact tie by id, not by position', () => {
    expect(wholePercents(0.505, 0.495, 'a', 'b')).toEqual([51, 49])
    expect(wholePercents(0.495, 0.505, 'b', 'a')).toEqual([49, 51])
    expect(wholePercents(0.2005, 0.7995, 'a', 'b').reduce((n, v) => n + v, 0)).toBe(100)
  })
})

describe('share of spending that helps each nominee', () => {
  it('counts own support plus the other side\'s opposition, over all four amounts', () => {
    const shares = adSpendShare({ support: 30, oppose: 10 }, { support: 20, oppose: 40 })!
    expect(shares[0]).toBeCloseTo((30 + 40) / 100)
    expect(shares[1]).toBeCloseTo((20 + 10) / 100)
    expect(shares[0] + shares[1]).toBeCloseTo(1)
  })

  it('is mirrored when the two nominees trade places', () => {
    const a = { support: 5, oppose: 2 }
    const b = { support: 1, oppose: 9 }
    const [x, y] = adSpendShare(a, b)!
    const [y2, x2] = adSpendShare(b, a)!
    expect(x2).toBeCloseTo(x)
    expect(y2).toBeCloseTo(y)
  })

  it('has no figure when nothing was reported', () => {
    expect(adSpendShare({ support: 0, oppose: 0 }, { support: 0, oppose: 0 })).toBeNull()
  })
})

describe('a normal race', () => {
  const callout = calloutFor(fixtures.normal)

  it('shows two nominees with percentages that sum to 100 on both rows', () => {
    expect(callout.sides).toHaveLength(2)
    expect(callout.sides.reduce((n, s) => n + (s.adPct ?? 0), 0)).toBe(100)
    expect(callout.sides.reduce((n, s) => n + (s.winPct ?? 0), 0)).toBe(100)
    expect(callout.adFlag).toBeNull()
    expect(callout.winFlag).toBeNull()
  })

  it('takes labels, colors and letters from the party table', () => {
    for (const side of callout.sides) {
      expect(side.partyLabel).toBe(PARTY_DISPLAY[side.party].label)
      expect(side.partyColor).toBe(PARTY_DISPLAY[side.party].color)
      expect(side.letter).toBe(side.party)
    }
  })

  it('lists the nominee that is not shown', () => {
    expect(callout.excluded).toEqual(['Ted Brown'])
  })
})

describe('swapping the Democratic and Republican labels', () => {
  for (const [name, fixture] of Object.entries(fixtures).filter(([k]) => k !== 'independent')) {
    it(`mirrors every value, label, color and column (${name})`, () => {
      const original = calloutFor(fixture)
      const swapped = calloutFor(swapFixture(fixture))
      const byId = (c: Callout) => new Map(c.sides.map((s) => [s.candidateId, s]))
      for (const [id, side] of byId(original)) {
        const mirror = byId(swapped).get(id)!
        expect(mirror.adPct).toBe(side.adPct)
        expect(mirror.winPct).toBe(side.winPct)
        expect(mirror.party).toBe(swapParty(side.party))
        expect(mirror.partyLabel).toBe(PARTY_DISPLAY[swapParty(side.party)].label)
        expect(mirror.partyColor).toBe(PARTY_DISPLAY[swapParty(side.party)].color)
      }
      expect(swapped.sides.map((s) => s.candidateId)).toEqual([...original.sides.map((s) => s.candidateId)].reverse())
      expect(swapped.adFlag).toEqual(original.adFlag)
      expect(swapped.winFlag).toEqual(original.winFlag)
      expect(swapped.incompleteNote).toBe(original.incompleteNote)
      expect(swapped.excluded).toEqual(original.excluded)
    })
  }
})

describe('flags', () => {
  it('shows "No forecast" with a reason, never 0%, when the forecast is null', () => {
    const callout = calloutFor(fixtures.nullForecast)
    expect(callout.winFlag?.label).toBe('No forecast')
    expect(callout.winFlag?.reason).toBe('Matchup no longer exists')
    expect(callout.sides.every((s) => s.winPct === null)).toBe(true)
    expect(callout.sides.every((s) => s.adPct !== null)).toBe(true)
  })

  it('shows "Incomplete data" with the reason when a shown nominee is unmatched', () => {
    const callout = calloutFor(fixtures.unmatched)
    expect(callout.adFlag).toEqual({ label: 'Incomplete data', reason: 'No FEC match' })
    expect(callout.sides.every((s) => s.adPct === null)).toBe(true)
  })

  it('shows an independent as the second square and no forecast', () => {
    const callout = calloutFor(fixtures.independent)
    expect(callout.sides.map((s) => s.letter).sort()).toEqual(['I', 'R'])
    expect(callout.sides.find((s) => s.letter === 'I')?.partyColor).toBe('var(--color-ind)')
    expect(callout.winFlag?.label).toBe('No forecast')
    expect(callout.sides.reduce((n, s) => n + (s.adPct ?? 0), 0)).toBe(100)
  })

  it('adds the incomplete-data reasons on a hatched race while the shown nominees stay complete', () => {
    const callout = calloutFor(fixtures.hatched)
    expect(callout.incompleteNote).toContain('Incomplete data')
    expect(callout.incompleteNote).toContain('No FEC match')
    expect(callout.adFlag).toBeNull()
  })
})

describe('all 35 races', () => {
  const callouts = buildAllCallouts(allRaces.races, forecastSnapshot)

  it('builds a callout for every race', () => {
    expect(callouts.size).toBe(35)
  })

  it('never shows 0% or 100% for a prediction, and every shown row sums to 100', () => {
    for (const c of callouts.values()) {
      const wins = c.sides.map((s) => s.winPct)
      if (wins.every((w) => w !== null)) {
        expect(wins.reduce((n, w) => n + (w ?? 0), 0)).toBe(100)
        expect(wins.every((w) => (w ?? 0) >= 1 && (w ?? 0) <= 99)).toBe(true)
      }
      const ads = c.sides.map((s) => s.adPct)
      if (ads.every((a) => a !== null)) expect(ads.reduce((n, a) => n + (a ?? 0), 0)).toBe(100)
    }
  })

  it('uses the latest frozen snapshot, by folder name', () => {
    const file = (name: string, fetchedAt: string) => ({
      source_name: name, source_url: 'https://example.test', api_base: '', fetched_at: fetchedAt, content_hash: 'x', model_version: null, tag: null, note: '', races: [],
    })
    const picked = latestSnapshot({
      '../data/frozen/2026-10-30T080000Z/snapshot.json': file('old', '2026-10-30T08:00:00Z'),
      '../data/frozen/2026-10-31T153829Z/snapshot.json': file('new', '2026-10-31T15:38:29Z'),
    })
    expect(picked.sourceName).toBe('new')
    expect(picked.fetchedAt).toBe('2026-10-31T15:38:29Z')
    expect(forecastSnapshot.sourceName).toBe('VotePredictor')
    expect(forecastSnapshot.contentHash).toHaveLength(64)
  })
})
