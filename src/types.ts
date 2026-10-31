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

export interface SpendingMetadata {
  dedup_method: string
  rows_pulled: number
  rows_kept: number
  rows_dropped: Record<string, number>
  approximate_committees: string[]
  /** Dollars in the rows that went through the approximate key match (dropped as matched, or kept as notices). */
  approx_rows_total: number
  /** Spending reported with no candidate ID, when measured; absent means no figure. */
  unattributed_total?: number
  /** Latest dissemination date among the rows that count, YYYY-MM-DD. */
  latest_dissemination_date: string | null
  latest_dissemination_by_race: Record<string, string>
  /** Rows dated after the fetch (typos in the filing). They count but never set the latest date. */
  future_dated_rows: number
  raw_sha256: string
  raw_path: string
  requests: number
}

export interface SpendingFile {
  fetchedAt: string
  source: string
  metadata?: SpendingMetadata
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

export interface RaceForecast {
  state: string
  /** The Democratic nominee's win probability, clamped 0.01 to 0.99 by the source. */
  pDemWin: number | null
  basis: string | null
  nPolls: number | null
  candidates: { democrat: string | null; republican: string | null } | null
  noForecast: { reason: string | null; actualMatchup: string | null } | null
  asOf: string | null
}

/** One race exactly as VotePredictor's API returned it. */
export interface ApiRace {
  race_id: string
  location: string
  as_of: string | null
  model_version: string | null
  forecast: { p_dem_win: number; source: string; n_polls: number | null } | null
  candidates: { democrat: string | null; republican: string | null } | null
  no_forecast?: { reason?: string; actual_matchup?: string } | null
}

/** The file written by scripts/freeze-forecast.ts: raw responses plus metadata. */
export interface FrozenSnapshotFile {
  source_name: string
  source_url: string
  api_base: string
  fetched_at: string
  content_hash: string
  model_version: string | null
  tag: string | null
  note: string
  races: ApiRace[]
}

export interface ForecastSnapshot {
  sourceName: string
  sourceUrl: string
  fetchedAt: string
  contentHash: string
  modelVersion: string | null
  tag: string | null
  note: string
  races: RaceForecast[]
}
