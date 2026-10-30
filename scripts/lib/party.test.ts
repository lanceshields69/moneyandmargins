import { describe, expect, it } from 'vitest'
import { mapBallotParty, mapPartyCode, tryMapPartyCode } from './party'

describe('mapPartyCode', () => {
  it('throws on a blank code', () => {
    expect(() => mapPartyCode('')).toThrow()
    expect(() => mapPartyCode('   ')).toThrow()
  })

  it('throws on an undefined or null code', () => {
    expect(() => mapPartyCode(undefined)).toThrow()
    expect(() => mapPartyCode(null)).toThrow()
  })

  it('throws on an unrecognized code', () => {
    expect(() => mapPartyCode('UNK')).toThrow()
  })

  it('maps DFL to D', () => {
    expect(mapPartyCode('DFL')).toBe('D')
  })

  it('maps DEM to D', () => {
    expect(mapPartyCode('DEM')).toBe('D')
  })

  it('maps REP to R', () => {
    expect(mapPartyCode('REP')).toBe('R')
  })

  it('maps IND and NPA to I', () => {
    expect(mapPartyCode('IND')).toBe('I')
    expect(mapPartyCode('NPA')).toBe('I')
  })

  it('maps known minor-party codes to other', () => {
    expect(mapPartyCode('LIB')).toBe('other')
    expect(mapPartyCode('GRE')).toBe('other')
  })

  it('maps the confirmed Forward Party code to other', () => {
    expect(mapPartyCode('FWD')).toBe('other')
  })
})

describe('tryMapPartyCode', () => {
  it('returns null instead of throwing for an unmapped code', () => {
    expect(tryMapPartyCode('UNK')).toBeNull()
    expect(tryMapPartyCode('')).toBeNull()
    expect(tryMapPartyCode(undefined)).toBeNull()
  })

  it('still returns the mapped category for a known code', () => {
    expect(tryMapPartyCode('DEM')).toBe('D')
  })
})

describe('mapBallotParty', () => {
  it('maps Democratic and DFL to D', () => {
    expect(mapBallotParty('Democratic')).toBe('D')
    expect(mapBallotParty('DFL')).toBe('D')
  })

  it('maps Republican to R', () => {
    expect(mapBallotParty('Republican')).toBe('R')
  })

  it('maps Independent, No party affiliation, and Unaffiliated to I', () => {
    expect(mapBallotParty('Independent')).toBe('I')
    expect(mapBallotParty('No party affiliation')).toBe('I')
    expect(mapBallotParty('Unaffiliated')).toBe('I')
  })

  it('maps a named minor party to other', () => {
    expect(mapBallotParty('Libertarian')).toBe('other')
    expect(mapBallotParty('Forward')).toBe('other')
  })

  it('maps any other named party label to other, not just the ones seen so far', () => {
    expect(mapBallotParty('Unity')).toBe('other')
    expect(mapBallotParty('Approval Voting')).toBe('other')
  })

  it('throws only when the ballot party label is blank', () => {
    expect(() => mapBallotParty('')).toThrow()
    expect(() => mapBallotParty(undefined)).toThrow()
  })
})
