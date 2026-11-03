// Parses each forecaster's own raw JSON into one normalized entry: a chamber-wide D/R seat split that always sums
// to 100, with that source's own as-of date. Pure — no fetching here, see scripts/freeze-seat-forecasts.ts. A
// malformed or unexpected shape returns an error instead of throwing, so one source's failure holds just that
// source; see docs/results-entry.md's "hold, don't fake" principle, applied the same way in src/civicapi.ts.
export interface SeatForecastEntry {
  key: string
  sourceName: string
  /** The source's own forecast page for this race, used for the card's big heading link. */
  sourceUrl: string
  /** The source's plain home page, used for the small credit link under the date. */
  homeUrl: string
  asOf: string
  dSeats: number
  rSeats: number
}

export type ParseResult = { ok: true; entry: SeatForecastEntry } | { ok: false; reason: string }

export interface SenateBaseline {
  notUpDemocraticCaucus: number
  notUpRepublican: number
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function dSeatsFromChamberTotal(key: string, sourceName: string, sourceUrl: string, homeUrl: string, dSeats: number, asOf: string): ParseResult {
  if (!Number.isFinite(dSeats) || !asOf) return { ok: false, reason: `${sourceName}: missing or non-numeric seat total` }
  const d = Math.max(0, Math.min(100, Math.round(dSeats)))
  return { ok: true, entry: { key, sourceName, sourceUrl, homeUrl, asOf, dSeats: d, rSeats: 100 - d } }
}

export function parseVotePredictor(raw: unknown, sourceUrl: string, homeUrl: string): ParseResult {
  if (!isObject(raw) || !isObject(raw.control)) return { ok: false, reason: 'VotePredictor: no control object in response' }
  const { expected_dem_seats, as_of } = raw.control
  return dSeatsFromChamberTotal('votepredictor', 'VotePredictor', sourceUrl, homeUrl, Number(expected_dem_seats), String(as_of ?? ''))
}

export function parseCallTheMap(raw: unknown, sourceUrl: string, homeUrl: string): ParseResult {
  if (!isObject(raw)) return { ok: false, reason: 'CallTheMap: response is not an object' }
  const asOf = isObject(raw.shared_environment) && isObject(raw.shared_environment.input_as_of) ? raw.shared_environment.input_as_of.approval : undefined
  return dSeatsFromChamberTotal('callthemap', 'CallTheMap', sourceUrl, homeUrl, Number(raw.expected_D_seats), String(asOf ?? ''))
}

export function parsePollingForecast(raw: unknown, sourceUrl: string, homeUrl: string, baseline: SenateBaseline): ParseResult {
  if (!isObject(raw) || !Array.isArray(raw.rows)) return { ok: false, reason: 'PollingForecast: no rows array in response' }
  let dShareUp = 0
  for (const row of raw.rows) {
    if (!isObject(row)) continue
    const chanceLeft = Number(row.chance_left)
    if (!Number.isFinite(chanceLeft)) continue
    if (row.left_party === 'D') dShareUp += chanceLeft
    else if (row.left_party === 'R') dShareUp += 1 - chanceLeft
  }
  const dSeats = baseline.notUpDemocraticCaucus + dShareUp
  return dSeatsFromChamberTotal('pollingforecast', 'PollingForecast', sourceUrl, homeUrl, dSeats, String(raw.asOf ?? ''))
}

export function parseBellwether(raw: unknown, sourceUrl: string, homeUrl: string, baseline: SenateBaseline, fallbackAsOf: string): ParseResult {
  if (!Array.isArray(raw)) return { ok: false, reason: 'Bellwether: response is not an array' }
  const senateRaces = raw.filter((r): r is Record<string, unknown> => isObject(r) && r.office === 'senate')
  if (senateRaces.length === 0) return { ok: false, reason: 'Bellwether: no senate races found' }
  let dShareUp = 0
  for (const race of senateRaces) {
    const pParty = isObject(race.p_party) ? race.p_party : undefined
    const d = pParty ? Number(pParty.D) : NaN
    if (Number.isFinite(d)) dShareUp += d
  }
  const dSeats = baseline.notUpDemocraticCaucus + dShareUp
  // Bellwether's races.json carries no chamber-level as-of date; the freeze script's own fetch time stands in.
  return dSeatsFromChamberTotal('bellwether', 'Bellwether', sourceUrl, homeUrl, dSeats, fallbackAsOf)
}
