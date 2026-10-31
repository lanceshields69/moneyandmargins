import { describe, expect, it } from 'vitest'
import rowsJson from '../__fixtures__/ie-rows.json'
import reportsJson from '../__fixtures__/ie-reports.json'
import { dedupeIeRows, periodicCutoffs, sumBySide, type IeRow, type ReportCoverage } from './dedup-ie'

const fixture = rowsJson as unknown as (IeRow & { fixture_group: string })[]
const reports = reportsJson as unknown as ReportCoverage[]

let n = 0
function row(over: Partial<IeRow> = {}): IeRow {
  n += 1
  return {
    sub_id: String(n),
    committee_id: 'C1',
    committee_name: 'ONE PAC',
    candidate_id: 'S1',
    support_oppose_indicator: 'S',
    expenditure_amount: 100,
    expenditure_date: '2026-10-01',
    dissemination_date: '2026-10-01',
    is_notice: true,
    most_recent: true,
    amendment_indicator: 'N',
    transaction_id: `SE24.${n}`,
    file_number: 1000 + n,
    previous_file_number: null,
    memo_code: null,
    report_type: null,
    report_year: null,
    election_type: 'G2026',
    payee_name: 'PAYEE',
    filing_form: 'F24',
    ...over,
  }
}
const periodic = (over: Partial<IeRow> = {}) => row({ is_notice: false, filing_form: 'F3X', report_type: 'Q3', report_year: 2026, ...over })
const cutoffs = (m: Record<string, string | null | undefined>) => new Map(Object.entries(m))

describe('amendments and terminations', () => {
  it('an amended row replaces the original, whether or not FEC flagged the original', () => {
    const original = row({ transaction_id: 'SE.9', file_number: 10, expenditure_amount: 500, most_recent: null })
    const amended = row({ transaction_id: 'SE.9', file_number: 11, previous_file_number: 10, amendment_indicator: 'A', expenditure_amount: 450 })
    const out = dedupeIeRows([original, amended], cutoffs({ C1: null }))
    expect(out.kept.map((r) => r.expenditure_amount)).toEqual([450])
    expect(out.dropped.superseded_by_amendment).toBe(1)
  })

  it('a chain of amendments keeps only the last version', () => {
    const v1 = row({ transaction_id: 'SE.9', file_number: 10, expenditure_amount: 500, most_recent: null })
    const v2 = row({ transaction_id: 'SE.9', file_number: 11, previous_file_number: 10, amendment_indicator: 'A', expenditure_amount: 450, most_recent: null })
    const v3 = row({ transaction_id: 'SE.9', file_number: 12, previous_file_number: 11, amendment_indicator: 'A', expenditure_amount: 400 })
    expect(dedupeIeRows([v1, v2, v3], cutoffs({ C1: null })).kept.map((r) => r.expenditure_amount)).toEqual([400])
  })

  it('FEC most_recent=false alone is enough to drop a superseded row', () => {
    const out = dedupeIeRows([row({ most_recent: false }), row({ most_recent: true })], cutoffs({ C1: null }))
    expect(out.kept).toHaveLength(1)
  })

  it('a line that an amended filing deleted is removed, because FEC marks the old version superseded', () => {
    const deleted = row({ transaction_id: 'SE.5', file_number: 20, expenditure_amount: 700, most_recent: false })
    const kept = row({ transaction_id: 'SE.6', file_number: 21, expenditure_amount: 50 })
    const out = dedupeIeRows([deleted, kept], cutoffs({ C1: null }))
    expect(out.kept.map((r) => r.expenditure_amount)).toEqual([50])
  })

  it('rows on a committee termination report (indicator T) are real expenditures and stay', () => {
    const final = periodic({ amendment_indicator: 'T', expenditure_amount: 900 })
    expect(dedupeIeRows([final], cutoffs({ C1: '2026-03-31' })).kept).toHaveLength(1)
  })

  it('memo subtotals do not count', () => {
    expect(dedupeIeRows([row({ memo_code: 'X' })], cutoffs({ C1: null })).kept).toEqual([])
  })
})

