import resultsRacesRaw from '../data/results-races.csv?raw'
import resultsVotesRaw from '../data/results-votes.csv?raw'
import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import usStatesData from '../data/us-states.json'
import { parseCsv } from './csv'
import { buildAllRaces } from './computeSpending'
import { buildAllCallouts, latestSnapshot } from './computeCallout'
import { buildResultsByRace, type ResultsRaceRow, type ResultsVoteRow } from './results'
import type { NomineesFile, SpendingFile } from './types'

const snapshotFiles = import.meta.glob('../data/frozen/*/snapshot.json', { eager: true })

export const allRaces = buildAllRaces(
  nomineesJson as unknown as NomineesFile,
  spendingJson as unknown as SpendingFile,
)

export const forecastSnapshot = latestSnapshot(snapshotFiles)

export const resultsByRace = buildResultsByRace(
  parseCsv(resultsRacesRaw) as unknown as ResultsRaceRow[],
  parseCsv(resultsVotesRaw) as unknown as ResultsVoteRow[],
  nomineesJson as unknown as NomineesFile,
)

export const callouts = buildAllCallouts(allRaces.races, forecastSnapshot, resultsByRace)

export const stateNames = new Map(
  (usStatesData as { states: { usps: string; name: string }[] }).states.map((s) => [s.usps, s.name]),
)

const geometry = usStatesData as unknown as { viewBox: string; states: { usps: string; labelPoint: [number, number] }[] }
export const mapViewBox = geometry.viewBox.split(' ').map(Number) as [number, number, number, number]
export const labelPoints = new Map(geometry.states.map((s) => [s.usps, s.labelPoint]))
