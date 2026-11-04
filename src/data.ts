import resultsRacesRaw from '../data/results-races.csv?raw'
import seatHoldersJson from '../data/seat-holders.json'
import resultsVotesRaw from '../data/results-votes.csv?raw'
import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import usStatesData from '../data/us-states.json'
import { parseCsv } from './csv'
import { buildAllRaces } from './computeSpending'
import { buildAllCallouts, latestSnapshot } from './computeCallout'
import { buildResultsByRace, type ResultsRaceRow, type ResultsVoteRow } from './results'
import type { RaceFlagsFile } from './raceFlags'
import type { NomineesFile, Party, SpendingFile } from './types'
import type { SeatForecastEntry } from './seatForecastSources'

const snapshotFiles = import.meta.glob('../data/frozen/*/snapshot.json', { eager: true })
// Optional: written by scripts/verify.ts, so it does not exist until the first run that passes. A glob, not an
// import, so a missing file is an empty object rather than a build error.
const methodologyFiguresFiles = import.meta.glob('../data/methodology-figures.json', { eager: true, import: 'default' })
export const methodologyFigures = (Object.values(methodologyFiguresFiles)[0] ?? null) as { fetchedAt?: string; dedupShortfallPct?: number } | null
const seatForecastFiles = import.meta.glob('../data/frozen-seats/*/snapshot.json', { eager: true })

/** The newest seat-forecast snapshot, by folder name (a sortable timestamp). Parallel to latestSnapshot, for the
 * chamber-wide "Forecast to win the Senate" carousel rather than the per-race map callout. Browsers never fetch
 * these sources directly; see scripts/freeze-seat-forecasts.ts. */
function latestSeatForecastSnapshot(files: Record<string, unknown>): readonly SeatForecastEntry[] {
  const names = Object.keys(files).sort()
  if (names.length === 0) return []
  const mod = files[names[names.length - 1]] as { default?: { sources: SeatForecastEntry[] } } & { sources?: SeatForecastEntry[] }
  return (mod.default ?? mod).sources ?? []
}

// Optional: written by scripts/verify.ts. A glob so a missing file is no flags rather than a build error.
const raceFlagFiles = import.meta.glob('../data/race-flags.json', { eager: true, import: 'default' })
const raceFlags = (Object.values(raceFlagFiles)[0] ?? null) as RaceFlagsFile | null

export const allRaces = buildAllRaces(
  nomineesJson as unknown as NomineesFile,
  spendingJson as unknown as SpendingFile,
  raceFlags,
)

export const forecastSnapshot = latestSnapshot(snapshotFiles)
export const seatForecastSources = latestSeatForecastSnapshot(seatForecastFiles)

export const resultsByRace = buildResultsByRace(
  parseCsv(resultsRacesRaw) as unknown as ResultsRaceRow[],
  parseCsv(resultsVotesRaw) as unknown as ResultsVoteRow[],
  nomineesJson as unknown as NomineesFile,
)

export const callouts = buildAllCallouts(allRaces.races, forecastSnapshot, resultsByRace, seatHoldersJson.holders as Record<string, Party>)

export const stateNames = new Map(
  (usStatesData as { states: { usps: string; name: string }[] }).states.map((s) => [s.usps, s.name]),
)

const geometry = usStatesData as unknown as { viewBox: string; states: { usps: string; d: string; labelPoint: [number, number] }[] }
export const mapViewBox = geometry.viewBox.split(' ').map(Number) as [number, number, number, number]
export const labelPoints = new Map(geometry.states.map((s) => [s.usps, s.labelPoint]))
export const statePaths = new Map(geometry.states.map((s) => [s.usps, s.d]))

/** The outline's bounding box as an SVG viewBox, from its absolute M/L/Z coordinates. */
function outlineBox(d: string): string {
  const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    minX = Math.min(minX, numbers[i]); maxX = Math.max(maxX, numbers[i])
    minY = Math.min(minY, numbers[i + 1]); maxY = Math.max(maxY, numbers[i + 1])
  }
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
}
export const stateBoxes = new Map(geometry.states.map((s) => [s.usps, outlineBox(s.d)]))
