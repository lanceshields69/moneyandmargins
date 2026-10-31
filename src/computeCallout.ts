import { PARTY_DISPLAY, type RaceView, type RowView } from './computeSpending'
import type { ApiRace, ForecastSnapshot, FrozenSnapshotFile, Party, RaceForecast } from './types'

const MAJOR_ORDER: readonly Party[] = ['D', 'R']

export interface CalloutSide {
  candidateId: string
  name: string
  party: Party
  partyLabel: string
  partyColor: string
  chip: string
  adPct: number | null
  winPct: number | null
}

export interface Callout {
  state: string
  raceName: string
  isSpecial: boolean
  sides: CalloutSide[]
  /** Set when the spending row cannot show percentages. */
  adFlag: { label: 'Incomplete data' | 'No spending reported'; reason: string | null } | null
  /** Set when the prediction row cannot show percentages. */
  winFlag: { label: 'No forecast'; reason: string | null } | null
  /** Race-level note for hatched states. */
  incompleteNote: string | null
  /** Nominees in the race that are not one of the two shown. */
  excluded: string[]
  /** Forecast problems worth reporting, such as a forecast naming a different matchup. */
  discrepancies: string[]
}

/**
 * Splits two percentages out of two shares so they are whole numbers that sum to 100. Uses the
 * largest-remainder rule; an exact tie goes to the side with the lower id, which does not depend on party.
 */
export function wholePercents(firstShare: number, secondShare: number, firstId: string, secondId: string): [number, number] {
  const a = firstShare * 100
  const b = secondShare * 100
  const floors: [number, number] = [Math.floor(a), Math.floor(b)]
  const extra = 100 - floors[0] - floors[1]
  if (extra <= 0) return floors
  const remainders: [number, number] = [a - floors[0], b - floors[1]]
  const firstGetsIt = remainders[0] !== remainders[1] ? remainders[0] > remainders[1] : firstId < secondId
  return firstGetsIt ? [floors[0] + extra, floors[1]] : [floors[0], floors[1] + extra]
}

/**
 * Each nominee's share of reported spending that helps them: their own support plus the other nominee's
 * opposition, over all four amounts. One function for any pair; party is never read.
 */
export function adSpendShare(a: { support: number; oppose: number }, b: { support: number; oppose: number }): [number, number] | null {
  const total = a.support + a.oppose + b.support + b.oppose
  if (total <= 0) return null
  return [(a.support + b.oppose) / total, (b.support + a.oppose) / total]
}

function combined(row: RowView): number {
  return (row.support?.value ?? 0) + (row.oppose?.value ?? 0)
}

/** The row to show for a party: complete data first, then most reported spending, then name. */
function bestOfParty(rows: RowView[], party: Party): RowView | null {
  const candidates = rows.filter((r) => r.party === party)
  if (candidates.length === 0) return null
  return [...candidates].sort(
    (x, y) => Number(x.incomplete) - Number(y.incomplete) || combined(y) - combined(x) || x.name.localeCompare(y.name),
  )[0]
}

export function pickPair(rows: RowView[]): RowView[] {
  const majors = MAJOR_ORDER.map((party) => bestOfParty(rows, party)).filter((r): r is RowView => r !== null)
  if (majors.length >= 2) return majors
  const independent = bestOfParty(rows, 'I')
  return independent ? [...majors, independent] : majors
}

function surname(name: string): string {
  return name.replace(/\b(jr|sr|ii|iii)\b\.?/gi, '').trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
}

function forecastNamesMatch(forecast: RaceForecast, byParty: Map<Party, RowView>): boolean {
  if (!forecast.candidates) return true
  const pairs: [Party, string | null][] = [['D', forecast.candidates.democrat], ['R', forecast.candidates.republican]]
  return pairs.every(([party, name]) => {
    if (name === null) return true
    const row = byParty.get(party)
    return row !== undefined && surname(row.name) === surname(name)
  })
}

