import { writeFileSync } from 'node:fs'
import 'dotenv/config'
import type { Candidate, NomineesFile, Party, Race } from '../src/types'
import { RETRIEVED_AT, SOURCE_RACES } from './data/nominees-source'
import { mapBallotParty, tryMapPartyCode } from './lib/party'

const API_KEY = process.env.FEC_API_KEY ?? 'DEMO_KEY'
const ELECTION_YEAR = 2026
const SOURCE_NOTE =
  'Nominees sourced from Wikipedia per-state race articles (permalinked), cross-checked against FEC candidate filings.'

interface FecCandidateTotal {
  candidate_id: string
  name: string
  state: string
  party: string
}

interface FecResponse {
  results: FecCandidateTotal[]
  pagination: { pages: number }
}

async function fetchAllCandidates(): Promise<FecCandidateTotal[]> {
  const all: FecCandidateTotal[] = []
  let page = 1
  let pages = 1

  do {
    const url = new URL('https://api.open.fec.gov/v1/candidates/totals/')
    url.searchParams.set('office', 'S')
    url.searchParams.set('election_year', String(ELECTION_YEAR))
    // Sorted by candidate_id (stable, unique) rather than receipts: a
    // receipts sort ties heavily at $0 and produces unstable pagination —
    // confirmed to both duplicate and silently drop records across pages.
    url.searchParams.set('sort', 'candidate_id')
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    url.searchParams.set('api_key', API_KEY)

    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`FEC API request failed: ${res.status} ${res.statusText}`)
    }
    const body = (await res.json()) as FecResponse
    all.push(...body.results)
    pages = body.pagination.pages
    page += 1
  } while (page <= pages)

  const seen = new Set<string>()
  return all.filter((c) => {
    if (seen.has(c.candidate_id)) return false
    seen.add(c.candidate_id)
    return true
  })
}

const NICKNAMES: Record<string, string[]> = {
  BOB: ['ROBERT', 'BOBBY'],
  ROBERT: ['BOB', 'BOBBY'],
  BILL: ['WILLIAM', 'BILLY'],
  WILLIAM: ['BILL', 'BILLY'],
  JIM: ['JAMES', 'JIMMY'],
  JAMES: ['JIM', 'JIMMY'],
  PEGGY: ['MARGARET'],
  MARGARET: ['PEGGY'],
  CHRIS: ['CHRISTOPHER'],
  CHRISTOPHER: ['CHRIS'],
  MIKE: ['MICHAEL'],
  MICHAEL: ['MIKE'],
  DAN: ['DANIEL'],
  DANIEL: ['DAN'],
  TOM: ['THOMAS', 'TOMMY'],
  THOMAS: ['TOM', 'TOMMY'],
  KEN: ['KENNETH'],
  KENNETH: ['KEN'],
  STEVE: ['STEVEN', 'STEPHEN'],
  STEVEN: ['STEVE', 'STEPHEN'],
  STEPHEN: ['STEVE', 'STEVEN'],
  GREG: ['GREGORY'],
  GREGORY: ['GREG'],
  ANDY: ['ANDREW'],
  ANDREW: ['ANDY'],
  TED: ['THEODORE', 'EDWARD'],
  THEODORE: ['TED'],
  ED: ['EDWARD'],
  EDWARD: ['ED', 'TED'],
  NATE: ['NATHAN', 'NATHANIEL'],
  NATHAN: ['NATE'],
  LARRY: ['LAWRENCE'],
  LAWRENCE: ['LARRY'],
  JOE: ['JOSEPH'],
  JOSEPH: ['JOE'],
  JOSH: ['JOSHUA'],
  JOSHUA: ['JOSH'],
}

const SUFFIXES = new Set(['JR', 'JR.', 'SR', 'SR.', 'II', 'III', 'IV', 'MR', 'MR.', 'MRS', 'MRS.', 'DR', 'DR.'])

