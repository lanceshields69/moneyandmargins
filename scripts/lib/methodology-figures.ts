// The figures the methodology page states as sentences. Pure: built from the same dedup and race rows that
// build spending.json, so the page and the data cannot disagree. A figure that cannot be computed throws.
import { doubleCountByRace, shortfallWindows, type AuditRow, type RaceRow } from './verify-checks'
import type { IeRow } from './dedup-ie'

export interface MethodologyFigures {
  /** The fetch these figures came from. Matches spending.json's fetchedAt. */
  fetchedAt: string
  /** Committees whose notices were matched by key because no coverage end date was available. */
  approxCommitteeCount: number
  /** Dollars in notices from those committees. */
  approxTotal: number
  /** Dollars counted twice: same committee, date and amount on two candidates in one race. */
  doubleCountTotal: number
  /** doubleCountTotal as a percent of all race spending. */
  doubleCountPct: number
  /** Dollars spent on no candidate in a race pair. */
  unattributedTotal: number
  /** States whose race the national card skips because a nominee has incomplete data. */
  incompleteRaces: string[]
  /** Windows (committee, candidate, side) where notices dropped as covered by a periodic report exceed the periodic evidence for it. */
  dedupShortfallCount: number
  /** Dollars across those shortfall windows. */
  dedupShortfallTotal: number
  /** dedupShortfallTotal as a percent of all-races spending. */
  dedupShortfallPct: number
}

export interface MethodologyFigureInputs {
  fetchedAt: string
  approximateCommittees: string[]
  approximateTotal: number
  raceRows: RaceRow[]
  unattributedTotal: number
  incompleteRaces: string[]
  auditRows: AuditRow[]
  periodicRows: IeRow[]
  memoPeriodicRows: IeRow[]
  allRacesTotal: number
}

const round = (n: number) => Math.round(n * 100) / 100

export function methodologyFigures(input: MethodologyFigureInputs): MethodologyFigures {
  if (!input.fetchedAt) throw new Error('Methodology figures: no fetchedAt')
  const doubles = [...doubleCountByRace(input.raceRows).values()]
  const doubleCountTotal = doubles.reduce((s, v) => s + v.overcount, 0)
  const raceTotal = doubles.reduce((s, v) => s + v.total, 0)
  const shortfalls = shortfallWindows(input.auditRows, input.periodicRows, input.memoPeriodicRows)
  const dedupShortfallTotal = shortfalls.reduce((s, w) => s + w.shortfall, 0)
  const figures: MethodologyFigures = {
    fetchedAt: input.fetchedAt,
    approxCommitteeCount: input.approximateCommittees.length,
    approxTotal: round(input.approximateTotal),
    doubleCountTotal: round(doubleCountTotal),
    doubleCountPct: round(raceTotal > 0 ? (100 * doubleCountTotal) / raceTotal : 0),
    unattributedTotal: round(input.unattributedTotal),
    incompleteRaces: [...input.incompleteRaces].sort(),
    dedupShortfallCount: shortfalls.length,
    dedupShortfallTotal: round(dedupShortfallTotal),
    dedupShortfallPct: round(input.allRacesTotal > 0 ? (100 * dedupShortfallTotal) / input.allRacesTotal : 0),
  }
  for (const key of ['approxCommitteeCount', 'approxTotal', 'doubleCountTotal', 'doubleCountPct', 'unattributedTotal', 'dedupShortfallCount', 'dedupShortfallTotal', 'dedupShortfallPct'] as const) {
    if (!Number.isFinite(figures[key])) throw new Error(`Methodology figure "${key}" could not be computed`)
  }
  return figures
}
