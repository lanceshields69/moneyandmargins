export type Party = 'D' | 'R' | 'I'

export interface SourcedValue<T> {
  value: T
  sourceUrl: string
  asOf: string
}

export interface Race {
  id: string
  state: string
  raceName: string
  isSpecial: boolean
  incumbentName: string | null
  incumbentParty: Party | null
  sourceUrl: string
  sourceTier: 'official' | 'secondary_wikipedia'
  retrievedAt: string
  note?: string
}

export interface Candidate {
  id: string
  raceId: string
  name: string
  party: Party
  fecIds: string[]
  fecMatchNote?: string
  provisional?: boolean
  provisionalReason?: string
}

export interface NomineesFile {
  fetchedAt: string
  source: string
  races: Race[]
  candidates: Candidate[]
}

export interface Committee {
  id: string
  name: string
  fecUrl: string
  amount: number
}

export interface ExpenditureTotals {
  candidateId: string
  support: SourcedValue<number>
  oppose: SourcedValue<number>
  topSupportCommittees: Committee[]
  topOpposeCommittees: Committee[]
}
