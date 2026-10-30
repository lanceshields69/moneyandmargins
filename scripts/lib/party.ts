export type RawPartyCategory = 'D' | 'R' | 'I' | 'other'

/**
 * FEC's own candidate party code (cross-check only, never authoritative for a
 * nominee's displayed party — see mapBallotParty).
 */
const FEC_PARTY_LOOKUP: Record<string, RawPartyCategory> = {
  DEM: 'D',
  DFL: 'D',
  REP: 'R',
  IND: 'I',
  NPA: 'I',
  LIB: 'other',
  GRE: 'other',
  CON: 'other',
  WOR: 'other',
  SWP: 'other',
  // Confirmed via Forward Party nominee reporting (Bob/Robert Chew, CO 2026).
  FWD: 'other',
}

export function mapPartyCode(code: string | null | undefined): RawPartyCategory {
  if (!code || code.trim() === '') {
    throw new Error('Blank party code')
  }
  const normalized = code.trim().toUpperCase()
  const mapped = FEC_PARTY_LOOKUP[normalized]
  if (!mapped) {
    throw new Error(`Unknown party code: "${code}"`)
  }
  return mapped
}

/** Non-throwing variant for non-nominee filers: an unmapped FEC code there is
 * a plain exclusion reason, not a fatal error. */
export function tryMapPartyCode(code: string | null | undefined): RawPartyCategory | null {
  try {
    return mapPartyCode(code)
  } catch {
    return null
  }
}

/**
 * The ballot/source-of-truth party label (e.g. from Wikipedia or a state's
 * certified candidate list) is authoritative for a nominee's displayed
 * party. The FEC code is cross-checked against this, not the other way
 * around.
 *
 * Only Democratic/Republican/Independent-equivalent labels are enumerated
 * explicitly; any other named party (Libertarian, Green, Forward, Unity,
 * etc.) falls through to 'other' — ballot sources name real parties, so a
 * generic bucket is correct here. Only a genuinely blank label fails.
 */
const MAJOR_AND_INDEPENDENT_BALLOT_LABELS: Record<string, RawPartyCategory> = {
  DEMOCRATIC: 'D',
  'DEMOCRATIC-FARMER-LABOR': 'D',
  DFL: 'D',
  REPUBLICAN: 'R',
  INDEPENDENT: 'I',
  'NO PARTY AFFILIATION': 'I',
  UNAFFILIATED: 'I',
}

export function mapBallotParty(label: string | null | undefined): RawPartyCategory {
  if (!label || label.trim() === '') {
    throw new Error('Blank ballot party label')
  }
  const normalized = label.trim().toUpperCase()
  return MAJOR_AND_INDEPENDENT_BALLOT_LABELS[normalized] ?? 'other'
}
