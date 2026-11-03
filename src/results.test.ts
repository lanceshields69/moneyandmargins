import { describe, expect, it } from 'vitest'
import {
  buildResultCallout,
  buildResultsByRace,
  validateResults,
  wholePercentsN,
  type ResultsRaceRow,
  type ResultsVoteRow,
} from './results'
import type { NomineesFile } from './types'

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
  status: 'Unofficial',
  percent_reporting: '98',
  note: '',
  source_url: 'https://x.test/results',
  as_of: '2026-11-03T21:00:00Z',
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

describe('buildResultCallout stages', () => {
  const pair = ['XX-2026--A-DEM', 'XX-2026--B-REP']

  it('not-added: no race row at all', () => {
    const out = buildResultCallout(pair, undefined)
    expect(out).toEqual({ stage: 'not-added', percentReporting: null, shares: { 'XX-2026--A-DEM': null, 'XX-2026--B-REP': null }, leadingCandidateId: null, asOf: null, sourceUrl: null, note: null })
  })

  it('counting: shares show, no leader', () => {
    const results = buildResultsByRace([raceRow({ status: 'Counting', percent_reporting: '41' })], [voteRow({ votes: '600' }), voteRow({ candidate: 'B Rep', votes: '400' })], nominees)
    const out = buildResultCallout(pair, results.get('XX-2026'))
    expect(out.stage).toBe('counting')
    expect(out.percentReporting).toBe(41)
    expect(out.shares).toEqual({ 'XX-2026--A-DEM': 60, 'XX-2026--B-REP': 40 })
    expect(out.leadingCandidateId).toBeNull()
  })

  it('unofficial: shares show, with a leader', () => {
    const results = buildResultsByRace([raceRow({ status: 'Unofficial' })], [voteRow({ votes: '600' }), voteRow({ candidate: 'B Rep', votes: '400' })], nominees)
    const out = buildResultCallout(pair, results.get('XX-2026'))
    expect(out.stage).toBe('unofficial')
    expect(out.leadingCandidateId).toBe('XX-2026--A-DEM')
  })

  it('certified: shares show, with a leader, same as unofficial but for the stage', () => {
    const results = buildResultsByRace([raceRow({ status: 'Certified' })], [voteRow({ votes: '600' }), voteRow({ candidate: 'B Rep', votes: '400' })], nominees)
    const out = buildResultCallout(pair, results.get('XX-2026'))
    expect(out.stage).toBe('certified')
    expect(out.leadingCandidateId).toBe('XX-2026--A-DEM')
  })

  it('an independent winning a race with no vote row for the pair leaves the pair with no leader', () => {
    const results = buildResultsByRace([raceRow({ status: 'Certified' })], [voteRow({ candidate: 'C Ind', votes: '900' }), voteRow({ votes: '100' })], nominees)
    const out = buildResultCallout(pair, results.get('XX-2026'))
    expect(out.leadingCandidateId).toBe('XX-2026--C-IND') // outside the displayed pair; the UI shows no box for either side
  })
})

describe('symmetry: swapping the two parties mirrors every share and the leader, nothing else', () => {
  const pair = ['XX-2026--A-DEM', 'XX-2026--B-REP']
  const swappedNominees: NomineesFile = {
    ...nominees,
    candidates: nominees.candidates.map((c) => (c.id === 'XX-2026--A-DEM' ? { ...c, party: 'R' } : c.id === 'XX-2026--B-REP' ? { ...c, party: 'D' } : c)),
  }

  it('gives the same shares and leader whichever party each candidate carries', () => {
    const races = [raceRow({ status: 'Unofficial' })]
    const votes = [voteRow({ candidate: 'A Dem', votes: '700' }), voteRow({ candidate: 'B Rep', votes: '300' })]
    const a = buildResultCallout(pair, buildResultsByRace(races, votes, nominees).get('XX-2026'))
    const b = buildResultCallout(pair, buildResultsByRace(races, votes, swappedNominees).get('XX-2026'))
    expect(a).toEqual(b) // the shares are keyed by candidate id, not party, so swapping the party column changes nothing here
  })
})
