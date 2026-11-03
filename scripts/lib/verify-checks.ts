// The verification checks. Pure functions over plain data, party-blind: nothing here reads a party except through
// the pair a caller passes in, so every check treats every race and party the same way.
export { parseCsv } from '../../src/csv'
import { parseCsv } from '../../src/csv'
import { dedupeIeRows, noticeDate, type IeRow } from './dedup-ie'

export interface CheckResult {
  id: string
  name: string
  /** A failed blocking check stops the refresh from replacing spending.json. Advisory checks are recorded and count toward shares_ready only. */
  blocking: boolean
  pass: boolean
  summary: string
  details: Record<string, unknown>[]
}

export interface RunRecord {
  ran_at: string
  fetched_at: string
  raw_sha256: string
  /** Every check passed (what shares_ready counts). */
  passed: boolean
  /** A blocking check failed: spending.json was not replaced. */
  blocked: boolean
  checks: CheckResult[]
}

export interface VerificationFile {
  /** True only when the last three consecutive runs passed every check. Nothing flips a flag from it automatically. */
  shares_ready: boolean
  shares_ready_rule: string
  runs: RunRecord[]
}

export const SHARES_READY_RULE = 'The last 3 consecutive runs passed all checks. Informational only: no flag is changed automatically.'
export const SHARES_READY_RUNS = 3

const pct = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0)
const round = (n: number) => Math.round(n * 100) / 100

// 1. No race dropped more than 2% and more than $100K against the previous run.
export function checkRaceDrops(previous: Record<string, number> | null, current: Record<string, number>, maxPct = 2, maxDollars = 100_000): CheckResult {
  const details: Record<string, unknown>[] = []
  if (previous) {
    for (const [race, before] of Object.entries(previous)) {
      const now = current[race] ?? 0
      const drop = before - now
      if (drop > maxDollars && pct(drop, before) > maxPct) details.push({ race, before: round(before), now: round(now), drop: round(drop), drop_pct: round(pct(drop, before)) })
    }
  }
  return {
    id: 'race_drops',
    blocking: true,
    name: 'No race total dropped more than 2% and $100K since the previous run',
    pass: details.length === 0,
    summary: previous ? `${details.length} race(s) dropped` : 'No previous run to compare with',
    details,
  }
}

// 2. Reconcile named committees to saved FEC export rows.
export interface ExportRow {
  committee_id: string
  candidate_id: string
  support_oppose_indicator: 'S' | 'O'
  expenditure_amount: number
  expenditure_date: string | null
  dissemination_date: string | null
  is_notice: boolean
  most_recent: boolean | null
  memo_code: string | null
  amendment_indicator: string | null
  election_type: string | null
  sub_id: string
  file_number: number | null
  previous_file_number: number | null
  transaction_id: string | null
  payee_name: string | null
  committee_name: string | null
}

export interface ReconcileTarget {
  committee_id: string
  label: string
  lines: { candidate_id: string; side: 'S' | 'O'; label: string }[]
}


const yes = (v: string) => v === 't' || v === 'true' || v === 'True'

export function exportRowsFromCsv(text: string): ExportRow[] {
  return parseCsv(text).map((r) => ({
    committee_id: r.committee_id,
    committee_name: r.committee_name || null,
    candidate_id: r.candidate_id,
    support_oppose_indicator: r.support_oppose_indicator as 'S' | 'O',
    expenditure_amount: Number(r.expenditure_amount || 0),
    expenditure_date: r.expenditure_date ? r.expenditure_date.slice(0, 10) : null,
    dissemination_date: r.dissemination_date ? r.dissemination_date.slice(0, 10) : null,
    is_notice: yes(r.is_notice),
    most_recent: r.most_recent === '' ? null : yes(r.most_recent),
    memo_code: r.memo_code || null,
    amendment_indicator: r.amendment_indicator || null,
    election_type: r.election_type || null,
    sub_id: r.sub_id,
    file_number: r.file_number ? Number(r.file_number) : null,
    previous_file_number: r.previous_file_number ? Number(r.previous_file_number) : null,
    transaction_id: r.transaction_id || null,
    payee_name: r.payee_name || null,
  }))
}

