import pages from '../data/votepredictor-pages.json'

/** True when scripts/verify-votepredictor-pages.ts found a working VotePredictor page with an "Other forecasts" section. */
export const hasOtherForecasts = (stateAbbreviation: string): boolean =>
  (pages.pages as Record<string, { ok: boolean }>)[stateAbbreviation.toUpperCase()]?.ok === true
