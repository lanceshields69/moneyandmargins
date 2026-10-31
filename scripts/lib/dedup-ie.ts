// Dedup for FEC itemized Schedule E rows (/v1/schedules/schedule_e/). Pure and party-blind:
// nothing here reads a party, a candidate, or a side except to carry it through.

export interface IeRow {
  sub_id: string
  committee_id: string
  committee_name: string | null
  candidate_id: string
  support_oppose_indicator: 'S' | 'O'
  expenditure_amount: number
  expenditure_date: string | null
  dissemination_date: string | null
  is_notice: boolean
  most_recent: boolean | null
  amendment_indicator: string | null
  transaction_id: string | null
  file_number: number | null
  previous_file_number: number | null
  memo_code: string | null
  report_type: string | null
  report_year: number | null
  election_type: string | null
  payee_name: string | null
  filing_form: string | null
}

/** One FEC periodic report for a committee, from /v1/committee/{id}/reports/ or /v1/reports/pac-party/. */
export interface ReportCoverage {
  committee_id: string
  report_type: string
  report_year: number
  coverage_end_date: string
}

export type DropReason = 'memo_subtotal' | 'superseded_by_amendment' | 'covered_by_periodic' | 'approximate_match'

export interface DedupResult {
  kept: IeRow[]
  dropped: Record<DropReason, number>
  /** Committees with periodic rows but no usable coverage end date: key-match fallback, marked approximate. */
  approximateCommittees: string[]
  /** Dollars in the notice rows that went through the approximate key match, whether matched away or kept. */
  approximateTotal: number
  /** Latest processed periodic coverage end per committee. null: no periodic rows are processed yet. */
  cutoffs: Record<string, string | null>
}

const day = (iso: string | null): string | null => (iso ? iso.slice(0, 10) : null)

/** The date that places a notice against a periodic report's coverage window. */
export function noticeDate(row: IeRow): string | null {
  return day(row.dissemination_date) ?? day(row.expenditure_date)
}

function approximateKey(row: IeRow): string {
  return [
    row.committee_id,
    row.candidate_id,
    row.support_oppose_indicator,
    row.expenditure_amount,
    day(row.expenditure_date),
    (row.payee_name ?? '').trim().toUpperCase(),
  ].join('|')
}

/**
 * Each committee's latest periodic coverage end among the periodic report types that actually have
 * processed rows in this pull. A periodic report that is filed but not yet itemized in the API does not
 * move the cutoff, so its notices stay counted. undefined: some report type could not be matched to a
 * coverage date, so the committee falls back to the approximate key match.
 */
export function periodicCutoffs(rows: IeRow[], reports: ReportCoverage[]): Map<string, string | null | undefined> {
  const byCommittee = new Map<string, Set<string>>()
  for (const row of rows) {
    if (row.is_notice || row.report_type === null || row.report_year === null) continue
    const set = byCommittee.get(row.committee_id) ?? new Set<string>()
    set.add(`${row.report_type}|${row.report_year}`)
    byCommittee.set(row.committee_id, set)
  }
  const coverage = new Map<string, string>()
  for (const r of reports) {
    const key = `${r.committee_id}|${r.report_type}|${r.report_year}`
    const end = day(r.coverage_end_date)
    if (end && (!coverage.has(key) || end > (coverage.get(key) ?? ''))) coverage.set(key, end)
  }

  const out = new Map<string, string | null | undefined>()
  const committees = new Set(rows.map((r) => r.committee_id))
  for (const committee of committees) {
    const seen = byCommittee.get(committee)
    if (!seen) {
      out.set(committee, null)
      continue
    }
    let cutoff: string | undefined
    let missing = false
    for (const rt of seen) {
      const end = coverage.get(`${committee}|${rt}`)
      if (!end) missing = true
      else if (!cutoff || end > cutoff) cutoff = end
    }
    out.set(committee, missing ? undefined : cutoff)
  }
  return out
}

export function dedupeIeRows(rows: IeRow[], cutoffs: Map<string, string | null | undefined>): DedupResult {
  const dropped: Record<DropReason, number> = {
    memo_subtotal: 0,
    superseded_by_amendment: 0,
    covered_by_periodic: 0,
    approximate_match: 0,
  }

  // 1. Memo subtotals restate lines that are already itemized.
  let live = rows.filter((r) => {
    if (r.memo_code === 'X') {
      dropped.memo_subtotal += 1
      return false
    }
    return true
  })

  // 2. Keep the latest version of each transaction. An amendment names the filing it replaces
  // (previous_file_number); FEC's own most_recent flag covers the rest, including a line an amended
  // filing deleted. amendment_indicator T is FEC's code for a committee's termination report, not a
  // deleted line: those rows are real expenditures and stay (FEC's own totals count them).
  const replaced = new Set<string>()
  for (const r of live) {
    if (r.amendment_indicator === 'A' && r.previous_file_number !== null && r.transaction_id) {
      replaced.add(`${r.committee_id}|${r.transaction_id}|${r.previous_file_number}`)
    }
  }
  live = live.filter((r) => {
    const gone = r.most_recent === false || (r.file_number !== null && !!r.transaction_id && replaced.has(`${r.committee_id}|${r.transaction_id}|${r.file_number}`))
    if (gone) {
      dropped.superseded_by_amendment += 1
      return false
    }
    return true
  })

  // 3. Periodic rows stand up to the committee's latest processed periodic coverage end; notices count only after it.
  const periodicByCommittee = new Map<string, Map<string, number>>()
  for (const r of live) {
    if (r.is_notice) continue
    const counts = periodicByCommittee.get(r.committee_id) ?? new Map<string, number>()
    counts.set(approximateKey(r), (counts.get(approximateKey(r)) ?? 0) + 1)
    periodicByCommittee.set(r.committee_id, counts)
  }

  const approximate = new Set<string>()
  let approximateTotal = 0
  const kept: IeRow[] = []
  for (const r of live) {
    if (!r.is_notice) {
      kept.push(r)
      continue
    }
    const cutoff = cutoffs.get(r.committee_id)
    if (typeof cutoff === 'string') {
      const date = noticeDate(r)
      if (date !== null && date <= cutoff) {
        dropped.covered_by_periodic += 1
        continue
      }
      kept.push(r)
    } else if (cutoff === null) {
      kept.push(r)
    } else {
      // Coverage end unavailable: match against periodic rows one for one, so a genuine repeat is not lost.
      approximate.add(r.committee_id)
      approximateTotal += r.expenditure_amount
      const counts = periodicByCommittee.get(r.committee_id)
      const key = approximateKey(r)
      const left = counts?.get(key) ?? 0
      if (left > 0) {
        counts?.set(key, left - 1)
        dropped.approximate_match += 1
        continue
      }
      kept.push(r)
    }
  }

  const cutoffsOut: Record<string, string | null> = {}
  for (const [committee, cutoff] of cutoffs) if (cutoff !== undefined) cutoffsOut[committee] = cutoff
  return { kept, dropped, approximateCommittees: [...approximate].sort(), approximateTotal, cutoffs: cutoffsOut }
}

export interface SideTotals {
  support: number
  oppose: number
}

export function sumBySide(rows: IeRow[]): SideTotals {
  let support = 0
  let oppose = 0
  for (const r of rows) {
    if (r.support_oppose_indicator === 'S') support += r.expenditure_amount
    else oppose += r.expenditure_amount
  }
  return { support, oppose }
}
