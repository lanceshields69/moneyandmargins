// A race whose total dropped sharply since the last update is held out as "Incomplete data" until a person
// reviews it. Written by scripts/verify.ts; the page only reads it. Party-blind: a race is flagged by its
// numbers, never by who the nominees are.
export interface RaceFlag {
  raceId: string
  state: string
  /** The race total in the run before, and in this one. */
  prior: number
  now: number
  drop: number
  dropPct: number
  /** The fetch that first flagged it. A flag carries over until the race is reviewed. */
  flaggedAt: string
}

export interface RaceFlagsFile {
  /** The fetch these flags were made for. They are ignored for any other spending data. */
  fetchedAt: string
  flags: RaceFlag[]
}

/** A person's review of a flagged race: the total they accepted, why, and when. */
export interface RaceReview {
  raceId: string
  total: number
  reason: string
  date: string
}

export const RACE_FLAG_REASON = 'Incomplete data: total dropped since last update, under review'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const raceFlagReason = (f: RaceFlag): string =>
  `${RACE_FLAG_REASON} (down ${money.format(f.drop)}, from ${money.format(f.prior)} to ${money.format(f.now)})`
