// The verification checks. Pure functions over plain data, party-blind: nothing here reads a party except through
// the pair a caller passes in, so every check treats every race and party the same way.
export { parseCsv } from '../../src/csv'
import { parseCsv } from '../../src/csv'
import type { IeRow } from './dedup-ie'

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
  /** The date FEC received the filing. Can lag dissemination_date, so a row disseminated before fetchedAt
   * may still not be receipted — and so not fetchable — until after it. */
  filing_date: string | null
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
    filing_date: r.filing_date ? r.filing_date.slice(0, 10) : null,
  }))
}

/** A row's identity for matching the reference export to the raw pull: a transaction and the filing that carries it. */
const rowKey = (r: { transaction_id: string | null; file_number: number | null }): string => `${r.transaction_id ?? ''}|${r.file_number ?? ''}`

/**
 * Did the fetch see everything the reference export saw? Checked against the raw pull, before any dedup,
 * so a row this fails on was never fetched at all — not dropped by a dedup decision, which dedup_audit
 * checks separately. A row whose filing date or dissemination date is on or after fetchedAt's date could
 * not have been receipted by FEC in time to be fetched; it is reported, not failed. Only a row dated
 * strictly before that date must already be in the raw pull.
 */
export function checkFetchCompleteness(exportRows: ExportRow[], rawRows: IeRow[], targets: ReconcileTarget[], fetchedAt: string): CheckResult {
  const cycle = exportRows.filter((r) => (r.election_type ?? '').endsWith('2026'))
  const fetchedDate = fetchedAt.slice(0, 10)

  const missing: Record<string, unknown>[] = []
  const future: Record<string, unknown>[] = []

  for (const t of targets) {
    for (const line of t.lines) {
      const onLine = (r: { committee_id: string; candidate_id: string; support_oppose_indicator: string }) =>
        r.committee_id === t.committee_id && r.candidate_id === line.candidate_id && r.support_oppose_indicator === line.side
      const rawKeys = new Set(rawRows.filter(onLine).map(rowKey))
      for (const r of cycle.filter(onLine)) {
        const key = `${r.transaction_id ?? ''}|${r.file_number ?? ''}`
        const date = r.dissemination_date ?? r.expenditure_date
        const entry = { committee: t.label, line: line.label, key, expenditure_amount: round(r.expenditure_amount), expenditure_date: date, filing_date: r.filing_date }
        const notYetReceipted = (r.filing_date !== null && r.filing_date >= fetchedDate) || (date !== null && date >= fetchedDate)
        if (notYetReceipted) future.push(entry)
        else if (!rawKeys.has(key)) missing.push(entry)
      }
    }
  }

  const futureTotal = round(future.reduce((s, d) => s + (d.expenditure_amount as number), 0))
  return {
    id: 'fetch_completeness',
    blocking: true,
    name: "Every reference row filed and disseminated before fetchedAt's date exists in the raw pull, before dedup",
    pass: missing.length === 0,
    summary: `${missing.length} missing; ${future.length} row(s) filed or disseminated on or after fetchedAt's date, totaling ${futureTotal} (informational)`,
    details: [...missing.map((d) => ({ ...d, kind: 'missing' })), ...future.map((d) => ({ ...d, kind: 'future' }))],
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

const day = (iso: string | null): string | null => (iso ? iso.slice(0, 10) : null)

/** A row's identity for checking that a dedup drop is justified: what it is, not how it was filed. */
const supersedeKey = (r: { committee_id: string; candidate_id: string; support_oppose_indicator: string; expenditure_amount: number; expenditure_date: string | null }): string =>
  [r.committee_id, r.candidate_id, r.support_oppose_indicator, r.expenditure_amount, day(r.expenditure_date)].join('|')

/** A covered-by-periodic row, with the race and party a caller attaches — this file stays party-blind: it
 * only groups by whatever label it's given, the same way for every party. */
export interface AuditRow extends IeRow {
  race: string
  party: string
}

/** A memo-subtotal periodic row restates a transaction by its own transaction_id, not a fresh line with its
 * own date, so it's matched to a notice by transaction_id and amount rather than the supersedeKey quadruple. */
const txnAmountKey = (r: { committee_id: string; candidate_id: string; support_oppose_indicator: string; transaction_id: string | null; expenditure_amount: number }): string =>
  [r.committee_id, r.candidate_id, r.support_oppose_indicator, r.transaction_id ?? '', r.expenditure_amount].join('|')

export interface ShortfallWindow {
  key: string
  sample: AuditRow
  noticeTotal: number
  periodicTotal: number
  shortfall: number
}

/**
 * Groups notices dropped as covered by a periodic report into windows of (committee, candidate, side) and
 * flags a window as a true shortfall only when its notice total exceeds its periodic evidence — non-memo
 * periodic rows plus memo-subtotal rows matched by transaction_id and amount — by more than 1% and $100.
 * That sum-level comparison tolerates a restatement filed under a different date or a split line, which a
 * per-row exact match does not, so it surfaces real gaps rather than formatting differences. Shared by
 * checkDedupAudit and the methodology figures, so both report the same windows.
 */
export function shortfallWindows(coveredRows: AuditRow[], periodicRows: IeRow[], memoPeriodicRows: IeRow[]): ShortfallWindow[] {
  const evidenceKeys = new Set(periodicRows.map(supersedeKey))
  const memoKeys = new Set(memoPeriodicRows.map(txnAmountKey))
  const isMatched = (r: AuditRow) => evidenceKeys.has(supersedeKey(r)) || memoKeys.has(txnAmountKey(r))

  const tripleKey = (r: AuditRow) => `${r.committee_id}|${r.candidate_id}|${r.support_oppose_indicator}`
  const noticeSums = new Map<string, number>()
  const sampleOf = new Map<string, AuditRow>()
  for (const r of coveredRows) {
    const k = tripleKey(r)
    noticeSums.set(k, (noticeSums.get(k) ?? 0) + r.expenditure_amount)
    if (!sampleOf.has(k)) sampleOf.set(k, r)
  }
  const periodicSums = new Map<string, number>()
  for (const r of [...periodicRows, ...memoPeriodicRows]) periodicSums.set(tripleKey(r as AuditRow), (periodicSums.get(tripleKey(r as AuditRow)) ?? 0) + r.expenditure_amount)

  // A window is a shortfall only if it also has at least one unmatched notice: a window that agrees on sum
  // has nothing to show as a gap even if it happens to clear the 1%/$100 threshold on rounding.
  const hasUnmatched = new Set(coveredRows.filter((r) => !isMatched(r)).map(tripleKey))

  const out: ShortfallWindow[] = []
  for (const [key, noticeTotal] of noticeSums) {
    if (!hasUnmatched.has(key)) continue
    const periodicTotal = periodicSums.get(key) ?? 0
    const diff = noticeTotal - periodicTotal
    const agrees = Math.abs(diff) <= 100 || (periodicTotal > 0 && (100 * Math.abs(diff)) / periodicTotal <= 1)
    if (diff > 0 && !agrees) out.push({ key, sample: sampleOf.get(key) as AuditRow, noticeTotal, periodicTotal, shortfall: diff })
  }
  return out
}

/**
 * Advisory: reports the shortfall windows by committee, by race (as a percent of the race's total), and by
 * party + side, without failing the run. Nothing here changes what dedupeIeRows keeps; a person judges
 * what this surfaces.
 */
export function checkDedupAudit(coveredRows: AuditRow[], periodicRows: IeRow[], memoPeriodicRows: IeRow[], raceTotals: Record<string, number>, allRacesTotal: number): CheckResult {
  const shortfalls = shortfallWindows(coveredRows, periodicRows, memoPeriodicRows)

  const sumBy = <K>(keyOf: (s: (typeof shortfalls)[number]) => K) => {
    const out = new Map<K, number>()
    for (const s of shortfalls) out.set(keyOf(s), (out.get(keyOf(s)) ?? 0) + s.shortfall)
    return out
  }

  const topCommittees = [...sumBy((s) => s.sample.committee_id)]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([committee_id, amount]) => ({ kind: 'committee', committee_id, amount: round(amount) }))

  const byRace = [...sumBy((s) => s.sample.race)]
    .map(([race, amount]) => ({ kind: 'race', race, amount: round(amount), race_total: round(raceTotals[race] ?? 0), pct: round(pct(amount, raceTotals[race] ?? 0)) }))
    .sort((a, b) => b.pct - a.pct)

  const bySide = [...sumBy((s) => `${s.sample.party} nominee, ${s.sample.support_oppose_indicator === 'S' ? 'support' : 'oppose'}`)]
    .map(([label, amount]) => ({ kind: 'side', label, amount: round(amount) }))
    .sort((a, b) => b.amount - a.amount)

  const total = round(shortfalls.reduce((s, w) => s + w.shortfall, 0))
  const totalPct = round(pct(total, allRacesTotal))
  return {
    id: 'dedup_audit',
    blocking: false,
    name: 'Advisory: a window (committee, candidate, side) where notices dropped as covered exceed the periodic evidence for it',
    pass: shortfalls.length === 0,
    summary: `${shortfalls.length} shortfall window(s), totaling ${total} (${totalPct}% of all-races spending; advisory, does not block)`,
    details: [
      ...shortfalls.map((s) => ({ kind: 'window', key: s.key, notice_total: round(s.noticeTotal), periodic_total: round(s.periodicTotal), shortfall: round(s.shortfall) })),
      ...topCommittees,
      ...byRace,
      ...bySide,
    ],
  }
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
