import { describe, expect, it } from 'vitest'
import { methodologyFigures, type MethodologyFigureInputs } from './methodology-figures'
import type { IeRow } from './dedup-ie'
import type { AuditRow, RaceRow } from './verify-checks'

let n = 0
function row(over: Partial<RaceRow> = {}): RaceRow {
  n += 1
  return {
    sub_id: String(n),
    committee_id: 'C1',
    committee_name: 'PAC',
    candidate_id: 'S1',
    support_oppose_indicator: 'S',
    expenditure_amount: 100,
    expenditure_date: '2026-10-01',
    dissemination_date: '2026-10-01',
    is_notice: false,
    most_recent: true,
    amendment_indicator: null,
    transaction_id: null,
    file_number: null,
    previous_file_number: null,
    memo_code: null,
    report_type: null,
    report_year: null,
    election_type: 'G2026',
    payee_name: null,
    filing_form: null,
    race: 'AL',
    ...over,
  }
}

const base: MethodologyFigureInputs = {
  fetchedAt: '2026-10-31T20:40:30.953Z',
  approximateCommittees: ['C2', 'C3'],
  approximateTotal: 1000,
  // Two candidates on the same committee, date and amount in AL: 100 counted twice.
  raceRows: [
    row({ committee_id: 'C9', candidate_id: 'S1', expenditure_amount: 100, expenditure_date: '2026-10-05' }),
    row({ committee_id: 'C9', candidate_id: 'S2', expenditure_amount: 100, expenditure_date: '2026-10-05' }),
    row({ committee_id: 'C8', candidate_id: 'S1', expenditure_amount: 300 }),
  ],
  unattributedTotal: 2500,
  incompleteRaces: ['MI', 'CO'],
  // A shortfall window: a notice with no matching periodic row, out of 10,000 all-races spending.
  auditRows: [{ ...row({ committee_id: 'C5', candidate_id: 'S1', is_notice: true, expenditure_amount: 1000 }), race: 'AL', party: 'R' } as AuditRow],
  periodicRows: [],
  memoPeriodicRows: [],
  allRacesTotal: 10_000,
}

describe('methodologyFigures', () => {
  it('counts approximate committees and totals their notices', () => {
    const f = methodologyFigures(base)
    expect(f.approxCommitteeCount).toBe(2)
    expect(f.approxTotal).toBe(1000)
  })

  it('counts the double-counted dollars and their share of race spending', () => {
    const f = methodologyFigures(base)
    // 100 double-counted of 500 total race spending.
    expect(f.doubleCountTotal).toBe(100)
    expect(f.doubleCountPct).toBe(20)
  })

  it('reports zero double counting when no candidates share a line', () => {
    const f = methodologyFigures({ ...base, raceRows: [row({ candidate_id: 'S1' })] })
    expect(f.doubleCountTotal).toBe(0)
    expect(f.doubleCountPct).toBe(0)
  })

  it('passes the unattributed total and sorts the incomplete races', () => {
    const f = methodologyFigures(base)
    expect(f.unattributedTotal).toBe(2500)
    expect(f.incompleteRaces).toEqual(['CO', 'MI'])
    expect(f.fetchedAt).toBe(base.fetchedAt)
  })

  it('fails with the figure name when one cannot be computed', () => {
    expect(() => methodologyFigures({ ...base, unattributedTotal: Number.NaN })).toThrow('"unattributedTotal" could not be computed')
  })

  it('fails when there is no fetch to tie the figures to', () => {
    expect(() => methodologyFigures({ ...base, fetchedAt: '' })).toThrow('no fetchedAt')
  })

  it('counts a dedup shortfall window and its share of all-races spending', () => {
    const f = methodologyFigures(base)
    expect(f.dedupShortfallCount).toBe(1)
    expect(f.dedupShortfallTotal).toBe(1000)
    expect(f.dedupShortfallPct).toBe(10)
  })

  it('reports no shortfall when every covered notice matches its periodic evidence', () => {
    const f = methodologyFigures({ ...base, auditRows: [] })
    expect(f.dedupShortfallCount).toBe(0)
    expect(f.dedupShortfallTotal).toBe(0)
    expect(f.dedupShortfallPct).toBe(0)
  })
})

export type { IeRow }
