import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import 'dotenv/config'
import type { RawScheduleERow } from './lib/fec-itemized'
import type { Candidate, Committee, ExpenditureTotals, FecMatch, NomineesFile, SpendingFile, SpendingMetadata, SpendingStatus } from '../src/types'
import { dedupeIeRows, noticeDate, periodicCutoffs, type IeRow, type ReportCoverage } from './lib/dedup-ie'
import { createFecClient, type Params } from './lib/fec-client'
import { assertInCycle, CYCLE, fetchItemizedRows, fetchReports, toIeRow } from './lib/fec-itemized'
import { fecNameMatchesNominee, nomineeFirstAndLast } from './lib/fec-name-match'

const API_KEY = process.env.FEC_API_KEY ?? 'DEMO_KEY'
const BATCH_SIZE = 25
// A refresh that returns far fewer rows than the last one is treated as a bad pull and does not overwrite spending.json.
const MIN_ROW_RATIO = 0.9
const client = createFecClient({ apiKey: API_KEY })
// --from-raw=data/raw/<timestamp> rebuilds spending.json from a saved pull without re-fetching the rows.
const FROM_RAW = process.argv.find((a) => a.startsWith('--from-raw='))?.slice('--from-raw='.length)
// --out=data/spending.candidate.json writes the result somewhere else, so scripts/verify.ts can check it before it replaces spending.json.
const OUT = process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length) ?? 'data/spending.json'
const SOURCE_NOTE =
  'FEC Schedule E independent expenditures, itemized (/schedules/schedule_e/), cycle=2026, 24/48-hour notices included and de-duplicated against periodic reports (see metadata.dedup_method).'
const DEDUP_METHOD =
  'Itemized Schedule E rows. Memo subtotals dropped. Within each filing chain only the latest version of a transaction is kept (FEC most_recent flag plus previous_file_number on amendments). ' +
  'For each committee, periodic-report rows (non-notice) stand up to the latest processed periodic coverage end date, and 24/48-hour notices count only after it. ' +
  'If a committee has periodic rows but no coverage end date can be matched, notices are matched one for one to periodic rows on (committee, candidate, support/oppose, amount, date, payee) and the committee is listed as approximate.'

// S4AK00214 is incumbent Dan Sullivan. The 2a nickname matching had also attached
// S6AK00326 (a separate 2026 registrant, Daniel J. Sullivan Jr., excluded from the
// MVP) to him, so the assignment is explicit.
const FEC_ID_ASSIGNMENTS: Record<string, string[]> = {
  'AK-2026--DAN-SULLIVAN': ['S4AK00214'],
}
const EXCLUDED_CANDIDATE_IDS = new Set(['AK-2026--DANIEL-J-SULLIVAN-JR'])
const SULLIVAN_REVIEW_IDS = ['S4AK00214', 'S6AK00326', 'S6AK00276']

// Brown and Rogers are the largest figures; printed with their window so the
// totals can be compared against FEC's site.
const COMPARE_CANDIDATE_IDS = ['OH-2026--SHERROD-BROWN', 'MI-2026--MIKE-ROGERS']

// Regenerates the symmetry-test fixture (--save-fixture): the OH race, where
// both the D and R nominee have multi-committee spending on both sides.
const FIXTURE_CANDIDATE_IDS = ['OH-2026--JON-HUSTED', 'OH-2026--SHERROD-BROWN']

interface Page<T> {
  results: T[]
  pagination: { pages: number; count: number }
}

interface FecCandidateRecord {
  candidate_id: string
  name: string
  office: string
  state: string
  party: string
  cycles: number[]
  election_years: number[]
  incumbent_challenge: string | null
}

async function fecGetPage<T>(path: string, params: Params, page: number): Promise<Page<T>> {
  return client.get<Page<T>>(path, [...params, ['per_page', '100'], ['page', String(page)]])
}

/** Fetches every page, keyed for dedupe, and fails if the unique row count
 * differs from FEC's reported count (the 2a pagination bug dropped/duplicated rows). */
