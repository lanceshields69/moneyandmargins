// Fetches race results from civicAPI into data/results-races.csv and data/results-votes.csv. Off unless
// RESULTS_AUTO=true. A race that fails to fetch, is test data, or breaks a sanity rule keeps its previous rows. The
// files are written only if the whole set passes validateResults, otherwise the last good files stay in place.
import { readFileSync, writeFileSync } from 'node:fs'
import { parseCsv } from '../src/csv'
import { feedRows, sanityViolations, type CivicRace, type RaceRows } from '../src/civicapi'
import { validateResults, type ResultsRaceRow, type ResultsVoteRow } from '../src/results'
import type { NomineesFile } from '../src/types'

if (process.env.RESULTS_AUTO !== 'true') {
  console.log('RESULTS_AUTO is not "true": feed fetch is off, no files written.')
  process.exit(0)
}

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf-8')
const quote = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
const toCsv = (headers: readonly string[], rows: Record<string, string>[]) =>
  [headers.join(','), ...rows.map((row) => headers.map((h) => quote(row[h] ?? '')).join(','))].join('\n') + '\n'

const RACE_HEADERS = ['race_id', 'status', 'percent_reporting', 'note', 'source_url', 'as_of', 'winner'] as const
const VOTE_HEADERS = ['race_id', 'candidate', 'party', 'votes'] as const

const nominees = JSON.parse(read('data/nominees.json')) as NomineesFile
const feedMap = JSON.parse(read('data/results-feed-map.json')) as Record<string, { civicRaceId: number; officialUrl: string | null }>
const previousRaces = parseCsv(read('data/results-races.csv')) as unknown as ResultsRaceRow[]
const previousVotes = parseCsv(read('data/results-votes.csv')) as unknown as ResultsVoteRow[]

const previous = new Map<string, RaceRows>()
for (const race of previousRaces) {
  previous.set(race.race_id, { race, votes: previousVotes.filter((v) => v.race_id === race.race_id) })
}

const asOf = new Date().toISOString()
const next = new Map(previous)
let updated = 0

for (const [raceId, entry] of Object.entries(feedMap)) {
  const response = await fetch(`https://civicapi.org/api/v2/race/${entry.civicRaceId}`, {
    headers: { 'User-Agent': 'money-and-margins-results/1.0 (https://moneyandmargins.app)' },
  }).catch((error: unknown) => error)
  if (!(response instanceof Response) || !response.ok) {
    console.log(`${raceId}: fetch failed, keeping previous rows`)
    continue
  }
  const civic = (await response.json()) as CivicRace
  const result = feedRows(raceId, civic, nominees, entry.officialUrl, asOf)
  if (!result.ok) {
    console.log(`${raceId}: ${result.reason}, keeping previous rows`)
    continue
  }
  const violations = sanityViolations(previous.get(raceId), result.rows)
  if (violations.length > 0) {
    console.log(`${raceId}: held (${violations.join('; ')})`)
    continue
  }
  next.set(raceId, result.rows)
  updated += 1
}

const races = [...next.values()].map((r) => r.race)
const votes = [...next.values()].flatMap((r) => r.votes)
const { errors } = validateResults(races, votes, nominees)
if (errors.length > 0) {
  console.error(`Results validation failed, nothing written (${errors.length}):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

const racesText = toCsv(RACE_HEADERS, races as unknown as Record<string, string>[])
const votesText = toCsv(VOTE_HEADERS, votes as unknown as Record<string, string>[])
if (racesText !== read('data/results-races.csv')) writeFileSync(new URL('data/results-races.csv', root), racesText)
if (votesText !== read('data/results-votes.csv')) writeFileSync(new URL('data/results-votes.csv', root), votesText)
console.log(`Fetched ${Object.keys(feedMap).length} races, updated ${updated}.`)
