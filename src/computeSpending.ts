import { countFecIdClaims, incompleteCodes, reasonFor, type IncompleteReason } from './incomplete'
import type { Candidate, Committee, ExpenditureTotals, NomineesFile, Party, Race, SpendingFile } from './types'

// The only place party identity maps to presentation. Everything else takes
// `party` as plain data and indexes this table; there are no party branches.
const tintOf = (variable: string) => `color-mix(in oklab, var(${variable}) 45%, white)`

export const PARTY_DISPLAY: Record<Party, { label: string; color: string; tint: string }> = {
  D: { label: 'Democratic', color: 'var(--color-dem)', tint: tintOf('--color-dem') },
  R: { label: 'Republican', color: 'var(--color-rep)', tint: tintOf('--color-rep') },
  I: { label: 'Independent or other party', color: 'var(--color-ind)', tint: tintOf('--color-ind') },
}

export interface SideView {
  value: number
  widthPct: number
}

export interface RowView {
  candidateId: string
  name: string
  party: Party
  partyLabel: string
  partyColor: string
  incomplete: boolean
  reason: IncompleteReason | null
  support: SideView | null
  oppose: SideView | null
  topSupportCommittees: Committee[]
  topOpposeCommittees: Committee[]
  sourceUrl: string | null
  asOf: string | null
}

const MAJOR_PARTIES: readonly Party[] = ['D', 'R']

export interface RaceView {
  raceId: string
  state: string
  raceName: string
  isSpecial: boolean
  rows: RowView[]
  scaleMax: number
  total: number | null
  incompleteCount: number
  /** Major parties with no nominee in the source data, in fixed D, R order. */
  missingMajor: Party[]
}

export interface AllRaces {
  races: RaceView[]
  maxTotal: number
  fetchedAt: string
  source: string
}

function surname(name: string): string {
  const parts = name
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, '')
    .replace(/[.,]/g, ' ')
    .trim()
    .split(/\s+/)
  return (parts[parts.length - 1] ?? '').toLowerCase()
}

/** Party-blind display order: surname, then full name, then id. */
export function compareNominees(
  a: { name: string; candidateId: string },
  b: { name: string; candidateId: string },
): number {
  return (
    surname(a.name).localeCompare(surname(b.name)) ||
    a.name.localeCompare(b.name) ||
    a.candidateId.localeCompare(b.candidateId)
  )
}

function hasNumbers(t: ExpenditureTotals | undefined): t is ExpenditureTotals {
  return t !== undefined && t.status !== 'unmatched' && t.support.value !== null && t.oppose.value !== null
}

export function buildRaceView(
  race: Race,
  candidates: Candidate[],
  totalsById: Map<string, ExpenditureTotals>,
  claims: Map<string, number>,
): RaceView {
  const entries = candidates
    .filter((c) => c.raceId === race.id)
    .map((candidate) => {
      const totals = totalsById.get(candidate.id)
      const reason = reasonFor(incompleteCodes(candidate, claims, totals !== undefined))
      return { candidate, totals, reason }
    })

  const values = entries.flatMap(({ totals, reason }) =>
    reason === null && hasNumbers(totals) ? [totals.support.value ?? 0, totals.oppose.value ?? 0] : [],
  )
  const scaleMax = Math.max(0, ...values)
  const side = (value: number): SideView => ({ value, widthPct: scaleMax > 0 ? (value / scaleMax) * 100 : 0 })

  const rows: RowView[] = entries
    .map(({ candidate, totals, reason }): RowView => {
      const display = PARTY_DISPLAY[candidate.party]
      const base = {
        candidateId: candidate.id,
        name: candidate.name,
        party: candidate.party,
        partyLabel: display.label,
        partyColor: display.color,
        sourceUrl: totals?.support.sourceUrl ?? null,
        asOf: totals?.support.asOf ?? null,
      }
      if (reason !== null || !hasNumbers(totals)) {
        return { ...base, incomplete: true, reason: reason ?? 'ID needs review', support: null, oppose: null, topSupportCommittees: [], topOpposeCommittees: [] }
      }
      return {
        ...base,
        incomplete: false,
        reason: null,
        support: side(totals.support.value ?? 0),
        oppose: side(totals.oppose.value ?? 0),
        topSupportCommittees: totals.topSupportCommittees,
        topOpposeCommittees: totals.topOpposeCommittees,
      }
    })
    .sort(compareNominees)

  const complete = rows.filter((r) => !r.incomplete)
  return {
    raceId: race.id,
    state: race.state,
    raceName: race.raceName,
    isSpecial: race.isSpecial,
    rows,
    scaleMax,
    total: complete.length > 0 ? complete.reduce((sum, r) => sum + (r.support?.value ?? 0) + (r.oppose?.value ?? 0), 0) : null,
    incompleteCount: rows.length - complete.length,
    missingMajor: MAJOR_PARTIES.filter((party) => !rows.some((r) => r.party === party)),
  }
}

