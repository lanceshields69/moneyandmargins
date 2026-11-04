import { describe, expect, it } from 'vitest'
import {
  buildResultCallout,
  buildResultsByRace,
  validateResults,
  wholePercentsN,
  type ResultsRaceRow,
  type ResultsVoteRow,
} from './results'
import type { NomineesFile, Party } from './types'

const nominees: NomineesFile = {
  fetchedAt: '2026-10-01T00:00:00Z',
  source: 'test',
  races: [
    { id: 'XX-2026', state: 'XX', raceName: 'Test Senate 2026', isSpecial: false, incumbentName: null, incumbentParty: null, sourceUrl: 'https://x.test', sourceTier: 'official', retrievedAt: '2026-10-01' },
    { id: 'YY-2026', state: 'YY', raceName: 'Other Senate 2026', isSpecial: false, incumbentName: null, incumbentParty: null, sourceUrl: 'https://x.test', sourceTier: 'official', retrievedAt: '2026-10-01' },
  ],
  candidates: [
    { id: 'XX-2026--A-DEM', raceId: 'XX-2026', name: 'A Dem', party: 'D', fecIds: [] },
    { id: 'XX-2026--B-REP', raceId: 'XX-2026', name: 'B Rep', party: 'R', fecIds: [] },
    { id: 'XX-2026--C-IND', raceId: 'XX-2026', name: 'C Ind', party: 'I', fecIds: [] },
    { id: 'YY-2026--D-DEM', raceId: 'YY-2026', name: 'D Dem', party: 'D', fecIds: [] },
    { id: 'YY-2026--E-REP', raceId: 'YY-2026', name: 'E Rep', party: 'R', fecIds: [] },
  ],
}

const raceRow = (over: Partial<ResultsRaceRow> = {}): ResultsRaceRow => ({
  race_id: 'XX-2026',
  status: 'Win',
  percent_reporting: '98',
  note: '',
  source_url: 'https://x.test/results',
  as_of: '2026-11-03T21:00:00Z',
  winner: 'A Dem',
  ...over,
})
const voteRow = (over: Partial<ResultsVoteRow> = {}): ResultsVoteRow => ({
  race_id: 'XX-2026',
  candidate: 'A Dem',
  party: 'D',
  votes: '1000',
  ...over,
})

describe('wholePercentsN', () => {
  it('rounds any number of shares to whole percents that sum to 100', () => {
    const out = wholePercentsN([{ id: 'a', value: 0.334 }, { id: 'b', value: 0.333 }, { id: 'c', value: 0.333 }])
    expect([...out.values()].reduce((a, b) => a + b, 0)).toBe(100)
    expect(out.get('a')).toBe(34) // largest remainder: .4 beats the two .3s
  })
  it('breaks a tie by the lower id, which carries no party meaning', () => {
    const out = wholePercentsN([{ id: 'z', value: 0.5 }, { id: 'a', value: 0.5 }])
    expect(out.get('a')).toBe(50)
    expect(out.get('z')).toBe(50)
  })
  it('returns an empty map for no shares', () => {
    expect(wholePercentsN([])).toEqual(new Map())
  })
})

