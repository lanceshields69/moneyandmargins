import { readFileSync } from 'node:fs'
import { knownIncompleteProblems, type KnownIncomplete } from '../src/incomplete'
import type { NomineesFile, SpendingFile } from '../src/types'

const read = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf-8')) as T

const nominees = read<NomineesFile>('nominees.json')
const spending = read<SpendingFile>('spending.json')
const known = read<KnownIncomplete[]>('known-incomplete.json')

const problems = knownIncompleteProblems(nominees.candidates, new Set(spending.totals.map((t) => t.candidateId)), known)
if (problems.length > 0) {
  console.error('Incomplete-data check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log('Incomplete-data check passed.')
