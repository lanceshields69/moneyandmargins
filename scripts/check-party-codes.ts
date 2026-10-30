import 'dotenv/config'
import { mapPartyCode } from './lib/party'

const API_KEY = process.env.FEC_API_KEY ?? 'DEMO_KEY'
const ELECTION_YEAR = 2026

interface FecCandidateTotal {
  candidate_id: string
  name: string
  state: string
  party: string
  incumbent_challenge_full: string | null
}

interface FecResponse {
  results: FecCandidateTotal[]
  pagination: { pages: number }
}

function oldNaiveMap(fecParty: string): 'D' | 'R' | 'I' {
  if (fecParty === 'DEM') return 'D'
  if (fecParty === 'REP') return 'R'
  return 'I'
}

async function fetchAllCandidates(): Promise<FecCandidateTotal[]> {
  const all: FecCandidateTotal[] = []
  let page = 1
  let pages = 1

  do {
    const url = new URL('https://api.open.fec.gov/v1/candidates/totals/')
    url.searchParams.set('office', 'S')
    url.searchParams.set('election_year', String(ELECTION_YEAR))
    url.searchParams.set('sort', '-receipts')
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

  return all
}

async function main() {
  const candidates = await fetchAllCandidates()

  const changed: Record<string, unknown>[] = []
  const errored: Record<string, unknown>[] = []

  for (const c of candidates) {
    const oldResult = oldNaiveMap(c.party)
    try {
      const newResult = mapPartyCode(c.party)
      if (newResult !== oldResult) {
        changed.push({
          name: c.name,
          state: c.state,
          fecPartyCode: c.party,
          old: oldResult,
          new: newResult,
        })
      }
    } catch (err) {
      errored.push({
        name: c.name,
        state: c.state,
        fecPartyCode: c.party,
        old: oldResult,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  console.log('\n=== Candidates whose classification changed (old -> new, no error) ===')
  console.table(changed)

  console.log('\n=== Candidates whose party code is now rejected (needs human-sourced party) ===')
  console.table(errored)

  console.log(
    `\n${candidates.length} candidates checked, ${changed.length} reclassified, ${errored.length} rejected as unknown/blank.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
