const SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV', 'MR', 'MRS', 'DR'])

// Only the equivalences that name search needs beyond equality and the
// 3-letter-prefix rule below (e.g. Ken/Kenneth, Jeff/Jeffrey need no entry).
const NICKNAMES: Record<string, string[]> = {
  JACK: ['JOHN'],
  JOHN: ['JACK', 'JON'],
  CINDY: ['CYNTHIA'],
  ANGIE: ['ANGELA'],
  CHUCK: ['CHARLES'],
  BOB: ['ROBERT'],
  BILL: ['WILLIAM'],
  PEGGY: ['MARGARET'],
  CHRIS: ['CHRISTOPHER'],
  MIKE: ['MICHAEL'],
  TED: ['THEODORE', 'EDWARD'],
}

/** Uppercase letters only, diacritics folded (LUJÁN -> LUJAN), hyphens split. */
export function tokens(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t !== '' && !SUFFIXES.has(t))
}

export function nomineeFirstAndLast(name: string): { first: string; last: string } {
  const t = tokens(name)
  return { first: t[0] ?? '', last: t[t.length - 1] ?? '' }
}

function firstNamesCompatible(nomineeFirst: string, fecToken: string): boolean {
  if (nomineeFirst === fecToken) return true
  if ((NICKNAMES[nomineeFirst] ?? []).includes(fecToken)) return true
  if ((NICKNAMES[fecToken] ?? []).includes(nomineeFirst)) return true
  const [short, long] = nomineeFirst.length <= fecToken.length ? [nomineeFirst, fecToken] : [fecToken, nomineeFirst]
  return short.length >= 3 && long.startsWith(short)
}

/**
 * Looser than the 2a matcher on purpose: FEC names carry middle names, married
 * names and legal first names (ARENHOLZ, ASHLEY HINSON; PAXTON, WARREN KENNETH
 * JR.). The nominee's surname must be any token of the FEC name, and the
 * nominee's first name must be compatible with any other token. State and
 * Senate office are enforced by the search query, and callers must still
 * review every match this returns.
 */
export function fecNameMatchesNominee(nomineeName: string, fecName: string): boolean {
  const { first, last } = nomineeFirstAndLast(nomineeName)
  const fec = tokens(fecName)
  const surnameIndex = fec.indexOf(last)
  if (surnameIndex === -1) return false
  return fec.some((t, i) => i !== surnameIndex && firstNamesCompatible(first, t))
}
