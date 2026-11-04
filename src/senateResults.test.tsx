import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SenateResultsImage from './components/SenateResultsImage'
import type { Callout } from './computeCallout'
import { callouts } from './data'
import { formatSpentCompact } from './format'
import type { ResultCallout, ResultStage } from './results'
import { buildSenateTally, SENATE_SEATS } from './senateResults'
import type { Party } from './types'

const BASELINE = { notUpDemocraticCaucus: 34, notUpRepublican: 31 }

/** A one-race callout with just the result the tally reads. */
const race = (stage: ResultStage, winnerParty: Party | null): Callout =>
  ({ result: { stage, winnerParty, winnerCandidateId: winnerParty, percentReporting: 100, shares: {}, asOf: null, sourceUrl: null, note: null } as ResultCallout }) as Callout

/** 35 races: `dWin`/`dFlip`/`rWin`/`rFlip` decided, the rest still reporting. */
function chamber(counts: { dWin?: number; dFlip?: number; rWin?: number; rFlip?: number }): Map<string, Callout> {
  const out = new Map<string, Callout>()
  const add = (n: number | undefined, stage: ResultStage, party: Party | null) => {
    for (let i = 0; i < (n ?? 0); i += 1) out.set(`S${out.size}`, race(stage, party))
  }
  add(counts.dWin, 'win', 'D')
  add(counts.dFlip, 'flip', 'D')
  add(counts.rWin, 'win', 'R')
  add(counts.rFlip, 'flip', 'R')
  while (out.size < 35) out.set(`S${out.size}`, race('reporting', null))
  return out
}

describe('the Senate tally', () => {
  it('counts the Figma frame: 54 Democratic seats (47 held, 7 flipped), 44 Republican, 2 undecided', () => {
    const t = buildSenateTally(chamber({ dWin: 13, dFlip: 7, rWin: 13 }), BASELINE)
    expect(t.seats).toEqual({ D: 54, R: 44 })
    expect(t.undecided).toBe(2)
    expect(t.segments.map((s) => [s.key, s.seats])).toEqual([['dHeld', 47], ['dFlips', 7], ['undecided', 2], ['rFlips', 0], ['rHeld', 44]])
    expect(t.headline).toBe('Democrats win the Senate.')
  })

  it('always totals 100 seats, whatever is decided', () => {
    for (const c of [{}, { dWin: 5 }, { dWin: 3, dFlip: 2, rWin: 9, rFlip: 4 }, { dWin: 18, rWin: 17 }]) {
      const t = buildSenateTally(chamber(c), BASELINE)
      expect(t.segments.reduce((n, s) => n + s.seats, 0)).toBe(SENATE_SEATS)
    }
  })

  it('leaves Reporting, no status, and non-major winners undecided', () => {
    const all = chamber({})
    all.set('X', race('win', 'I'))
    all.delete('S0')
    const t = buildSenateTally(all, BASELINE)
    expect(t.seats).toEqual({ D: 34, R: 31 })
    expect(t.undecided).toBe(35)
    expect(t.headline).toBe('Senate control is undecided.')
  })

  it('names the party with 51 seats, and nobody at 50', () => {
    expect(buildSenateTally(chamber({ rWin: 14, rFlip: 6 }), BASELINE).headline).toBe('Republicans win the Senate.')
    expect(buildSenateTally(chamber({ dWin: 16 }), BASELINE).seats.D).toBe(50)
    expect(buildSenateTally(chamber({ dWin: 16 }), BASELINE).headline).toBe('Senate control is undecided.')
    expect(buildSenateTally(chamber({ dWin: 17 }), BASELINE).headline).toBe('Democrats win the Senate.')
  })

  it('swapping the parties mirrors every number and the headline', () => {
    const a = buildSenateTally(chamber({ dWin: 10, dFlip: 5, rWin: 12, rFlip: 2 }), BASELINE)
    const b = buildSenateTally(chamber({ rWin: 10, rFlip: 5, dWin: 12, dFlip: 2 }), { notUpDemocraticCaucus: 31, notUpRepublican: 34 })
    expect(b.seats).toEqual({ D: a.seats.R, R: a.seats.D })
    expect(b.undecided).toBe(a.undecided)
    expect(b.segments.map((s) => s.seats)).toEqual([...a.segments.map((s) => s.seats)].reverse())
    expect(a.headline.replace('Democrats', 'X').replace('Republicans', 'X')).toBe(b.headline.replace('Democrats', 'X').replace('Republicans', 'X'))
  })

  it('reads the real data: every race is a Win, Flip, Reporting or none, and the chamber totals 100', () => {
    const t = buildSenateTally(callouts, BASELINE)
    expect(t.seats.D + t.seats.R + t.undecided).toBe(100)
    expect(t.segments).toHaveLength(5)
  })
})