describe('validateResults', () => {
  it('passes on a clean pair of files', () => {
    const { errors } = validateResults([raceRow()], [voteRow(), voteRow({ candidate: 'B Rep', votes: '900' })], nominees)
    expect(errors).toEqual([])
  })

  it('flags an unknown race_id in either file', () => {
    expect(validateResults([raceRow({ race_id: 'ZZ-2026' })], [], nominees).errors[0]).toMatch(/unknown race_id/)
    expect(validateResults([], [voteRow({ race_id: 'ZZ-2026' })], nominees).errors[0]).toMatch(/unknown race_id/)
  })

  it('flags a candidate not in nominees.json for that race', () => {
    const { errors } = validateResults([raceRow()], [voteRow({ candidate: 'Nobody Here' })], nominees)
    expect(errors.some((e) => e.includes('candidate not in nominees.json'))).toBe(true)
  })

  it('flags a candidate that exists, but for a different race', () => {
    const { errors } = validateResults([raceRow(), raceRow({ race_id: 'YY-2026' })], [voteRow({ race_id: 'YY-2026', candidate: 'A Dem' })], nominees)
    expect(errors.some((e) => e.includes('candidate not in nominees.json'))).toBe(true)
  })

  it('flags an invalid status', () => {
    const { errors } = validateResults([raceRow({ status: 'Leading' })], [], nominees)
    expect(errors[0]).toMatch(/invalid status/)
    expect(validateResults([raceRow({ status: 'Counting' })], [], nominees).errors[0]).toMatch(/invalid status/)
  })

  it('needs a winner when Win, none when Reporting, and a winner who is a nominee in the race', () => {
    expect(validateResults([raceRow({ winner: '' })], [], nominees).errors[0]).toMatch(/needs a winner/)
    expect(validateResults([raceRow({ status: 'Reporting', winner: 'A Dem' })], [], nominees).errors[0]).toMatch(/must not name a winner/)
    expect(validateResults([raceRow({ status: 'Reporting', winner: '' })], [], nominees).errors).toEqual([])
    expect(validateResults([raceRow({ winner: 'D Dem' })], [], nominees).errors[0]).toMatch(/not in nominees.json for this race/)
  })

  it('flags percent_reporting outside 0 to 100, and a non-numeric value', () => {
    expect(validateResults([raceRow({ percent_reporting: '101' })], [], nominees).errors[0]).toMatch(/percent_reporting/)
    expect(validateResults([raceRow({ percent_reporting: '-1' })], [], nominees).errors[0]).toMatch(/percent_reporting/)
    expect(validateResults([raceRow({ percent_reporting: 'abc' })], [], nominees).errors[0]).toMatch(/percent_reporting/)
    expect(validateResults([raceRow({ percent_reporting: '0' })], [], nominees).errors).toEqual([])
    expect(validateResults([raceRow({ percent_reporting: '100' })], [], nominees).errors).toEqual([])
  })

  it('flags negative or non-integer votes', () => {
    expect(validateResults([raceRow()], [voteRow({ votes: '-5' })], nominees).errors[0]).toMatch(/votes must be/)
    expect(validateResults([raceRow()], [voteRow({ votes: '5.5' })], nominees).errors[0]).toMatch(/votes must be/)
    expect(validateResults([raceRow()], [voteRow({ votes: '0' })], nominees).errors).toEqual([])
  })

  it('flags a missing source_url or as_of', () => {
    expect(validateResults([raceRow({ source_url: '' })], [], nominees).errors[0]).toMatch(/missing source_url/)
    expect(validateResults([raceRow({ as_of: '' })], [], nominees).errors[0]).toMatch(/missing as_of/)
  })

  it('flags votes for a race with no race row', () => {
    const { errors } = validateResults([], [voteRow()], nominees)
    expect(errors.some((e) => e.includes('no race row'))).toBe(true)
  })

  it('applies every rule the same way to a Democratic and a Republican candidate', () => {
    const dem = validateResults([raceRow()], [voteRow({ candidate: 'A Dem', votes: '-1' })], nominees).errors
    const rep = validateResults([raceRow()], [voteRow({ candidate: 'B Rep', votes: '-1' })], nominees).errors
    expect(dem.map((e) => e.replace('A Dem', 'X').replace('B Rep', 'X'))).toEqual(rep.map((e) => e.replace('A Dem', 'X').replace('B Rep', 'X')))
  })
})

