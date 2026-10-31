export type Party = 'D' | 'R' | 'I'

export interface SourcedValue<T> {
  value: T
  sourceUrl: string
  asOf: string
}

export interface Race {
  id: string
  state: string
  raceName: string
  isSpecial: boolean
  incumbentName: string | null
  incumbentParty: Party | null
  sourceUrl: string
  sourceTier: 'official' | 'secondary_wikipedia'
  retrievedAt: string
  note?: string
}

export interface FecMatch {
  id: string
  fecName: string
  fecParty: string
  cycles: number[]
  method: '2a-name-match' | 'manual-assignment' | 'fec-name-search'
}

export interface Candidate {
  id: string
  raceId: string
  name: string
  party: Party
  fecIds: string[]
  fecMatches?: FecMatch[]
  fecMatchNote?: string
  provisional?: boolean
  provisionalReason?: string
}

export interface NomineesFile {
  fetchedAt: string
  source: string
  races: Race[]
  candidates: Candidate[]
}

export interface Committee {
  id: string
  name: string
  fecUrl: string
  amount: number
}

/**
 * queried_with_rows: FEC IDs resolved and the query returned expenditure rows.
 * queried_zero_rows: FEC IDs resolved and queried; FEC reports no 2026-cycle
 *   independent expenditures (a true zero).
 * unmatched: no FEC candidate ID could be resolved, so nothing was queried and
 *   the totals are null (unknown), never 0.
 */
export type SpendingStatus = 'queried_with_rows' | 'queried_zero_rows' | 'unmatched'

export interface SpendingFile {
  fetchedAt: string
  source: string
  totals: ExpenditureTotals[]
}

export interface ExpenditureTotals {
  candidateId: string
  status: SpendingStatus
  fecIds: string[]
  support: SourcedValue<number | null>
  oppose: SourcedValue<number | null>
  topSupportCommittees: Committee[]
  topOpposeCommittees: Committee[]
}
