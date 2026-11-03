// Maps a civicAPI race payload (https://civicapi.org/api/v2/race/{id}) to our two result rows, and applies the sanity
// rules. Pure: nothing here fetches or writes. scripts/fetch-results.ts does both. Party comes only from nominees.json.
import type { NomineesFile } from './types'
import type { ResultsRaceRow, ResultsVoteRow, ResultStatus } from './results'

export interface CivicCandidate {
  name: string
  votes: number
}

export interface CivicRace {
  id: number
  test_data?: boolean
  percent_reporting: number
  candidates: CivicCandidate[]
}

export interface RaceRows {
  race: ResultsRaceRow
  votes: ResultsVoteRow[]
}

export type FeedResult = { ok: true; rows: RaceRows } | { ok: false; reason: string }

/** Counting until every precinct reports; Unofficial at 100. Certified is never set from the feed. */
export function feedStatus(race: CivicRace): ResultStatus | null {
  if (race.test_data) return null
  if (race.candidates.every((c) => c.votes === 0)) return null
  return race.percent_reporting >= 100 ? 'Unofficial' : 'Counting'
}

function nameTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Exact match, or the same first and last name with a middle name on one side only (e.g. "Christopher Campbell"). */
export function matchesNominee(civicName: string, nomineeName: string): boolean {
  const a = nameTokens(civicName)
  const b = nameTokens(nomineeName)
  if (a.length === 0 || b.length === 0) return false
  if (a.join(' ') === b.join(' ')) return true
  return a[0] === b[0] && a[a.length - 1] === b[b.length - 1]
}

export function feedRows(raceId: string, civic: CivicRace, nominees: NomineesFile, officialUrl: string | null, asOf: string): FeedResult {
  const status = feedStatus(civic)
  if (status === null) return { ok: false, reason: civic.test_data ? 'civicAPI marks this race as test data' : 'no votes reported yet' }
  const nomineeList = nominees.candidates.filter((c) => c.raceId === raceId)
  const votes: ResultsVoteRow[] = []
  for (const nominee of nomineeList) {
    const match = civic.candidates.find((c) => matchesNominee(c.name, nominee.name))
    if (!match) return { ok: false, reason: `no civicAPI candidate matches ${nominee.name}` }
    votes.push({ race_id: raceId, candidate: nominee.name, party: nominee.party, votes: String(match.votes) })
  }
  return {
    ok: true,
    rows: {
      race: {
        race_id: raceId,
        status,
        percent_reporting: String(civic.percent_reporting),
        note: '',
        source_url: officialUrl ?? 'https://civicapi.org/decision-2026',
        as_of: asOf,
      },
      votes,
    },
  }
}

const MARGIN_FLIP_POINTS = 15
const MAX_REPORTING_GAIN_FOR_FLIP = 5

/** Votes and reporting never go down, and a margin that flips by more than 15 points on under 5 more points reported is held. */
export function sanityViolations(prev: RaceRows | undefined, next: RaceRows): string[] {
  if (!prev) return []
  const violations: string[] = []
  const prevPct = Number(prev.race.percent_reporting)
  const nextPct = Number(next.race.percent_reporting)
  if (nextPct < prevPct) violations.push(`percent_reporting fell from ${prevPct} to ${nextPct}`)
  for (const row of next.votes) {
    const before = prev.votes.find((v) => v.candidate === row.candidate)
    if (before && Number(row.votes) < Number(before.votes)) violations.push(`${row.candidate} votes fell from ${before.votes} to ${row.votes}`)
  }
  const leader = [...prev.votes].sort((a, b) => Number(b.votes) - Number(a.votes))[0]
  if (leader) {
    const prevMargin = signedMarginPoints(prev.votes, leader.candidate)
    const nextMargin = signedMarginPoints(next.votes, leader.candidate)
    if (prevMargin !== null && nextMargin !== null && prevMargin > 0 && nextMargin < 0) {
      const swing = prevMargin - nextMargin
      if (swing > MARGIN_FLIP_POINTS && nextPct - prevPct < MAX_REPORTING_GAIN_FOR_FLIP) {
        violations.push(`margin flipped by ${swing.toFixed(1)} points on ${(nextPct - prevPct).toFixed(1)} more points reporting`)
      }
    }
  }
  return violations
}

/** The named candidate's share minus the best other candidate's share, in points. */
function signedMarginPoints(votes: ResultsVoteRow[], candidate: string): number | null {
  const total = votes.reduce((sum, v) => sum + Number(v.votes), 0)
  const mine = votes.find((v) => v.candidate === candidate)
  const others = votes.filter((v) => v.candidate !== candidate)
  if (total === 0 || !mine || others.length === 0) return null
  const bestOther = Math.max(...others.map((v) => Number(v.votes)))
  return ((Number(mine.votes) - bestOther) / total) * 100
}