describe('periodic and notice split', () => {
  it('counts a notice only after the periodic coverage end, and never counts a row twice', () => {
    const rows = [
      periodic({ expenditure_amount: 10, dissemination_date: '2026-09-15', expenditure_date: '2026-09-15' }),
      row({ expenditure_amount: 10, dissemination_date: '2026-09-15', expenditure_date: '2026-09-15' }),
      row({ expenditure_amount: 20, dissemination_date: '2026-09-30', expenditure_date: '2026-09-30' }),
      row({ expenditure_amount: 30, dissemination_date: '2026-10-01', expenditure_date: '2026-10-01' }),
    ]
    const out = dedupeIeRows(rows, cutoffs({ C1: '2026-09-30' }))
    expect(out.kept.map((r) => r.expenditure_amount).sort()).toEqual([10, 30])
    expect(out.dropped.covered_by_periodic).toBe(2)
  })

  it('keeps every notice when no periodic report is processed yet', () => {
    const out = dedupeIeRows([row(), row()], cutoffs({ C1: null }))
    expect(out.kept).toHaveLength(2)
  })

  it('a periodic report that is filed but not itemized does not hide notices', () => {
    const rows = [row({ dissemination_date: '2026-10-05', expenditure_date: '2026-10-05' })]
    const filed: ReportCoverage[] = [{ committee_id: 'C1', report_type: 'Q3', report_year: 2026, coverage_end_date: '2026-09-30' }]
    expect(periodicCutoffs(rows, filed).get('C1')).toBeNull()
  })

  it('takes the latest processed report type as the cutoff', () => {
    const rows = [periodic({ report_type: 'Q2' }), periodic({ report_type: 'Q3' })]
    const filed: ReportCoverage[] = [
      { committee_id: 'C1', report_type: 'Q2', report_year: 2026, coverage_end_date: '2026-06-30' },
      { committee_id: 'C1', report_type: 'Q3', report_year: 2026, coverage_end_date: '2026-09-30' },
    ]
    expect(periodicCutoffs(rows, filed).get('C1')).toBe('2026-09-30')
  })

  it('without a coverage date, falls back to a one-for-one key match and flags the committee approximate', () => {
    const rows = [
      periodic({ expenditure_amount: 55, expenditure_date: '2026-09-10' }),
      row({ expenditure_amount: 55, expenditure_date: '2026-09-10' }),
      row({ expenditure_amount: 55, expenditure_date: '2026-09-10' }),
    ]
    const out = dedupeIeRows(rows, cutoffs({ C1: undefined }))
    expect(out.kept.map((r) => r.expenditure_amount)).toEqual([55, 55])
    expect(out.dropped.approximate_match).toBe(1)
    expect(out.approximateCommittees).toEqual(['C1'])
  })
})

describe('saved Texas and Ohio pull', () => {
  const result = dedupeIeRows(fixture, periodicCutoffs(fixture, reports))
  const totalsFor = (group: string, rows: IeRow[]) => sumBySide(rows.filter((r) => (r as IeRow & { fixture_group: string }).fixture_group === group))
  const ids: Record<string, string> = {
    PAXTON: 'TX-2026--KEN-PAXTON',
    TALARICO: 'TX-2026--JAMES-TALARICO',
    HUSTED: 'OH-2026--JON-HUSTED',
    BROWN: 'OH-2026--SHERROD-BROWN',
  }

  it('no notice is counted next to the periodic row it duplicates', () => {
    const periodicKeys = new Set(result.kept.filter((r) => !r.is_notice).map((r) => `${r.committee_id}|${r.transaction_id}|${r.expenditure_amount}`))
    const overlap = result.kept.filter((r) => r.is_notice && periodicKeys.has(`${r.committee_id}|${r.transaction_id}|${r.expenditure_amount}`) && !result.approximateCommittees.includes(r.committee_id))
    expect(overlap).toEqual([])
  })

  // FEC's by-candidate aggregate (periodic reports only) as published on 2026-10-31, before notices were included.
  const aggregate: Record<string, { support: number; oppose: number }> = {
    PAXTON: { support: 1427092, oppose: 26931096 },
    TALARICO: { support: 4397036, oppose: 1281079 },
    HUSTED: { support: 5108041, oppose: 1149433 },
    BROWN: { support: 288280, oppose: 4179198 },
  }

  it('periodic rows reconcile to the totals FEC had already published for these candidates', () => {
    for (const group of Object.keys(ids)) {
      const kept = totalsFor(group, result.kept.filter((r) => !r.is_notice))
      expect(Math.round(kept.support)).toBe(aggregate[group].support)
      expect(Math.round(kept.oppose)).toBe(aggregate[group].oppose)
    }
  })

  it('every kept row and every dropped row adds back to the raw pull', () => {
    const droppedTotal = Object.values(result.dropped).reduce((a, b) => a + b, 0)
    expect(result.kept.length + droppedTotal).toBe(fixture.length)
  })

  it('counts the Texas PAC notices that the aggregate left out', () => {
    const texasPac = result.kept.filter((r) => r.committee_id === 'C00960211')
    expect(texasPac.length).toBeGreaterThan(0)
    expect(texasPac.every((r) => r.is_notice)).toBe(true)
  })

  it('applies the same rule to every party: swapping two candidates swaps their totals, and so does flipping support and oppose', () => {
    const a = 'S6TX00388'
    const b = 'S6TX00479'
    const swapped = fixture.map((r) => (r.candidate_id === a ? { ...r, candidate_id: b } : r.candidate_id === b ? { ...r, candidate_id: a } : r))
    const flipped = fixture.map((r) => ({ ...r, support_oppose_indicator: r.support_oppose_indicator === 'S' ? ('O' as const) : ('S' as const) }))
    const base = dedupeIeRows(fixture, periodicCutoffs(fixture, reports))
    const s = dedupeIeRows(swapped, periodicCutoffs(swapped, reports))
    const f = dedupeIeRows(flipped, periodicCutoffs(flipped, reports))
    const byCandidate = (rows: IeRow[], id: string) => sumBySide(rows.filter((r) => r.candidate_id === id))
    expect(byCandidate(s.kept, b)).toEqual(byCandidate(base.kept, a))
    expect(byCandidate(s.kept, a)).toEqual(byCandidate(base.kept, b))
    expect(s.kept.length).toBe(base.kept.length)
    expect(sumBySide(f.kept)).toEqual({ support: sumBySide(base.kept).oppose, oppose: sumBySide(base.kept).support })
    expect(f.dropped).toEqual(base.dropped)
  })
})