export function buildAllRaces(nominees: NomineesFile, spending: SpendingFile): AllRaces {
  const totalsById = new Map(spending.totals.map((t) => [t.candidateId, t]))
  const claims = countFecIdClaims(nominees.candidates)
  const races = nominees.races.map((race) => buildRaceView(race, nominees.candidates, totalsById, claims))
  const maxTotal = Math.max(0, ...races.map((r) => r.total ?? 0))
  return { races, maxTotal, fetchedAt: spending.fetchedAt, source: spending.source }
}

/** Square-root scale so mid-range races stay distinguishable from the largest. */
export function fillFraction(total: number | null, maxTotal: number): number {
  if (total === null || maxTotal <= 0) return 0
  return Math.sqrt(Math.min(total, maxTotal) / maxTotal)
}

export interface PartyBar {
  total: number
  statePortion: number
  /** Segment length as a percent of the shared national scale (the larger party's combined total). */
  widthPct: number
  /** The selected state's share of this bar, as a percent of the bar. */
  statePct: number
}

export interface PartyGroup {
  party: Party
  label: string
  color: string
  tint: string
  nominees: number
  support: PartyBar
  oppose: PartyBar
  /** Supporting plus opposing, shown as one bar made of two labeled segments. Not a net figure. */
  total: number
  stateTotal: number
}

export interface NationalView {
  groups: PartyGroup[]
  scaleMax: number
  stateCode: string | null
}

/**
 * Spending for and against each major party's nominees across all races. Support and oppose stay
 * separate. Nominees with incomplete data and independents are left out. Groups are ordered by
 * label, not by party identity or by amount.
 */
export function buildNationalView(races: RaceView[], stateCode: string | null): NationalView {
  const sums = MAJOR_PARTIES.map((party) => {
    const sum = { party, nominees: 0, support: 0, oppose: 0, stateSupport: 0, stateOppose: 0 }
    for (const race of races) {
      for (const row of race.rows) {
        if (row.party !== party || row.incomplete) continue
        sum.nominees += 1
        sum.support += row.support?.value ?? 0
        sum.oppose += row.oppose?.value ?? 0
        if (race.state === stateCode) {
          sum.stateSupport += row.support?.value ?? 0
          sum.stateOppose += row.oppose?.value ?? 0
        }
      }
    }
    return sum
  })
  const scaleMax = Math.max(0, ...sums.map((x) => x.support + x.oppose))
  const bar = (total: number, statePortion: number): PartyBar => ({
    total,
    statePortion,
    widthPct: scaleMax > 0 ? (total / scaleMax) * 100 : 0,
    statePct: total > 0 ? (statePortion / total) * 100 : 0,
  })
  const groups = sums
    .map((x): PartyGroup => ({
      party: x.party,
      label: PARTY_DISPLAY[x.party].label,
      color: PARTY_DISPLAY[x.party].color,
      tint: PARTY_DISPLAY[x.party].tint,
      nominees: x.nominees,
      support: bar(x.support, x.stateSupport),
      oppose: bar(x.oppose, x.stateOppose),
      total: x.support + x.oppose,
      stateTotal: x.stateSupport + x.stateOppose,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  return { groups, scaleMax, stateCode }
}
