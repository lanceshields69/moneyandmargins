import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import rowsJson from '../__fixtures__/ie-rows.json'
import reportsJson from '../__fixtures__/ie-reports.json'
import { dedupeIeRows, periodicCutoffs, type IeRow, type ReportCoverage } from './dedup-ie'
import {
  appendRun,
  checkDoubleCount,
  checkExportReconciliation,
  checkPrimaryShare,
  checkRaceDrops,
  checkTotalsIdentity,
  exportDateOf,
  exportRowsFromCsv,
  parseCsv,
  sharesReady,
  type RaceRow,
  type ReconcileTarget,
  type RunRecord,
} from './verify-checks'

let n = 0
function row(over: Partial<RaceRow> = {}): RaceRow {
  n += 1
  return {
    sub_id: String(n),
    committee_id: `C${n}`,
    committee_name: 'PAC',
    candidate_id: 'S1',
    support_oppose_indicator: 'S',
    expenditure_amount: 1000,
    expenditure_date: '2026-10-01',
    dissemination_date: '2026-10-01',
    is_notice: true,
    most_recent: true,
    amendment_indicator: 'N',
    transaction_id: `SE.${n}`,
    file_number: n,
    previous_file_number: null,
    memo_code: null,
    report_type: null,
    report_year: null,
    election_type: 'G2026',
    payee_name: 'PAYEE',
    filing_form: 'F24',
    race: 'XX',
    ...over,
  }
}

describe('1. race totals do not drop', () => {
  it('flags a race that dropped more than 2% and more than $100K', () => {
    const out = checkRaceDrops({ TX: 10_000_000, OH: 5_000_000 }, { TX: 9_000_000, OH: 5_000_000 })
    expect(out.pass).toBe(false)
    expect(out.details).toEqual([{ race: 'TX', before: 10_000_000, now: 9_000_000, drop: 1_000_000, drop_pct: 10 }])
  })
  it('passes a drop that is over 2% but under $100K, or over $100K but under 2%', () => {
    expect(checkRaceDrops({ A: 1_000_000 }, { A: 950_000 }).pass).toBe(true)
    expect(checkRaceDrops({ B: 100_000_000 }, { B: 99_000_000 }).pass).toBe(true)
  })
  it('passes growth, a new race, and a first run with nothing to compare', () => {
    expect(checkRaceDrops({ A: 5 }, { A: 6, B: 10 }).pass).toBe(true)
    expect(checkRaceDrops(null, { A: 1 }).pass).toBe(true)
  })
  it('treats every race the same: swapping two races swaps the answer', () => {
    const a = checkRaceDrops({ ONE: 10e6, TWO: 10e6 }, { ONE: 8e6, TWO: 10e6 })
    const b = checkRaceDrops({ ONE: 10e6, TWO: 10e6 }, { ONE: 10e6, TWO: 8e6 })
    expect(a.details.map((d) => d.race)).toEqual(['ONE'])
    expect(b.details.map((d) => d.race)).toEqual(['TWO'])
  })
})

describe('2. reconciliation to the saved FEC exports', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), 'scripts/__fixtures__/exports', f), 'utf-8')
  const texas = exportRowsFromCsv(read('schedule_e-2026-10-31T14_33_41.csv'))
  const slf = exportRowsFromCsv(read('schedule_e-2026-10-31T14_36_56.csv'))
  const targets: ReconcileTarget[] = [
    { committee_id: 'C00960211', label: 'Texas PAC', lines: [{ candidate_id: 'S6TX00388', side: 'S', label: 'supporting Paxton' }, { candidate_id: 'S6TX00479', side: 'O', label: 'opposing Talarico' }] },
    { committee_id: 'C00571703', label: 'SLF PAC', lines: [{ candidate_id: 'S6OH00163', side: 'O', label: 'opposing Brown' }, { candidate_id: 'S6OH00304', side: 'S', label: 'supporting Husted' }] },
  ]
  const pulled = rowsJson as unknown as IeRow[]
  const ours = dedupeIeRows(pulled, periodicCutoffs(pulled, reportsJson as unknown as ReportCoverage[])).kept

  it('reads the exports: dates from the file names, and cycle rows only', () => {
    expect(exportDateOf('schedule_e-2026-10-31T14_33_41.csv')).toBe('2026-10-31')
    expect(texas).toHaveLength(56)
    expect(slf.every((r) => (r.election_type ?? '').endsWith('2026'))).toBe(true)
  })

  it('Texas PAC and SLF PAC match their exports for rows up to the export date', () => {
    const a = checkExportReconciliation(texas, ours, targets.slice(0, 1), '2026-10-31')
    const b = checkExportReconciliation(slf, ours, targets.slice(1), '2026-10-31')
    expect(a.details.map((d) => d.difference_pct)).toEqual([0, 0])
    expect(b.details.every((d) => Number(d.difference_pct) <= 1)).toBe(true)
    expect(a.pass && b.pass).toBe(true)
  })

  it('fails when our rows are missing a committee that the export has', () => {
    const without = ours.filter((r) => r.committee_id !== 'C00960211')
    const out = checkExportReconciliation(texas, without, targets.slice(0, 1), '2026-10-31')
    expect(out.pass).toBe(false)
    expect(out.details.every((d) => d.pass === false)).toBe(true)
  })

  it('ignores rows after the export date on both sides', () => {
    const later = ours.map((r) => (r.committee_id === 'C00960211' ? { ...r, dissemination_date: '2026-11-02', expenditure_date: '2026-11-02' } : r))
    const out = checkExportReconciliation(texas, later, targets.slice(0, 1), '2026-10-31')
    expect(out.details.map((d) => d.our_total)).toEqual([0, 0])
  })
})

