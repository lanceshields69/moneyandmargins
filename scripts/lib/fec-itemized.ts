import type { FecClient } from './fec-client'
import type { IeRow, ReportCoverage } from './dedup-ie'

export const CYCLE = 2026
const CANDIDATE_BATCH = 10
const COMMITTEE_BATCH = 30

/** A /v1/schedules/schedule_e/ row as FEC returns it. Only the fields we read are typed. */
export interface RawScheduleERow {
  sub_id: string | number
  committee_id: string
  committee?: { name?: string | null } | null
  candidate_id: string
  support_oppose_indicator: 'S' | 'O'
  expenditure_amount: number | null
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
  [key: string]: unknown
}

interface KeysetPage {
  results: RawScheduleERow[]
  pagination: { count: number; last_indexes?: { last_index: string; last_expenditure_date?: string } | null }
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Every itemized Schedule E row for the candidates, cycle 2026, notices included, all pages. */
export async function fetchItemizedRows(client: FecClient, candidateIds: string[]): Promise<RawScheduleERow[]> {
  const bySubId = new Map<string, RawScheduleERow>()
  for (const batch of chunk([...new Set(candidateIds)].sort(), CANDIDATE_BATCH)) {
    const wanted = new Set(batch)
    let expected = -1
    let got = 0
    let cursor: [string, string][] = []
    for (;;) {
      const page: KeysetPage = await client.get('/schedules/schedule_e/', [
        ...batch.map((id): [string, string] => ['candidate_id', id]),
        ['cycle', String(CYCLE)],
        ['per_page', '100'],
        ['sort', '-expenditure_date'],
        ...cursor,
      ])
      if (expected === -1) expected = page.pagination.count
      for (const row of page.results) {
        if (!wanted.has(row.candidate_id)) throw new Error(`Itemized row for unrequested candidate ${row.candidate_id}`)
        bySubId.set(String(row.sub_id), row)
        got += 1
      }
      const next = page.pagination.last_indexes
      if (page.results.length === 0 || !next || got >= expected) break
      cursor = [['last_index', next.last_index]]
      if (next.last_expenditure_date) cursor.push(['last_expenditure_date', next.last_expenditure_date])
    }
    const unique = [...bySubId.values()].filter((r) => wanted.has(r.candidate_id)).length
    if (unique !== expected) throw new Error(`Pagination integrity check failed: FEC reported ${expected} rows for a batch, got ${unique} unique.`)
  }
  return [...bySubId.values()]
}

interface RawReport {
  committee_id: string
  report_type: string | null
  report_year: number | null
  coverage_end_date: string | null
  most_recent: boolean | null
}

const toCoverage = (r: RawReport): ReportCoverage | null =>
  r.report_type && r.report_year && r.coverage_end_date && r.most_recent !== false
    ? { committee_id: r.committee_id, report_type: r.report_type, report_year: r.report_year, coverage_end_date: r.coverage_end_date.slice(0, 10) }
    : null

/** Periodic report coverage for each committee: batched, then one by one for any the batch missed. */
export async function fetchReports(client: FecClient, committeeIds: string[]): Promise<ReportCoverage[]> {
  const out: ReportCoverage[] = []
  const found = new Set<string>()
  const add = (r: RawReport) => {
    const c = toCoverage(r)
    if (c) {
      out.push(c)
      found.add(c.committee_id)
    }
  }
  for (const batch of chunk([...new Set(committeeIds)].sort(), COMMITTEE_BATCH)) {
    for (let page = 1; ; page += 1) {
      const body: { results: RawReport[]; pagination: { pages: number } } = await client.get('/reports/pac-party/', [
        ...batch.map((id): [string, string] => ['committee_id', id]),
        ['cycle', String(CYCLE)],
        ['per_page', '100'],
        ['page', String(page)],
        ['sort', '-coverage_end_date'],
      ])
      body.results.forEach(add)
      if (page >= body.pagination.pages) break
    }
  }
  for (const id of [...new Set(committeeIds)].sort().filter((c) => !found.has(c))) {
    const body: { results: RawReport[] } = await client.get(`/committee/${id}/reports/`, [
      ['cycle', String(CYCLE)],
      ['per_page', '100'],
      ['sort', '-coverage_end_date'],
    ])
    body.results.forEach(add)
  }
  return out
}

export function toIeRow(raw: RawScheduleERow): IeRow {
  return {
    sub_id: String(raw.sub_id),
    committee_id: raw.committee_id,
    committee_name: raw.committee?.name ?? null,
    candidate_id: raw.candidate_id,
    support_oppose_indicator: raw.support_oppose_indicator,
    expenditure_amount: raw.expenditure_amount ?? 0,
    expenditure_date: raw.expenditure_date,
    dissemination_date: raw.dissemination_date,
    is_notice: raw.is_notice,
    most_recent: raw.most_recent,
    amendment_indicator: raw.amendment_indicator,
    transaction_id: raw.transaction_id,
    file_number: raw.file_number,
    previous_file_number: raw.previous_file_number,
    memo_code: raw.memo_code,
    report_type: raw.report_type,
    report_year: raw.report_year == null ? null : Number(raw.report_year),
    election_type: raw.election_type,
    payee_name: raw.payee_name,
    filing_form: raw.filing_form,
  }
}

/**
 * The request already filters to cycle=2026 on FEC's side. This is the second check: a row's report year must be
 * 2025 or 2026 (the two-year 2026 cycle). Rows with no report year fall back to their expenditure or dissemination date.
 */
export function assertInCycle(rows: IeRow[]): void {
  const outside = rows.filter((r) => {
    const y = Number(r.report_year ?? ((r.expenditure_date ?? r.dissemination_date ?? '').slice(0, 4)))
    return !(y === 2025 || y === 2026)
  })
  if (outside.length > 0) {
    const sample = outside.slice(0, 3).map((r) => `${r.committee_id} report_year=${r.report_year} spent=${r.expenditure_date} disseminated=${r.dissemination_date} election=${r.election_type}`)
    throw new Error(`${outside.length} itemized rows outside the 2026 cycle (2025-2026): ${sample.join('; ')}`)
  }
}
