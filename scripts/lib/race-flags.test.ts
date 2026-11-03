import { describe, expect, it } from 'vitest'
import { computeRaceFlags, validateRaceIds, validateReviews } from './race-flags'
import { checkRaceDrops, checkTotalsIdentity, checkFetchCompleteness, type ReconcileTarget } from './verify-checks'
import type { ExportRow } from './verify-checks'
import type { RaceFlag, RaceReview } from '../../src/raceFlags'

const at = (n: number) => ({ state: 'MS', total: n })
const fetchedAt = '2026-11-03T22:44:25.774Z'
const base = { carried: [] as RaceFlag[], reviews: [] as RaceReview[], fetchedAt }

describe('race drop flag', () => {
  it('flags Mississippi with the 22:44 figures, with the drop amount and the prior and new totals', () => {
    const flags = computeRaceFlags({ ...base, previous: { 'MS-2026': 19043459.64 }, current: { 'MS-2026': at(17793908.68) } })
    expect(flags).toEqual([{ raceId: 'MS-2026', state: 'MS', prior: 19043459.64, now: 17793908.68, drop: 1249550.96, dropPct: 6.56, flaggedAt: fetchedAt }])
  })

  it('does not flag a drop under 2% or under $100K, or growth, or a first run', () => {
    expect(computeRaceFlags({ ...base, previous: { A: 1_000_000 }, current: { A: at(950_000) } })).toEqual([])
    expect(computeRaceFlags({ ...base, previous: { A: 100_000_000 }, current: { A: at(99_000_000) } })).toEqual([])
    expect(computeRaceFlags({ ...base, previous: { A: 5 }, current: { A: at(6) } })).toEqual([])
    expect(computeRaceFlags({ ...base, previous: null, current: { A: at(1) } })).toEqual([])
  })

  it('keeps a flag on later runs, with its original figures, until the race is reviewed', () => {
    const first = computeRaceFlags({ ...base, previous: { A: 10e6 }, current: { A: at(9e6) } })
    const later = computeRaceFlags({ ...base, carried: first, previous: { A: 9e6 }, current: { A: at(9.01e6) }, fetchedAt: 'later' })
    expect(later).toEqual(first)
  })

  it('a reviewed race stays unflagged across runs until its total drops again by more than 2% and $100K', () => {
    const review: RaceReview = { raceId: 'A', total: 9e6, reason: 'AB PAC notices now covered by its periodic reports', date: '2026-11-04' }
    const carried = computeRaceFlags({ ...base, previous: { A: 10e6 }, current: { A: at(9e6) } })
    const run = (now: number, previous: number) => computeRaceFlags({ ...base, carried, reviews: [review], previous: { A: previous }, current: { A: at(now) } })
    expect(run(9e6, 9e6)).toEqual([]) // the next run: reviewed, not flagged
    expect(run(8.9e6, 9e6)).toEqual([]) // a small change is not a large one
    expect(run(7e6, 8.9e6)).toHaveLength(1) // the next large change flags it again, measured from the reviewed total
    expect(run(7e6, 8.9e6)[0]).toMatchObject({ prior: 9e6, now: 7e6, drop: 2e6 })
    // a drop between consecutive runs that is large, but small from the reviewed total, stays unflagged
    expect(run(8.95e6, 9.5e6)).toEqual([])
  })

  it('rejects a review without a reason, date or total', () => {
    expect(() => validateReviews([{ raceId: 'A', total: 1, reason: ' ', date: '2026-11-04' }])).toThrow('race-review.json')
    expect(() => validateReviews([{ raceId: 'A', total: Number.NaN, reason: 'x', date: '2026-11-04' }])).toThrow('race-review.json')
  })

  it('fails loudly on a race ID that is not in the race list, so a review cannot silently fail to match', () => {
    const known = new Set(['MS-2026', 'OH-2026'])
    expect(() => validateRaceIds('data/race-review.json', ['MS-2026'], known)).not.toThrow()
    expect(() => validateRaceIds('data/race-review.json', ['2026-SEN-MS'], known)).toThrow('unknown race ID(s) "2026-SEN-MS"')
    expect(() => validateRaceIds('data/race-flags.json', ['ms-2026'], known)).toThrow('use an ID from the race list')
  })

  it('treats every race the same: swapping two races swaps the flags', () => {
    const a = computeRaceFlags({ ...base, previous: { ONE: 10e6, TWO: 10e6 }, current: { ONE: at(8e6), TWO: at(10e6) } })
    const b = computeRaceFlags({ ...base, previous: { ONE: 10e6, TWO: 10e6 }, current: { ONE: at(10e6), TWO: at(8e6) } })
    expect(a.map((f) => f.raceId)).toEqual(['ONE'])
    expect(b.map((f) => f.raceId)).toEqual(['TWO'])
  })
})

describe('what blocks a run', () => {
  it('a sharp drop is a flag in the check and does not block the run', () => {
    const out = checkRaceDrops({ MS: 19043459.64 }, { MS: 17793908.68 })
    expect(out.pass).toBe(false)
    expect(out.blocking).toBe(false)
  })

  it('totals that do not add up still block', () => {
    const out = checkTotalsIdentity({ allRaces: 1000, aligned: 700, unattributed: 100, excluded: 100 })
    expect(out.pass).toBe(false)
    expect(out.blocking).toBe(true)
  })

  it('a reference row missing from the raw pull still blocks', () => {
    const row: ExportRow = {
      committee_id: 'C1', committee_name: 'PAC', candidate_id: 'S1', support_oppose_indicator: 'S', expenditure_amount: 100, expenditure_date: '2026-10-01',
      dissemination_date: '2026-10-01', filing_date: '2026-10-01', is_notice: true, most_recent: true, memo_code: null, amendment_indicator: 'N', election_type: 'G2026',
      sub_id: '1', file_number: 7, previous_file_number: 7, transaction_id: 'SE.1', payee_name: 'P',
    }
    const targets: ReconcileTarget[] = [{ committee_id: 'C1', label: 'PAC', lines: [{ candidate_id: 'S1', side: 'S', label: 'supporting' }] }]
    const out = checkFetchCompleteness([row], [], targets, '2026-11-03T00:00:00Z')
    expect(out.pass).toBe(false)
    expect(out.blocking).toBe(true)
  })
})
