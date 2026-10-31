import { countFecIdClaims, incompleteCodes, reasonFor, type IncompleteReason } from './incomplete'
import type { Candidate, Committee, ExpenditureTotals, NomineesFile, Party, Race, SpendingFile } from './types'

// The only place party identity maps to presentation. Everything else takes
// `party` as plain data and indexes this table; there are no party branches.
const tintOf = (variable: string) => `color-mix(in oklab, var(${variable}) 45%, white)`

// `chip` is the mark inside a color chip. Red and blue read on their own, so they carry none; green does not.
export const PARTY_DISPLAY: Record<Party, { label: string; color: string; tint: string; chip: string }> = {
  D: { label: 'Democratic', color: 'var(--color-dem)', tint: tintOf('--color-dem'), chip: '' },
  R: { label: 'Republican', color: 'var(--color-rep)', tint: tintOf('--color-rep'), chip: '' },
  I: { label: 'Independent or other party', color: 'var(--color-ind)', tint: tintOf('--color-ind'), chip: 'I' },
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
  /** Latest dissemination date among the rows that count (YYYY-MM-DD), when the data carries it. */
  latestDissemination: string | null
  /** Pipeline figures for the methodology text; null when the data does not carry them. */
  unattributedTotal: number | null
  approxCommitteeCount: number | null
  approxTotal: number | null
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

/** Party-blind display order: party name alphabetically (from the label table), then surname, full name, id. */
export function compareNominees(
  a: { name: string; candidateId: string; party: Party },
  b: { name: string; candidateId: string; party: Party },
): number {
  return (
    PARTY_DISPLAY[a.party].label.localeCompare(PARTY_DISPLAY[b.party].label) ||
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
    // Summed in id order, not display order, so the total does not move in the last digit when the display order does.
    total: complete.length > 0 ? [...complete].sort((a, b) => a.candidateId.localeCompare(b.candidateId)).reduce((sum, r) => sum + (r.support?.value ?? 0) + (r.oppose?.value ?? 0), 0) : null,
    incompleteCount: rows.length - complete.length,
    missingMajor: MAJOR_PARTIES.filter((party) => !rows.some((r) => r.party === party)),
  }
}

export function buildAllRaces(nominees: NomineesFile, spending: SpendingFile): AllRaces {
  const totalsById = new Map(spending.totals.map((t) => [t.candidateId, t]))
  const claims = countFecIdClaims(nominees.candidates)
  const races = nominees.races.map((race) => buildRaceView(race, nominees.candidates, totalsById, claims))
  const maxTotal = Math.max(0, ...races.map((r) => r.total ?? 0))
  return {
    races,
    maxTotal,
    fetchedAt: spending.fetchedAt,
    latestDissemination: spending.metadata?.latest_dissemination_date ?? null,
    unattributedTotal: spending.metadata?.unattributed_total ?? null,
    approxCommitteeCount: spending.metadata ? spending.metadata.approximate_committees.length : null,
    approxTotal: spending.metadata?.approx_rows_total ?? null,
    source: spending.source,
  }
}

/** Square-root scale so mid-range races stay distinguishable from the largest. */
export function fillFraction(total: number | null, maxTotal: number): number {
  if (total === null || maxTotal <= 0) return 0
  return Math.sqrt(Math.min(total, maxTotal) / maxTotal)
}
