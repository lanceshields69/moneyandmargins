import { describe, expect, it } from 'vitest'
import { fetchCommitteeReports, fetchReports } from './fec-itemized'
import type { FecClient } from './fec-client'

interface Rep { committee_id: string; report_type: string; report_year: number; coverage_end_date: string; most_recent: boolean; file_number: number }
const rep = (committee_id: string, report_type: string, end: string, file_number: number): Rep => ({ committee_id, report_type, report_year: 2026, coverage_end_date: `${end}T00:00:00`, most_recent: true, file_number })

// Two committees whose reports tie on the sort key (both end 2026-07-31 / 2026-06-30), as in the real batch.
const AB = [rep('CAB', 'Q2', '2026-06-30', 1), rep('CAB', 'M8', '2026-07-31', 2), rep('CAB', 'M9', '2026-08-31', 3)]
const OH = [rep('COH', 'Q2', '2026-06-30', 4), rep('COH', 'Q3', '2026-09-30', 5)]
const ALL = [...AB, ...OH]

/**
 * Replays what FEC's offset paging did over a sort other rows tie on: the batched endpoint repeats one row at
 * a page boundary and loses another (here AB PAC's M8 and a duplicate Q2), while its count still says 5.
 * The per-committee endpoint is correct unless `flaky` makes it do the same.
 */
function fakeClient(opts: { flaky?: string[] } = {}): FecClient & { calls: string[] } {
  const calls: string[] = []
  const flaky = [...(opts.flaky ?? [])]
  return {
    calls,
    requestCount: () => calls.length,
    async get<T>(path: string): Promise<T> {
      calls.push(path)
      const batched = path === '/reports/pac-party/'
      const id = /committee\/(\w+)\/reports/.exec(path)?.[1]
      let results: Rep[] = batched ? ALL.filter((r) => r.report_type !== 'M8').concat([ALL[0]]) : ALL.filter((r) => r.committee_id === id)
      if (!batched && flaky.length > 0 && flaky[0] === id) {
        flaky.shift()
        results = results.filter((r) => r.report_type !== 'M8').concat([results[0]])
      }
      return { results, pagination: { pages: 1, count: batched ? ALL.length : ALL.filter((r) => r.committee_id === id).length } } as T
    },
  }
}

describe('report coverage is complete before a committee can be classified', () => {
  it('has the coverage date for every report, M8 and Q2 included, despite a tied-sort batch that loses rows', async () => {
    const out = await fetchReports(fakeClient(), ['CAB', 'COH'])
    const has = (c: string, t: string) => out.find((r) => r.committee_id === c && r.report_type === t)?.coverage_end_date
    expect(has('CAB', 'M8')).toBe('2026-07-31')
    expect(has('CAB', 'Q2')).toBe('2026-06-30')
    expect(has('COH', 'Q2')).toBe('2026-06-30')
    expect(out).toHaveLength(5)
  })

  it('never calls the batched endpoint', async () => {
    const client = fakeClient()
    await fetchReports(client, ['CAB', 'COH'])
    expect(client.calls.every((p) => p.startsWith('/committee/'))).toBe(true)
  })

  it('refetches a committee whose list does not match FEC\'s count, and logs the discrepancy', async () => {
    const logs: string[] = []
    const out = await fetchCommitteeReports(fakeClient({ flaky: ['CAB'] }), 'CAB', (m) => logs.push(m))
    expect(out.map((r) => r.report_type).sort()).toEqual(['M8', 'M9', 'Q2'])
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('CAB')
  })

  it('fails the run instead of classifying from a list that stays incomplete', async () => {
    await expect(fetchCommitteeReports(fakeClient({ flaky: ['CAB', 'CAB', 'CAB'] }), 'CAB', () => {})).rejects.toThrow('refusing to classify')
  })
})