describe('3. double count per race', () => {
  const contrast = (race: string, amount: number) => [
    row({ race, committee_id: 'CX', candidate_id: 'A', support_oppose_indicator: 'S', expenditure_amount: amount }),
    row({ race, committee_id: 'CX', candidate_id: 'B', support_oppose_indicator: 'O', expenditure_amount: amount }),
  ]
  it('counts a contrast ad on two candidates once too often and flags a race over 2%', () => {
    const rows = [...contrast('XX', 100), row({ race: 'XX', expenditure_amount: 1000 })]
    const out = checkDoubleCount(rows)
    expect(out.pass).toBe(false)
    expect(out.details).toEqual([{ race: 'XX', overcount: 100, race_total: 1200, share_pct: 8.33 }])
  })
  it('passes a race at or under 2%', () => {
    const rows = [...contrast('XX', 10), row({ race: 'XX', expenditure_amount: 100_000 })]
    expect(checkDoubleCount(rows).pass).toBe(true)
  })
  it('does not count the same amount from two committees, or on two dates, or in two races', () => {
    const rows = [
      row({ race: 'XX', committee_id: 'C1', candidate_id: 'A', expenditure_amount: 500 }),
      row({ race: 'XX', committee_id: 'C2', candidate_id: 'B', expenditure_amount: 500 }),
      row({ race: 'XX', committee_id: 'C3', candidate_id: 'A', expenditure_amount: 500, expenditure_date: '2026-10-02' }),
      row({ race: 'XX', committee_id: 'C3', candidate_id: 'B', expenditure_amount: 500, expenditure_date: '2026-10-03' }),
      row({ race: 'YY', committee_id: 'C4', candidate_id: 'A', expenditure_amount: 500 }),
      row({ race: 'ZZ', committee_id: 'C4', candidate_id: 'B', expenditure_amount: 500 }),
    ]
    expect(checkDoubleCount(rows, 0).details).toEqual([])
  })
  it('gives the same answer whichever candidate or side is which: swapping them changes nothing', () => {
    const a = contrast('XX', 100)
    const b = a.map((r) => ({ ...r, candidate_id: r.candidate_id === 'A' ? 'B' : 'A', support_oppose_indicator: r.support_oppose_indicator === 'S' ? ('O' as const) : ('S' as const) }))
    expect(checkDoubleCount([...a, row({ race: 'XX', expenditure_amount: 1000 })]).details).toEqual(checkDoubleCount([...b, row({ race: 'XX', expenditure_amount: 1000 })]).details)
  })
})

describe('4. primary-labeled share per race', () => {
  it('flags a race over 10% and reads the filer label, not the date', () => {
    const rows = [row({ race: 'XX', election_type: 'P2026', expenditure_amount: 200 }), row({ race: 'XX', election_type: 'G2026', expenditure_amount: 800 })]
    const out = checkPrimaryShare(rows)
    expect(out.pass).toBe(false)
    expect(out.details).toEqual([{ race: 'XX', primary: 200, race_total: 1000, share_pct: 20 }])
  })
  it('passes at 10% or under, and treats other labels as not primary', () => {
    const rows = [row({ race: 'XX', election_type: 'P2026', expenditure_amount: 100 }), row({ race: 'XX', election_type: 'R2026', expenditure_amount: 400 }), row({ race: 'XX', election_type: 'G2026', expenditure_amount: 500 })]
    expect(checkPrimaryShare(rows).pass).toBe(true) // exactly 10% is not over 10%; the runoff label is not a primary
  })
})

describe('5. the all-races total is accounted for', () => {
  it('passes when aligned + unattributed + excluded equals the total', () => {
    expect(checkTotalsIdentity({ allRaces: 100, aligned: 70, unattributed: 10, excluded: 20 }).pass).toBe(true)
  })
  it('allows 0.5% and fails beyond it', () => {
    expect(checkTotalsIdentity({ allRaces: 1000, aligned: 700, unattributed: 100, excluded: 195 }).pass).toBe(true)
    const out = checkTotalsIdentity({ allRaces: 1000, aligned: 700, unattributed: 100, excluded: 190 })
    expect(out.pass).toBe(false)
    expect(out.details[0]).toMatchObject({ gap: 10, gap_pct: 1 })
  })
})

describe('shares_ready and the run history', () => {
  const run = (passed: boolean): RunRecord => ({ ran_at: 'x', fetched_at: 'y', raw_sha256: 'z', passed, blocked: false, checks: [] })
  it('needs the last three consecutive runs to pass', () => {
    expect(sharesReady([run(true), run(true)])).toBe(false)
    expect(sharesReady([run(true), run(true), run(true)])).toBe(true)
    expect(sharesReady([run(false), run(true), run(true), run(true)])).toBe(true)
    expect(sharesReady([run(true), run(true), run(false), run(true)])).toBe(false)
  })
  it('appends to the history instead of replacing it, and never changes earlier runs', () => {
    const first = appendRun(null, run(true))
    const second = appendRun(first, run(false))
    expect(second.runs).toHaveLength(2)
    expect(second.runs[0]).toBe(first.runs[0])
    expect(second.shares_ready).toBe(false)
  })
})

describe('csv reader', () => {
  it('handles quotes, commas and blank trailing fields', () => {
    expect(parseCsv('a,b,c\n1,"x, ""y""",\n')).toEqual([{ a: '1', b: 'x, "y"', c: '' }])
  })
})
