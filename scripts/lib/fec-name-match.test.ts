import { describe, expect, it } from 'vitest'
import { fecNameMatchesNominee, nomineeFirstAndLast, tokens } from './fec-name-match'

describe('tokens', () => {
  it('folds accents so Luján matches LUJAN', () => {
    expect(tokens('Ben Ray Luján')).toEqual(['BEN', 'RAY', 'LUJAN'])
    expect(tokens('LUJAN, BEN RAY')).toEqual(['LUJAN', 'BEN', 'RAY'])
  })

  it('drops generational and honorific suffixes', () => {
    expect(tokens('Whitfield Harrington Jr.')).toEqual(['WHITFIELD', 'HARRINGTON'])
    expect(tokens('PAXTON, WARREN KENNETH JR.')).toEqual(['PAXTON', 'WARREN', 'KENNETH'])
  })

  it('splits hyphenated surnames', () => {
    expect(tokens('EL-SAYED, ABDUL')).toEqual(['EL', 'SAYED', 'ABDUL'])
  })
})

describe('nomineeFirstAndLast', () => {
  it('ignores suffix and middle initial', () => {
    expect(nomineeFirstAndLast('Daniel J. Sullivan Jr.')).toEqual({ first: 'DANIEL', last: 'SULLIVAN' })
  })
})

describe('fecNameMatchesNominee', () => {
  it('matches nickname to legal first name (Nixon, Conboy, Reed)', () => {
    expect(fecNameMatchesNominee('Angie Nixon', 'NIXON, ANGELA')).toBe(true)
    expect(fecNameMatchesNominee('Chuck Conboy', 'CONBOY, CHARLES')).toBe(true)
    expect(fecNameMatchesNominee('Jack Reed', 'REED, JOHN F.')).toBe(true)
  })

  it('matches across accents (Luján)', () => {
    expect(fecNameMatchesNominee('Ben Ray Luján', 'LUJAN, BEN RAY')).toBe(true)
  })

  it('matches when the FEC record carries a suffix (Jr.)', () => {
    expect(fecNameMatchesNominee('Whitfield Harrington Jr.', 'HARRINGTON, WHITFIELD JR.')).toBe(true)
    expect(fecNameMatchesNominee('Ken Paxton', 'PAXTON, WARREN KENNETH JR.')).toBe(true)
  })

  it('matches a surname and first name found anywhere in the FEC name', () => {
    expect(fecNameMatchesNominee('Ashley Hinson', 'ARENHOLZ, ASHLEY HINSON')).toBe(true)
    expect(fecNameMatchesNominee('Rachel Fetty Anderson', 'FETTY ANDERSON, RACHEL LEE')).toBe(true)
    expect(fecNameMatchesNominee('Abdul El-Sayed', 'EL-SAYED, ABDUL')).toBe(true)
  })

  it('matches a short form that is a prefix of the legal name', () => {
    expect(fecNameMatchesNominee('Jeff Merkley', 'MERKLEY, JEFFREY ALAN')).toBe(true)
  })

  it('rejects a different surname', () => {
    expect(fecNameMatchesNominee('Mark Hackett', 'SLOAN, MARK STEPHEN MR')).toBe(false)
  })

  it('rejects the same surname with an unrelated first name', () => {
    expect(fecNameMatchesNominee('Jack Reed', 'REED, STANLEY E')).toBe(false)
  })

  it('does not treat a two-letter prefix as a first-name match', () => {
    expect(fecNameMatchesNominee('Al Smith', 'SMITH, ALBERT')).toBe(false)
  })

  it('cannot tell the two Alaska Sullivans apart, so FEC IDs must be assigned explicitly', () => {
    expect(fecNameMatchesNominee('Dan Sullivan', 'SULLIVAN, DANIEL J')).toBe(true)
    expect(fecNameMatchesNominee('Daniel J. Sullivan Jr.', 'SULLIVAN, DAN')).toBe(true)
  })
})
