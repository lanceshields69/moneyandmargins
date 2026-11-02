// Validates data/results-races.csv and data/results-votes.csv against data/nominees.json. Runs in `npm run
// prebuild` and is exercised directly by src/results.test.ts. Read-only: it never writes a file.
import { readFileSync } from 'node:fs'
import { parseCsv } from '../src/csv'
import { validateResults, type ResultsRaceRow, type ResultsVoteRow } from '../src/results'
import type { NomineesFile } from '../src/types'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf-8')

const nominees = JSON.parse(read('data/nominees.json')) as NomineesFile
const raceRows = parseCsv(read('data/results-races.csv')) as unknown as ResultsRaceRow[]
const voteRows = parseCsv(read('data/results-votes.csv')) as unknown as ResultsVoteRow[]

const { errors } = validateResults(raceRows, voteRows, nominees)
if (errors.length > 0) {
  console.error(`Results validation failed (${errors.length}):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exitCode = 1
} else {
  console.log(`Results validation passed. ${raceRows.length} race row(s), ${voteRows.length} vote row(s).`)
}