function normalize(s: string): string {
  return s.toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** "First Middle Last Suffix" -> { first, last } */
function parseNominee(name: string): { first: string; last: string } {
  const tokens = normalize(name).split(' ').filter((t) => !SUFFIXES.has(t))
  return { first: tokens[0] ?? '', last: tokens[tokens.length - 1] ?? '' }
}

/** FEC "LAST, FIRST MIDDLE SUFFIX" -> { first, last } */
function parseFec(name: string): { first: string; last: string } {
  const [lastPart, restPart] = name.split(',').map((p) => p?.trim() ?? '')
  const last = normalize(lastPart).split(' ')[0] ?? ''
  const restTokens = normalize(restPart ?? '').split(' ').filter((t) => !SUFFIXES.has(t))
  const first = restTokens[0] ?? ''
  return { first, last }
}

/**
 * Surname spelling found to differ between the nominee source and FEC's
 * filing (confirmed by manual inspection, not auto-detected — exact-match
 * surname comparison otherwise misses these).
 */
const SURNAME_ALIASES: Record<string, string> = {
  GILLESPIE: 'GILESPIE', // FEC: "GILESPIE, NEIL JOSEPH" (FL) — one L
}

function firstNamesMatch(a: string, b: string): boolean {
  if (a === b) return true
  return (NICKNAMES[a] ?? []).includes(b) || (NICKNAMES[b] ?? []).includes(a)
}

function findFecMatches(
  nomineeName: string,
  state: string,
  fecCandidates: FecCandidateTotal[],
): FecCandidateTotal[] {
  const { first, last } = parseNominee(nomineeName)
  const lastAlias = SURNAME_ALIASES[last]
  return fecCandidates.filter((c) => {
    if (c.state !== state) return false
    const fec = parseFec(c.name)
    const surnameMatches = fec.last === last || (lastAlias !== undefined && fec.last === lastAlias)
    return surnameMatches && firstNamesMatch(fec.first, first)
  })
}

interface NomineeMatchRow {
  state: string
  raceId: string
  candidateName: string
  party: Party
  fecIds: string[]
  fecMatchNote?: string
  mismatchFlag?: string
  provisional: boolean
  provisionalReason?: string
}

function buildNominees(fecCandidates: FecCandidateTotal[]): {
  nomineesFile: NomineesFile
  matchRows: NomineeMatchRow[]
} {
  const races: Race[] = []
  const candidates: Candidate[] = []
  const matchRows: NomineeMatchRow[] = []

  for (const sourceRace of SOURCE_RACES) {
    const raceId = `${sourceRace.state}-${ELECTION_YEAR}`
    const nomineeRecords: Candidate[] = []

    for (const nominee of sourceRace.nominees) {
      const ballotCategory = mapBallotParty(nominee.ballotParty)
      const displayParty: Party = ballotCategory === 'other' ? 'I' : ballotCategory

      const matches = findFecMatches(nominee.name, sourceRace.state, fecCandidates)
      const fecIds = matches.map((m) => m.candidate_id)

      let mismatchFlag: string | undefined
      for (const match of matches) {
        const fecCategory = tryMapPartyCode(match.party)
        if (fecCategory !== null && fecCategory !== ballotCategory) {
          mismatchFlag = `FEC party code "${match.party}" (${match.candidate_id}) disagrees with ballot party "${nominee.ballotParty}" — ballot wins.`
        }
      }

      let fecMatchNote: string | undefined
      if (fecIds.length === 0) {
        fecMatchNote = 'no FEC filing found'
      } else if (fecIds.length > 1) {
        fecMatchNote = `matched ${fecIds.length} FEC candidate IDs — not merged, verify same person`
      }

      const candidateId = `${raceId}--${normalize(nominee.name).replace(/\s+/g, '-')}`

      nomineeRecords.push({
        id: candidateId,
        raceId,
        name: nominee.name,
        party: displayParty,
        fecIds,
        fecMatchNote,
        provisional: nominee.provisional,
        provisionalReason: nominee.provisionalReason,
      })

      matchRows.push({
        state: sourceRace.state,
        raceId,
        candidateName: nominee.name,
        party: displayParty,
        fecIds,
        fecMatchNote,
        mismatchFlag,
        provisional: Boolean(nominee.provisional),
        provisionalReason: nominee.provisionalReason,
      })
    }

    races.push({
      id: raceId,
      state: sourceRace.state,
      raceName: sourceRace.raceName,
      isSpecial: sourceRace.isSpecial,
      incumbentName: null,
      incumbentParty: null,
      sourceUrl: sourceRace.sourceUrl,
      sourceTier: sourceRace.sourceTier,
      retrievedAt: RETRIEVED_AT,
      note: sourceRace.note,
    })
    candidates.push(...nomineeRecords)
  }

  return {
    nomineesFile: {
      fetchedAt: new Date().toISOString(),
      source: SOURCE_NOTE,
      races,
      candidates,
    },
    matchRows,
  }
}

function buildExcludedFilers(
  fecCandidates: FecCandidateTotal[],
  matchedFecIds: Set<string>,
): Record<string, unknown>[] {
  return fecCandidates
    .filter((c) => !matchedFecIds.has(c.candidate_id))
    .map((c) => {
      const category = tryMapPartyCode(c.party)
      return {
        name: c.name,
        state: c.state,
        fecPartyCode: c.party,
        reason:
          category === null
            ? `not a certified general-election nominee (FEC party code "${c.party}" also unresolved)`
            : 'not a certified general-election nominee (primary loser, withdrawn, write-in, or duplicate filing)',
      }
    })
}

function crossCheckMissingNominees(matchRows: NomineeMatchRow[]): Record<string, unknown>[] {
  return matchRows
    .filter((r) => r.fecMatchNote === 'no FEC filing found')
    .map((r) => ({ state: r.state, candidate: r.candidateName, note: 'nominee has no FEC filing found' }))
}

async function main() {
  const fecCandidates = await fetchAllCandidates()
  const { nomineesFile, matchRows } = buildNominees(fecCandidates)

  const matchedFecIds = new Set(matchRows.flatMap((r) => r.fecIds))

  console.log('\n=== Nominees ===')
  console.table(
    matchRows.map((r) => ({
      state: r.state,
      candidate: r.candidateName,
      party: r.party,
      fecIds: r.fecIds.join(', ') || '(none)',
      note: r.fecMatchNote ?? '',
      mismatch: r.mismatchFlag ?? '',
      provisional: r.provisional ? 'yes' : '',
    })),
  )

  console.log('\n=== Excluded raw FEC filers (not matched to a nominee) ===')
  const excluded = buildExcludedFilers(fecCandidates, matchedFecIds)
  console.table(excluded)

  console.log('\n=== Cross-check: nominees with no FEC match ===')
  console.table(crossCheckMissingNominees(matchRows))

  console.log(
    `\n${nomineesFile.races.length} races, ${nomineesFile.candidates.length} nominees, ${excluded.length} filers excluded.`,
  )

  if (process.argv.includes('--confirm')) {
    writeFileSync(
      new URL('../data/nominees.json', import.meta.url),
      JSON.stringify(nomineesFile, null, 2) + '\n',
    )
    console.log('\nWrote data/nominees.json')
  } else {
    console.log('\nPreview only — rerun with --confirm after approval to write data/nominees.json')
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
