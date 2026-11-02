// Read-only check of VotePredictor against the latest frozen snapshot. It never writes a snapshot and never changes
// what the site shows. Prints a table and exits 0; a threshold breach is reported, not fatal.
//   tsx scripts/check-forecast.ts [--threshold=0.05]
import { readdirSync, readFileSync } from 'node:fs'
import type { ApiRace, FrozenSnapshotFile, NomineesFile } from '../src/types'

const BASE = 'https://votepredictor.com/api/v1'
const threshold = Number(process.argv.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? 0.05)

const folders = readdirSync(new URL('../data/frozen/', import.meta.url)).sort()
const latest = JSON.parse(readFileSync(new URL(`../data/frozen/${folders[folders.length - 1]}/snapshot.json`, import.meta.url), 'utf-8')) as FrozenSnapshotFile
const nominees = JSON.parse(readFileSync(new URL('../data/nominees.json', import.meta.url), 'utf-8')) as NomineesFile

const frozen = new Map(latest.races.map((r) => [r.race_id, r]))
const rows: { race: string; frozen: number | null; live: number | null; diff: number | null; rating: string | null; asOf: string | null }[] = []
for (const race of nominees.races) {
  const id = `2026_SEN_${race.state}`
  const live = (await (await fetch(`${BASE}/race/${id}`)).json()) as ApiRace
  const was = frozen.get(id)?.forecast?.p_dem_win ?? null
  const now = live.forecast?.p_dem_win ?? null
  rows.push({ race: race.state, frozen: was, live: now, diff: was !== null && now !== null ? now - was : null, rating: live.forecast?.rating ?? null, asOf: live.as_of ?? null })
}

const moved = rows.filter((r) => r.diff !== null && Math.abs(r.diff) >= threshold)
const nullNow = rows.filter((r) => r.live === null).map((r) => r.race)
console.log(`Frozen snapshot: ${folders[folders.length - 1]} (${latest.fetched_at}). Live: ${new Date().toISOString()}.`)
console.log('race  frozen   live     change   rating now')
for (const r of rows) {
  const f = (v: number | null) => (v === null ? '  -  ' : `${(v * 100).toFixed(1)}%`.padStart(6))
  const d = r.diff === null ? '   -  ' : `${r.diff >= 0 ? '+' : ''}${(r.diff * 100).toFixed(1)}`.padStart(6)
  console.log(`${r.race.padEnd(5)} ${f(r.frozen)}  ${f(r.live)}  ${d} pts  ${r.rating ?? '-'}`)
}
console.log(`\nMoved by ${(threshold * 100).toFixed(0)} points or more: ${moved.length}${moved.length ? ` (${moved.map((m) => m.race).join(', ')})` : ''}`)
console.log(`Null live forecasts: ${nullNow.join(', ') || 'none'}`)