export function buildCallout(race: RaceView, forecast: RaceForecast | undefined): Callout {
  const pair = pickPair(race.rows)
  const sorted = [...pair].sort((a, b) => a.partyLabel.localeCompare(b.partyLabel) || a.candidateId.localeCompare(b.candidateId))
  const sides: CalloutSide[] = sorted.map((row) => ({
    candidateId: row.candidateId,
    name: row.name,
    party: row.party,
    partyLabel: PARTY_DISPLAY[row.party].label,
    partyColor: PARTY_DISPLAY[row.party].color,
    chip: PARTY_DISPLAY[row.party].chip,
    adPct: null,
    winPct: null,
  }))

  const callout: Callout = {
    state: race.state,
    raceName: race.raceName,
    isSpecial: race.isSpecial,
    sides,
    adFlag: null,
    winFlag: null,
    incompleteNote: null,
    excluded: race.rows.filter((r) => !pair.includes(r)).map((r) => r.name),
    discrepancies: [],
  }

  if (race.incompleteCount > 0) {
    const reasons = new Map<string, number>()
    for (const row of race.rows) if (row.incomplete && row.reason) reasons.set(row.reason, (reasons.get(row.reason) ?? 0) + 1)
    callout.incompleteNote = `Incomplete data: ${[...reasons].map(([reason, count]) => `${count} ${reason}`).join(', ')}`
  }

  // Spent on ads
  if (sorted.length < 2) {
    callout.adFlag = { label: 'Incomplete data', reason: 'Fewer than two nominees' }
  } else {
    const flagged = sorted.map((s) => race.rows.find((r) => r.candidateId === s.candidateId)).find((r) => r?.incomplete)
    if (flagged) {
      callout.adFlag = { label: 'Incomplete data', reason: flagged.reason }
    } else {
      const [first, second] = sorted.map((s) => race.rows.find((r) => r.candidateId === s.candidateId)!)
      const shares = adSpendShare(
        { support: first.support?.value ?? 0, oppose: first.oppose?.value ?? 0 },
        { support: second.support?.value ?? 0, oppose: second.oppose?.value ?? 0 },
      )
      if (shares === null) {
        callout.adFlag = { label: 'No spending reported', reason: null }
      } else {
        const [a, b] = wholePercents(shares[0], shares[1], first.candidateId, second.candidateId)
        sides[0].adPct = a
        sides[1].adPct = b
      }
    }
  }

  // Predicted to win: the source forecasts Democratic against Republican only.
  const byParty = new Map<Party, RowView>(pair.map((r) => [r.party, r]))
  const isMajorPair = byParty.has('D') && byParty.has('R') && sorted.length === 2
  if (!forecast || forecast.pDemWin === null) {
    callout.winFlag = { label: 'No forecast', reason: forecast?.noForecast?.actualMatchup ?? null }
  } else if (!isMajorPair) {
    callout.winFlag = { label: 'No forecast', reason: 'The forecast covers a different matchup' }
    callout.discrepancies.push(`${race.state}: forecast names ${forecast.candidates?.democrat ?? 'a Democrat'} but the nominee list has no Democratic nominee`)
  } else if (!forecastNamesMatch(forecast, byParty)) {
    callout.winFlag = { label: 'No forecast', reason: 'The forecast names different candidates' }
    callout.discrepancies.push(`${race.state}: forecast names ${forecast.candidates?.democrat} and ${forecast.candidates?.republican}`)
  } else {
    const democrat = byParty.get('D')!
    const republican = byParty.get('R')!
    const [d, r] = wholePercents(forecast.pDemWin, 1 - forecast.pDemWin, democrat.candidateId, republican.candidateId)
    for (const side of sides) side.winPct = side.candidateId === democrat.candidateId ? d : side.candidateId === republican.candidateId ? r : null
  }
  return callout
}

function normalizeRace(race: ApiRace): RaceForecast {
  return {
    state: race.location,
    pDemWin: race.forecast?.p_dem_win ?? null,
    basis: race.forecast?.source ?? null,
    nPolls: race.forecast?.n_polls ?? null,
    candidates: race.candidates,
    noForecast: race.no_forecast
      ? { reason: race.no_forecast.reason ?? null, actualMatchup: race.no_forecast.actual_matchup ?? null }
      : null,
    asOf: race.as_of,
  }
}

export function normalizeSnapshot(file: FrozenSnapshotFile): ForecastSnapshot {
  return {
    sourceName: file.source_name,
    sourceUrl: file.source_url,
    fetchedAt: file.fetched_at,
    contentHash: file.content_hash,
    modelVersion: file.model_version,
    tag: file.tag,
    note: file.note,
    races: file.races.map(normalizeRace),
  }
}

/** The newest snapshot, by folder name (a sortable timestamp). Forecasts never come from anywhere else. */
export function latestSnapshot(files: Record<string, unknown>): ForecastSnapshot {
  const names = Object.keys(files).sort()
  if (names.length === 0) throw new Error('No frozen forecast snapshot found in data/frozen/')
  const mod = files[names[names.length - 1]] as { default?: FrozenSnapshotFile } & FrozenSnapshotFile
  return normalizeSnapshot(mod.default ?? mod)
}

export function buildAllCallouts(races: RaceView[], snapshot: ForecastSnapshot): Map<string, Callout> {
  const forecastByState = new Map(snapshot.races.map((r) => [r.state, r]))
  return new Map(races.map((race) => [race.state, buildCallout(race, forecastByState.get(race.state))]))
}
