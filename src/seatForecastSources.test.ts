import { describe, expect, it } from 'vitest'
import { parseBellwether, parseCallTheMap, parsePollingForecast, parseVotePredictor, type SenateBaseline } from './seatForecastSources'

const baseline: SenateBaseline = { notUpDemocraticCaucus: 34, notUpRepublican: 31 }

describe('parseVotePredictor', () => {
  it('reads expected_dem_seats and as_of, and the two sides sum to 100', () => {
    const raw = { control: { expected_dem_seats: 51.30275, p_dem_control: 0.619275, as_of: '2026-11-02' } }
    const result = parseVotePredictor(raw, 'https://votepredictor.com/senate', 'https://votepredictor.com')
    expect(result).toEqual({
      ok: true,
      entry: { key: 'votepredictor', sourceName: 'VotePredictor', sourceUrl: 'https://votepredictor.com/senate', homeUrl: 'https://votepredictor.com', asOf: '2026-11-02', dSeats: 51, rSeats: 49 },
    })
  })

  it('fails instead of throwing when control is missing', () => {
    expect(parseVotePredictor({}, 'https://x.test', 'https://x.test')).toEqual({ ok: false, reason: expect.stringContaining('VotePredictor') })
    expect(parseVotePredictor(null, 'https://x.test', 'https://x.test').ok).toBe(false)
  })
})

describe('parseCallTheMap', () => {
  it('reads expected_D_seats and shared_environment.input_as_of.approval', () => {
    const raw = { expected_D_seats: 51.16342, expected_R_seats: 48.43132, shared_environment: { input_as_of: { approval: '2026-11-02', generic_ballot: '2026-11-02' } } }
    const result = parseCallTheMap(raw, 'https://www.callthemap.com/senate', 'https://www.callthemap.com')
    expect(result).toEqual({
      ok: true,
      entry: { key: 'callthemap', sourceName: 'CallTheMap', sourceUrl: 'https://www.callthemap.com/senate', homeUrl: 'https://www.callthemap.com', asOf: '2026-11-02', dSeats: 51, rSeats: 49 },
    })
  })

  it('fails on a non-object response', () => {
    expect(parseCallTheMap('not json', 'https://x.test', 'https://x.test').ok).toBe(false)
  })
})

describe('parsePollingForecast', () => {
  it('sums chance_left by left_party, adds the baseline, and asOf comes from the payload', () => {
    const raw = {
      asOf: '2026-11-02',
      rows: [
        { left_party: 'D', chance_left: 0.712 },
        { left_party: 'D', chance_left: 0.002 },
        { left_party: 'R', chance_left: 0.1 }, // D's share of this race is 1 - 0.1 = 0.9
      ],
    }
    const result = parsePollingForecast(raw, 'https://www.pollingforecast.com/us/senate', 'https://www.pollingforecast.com', baseline)
    // 34 + 0.712 + 0.002 + 0.9 = 35.614 -> rounds to 36
    expect(result).toEqual({
      ok: true,
      entry: { key: 'pollingforecast', sourceName: 'PollingForecast', sourceUrl: 'https://www.pollingforecast.com/us/senate', homeUrl: 'https://www.pollingforecast.com', asOf: '2026-11-02', dSeats: 36, rSeats: 64 },
    })
  })

  it('ignores a row with a non-numeric chance_left instead of throwing', () => {
    const raw = { asOf: '2026-11-02', rows: [{ left_party: 'D', chance_left: 'n/a' }] }
    const result = parsePollingForecast(raw, 'https://x.test', 'https://x.test', baseline)
    expect(result).toEqual({ ok: true, entry: expect.objectContaining({ dSeats: 34, rSeats: 66 }) })
  })

  it('fails when rows is missing', () => {
    expect(parsePollingForecast({ asOf: '2026-11-02' }, 'https://x.test', 'https://x.test', baseline).ok).toBe(false)
  })
})

describe('parseBellwether', () => {
  it('filters to office "senate", sums p_party.D, adds the baseline, and falls back to the given as-of', () => {
    const raw = [
      { office: 'senate', state: 'FL', p_party: { D: 0.1166, R: 0.8834 } },
      { office: 'senate', state: 'OH', p_party: { D: 0.8175, R: 0.1825 } },
      { office: 'house', state: 'TX-1', p_party: { D: 0.01, R: 0.99 } }, // excluded: not a senate race
    ]
    const result = parseBellwether(raw, 'https://bellwether-zak.vercel.app', 'https://bellwether-zak.vercel.app', baseline, '2026-11-02T12:00:00Z')
    // 34 + 0.1166 + 0.8175 = 34.9341 -> rounds to 35
    expect(result).toEqual({
      ok: true,
      entry: { key: 'bellwether', sourceName: 'Bellwether', sourceUrl: 'https://bellwether-zak.vercel.app', homeUrl: 'https://bellwether-zak.vercel.app', asOf: '2026-11-02T12:00:00Z', dSeats: 35, rSeats: 65 },
    })
  })

  it('fails when the response is not an array, or has no senate races', () => {
    expect(parseBellwether({}, 'https://x.test', 'https://x.test', baseline, '2026-11-02').ok).toBe(false)
    expect(parseBellwether([{ office: 'house' }], 'https://x.test', 'https://x.test', baseline, '2026-11-02').ok).toBe(false)
  })
})

describe('every parser', () => {
  it('always returns two seat counts that sum to 100', () => {
    const results = [
      parseVotePredictor({ control: { expected_dem_seats: 0.4, as_of: '2026-11-02' } }, 'https://x.test', 'https://x.test'),
      parseCallTheMap({ expected_D_seats: 99.9, shared_environment: { input_as_of: { approval: '2026-11-02' } } }, 'https://x.test', 'https://x.test'),
      parsePollingForecast({ asOf: '2026-11-02', rows: [] }, 'https://x.test', 'https://x.test', baseline),
      parseBellwether([{ office: 'senate', p_party: { D: 0 } }], 'https://x.test', 'https://x.test', baseline, '2026-11-02'),
    ]
    for (const r of results) {
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.entry.dSeats + r.entry.rSeats).toBe(100)
    }
  })
})
