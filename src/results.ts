// Results, hand-entered in two CSV files (see docs/results-entry.md). Pure and party-blind: nothing here reads a
// party except to carry it through from nominees.json. No automatic publishing, admin page, or outside feed here.
import type { NomineesFile } from './types'

export type ResultStatus = 'Counting' | 'Unofficial' | 'Certified'
const VALID_STATUSES: readonly ResultStatus[] = ['Counting', 'Unofficial', 'Certified']

export interface ResultsRaceRow {
  race_id: string
  status: string
  percent_reporting: string
  note: string
  source_url: string
  as_of: string
}

export interface ResultsVoteRow {
  race_id: string
  candidate: string
  party: string
  votes: string
}

export interface ResultsValidation {
  errors: string[]
}

/** Every rule the build and the tests both run. Unknown fields are reported once, by file and race. */
export function validateResults(raceRows: ResultsRaceRow[], voteRows: ResultsVoteRow[], nominees: NomineesFile): ResultsValidation {
  const errors: string[] = []
  const raceIds = new Set(nominees.races.map((r) => r.id))
  const raceRowIds = new Set<string>()
  const candidateNamesByRace = new Map<string, Set<string>>()
  for (const c of nominees.candidates) {
    const names = candidateNamesByRace.get(c.raceId) ?? new Set<string>()
    names.add(c.name)
    candidateNamesByRace.set(c.raceId, names)
  }

  for (const row of raceRows) {
    const label = `results-races.csv ${row.race_id || '(blank race_id)'}`
    if (!raceIds.has(row.race_id)) {
      errors.push(`${label}: unknown race_id`)
      continue
    }
    raceRowIds.add(row.race_id)
    if (!VALID_STATUSES.includes(row.status as ResultStatus)) errors.push(`${label}: invalid status "${row.status}" (must be Counting, Unofficial, or Certified)`)
    const pct = Number(row.percent_reporting)
    if (row.percent_reporting.trim() === '' || !Number.isFinite(pct) || pct < 0 || pct > 100) errors.push(`${label}: percent_reporting must be 0 to 100, got "${row.percent_reporting}"`)
    if (!row.source_url.trim()) errors.push(`${label}: missing source_url`)
    if (!row.as_of.trim()) errors.push(`${label}: missing as_of`)
  }

  for (const row of voteRows) {
    const label = `results-votes.csv ${row.race_id || '(blank race_id)'} / ${row.candidate || '(blank candidate)'}`
    if (!raceIds.has(row.race_id)) {
      errors.push(`${label}: unknown race_id`)
      continue
    }
    if (!raceRowIds.has(row.race_id)) errors.push(`${label}: votes for a race with no race row in results-races.csv`)
    const names = candidateNamesByRace.get(row.race_id)
    if (!names || !names.has(row.candidate)) errors.push(`${label}: candidate not in nominees.json for this race`)
    const votes = Number(row.votes)
    if (!Number.isInteger(votes) || votes < 0 || row.votes.trim() === '') errors.push(`${label}: votes must be a non-negative integer, got "${row.votes}"`)
  }

  return { errors }
}

/** Largest-remainder rounding across any number of shares. Ties go to the lower id, which carries no party meaning. */
export function wholePercentsN(shares: { id: string; value: number }[]): Map<string, number> {
  if (shares.length === 0) return new Map()
  const raw = shares.map((s) => ({ id: s.id, scaled: s.value * 100 }))
  const floors = raw.map((r) => ({ id: r.id, floor: Math.floor(r.scaled), rem: r.scaled - Math.floor(r.scaled) }))
  const out = new Map(floors.map((f) => [f.id, f.floor]))
  const remaining = 100 - floors.reduce((sum, f) => sum + f.floor, 0)
  const order = [...floors].sort((a, b) => b.rem - a.rem || a.id.localeCompare(b.id))
  for (let i = 0; i < remaining && i < order.length; i += 1) out.set(order[i].id, (out.get(order[i].id) ?? 0) + 1)
  return out
}

export interface RaceResultData {
  status: ResultStatus
  percentReporting: number
  note: string | null
  sourceUrl: string
  asOf: string
  /** Votes by candidate id, for every candidate with a vote row in this race, not only the callout's pair. */
  votesByCandidate: Map<string, number>
}

/** One row per race_id in results-races.csv, with its votes attached. Assumes validateResults found no errors. */
export function buildResultsByRace(raceRows: ResultsRaceRow[], voteRows: ResultsVoteRow[], nominees: NomineesFile): Map<string, RaceResultData> {
  const candidateIdByRaceAndName = new Map<string, string>()
  for (const c of nominees.candidates) candidateIdByRaceAndName.set(`${c.raceId}|${c.name}`, c.id)

  const out = new Map<string, RaceResultData>()
  for (const row of raceRows) {
    out.set(row.race_id, {
      status: row.status as ResultStatus,
      percentReporting: Number(row.percent_reporting),
      note: row.note.trim() || null,
      sourceUrl: row.source_url,
      asOf: row.as_of,
      votesByCandidate: new Map(),
    })
  }
  for (const row of voteRows) {
    const entry = out.get(row.race_id)
    const candidateId = candidateIdByRaceAndName.get(`${row.race_id}|${row.candidate}`)
    if (entry && candidateId) entry.votesByCandidate.set(candidateId, Number(row.votes))
  }
  return out
}

export type ResultStage = 'not-added' | 'counting' | 'unofficial' | 'certified'

const STAGE_BY_STATUS: Record<ResultStatus, ResultStage> = { Counting: 'counting', Unofficial: 'unofficial', Certified: 'certified' }

export interface ResultCallout {
  stage: ResultStage
  percentReporting: number | null
  /** Whole-percent shares for the callout's two sides, keyed by candidate id. Null in every stage but counting, unofficial and certified. */
  shares: Record<string, number | null>
  /** The candidate with the most votes, once a stage shows a leader (unofficial or certified); otherwise null. */
  leadingCandidateId: string | null
  asOf: string | null
  sourceUrl: string | null
  note: string | null
}

/**
 * Builds the Result row for one race's two displayed candidates. The pair and its order come from the caller
 * (the same pair and order as the callout's squares), so results never pick their own candidates.
 */
export function buildResultCallout(pairCandidateIds: readonly string[], raceResult: RaceResultData | undefined): ResultCallout {
  if (!raceResult) {
    return {
      stage: 'not-added',
      percentReporting: null,
      shares: Object.fromEntries(pairCandidateIds.map((id) => [id, null])),
      leadingCandidateId: null,
      asOf: null,
      sourceUrl: null,
      note: null,
    }
  }

  const stage = STAGE_BY_STATUS[raceResult.status]
  const totalVotes = [...raceResult.votesByCandidate.values()].reduce((sum, v) => sum + v, 0)
  const pct = totalVotes > 0 ? wholePercentsN([...raceResult.votesByCandidate.entries()].map(([id, votes]) => ({ id, value: votes / totalVotes }))) : new Map<string, number>()
  const shares = Object.fromEntries(pairCandidateIds.map((id) => [id, pct.get(id) ?? null]))

  let leadingCandidateId: string | null = null
  if (stage !== 'counting' && raceResult.votesByCandidate.size > 0) {
    const byVotes = [...raceResult.votesByCandidate.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    leadingCandidateId = byVotes[0][0]
  }

  return { stage, percentReporting: raceResult.percentReporting, shares, leadingCandidateId, asOf: raceResult.asOf, sourceUrl: raceResult.sourceUrl, note: raceResult.note }
}
