// Runs after each fetch, before the new spending file replaces data/spending.json.
//   tsx scripts/verify.ts --candidate=data/spending.candidate.json --previous=data/spending.json
// Appends this run to data/verification.json and exits 1 if any check failed. It never changes a flag:
// shares_ready is reported, and a person decides.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { pickPair } from '../src/computeCallout'
import { buildAllRaces } from '../src/computeSpending'
import type { NomineesFile, SpendingFile } from '../src/types'
import { dedupeIeRows, periodicCutoffs, type ReportCoverage } from './lib/dedup-ie'
import { toIeRow, type RawScheduleERow } from './lib/fec-itemized'
import {
  appendRun,
  checkDoubleCount,
  checkExportReconciliation,
  checkPrimaryShare,
  checkRaceDrops,
  checkTotalsIdentity,
  exportDateOf,
  exportRowsFromCsv,
  type CheckResult,
  type RaceRow,
  type ReconcileTarget,
  type TotalsBreakdown,
  type VerificationFile,
} from './lib/verify-checks'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const root = new URL('../', import.meta.url)
const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, root), 'utf-8')) as T

// The two saved FEC exports (2026-cycle rows) and the lines to reconcile in each.
const EXPORT_DIR = 'scripts/__fixtures__/exports/'
const TARGETS: ReconcileTarget[] = [
  {
    committee_id: 'C00960211',
    label: 'Texas PAC',
    lines: [
      { candidate_id: 'S6TX00388', side: 'S', label: 'supporting Paxton' },
      { candidate_id: 'S6TX00479', side: 'O', label: 'opposing Talarico' },
    ],
  },
  {
    committee_id: 'C00571703',
    label: 'SLF PAC',
    lines: [
      { candidate_id: 'S6OH00163', side: 'O', label: 'opposing Brown' },
      { candidate_id: 'S6OH00304', side: 'S', label: 'supporting Husted' },
    ],
  },
]

const candidatePath = arg('candidate') ?? 'data/spending.json'
const previousPath = arg('previous')
const candidate = readJson<SpendingFile>(candidatePath)
const previous = previousPath && existsSync(new URL(previousPath, root)) ? readJson<SpendingFile>(previousPath) : null
const nominees = readJson<NomineesFile>('data/nominees.json')

const rawDir = candidate.metadata?.raw_path
if (!rawDir) throw new Error(`${candidatePath} has no metadata.raw_path: it was not built from a saved raw pull.`)
const readGz = <T>(name: string): T => JSON.parse(gunzipSync(readFileSync(new URL(`${rawDir}${name}`, root))).toString('utf-8')) as T
const rows = readGz<RawScheduleERow[]>('itemized.json.gz').map(toIeRow)
const reports = readGz<ReportCoverage[]>('reports.json.gz')
const kept = dedupeIeRows(rows, periodicCutoffs(rows, reports)).kept

// Each FEC candidate ID belongs to one nominee, and each nominee to one race.
const raceOfFecId = new Map<string, string>()
for (const t of candidate.totals) {
  const nominee = nominees.candidates.find((c) => c.id === t.candidateId)
  if (nominee) for (const id of t.fecIds) raceOfFecId.set(id, nominee.raceId.slice(0, 2))
}
const raceRows: RaceRow[] = kept.flatMap((r) => (raceOfFecId.has(r.candidate_id) ? [{ ...r, race: raceOfFecId.get(r.candidate_id) as string }] : []))

const raceTotals = (file: SpendingFile): Record<string, number> =>
  Object.fromEntries(buildAllRaces(nominees, file).races.map((r) => [r.state, r.total ?? 0]))

// 5. Where every dollar of the all-races total goes.
function breakdown(): TotalsBreakdown {
  const out: TotalsBreakdown = { allRaces: 0, aligned: 0, unattributed: 0, excluded: 0 }
  for (const race of buildAllRaces(nominees, candidate).races) {
    const total = race.total ?? 0
    out.allRaces += total
    if (race.incompleteCount > 0) {
      out.excluded += total
      continue
    }
    const pair = pickPair(race.rows)
    if (pair.length < 2) {
      out.unattributed += total
      continue
    }
    const ids = new Set(pair.map((p) => p.candidateId))
    for (const member of pair) {
      const other = pair.find((p) => p !== member)
      out.aligned += (member.support?.value ?? 0) + (other?.oppose?.value ?? 0)
    }
    out.unattributed += race.rows.filter((r) => !ids.has(r.candidateId)).reduce((s, r) => s + (r.support?.value ?? 0) + (r.oppose?.value ?? 0), 0)
  }
  return out
}

function reconciliation(): CheckResult {
  const files = readdirSync(new URL(EXPORT_DIR, root)).filter((f) => f.endsWith('.csv')).sort()
  const parts = files.map((file) => {
    const upTo = exportDateOf(file)
    if (!upTo) throw new Error(`Cannot read an export date from ${file}`)
    const exportRows = exportRowsFromCsv(readFileSync(new URL(`${EXPORT_DIR}${file}`, root), 'utf-8'))
    const present = TARGETS.filter((t) => exportRows.some((r) => r.committee_id === t.committee_id))
    return { file, result: checkExportReconciliation(exportRows, kept, present, upTo) }
  })
  const details = parts.flatMap((p) => p.result.details.map((d) => ({ file: p.file, ...d })))
  const failed = parts.filter((p) => !p.result.pass).length
  return {
    id: 'export_reconciliation',
    blocking: true,
    name: parts[0]?.result.name ?? 'Named committees match the saved FEC exports',
    pass: failed === 0 && parts.length > 0,
    summary: parts.map((p) => `${p.file}: ${p.result.summary}`).join('; '),
    details,
  }
}

const checks: CheckResult[] = [
  checkRaceDrops(previous ? raceTotals(previous) : null, raceTotals(candidate)),
  reconciliation(),
  checkDoubleCount(raceRows),
  checkPrimaryShare(raceRows),
  checkTotalsIdentity(breakdown()),
]

const run = {
  ran_at: new Date().toISOString(),
  fetched_at: candidate.fetchedAt,
  raw_sha256: candidate.metadata?.raw_sha256 ?? '',
  passed: checks.every((c) => c.pass),
  blocked: checks.some((c) => c.blocking && !c.pass),
  checks,
}
const historyPath = arg('history') ? new URL(arg('history') as string, `file://${process.cwd()}/`) : new URL('data/verification.json', root)
const history: VerificationFile | null = existsSync(historyPath) ? (JSON.parse(readFileSync(historyPath, 'utf-8')) as VerificationFile) : null
const next = appendRun(history, run)
writeFileSync(historyPath, JSON.stringify(next, null, 2) + '\n')

const lines = [
  '## Verification',
  ...checks.map((c) => `- ${c.pass ? 'PASS' : c.blocking ? 'FAIL (blocking)' : 'FAIL (advisory)'} ${c.id}: ${c.summary}`),
  `- shares_ready: ${next.shares_ready} (${next.runs.length} run${next.runs.length === 1 ? '' : 's'} on record; ${next.shares_ready_rule})`,
]
console.log(lines.join('\n'))
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n', { flag: 'a' })
if (run.blocked) {
  console.error('A blocking check failed. spending.json was not replaced.')
  process.exitCode = 1
}