describe('buildResultCallout statuses', () => {
  const pair = ['XX-2026--A-DEM', 'XX-2026--B-REP']
  const parties = new Map<string, Party>([['XX-2026--A-DEM', 'D'], ['XX-2026--B-REP', 'R'], ['XX-2026--C-IND', 'I']])
  const votes = [voteRow({ votes: '600' }), voteRow({ candidate: 'B Rep', votes: '400' })]

  it('none: no race row at all', () => {
    const out = buildResultCallout(pair, undefined)
    expect(out).toEqual({ stage: 'none', percentReporting: null, shares: { 'XX-2026--A-DEM': null, 'XX-2026--B-REP': null }, winnerCandidateId: null, winnerParty: null, asOf: null, sourceUrl: null, note: null })
  })

  it('reporting: shares show, no winner is named', () => {
    const results = buildResultsByRace([raceRow({ status: 'Reporting', winner: '', percent_reporting: '41' })], votes, nominees)
    const out = buildResultCallout(pair, results.get('XX-2026'), parties, 'R')
    expect(out.stage).toBe('reporting')
    expect(out.percentReporting).toBe(41)
    expect(out.shares).toEqual({ 'XX-2026--A-DEM': 60, 'XX-2026--B-REP': 40 })
    expect(out.winnerCandidateId).toBeNull()
  })

  it('win: the winner is the candidate civicAPI flagged, win or flip by the seat holder', () => {
    const results = buildResultsByRace([raceRow()], votes, nominees)
    expect(buildResultCallout(pair, results.get('XX-2026'), parties, 'D').stage).toBe('win')
    const flipped = buildResultCallout(pair, results.get('XX-2026'), parties, 'R')
    expect(flipped.stage).toBe('flip')
    expect(flipped.winnerCandidateId).toBe('XX-2026--A-DEM')
    expect(flipped.winnerParty).toBe('D')
  })

  it('the winner is civicAPI\'s flag, not whoever has more votes', () => {
    const results = buildResultsByRace([raceRow({ winner: 'B Rep' })], votes, nominees)
    expect(buildResultCallout(pair, results.get('XX-2026'), parties, 'R').winnerCandidateId).toBe('XX-2026--B-REP')
  })
})

describe('shares total 100 in every race', () => {
  const total = (shares: { id: string; value: number }[]) => [...wholePercentsN(shares).values()].reduce((a, b) => a + b, 0)
  const fromVotes = (votes: number[]) => {
    const sum = votes.reduce((a, b) => a + b, 0)
    return votes.map((v, i) => ({ id: `c${i}`, value: v / sum }))
  }

  it('on exact ties and thirds', () => {
    expect(total(fromVotes([1, 1]))).toBe(100)
    expect(total(fromVotes([1, 1, 1]))).toBe(100)
    expect(total(fromVotes([1, 1, 1, 1, 1, 1, 1]))).toBe(100)
  })

  it('on rounding edges where every share ends in .5 or just under', () => {
    expect(total(fromVotes([1, 3]))).toBe(100) // 25 / 75
    expect(total(fromVotes([1, 199]))).toBe(100) // 0.5 / 99.5
    expect(total(fromVotes([333, 333, 334]))).toBe(100)
    expect(total(fromVotes([1005, 995]))).toBe(100)
  })

  it('on a zero-vote candidate and a one-candidate race', () => {
    expect(total(fromVotes([1000, 0]))).toBe(100)
    expect(total(fromVotes([42]))).toBe(100)
  })

  it('on 2,000 random races of two to six candidates', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
    for (let n = 0; n < 2000; n += 1) {
      const k = 2 + Math.floor(rand() * 5)
      const votes = Array.from({ length: k }, () => Math.floor(rand() * 5_000_000))
      if (votes.every((v) => v === 0)) continue
      expect(total(fromVotes(votes))).toBe(100)
    }
  })

  it('and the displayed pair shares come from the same rounding', () => {
    const results = buildResultsByRace([raceRow()], [voteRow({ votes: '1' }), voteRow({ candidate: 'B Rep', votes: '1' }), voteRow({ candidate: 'C Ind', party: 'I', votes: '1' })], nominees)
    const out = buildResultCallout(['XX-2026--A-DEM', 'XX-2026--B-REP'], results.get('XX-2026'), new Map([['XX-2026--A-DEM', 'D' as Party]]), 'D')
    expect(Object.values(out.shares)).toEqual([34, 33]) // 34 + 33 + 33 across all three candidates
  })
})