describe('the Senate image', () => {
  const tally = buildSenateTally(chamber({ dWin: 13, dFlip: 7, rWin: 13 }), BASELINE)
  const html = renderToStaticMarkup(<SenateResultsImage tally={tally} spent={{ D: 686_300_000, R: 1_040_000_000 }} />)

  it('is one image: no carousel, dots, or rotating cards', () => {
    expect(html.match(/<svg/g)).toHaveLength(1)
    expect(html).not.toContain('seat-forecast-dot')
    expect(html).not.toContain('seat-forecast-card')
    expect(html).not.toContain('aria-live')
  })

  it('shows the headline, the seat counts, and the Win, Flip, Win labels from the frame', () => {
    expect(html).toContain('Democrats win the Senate.')
    expect(html).toContain('>54<')
    expect(html).toContain('>44<')
    expect(html.match(/>SEATS</g)).toHaveLength(2)
    expect([...html.matchAll(/>(Win|Flip)</g)].map((m) => m[1])).toEqual(['Win', 'Flip', 'Win'])
  })

  it('shows each party\'s aligned spending the way the frame writes it', () => {
    expect(html).toContain('Spent: $686M')
    expect(html).toContain('Spent: $1.04B')
    expect(formatSpentCompact(686_300_000)).toBe('$686M')
    expect(formatSpentCompact(1_040_000_000)).toBe('$1.04B')
  })

  it('draws the flips hatched and the undecided seats as the cream divider, party colors for the rest', () => {
    expect(html).toContain('data-segment="dFlips"')
    expect(html).toContain('senate-flip-hatch')
    expect(html).toContain('data-segment="undecided"')
    expect(html).toContain('#d6cfba')
    expect(html).not.toContain('data-segment="rFlips"') // no seat flipped to the Republicans, so no segment
  })

  it('leaves out a spending figure that is not shown, and describes the chamber for assistive tech', () => {
    const none = renderToStaticMarkup(<SenateResultsImage tally={tally} spent={{ D: null, R: null }} />)
    expect(none).not.toContain('Spent:')
    expect(html).toContain('aria-label="Democrats win the Senate. Democrats 54 seats, Republicans 44 seats, 2 undecided."')
  })

  it('is the same picture for both parties: mirrored data gives mirrored seats, labels and colors', () => {
    const mirrored = buildSenateTally(chamber({ rWin: 13, rFlip: 7, dWin: 13 }), { notUpDemocraticCaucus: 31, notUpRepublican: 34 })
    const m = renderToStaticMarkup(<SenateResultsImage tally={mirrored} spent={{ D: 1_040_000_000, R: 686_300_000 }} />)
    expect(m).toContain('Republicans win the Senate.')
    expect(m).toContain('data-segment="rFlips"')
    expect(m).not.toContain('data-segment="dFlips"')
    expect([...m.matchAll(/>(Win|Flip)</g)].map((x) => x[1])).toEqual(['Win', 'Flip', 'Win'])
  })
})