/** The export date from a file name like schedule_e-2026-10-31T14_33_41.csv. */
export const exportDateOf = (fileName: string): string | null => /(\d{4}-\d{2}-\d{2})T/.exec(fileName)?.[1] ?? null

const asIeRow = (r: ExportRow): IeRow => ({
  sub_id: r.sub_id,
  committee_id: r.committee_id,
  committee_name: r.committee_name,
  candidate_id: r.candidate_id,
  support_oppose_indicator: r.support_oppose_indicator,
  expenditure_amount: r.expenditure_amount,
  expenditure_date: r.expenditure_date,
  dissemination_date: r.dissemination_date,
  is_notice: r.is_notice,
  most_recent: r.most_recent,
  amendment_indicator: r.amendment_indicator,
  transaction_id: r.transaction_id,
  file_number: r.file_number,
  previous_file_number: r.previous_file_number,
  memo_code: r.memo_code,
  report_type: null,
  report_year: null,
  election_type: r.election_type,
  payee_name: r.payee_name,
  filing_form: null,
})

export function checkExportReconciliation(
  exportRows: ExportRow[],
  ours: IeRow[],
  targets: ReconcileTarget[],
  upTo: string,
  tolerancePct = 1,
): CheckResult {
  // 2026-cycle rows only, with the same latest-version rule as the pipeline, up to the export date.
  const cycle = exportRows.filter((r) => (r.election_type ?? '').endsWith('2026'))
  const exportKept = dedupeIeRows(cycle.map(asIeRow), new Map(targets.map((t) => [t.committee_id, null]))).kept
  const within = (date: string | null) => date !== null && date <= upTo
  const details: Record<string, unknown>[] = []
  for (const t of targets) {
    for (const line of t.lines) {
      const sum = (rows: IeRow[]) =>
        rows
          .filter((r) => r.committee_id === t.committee_id && r.candidate_id === line.candidate_id && r.support_oppose_indicator === line.side && within(noticeDate(r)))
          .reduce((s, r) => s + r.expenditure_amount, 0)
      const fromExport = sum(exportKept)
      const fromRun = sum(ours)
      const diff = fromRun - fromExport
      details.push({
        committee: t.label,
        line: line.label,
        up_to: upTo,
        export_total: round(fromExport),
        our_total: round(fromRun),
        difference: round(diff),
        difference_pct: round(pct(Math.abs(diff), fromExport)),
        pass: fromExport > 0 ? pct(Math.abs(diff), fromExport) <= tolerancePct : fromRun === 0,
      })
    }
  }
  const failed = details.filter((d) => d.pass === false).length
  return {
    id: 'export_reconciliation',
    blocking: true,
    name: `Named committees match the saved FEC exports within ${tolerancePct}% (rows up to the export dates)`,
    pass: failed === 0,
    summary: `${details.length - failed} of ${details.length} lines match`,
    details,
  }
}

// 3 and 4 work per race from the rows that count. `raceOf` maps an FEC candidate ID to its race.
export interface RaceRow extends IeRow {
  race: string
}

function perRace(rows: RaceRow[]): Map<string, RaceRow[]> {
  const out = new Map<string, RaceRow[]>()
  for (const r of rows) out.set(r.race, [...(out.get(r.race) ?? []), r])
  return out
}

