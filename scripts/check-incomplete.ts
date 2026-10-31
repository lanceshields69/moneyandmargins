import { readFileSync } from 'node:fs'
import { knownIncompleteProblems, type KnownIncomplete } from '../src/incomplete'
import type { NomineesFile, SpendingFile } from '../src/types'

const read = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf-8')) as T

const nominees = read<NomineesFile>('nominees.json')
const spending = read<SpendingFile>('spending.json')
const known = read<KnownIncomplete[]>('known-incomplete.json')

const problems = knownIncompleteProblems(nominees.candidates, new Set(spending.totals.map((t) => t.candidateId)), known)
if (problems.length > 0) {
  const list = problems.map((p) => `  - ${p}`).join('\n')
  // The scheduled refresh sets INCOMPLETE_CHECK=warn: flagged nominees still publish, shown as "Incomplete data".
  if (process.env.INCOMPLETE_CHECK === 'warn') {
    console.warn('Incomplete-data warning (publishing anyway):\n' + list)
  } else {
    console.error('Incomplete-data check failed:\n' + list)
    process.exit(1)
  }
} else {
  console.log('Incomplete-data check passed.')
}
