import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { ApiRace, FrozenSnapshotFile, NomineesFile } from '../src/types'

const BASE = 'https://votepredictor.com/api/v1'
const SOURCE_NAME = 'VotePredictor'
const SOURCE_URL = 'https://votepredictor.com'

async function fetchRace(state: string): Promise<ApiRace> {
  const res = await fetch(`${BASE}/race/2026_SEN_${state}`)
  if (!res.ok) throw new Error(`VotePredictor request failed for ${state}: ${res.status}`)
  return (await res.json()) as ApiRace
}

async function main() {
  const tagIndex = process.argv.indexOf('--tag')
  const tag = tagIndex >= 0 ? (process.argv[tagIndex + 1] ?? null) : null

  const nominees = JSON.parse(readFileSync(new URL('../data/nominees.json', import.meta.url), 'utf-8')) as NomineesFile
  const races: ApiRace[] = []
  for (const race of nominees.races) races.push(await fetchRace(race.state))

  const fetchedAt = new Date().toISOString()
  const snapshot: FrozenSnapshotFile = {
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    api_base: BASE,
    fetched_at: fetchedAt,
    content_hash: createHash('sha256').update(JSON.stringify(races)).digest('hex'),
    model_version: races.find((r) => r.model_version)?.model_version ?? null,
    tag,
    note: "p_dem_win is the Democratic nominee's win probability, clamped by the source to 0.01-0.99. The other side is its complement.",
    races,
  }

  // Append-only: one folder per freeze, never overwritten. Colons are replaced so the folder name is portable.
  const folder = `${fetchedAt.slice(0, 19).replace(/:/g, '')}Z`
  const dir = new URL(`../data/frozen/${folder}/`, import.meta.url)
  if (existsSync(dir)) throw new Error(`Snapshot folder already exists: data/frozen/${folder}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('snapshot.json', dir), JSON.stringify(snapshot, null, 2) + '\n')

  const nulls = races.filter((r) => r.forecast === null)
  console.log(`Wrote data/frozen/${folder}/snapshot.json (${races.length} races, hash ${snapshot.content_hash.slice(0, 12)}${tag ? `, tag ${tag}` : ''}).`)
  console.log(`Forecast timestamps (as_of): ${[...new Set(races.map((r) => r.as_of).filter(Boolean))].join(', ')}`)
  console.log(`Null forecasts: ${nulls.map((r) => `${r.location} (${r.no_forecast?.reason ?? 'no reason given'})`).join(', ') || 'none'}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
