// Fetches all 4 chamber-wide Senate forecasts and freezes one combined snapshot, parallel to freeze-forecast.ts's
// per-race VotePredictor pipeline. Browsers never call these APIs; src/data.ts reads only the committed snapshot.
// A source that fails to fetch or parse is left out of this run's file rather than faked or carried over stale.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { parseBellwether, parseCallTheMap, parsePollingForecast, parseVotePredictor, type SeatForecastEntry } from '../src/seatForecastSources'
import { SENATE_BASELINE } from './data/senate-baseline-source'

const UA = 'money-and-margins-seat-forecast/1.0 (https://moneyandmargins.app)'

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const baseline = { notUpDemocraticCaucus: SENATE_BASELINE.notUpDemocraticCaucus, notUpRepublican: SENATE_BASELINE.notUpRepublican }

  const attempts: { label: string; run: () => Promise<ReturnType<typeof parseVotePredictor>> }[] = [
    {
      label: 'VotePredictor',
      run: async () => parseVotePredictor(await fetchJson('https://votepredictor.com/api/v1/chamber/senate'), 'https://votepredictor.com/senate', 'https://votepredictor.com'),
    },
    {
      label: 'CallTheMap',
      run: async () => parseCallTheMap(await fetchJson('https://www.callthemap.com/status/download/senate_probs.json'), 'https://www.callthemap.com/senate', 'https://www.callthemap.com'),
    },
    {
      label: 'PollingForecast',
      run: async () => parsePollingForecast(await fetchJson('https://www.pollingforecast.com/api/us/senate'), 'https://www.pollingforecast.com/us/senate', 'https://www.pollingforecast.com', baseline),
    },
    {
      label: 'Bellwether',
      run: async () => parseBellwether(await fetchJson('https://bellwether-zak.vercel.app/data/races.json'), 'https://bellwether-zak.vercel.app', 'https://bellwether-zak.vercel.app', baseline, fetchedAt),
    },
  ]

  const entries: SeatForecastEntry[] = []
  for (const attempt of attempts) {
    try {
      const result = await attempt.run()
      if (result.ok) {
        entries.push(result.entry)
        console.log(`${attempt.label}: ${result.entry.dSeats}D / ${result.entry.rSeats}R, as of ${result.entry.asOf}`)
      } else {
        console.log(`${attempt.label}: held — ${result.reason}`)
      }
    } catch (err) {
      console.log(`${attempt.label}: held — fetch failed (${err instanceof Error ? err.message : String(err)})`)
    }
  }

  if (entries.length === 0) {
    console.error('No source produced a seat forecast; nothing written.')
    process.exitCode = 1
    return
  }

  // Append-only: one folder per freeze, never overwritten, same convention as data/frozen/.
  const folder = `${fetchedAt.slice(0, 19).replace(/:/g, '')}Z`
  const dir = new URL(`../data/frozen-seats/${folder}/`, import.meta.url)
  if (existsSync(dir)) throw new Error(`Snapshot folder already exists: data/frozen-seats/${folder}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('snapshot.json', dir), JSON.stringify({ fetchedAt, sources: entries }, null, 2) + '\n')
  console.log(`Wrote data/frozen-seats/${folder}/snapshot.json (${entries.length} of ${attempts.length} sources).`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
