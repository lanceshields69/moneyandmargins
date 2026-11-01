// Checks which VotePredictor race pages exist and have the "Other forecasts" section, so the site links only to
// working pages. It records a status and two booleans per state. It reads no rating, probability or other content.
//   tsx scripts/verify-votepredictor-pages.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { VOTEPREDICTOR } from '../src/votepredictor'

const root = new URL('../', import.meta.url)
const nominees = JSON.parse(readFileSync(new URL('data/nominees.json', root), 'utf-8')) as { races: { id: string; state: string }[] }
const states = JSON.parse(readFileSync(new URL('data/us-states.json', root), 'utf-8')) as { states: { usps: string; name: string }[] }
const nameOf = new Map(states.states.map((s) => [s.usps, s.name]))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const out: Record<string, { ok: boolean; status: number; titleMatches: boolean; hasOtherForecasts: boolean }> = {}
for (const race of [...nominees.races].sort((a, b) => a.state.localeCompare(b.state))) {
  const url = `${VOTEPREDICTOR.base}${race.state.toLowerCase()}`
  let status = 0
  let html = ''
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (link check for moneyandmargins.app)' }, redirect: 'follow' })
    status = res.status
    html = status === 200 ? await res.text() : ''
  } catch {
    status = 0
  }
  const title = /<title>([^<]*)/.exec(html)?.[1] ?? ''
  const titleMatches = html !== '' && title.includes(nameOf.get(race.state) ?? '\u0000') && /senate/i.test(title)
  // The visible heading, not the copy of the text inside the page's script payload.
  const hasOtherForecasts = /<h2[^>]*>\s*Other forecasts\s*<\/h2>/.test(html)
  out[race.state] = { ok: status === 200 && titleMatches && hasOtherForecasts, status, titleMatches, hasOtherForecasts }
  await sleep(400)
}
writeFileSync(
  new URL('data/votepredictor-pages.json', root),
  JSON.stringify({ checkedAt: new Date().toISOString(), base: VOTEPREDICTOR.base, pages: out }, null, 2) + '\n',
)
const bad = Object.entries(out).filter(([, v]) => !v.ok)
console.log(`${Object.keys(out).length - bad.length} of ${Object.keys(out).length} pages are good.`)
for (const [st, v] of bad) console.log(`  omit ${st}: ${JSON.stringify(v)}`)