/** Same committee, date and amount on two different candidates in one race: a contrast ad on two lines counts twice. */
export function doubleCountByRace(rows: RaceRow[]): Map<string, { overcount: number; total: number }> {
  const out = new Map<string, { overcount: number; total: number }>()
  for (const [race, list] of perRace(rows)) {
    const groups = new Map<string, Set<string>>()
    for (const r of list) {
      const key = `${r.committee_id}|${r.expenditure_date}|${r.expenditure_amount}`
      groups.set(key, (groups.get(key) ?? new Set()).add(r.candidate_id))
    }
    let overcount = 0
    for (const [key, candidates] of groups) if (candidates.size > 1) overcount += Number(key.split('|')[2]) * (candidates.size - 1)
    out.set(race, { overcount, total: list.reduce((s, r) => s + r.expenditure_amount, 0) })
  }
  return out
}

export function checkDoubleCount(rows: RaceRow[], maxPct = 2): CheckResult {
  const per = doubleCountByRace(rows)
  const details = [...per]
    .map(([race, v]) => ({ race, overcount: round(v.overcount), race_total: round(v.total), share_pct: round(pct(v.overcount, v.total)) }))
    .filter((d) => d.share_pct > maxPct)
    .sort((a, b) => b.share_pct - a.share_pct)
  const all = [...per.values()]
  return {
    id: 'double_count',
    blocking: false,
    name: `Possible double count (same committee, date and amount on two candidates) under ${maxPct}% in every race`,
    pass: details.length === 0,
    summary: `${details.length} race(s) over ${maxPct}%; overall ${round(pct(all.reduce((s, v) => s + v.overcount, 0), all.reduce((s, v) => s + v.total, 0)))}%`,
    details,
  }
}

/** Primary-labeled spending as a share of the race, using the filer's election_type. */
export const isPrimary = (electionType: string | null): boolean => (electionType ?? '').toUpperCase().startsWith('P')

export function checkPrimaryShare(rows: RaceRow[], maxPct = 10): CheckResult {
  const details = [...perRace(rows)]
    .map(([race, list]) => {
      const total = list.reduce((s, r) => s + r.expenditure_amount, 0)
      const primary = list.filter((r) => isPrimary(r.election_type)).reduce((s, r) => s + r.expenditure_amount, 0)
      return { race, primary: round(primary), race_total: round(total), share_pct: round(pct(primary, total)) }
    })
    .filter((d) => d.share_pct > maxPct)
    .sort((a, b) => b.share_pct - a.share_pct)
  return {
    id: 'primary_share',
    blocking: false,
    name: `Primary-labeled spending under ${maxPct}% in every race`,
    pass: details.length === 0,
    summary: `${details.length} race(s) over ${maxPct}%`,
    details,
  }
}

// 5. The all-races total is accounted for.
export interface TotalsBreakdown {
  allRaces: number
  aligned: number
  /** Spending on candidates outside a race's two-candidate pair. Spending with no candidate ID is outside the data set. */
  unattributed: number
  /** Races left out of the aligned totals because a nominee has incomplete data. */
  excluded: number
}

export function checkTotalsIdentity(t: TotalsBreakdown, tolerancePct = 0.5): CheckResult {
  const sum = t.aligned + t.unattributed + t.excluded
  const gap = t.allRaces - sum
  const gapPct = pct(Math.abs(gap), t.allRaces)
  return {
    id: 'totals_identity',
    blocking: false,
    name: `All-races total equals aligned plus unattributed plus excluded within ${tolerancePct}%`,
    pass: gapPct <= tolerancePct,
    summary: `gap ${round(gap)} (${round(gapPct)}%)`,
    details: [{ all_races: round(t.allRaces), aligned: round(t.aligned), unattributed: round(t.unattributed), excluded: round(t.excluded), gap: round(gap), gap_pct: round(gapPct) }],
  }
}

export function sharesReady(runs: RunRecord[]): boolean {
  return runs.length >= SHARES_READY_RUNS && runs.slice(-SHARES_READY_RUNS).every((r) => r.passed)
}

export function appendRun(file: VerificationFile | null, run: RunRecord): VerificationFile {
  const runs = [...(file?.runs ?? []), run]
  return { shares_ready: sharesReady(runs), shares_ready_rule: SHARES_READY_RULE, runs }
}