async function fecGetAll<T>(path: string, params: Params, keyOf: (row: T) => string): Promise<T[]> {
  const byKey = new Map<string, T>()
  let page = 1
  let pages = 1
  let expected = -1

  do {
    const body = await fecGetPage<T>(path, params, page)
    if (expected === -1) expected = body.pagination.count
    for (const row of body.results) byKey.set(keyOf(row), row)
    pages = body.pagination.pages
    page += 1
  } while (page <= pages)

  if (byKey.size !== expected) {
    throw new Error(`Pagination integrity check failed for ${path}: FEC reported ${expected} rows, got ${byKey.size} unique.`)
  }
  return [...byKey.values()]
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

type ResolvedHow = 'nominees.json' | 'override' | 'name search'

interface Assignment {
  fecIds: string[]
  how: ResolvedHow
}

interface SearchOutcome {
  fecIds: string[]
  note: string
  matches: FecCandidateRecord[]
}

/** Searches by state + Senate office with no cycle filter (candidate IDs persist
 * across cycles), then requires 2026 in the matched record's cycles. */
async function searchFecByName(candidate: Candidate): Promise<SearchOutcome> {
  const state = candidate.raceId.slice(0, 2)
  const { first, last } = nomineeFirstAndLast(candidate.name)

  let matches: FecCandidateRecord[] = []
  const seen = new Map<string, FecCandidateRecord>()
  for (const q of [last, first]) {
    const results = await fecGetAll<FecCandidateRecord>(
      '/candidates/search/',
      [['q', q], ['state', state], ['office', 'S'], ['sort', 'candidate_id']],
      (r) => r.candidate_id,
    )
    for (const r of results) seen.set(r.candidate_id, r)
    matches = results.filter((r) => fecNameMatchesNominee(candidate.name, r.name))
    if (matches.length > 0) break
  }

  // On no match, return the raw hits so the unmatched report shows near-misses.
  if (matches.length === 0) return { fecIds: [], note: 'no FEC filing found', matches: [...seen.values()] }

  const active = matches.filter((m) => m.cycles.includes(CYCLE))
  if (active.length === 0) {
    return { fecIds: [], note: 'FEC record found but no 2026 cycle activity', matches }
  }
  if (active.length > 1) {
    return { fecIds: [], note: 'ambiguous: multiple 2026 FEC records matched', matches: active }
  }
  return { fecIds: [active[0].candidate_id], note: 'resolved by name search', matches: active }
}

function assertUniqueOwnership(assignments: Map<string, Assignment>): Map<string, string> {
  const owners = new Map<string, string[]>()
  for (const [candidateId, { fecIds }] of assignments) {
    for (const fecId of fecIds) owners.set(fecId, [...(owners.get(fecId) ?? []), candidateId])
  }
  const duplicated = [...owners].filter(([, ids]) => ids.length > 1)
  if (duplicated.length > 0) {
    throw new Error(
      `FEC candidate ID claimed by more than one nominee: ${duplicated.map(([fecId, ids]) => `${fecId} -> ${ids.join(' & ')}`).join('; ')}`,
    )
  }
  return new Map([...owners].map(([fecId, ids]) => [fecId, ids[0]]))
}

function committeeUrl(committeeId: string): string {
  return `https://www.fec.gov/data/committee/${committeeId}/`
}

function candidateSourceUrl(candidate: Candidate, fecIds: string[]): string {
  if (fecIds.length > 0) {
    return `https://www.fec.gov/data/candidate/${fecIds[0]}/?tab=independent-expenditures&cycle=${CYCLE}&election_full=false`
  }
  return `https://www.fec.gov/data/elections/senate/${candidate.raceId.slice(0, 2)}/${CYCLE}/`
}

/** Sums per committee for one side, desc by amount, ties by committee_id ascending. */
function topCommittees(rows: IeRow[], side: 'S' | 'O'): Committee[] {
  const byCommittee = new Map<string, { name: string; amount: number }>()
  for (const row of rows) {
    if (row.support_oppose_indicator !== side) continue
    const existing = byCommittee.get(row.committee_id)
    if (existing) {
      existing.amount += row.expenditure_amount
    } else {
      byCommittee.set(row.committee_id, { name: row.committee_name ?? row.committee_id, amount: row.expenditure_amount })
    }
  }
  return [...byCommittee.entries()]
    .sort((a, b) => b[1].amount - a[1].amount || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([id, { name, amount }]) => ({ id, name, fecUrl: committeeUrl(id), amount }))
}

function sumSide(rows: IeRow[], side: 'S' | 'O'): number {
  return rows.reduce((sum, row) => (row.support_oppose_indicator === side ? sum + row.expenditure_amount : sum), 0)
}

function buildTotals(
  candidates: Candidate[],
  assignments: Map<string, Assignment>,
  rowsByFecId: Map<string, IeRow[]>,
  fetchedAt: string,
): ExpenditureTotals[] {
  return candidates.map((candidate) => {
    const fecIds = assignments.get(candidate.id)?.fecIds ?? []
    const sourceUrl = candidateSourceUrl(candidate, fecIds)

    if (fecIds.length === 0) {
      return {
        candidateId: candidate.id,
        status: 'unmatched' as SpendingStatus,
        fecIds,
        support: { value: null, sourceUrl, asOf: fetchedAt },
        oppose: { value: null, sourceUrl, asOf: fetchedAt },
        topSupportCommittees: [],
        topOpposeCommittees: [],
      }
    }

    const rows = fecIds.flatMap((id) => rowsByFecId.get(id) ?? [])
    return {
      candidateId: candidate.id,
      status: (rows.length > 0 ? 'queried_with_rows' : 'queried_zero_rows') as SpendingStatus,
      fecIds,
      support: { value: sumSide(rows, 'S'), sourceUrl, asOf: fetchedAt },
      oppose: { value: sumSide(rows, 'O'), sourceUrl, asOf: fetchedAt },
      topSupportCommittees: topCommittees(rows, 'S'),
      topOpposeCommittees: topCommittees(rows, 'O'),
    }
  })
}

async function main() {
  const nomineesFile = JSON.parse(
    readFileSync(new URL('../data/nominees.json', import.meta.url), 'utf-8'),
  ) as NomineesFile
  const candidates = nomineesFile.candidates.filter((c) => !EXCLUDED_CANDIDATE_IDS.has(c.id))

  // 1. Starting assignments: 2a data, with explicit overrides applied.
  const assignments = new Map<string, Assignment>()
  for (const c of candidates) {
    const override = FEC_ID_ASSIGNMENTS[c.id]
    assignments.set(
      c.id,
      override ? { fecIds: override, how: 'override' } : { fecIds: [...c.fecIds], how: 'nominees.json' },
    )
  }

  // 2. Name search for every nominee still without an FEC ID.
  const unresolved: { candidate: Candidate; note: string; matches: FecCandidateRecord[] }[] = []
  const searched: { candidate: Candidate; record: FecCandidateRecord }[] = []
  for (const c of candidates) {
    if ((assignments.get(c.id)?.fecIds.length ?? 0) > 0) continue
    const outcome = await searchFecByName(c)
    if (outcome.fecIds.length === 1) {
      assignments.set(c.id, { fecIds: outcome.fecIds, how: 'name search' })
      searched.push({ candidate: c, record: outcome.matches[0] })
    } else {
      unresolved.push({ candidate: c, note: outcome.note, matches: outcome.matches })
    }
  }

  // 3. Each FEC ID must belong to exactly one nominee (throws otherwise).
  const ownerByFecId = assertUniqueOwnership(assignments)

  // 4. FEC records for every ID we will query: confirms identity and 2026 cycle.
  const allFecIds = [...ownerByFecId.keys()]
  const records = new Map<string, FecCandidateRecord>()
  for (const batch of chunk(allFecIds, BATCH_SIZE)) {
    const got = await fecGetAll<FecCandidateRecord>(
      '/candidates/',
      [...batch.map((id): [string, string] => ['candidate_id', id]), ['sort', 'candidate_id']],
      (r) => r.candidate_id,
    )
    for (const r of got) records.set(r.candidate_id, r)
  }
  const no2026Cycle = allFecIds.filter((id) => !records.get(id)?.cycles.includes(CYCLE))

  // 5. Itemized Schedule E rows, 24/48-hour notices included, cycle 2026 only.
  const savedDir = FROM_RAW ? new URL(`../${FROM_RAW.replace(/\/?$/, '/')}`, import.meta.url) : null
  const readGz = <T>(name: string): T => JSON.parse(gunzipSync(readFileSync(new URL(name, savedDir as URL))).toString('utf-8')) as T
  const rawItemized = savedDir ? readGz<RawScheduleERow[]>('itemized.json.gz') : await fetchItemizedRows(client, allFecIds)
  const rawRows = rawItemized.map(toIeRow)
  assertInCycle(rawRows)

  // 6. De-duplicate: latest version per transaction, periodic rows up to each committee's coverage end, notices after it.
  const reports = savedDir ? readGz<ReportCoverage[]>('reports.json.gz') : await fetchReports(client, [...new Set(rawRows.map((r) => r.committee_id))])
  const cutoffs = periodicCutoffs(rawRows, reports)
  const dedup = dedupeIeRows(rawRows, cutoffs)
  const keptRows = dedup.kept

  const rowsByFecId = new Map<string, IeRow[]>()
  for (const row of keptRows) {
    rowsByFecId.set(row.candidate_id, [...(rowsByFecId.get(row.candidate_id) ?? []), row])
  }

  const fetchedAt = savedDir
    ? (JSON.parse(readFileSync(new URL('meta.json', savedDir), 'utf-8')) as { fetchedAt: string }).fetchedAt
    : new Date().toISOString()
  const totals = buildTotals(candidates, assignments, rowsByFecId, fetchedAt)

  // Latest dissemination date per race and overall, from the rows that count.
  const stateOf = new Map<string, string>()
  for (const c of candidates) for (const id of assignments.get(c.id)?.fecIds ?? []) stateOf.set(id, c.raceId.slice(0, 2))
  const latestByState: Record<string, string> = {}
  let latestOverall = ''
  let futureDated = 0
  for (const row of keptRows) {
    const date = noticeDate(row)
    const state = stateOf.get(row.candidate_id)
    if (!date || !state) continue
    // A filing with a date after the fetch is a typo in the filing; it still counts but cannot set "latest".
    if (date > fetchedAt.slice(0, 10)) {
      futureDated += 1
      continue
    }
    if (date > (latestByState[state] ?? '')) latestByState[state] = date
    if (date > latestOverall) latestOverall = date
  }

  const rawJson = JSON.stringify(rawItemized)
  const rawHash = createHash('sha256').update(rawJson).digest('hex')
  const metadata: SpendingMetadata = {
    dedup_method: DEDUP_METHOD,
    rows_pulled: rawRows.length,
    rows_kept: keptRows.length,
    rows_dropped: dedup.dropped,
    approximate_committees: dedup.approximateCommittees,
    approx_rows_total: dedup.approximateTotal,
    latest_dissemination_date: latestOverall || null,
    future_dated_rows: futureDated,
    latest_dissemination_by_race: Object.fromEntries(Object.entries(latestByState).sort(([a], [b]) => a.localeCompare(b))),
    raw_sha256: rawHash,
    raw_path: FROM_RAW ? FROM_RAW.replace(/\/?$/, '/') : `data/raw/${fetchedAt.replace(/[:.]/g, '-')}/`,
    requests: client.requestCount(),
  }

  // ---- Report ----
  const statusCounts = { queried_with_rows: 0, queried_zero_rows: 0, unmatched: 0 }
  for (const t of totals) statusCounts[t.status] += 1

  console.log('\n=== Status counts ===')
  console.table(statusCounts)

  console.log('\n=== Unmatched nominees (spending = null; review each) ===')
  console.table(
    unresolved.map(({ candidate, note, matches }) => ({
      candidate: candidate.id,
      reason: note,
      rawSearchHits: matches.map((m) => `${m.candidate_id} ${m.name} [${m.cycles.slice(-2).join(',')}]`).join('; ') || '(none)',
    })),
  )

  console.log('\n=== Resolved by name search (no cycle filter; 2026 confirmed in cycles) ===')
  console.table(
    searched.map(({ candidate, record }) => ({
      candidate: candidate.name,
      state: candidate.raceId.slice(0, 2),
      fecId: record.candidate_id,
      fecName: record.name,
      fecParty: record.party,
      cycles: record.cycles.join(','),
    })),
  )

  console.log('\n=== Sullivan / Peltola resolution ===')
  console.table(
    SULLIVAN_REVIEW_IDS.map((id) => {
      const r = records.get(id)
      return {
        fecId: id,
        name: r?.name,
        office: r?.office,
        state: r?.state,
        party: r?.party,
        incumbentChallenger: r?.incumbent_challenge,
        cycles: r?.cycles.join(','),
        assignedTo: ownerByFecId.get(id) ?? '(not queried)',
        queried: ownerByFecId.has(id) ? 'yes' : 'NO',
      }
    }),
  )

  console.log('\n=== Query window and dedup ===')
  console.log(`GET /v1/schedules/schedule_e/ cycle=${CYCLE}, notices included: ${rawRows.length} rows pulled, ${keptRows.length} kept, ${client.requestCount()} requests.`)
  console.log('Dropped:', dedup.dropped, '| approximate committees:', dedup.approximateCommittees.length, '| latest dissemination:', latestOverall)
  console.table(
    COMPARE_CANDIDATE_IDS.map((id) => {
      const t = totals.find((x) => x.candidateId === id)
      return {
        candidate: id,
        fecIds: t?.fecIds.join(', '),
        support: t?.support.value,
        oppose: t?.oppose.value,
        compareAt: t?.support.sourceUrl,
      }
    }),
  )

  console.log('\n=== Top spend (sorted by support + oppose volume for listing only; sides not netted) ===')
  console.table(
    [...totals]
      .filter((t) => t.status === 'queried_with_rows')
      .sort((a, b) => (b.support.value ?? 0) + (b.oppose.value ?? 0) - ((a.support.value ?? 0) + (a.oppose.value ?? 0)))
      .slice(0, 15)
      .map((t) => ({
        candidateId: t.candidateId,
        support: Math.round(t.support.value ?? 0),
        oppose: Math.round(t.oppose.value ?? 0),
        supportCommittees: t.topSupportCommittees.length,
        opposeCommittees: t.topOpposeCommittees.length,
      })),
  )

  if (no2026Cycle.length > 0) {
    console.warn(`\nWARNING: queried FEC IDs with no ${CYCLE} cycle on their FEC record: ${no2026Cycle.join(', ')}`)
  }
  console.log(`\n${totals.length} candidates, ${allFecIds.length} distinct FEC IDs queried, ${rawRows.length} itemized rows pulled, ${keptRows.length} counted.`)

  const spendingFile: SpendingFile = { fetchedAt, source: SOURCE_NOTE, metadata, totals }

  if (process.argv.includes('--confirm')) {
    // A bad pull must not replace good data: far fewer rows than last time fails the run.
    const previous = existsSync(new URL('../data/spending.json', import.meta.url))
      ? (JSON.parse(readFileSync(new URL('../data/spending.json', import.meta.url), 'utf-8')) as SpendingFile)
      : null
    const before = previous?.metadata?.rows_pulled
    if (before && rawRows.length < before * MIN_ROW_RATIO) {
      throw new Error(`Refusing to overwrite data/spending.json: this pull has ${rawRows.length} rows, the last had ${before} (less than ${MIN_ROW_RATIO * 100}%).`)
    }

    // The raw pull is append-only, one folder per run; data/raw is gitignored and kept as a workflow artifact.
    const dir = new URL(`../${metadata.raw_path}`, import.meta.url)
    if (!savedDir) mkdirSync(dir, { recursive: true })
    if (!savedDir) writeFileSync(new URL('itemized.json.gz', dir), gzipSync(rawJson))
    if (!savedDir) writeFileSync(new URL('reports.json.gz', dir), gzipSync(JSON.stringify(reports)))
    if (!savedDir) writeFileSync(new URL('meta.json', dir), JSON.stringify({ fetchedAt, sha256: rawHash, rows: rawRows.length, requests: client.requestCount() }, null, 2) + '\n')

    writeFileSync(new URL(`../${OUT}`, import.meta.url), JSON.stringify(spendingFile, null, 2) + '\n')
    console.log(`\nWrote ${OUT} and`, metadata.raw_path)
  } else {
    console.log('\nPreview only. Rerun with --confirm to write data/spending.json')
  }

  if (process.argv.includes('--write-nominees')) {
    const updated: Candidate[] = candidates.map((c) => {
      const a = assignments.get(c.id) ?? { fecIds: [], how: 'nominees.json' as ResolvedHow }
      const fecMatches: FecMatch[] = a.fecIds.map((id) => ({
        id,
        fecName: records.get(id)?.name ?? '',
        fecParty: records.get(id)?.party ?? '',
        cycles: records.get(id)?.cycles ?? [],
        method:
          a.how === 'override'
            ? 'manual-assignment'
            : a.how === 'name search'
              ? 'fec-name-search'
              : (c.fecMatches?.find((m) => m.id === id)?.method ?? '2a-name-match'),
      }))
      const { fecMatchNote: previousNote, ...rest } = c
      const fecMatchNote =
        a.fecIds.length === 0
          ? 'no FEC filing found'
          : a.fecIds.length > 1
            ? (previousNote ?? `matched ${a.fecIds.length} FEC candidate IDs — not merged, verify same person`)
            : undefined
      return { ...rest, fecIds: a.fecIds, fecMatches, ...(fecMatchNote ? { fecMatchNote } : {}) }
    })
    const races = nomineesFile.races.map((r) =>
      r.id === 'AK-2026'
        ? {
            ...r,
            note: 'Alaska uses a top-four nonpartisan primary; two Republicans (Sullivan, Heikes) advanced. Daniel J. Sullivan Jr. (Undeclared, certified on the general ballot) is not shown in this version.',
          }
        : r,
    )
    writeFileSync(
      new URL('../data/nominees.json', import.meta.url),
      JSON.stringify({ ...nomineesFile, races, candidates: updated }, null, 2) + '\n',
    )
    console.log('Wrote resolved FEC IDs to data/nominees.json')
  }

  if (process.argv.includes('--save-fixture')) {
    const fixtureTotals = totals.filter((t) => FIXTURE_CANDIDATE_IDS.includes(t.candidateId))
    writeFileSync(
      new URL('./__fixtures__/spending-fixture.json', import.meta.url),
      JSON.stringify({ fetchedAt, source: SOURCE_NOTE, totals: fixtureTotals }, null, 2) + '\n',
    )
    console.log('Wrote scripts/__fixtures__/spending-fixture.json')
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
