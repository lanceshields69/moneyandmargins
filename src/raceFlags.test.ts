import { describe, expect, it } from 'vitest'
import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import { buildNationalCard } from './computeNational'
import { buildAllRaces } from './computeSpending'
import { RACE_FLAG_REASON, raceFlagReason, type RaceFlag, type RaceFlagsFile } from './raceFlags'
import type { NomineesFile, Party, SpendingFile } from './types'

const nominees = nomineesJson as unknown as NomineesFile
const spending = spendingJson as unknown as SpendingFile
const flag = (raceId: string): RaceFlag => ({ raceId, state: raceId.slice(0, 2), prior: 19043459.64, now: 17793908.68, drop: 1249550.96, dropPct: 6.56, flaggedAt: spending.fetchedAt })
const file = (...ids: string[]): RaceFlagsFile => ({ fetchedAt: spending.fetchedAt, flags: ids.map(flag) })
const flaggedIds = (all: ReturnType<typeof buildAllRaces>) => all.races.filter((r) => r.incompleteCount > 0 && r.rows.every((x) => x.reason?.startsWith(RACE_FLAG_REASON))).map((r) => r.raceId).sort()

describe('a flagged race on the page', () => {
  const plain = buildAllRaces(nominees, spending)
  const flagged = buildAllRaces(nominees, spending, file('MS-2026'))
  const ms = flagged.races.find((r) => r.raceId === 'MS-2026')!

  it('shows "Incomplete data: total dropped since last update, under review" with the drop and both totals, on every nominee', () => {
    expect(ms.incompleteCount).toBe(ms.rows.length)
    for (const row of ms.rows) {
      expect(row.incomplete).toBe(true)
      expect(row.reason).toBe(raceFlagReason(flag('MS-2026')))
    }
    expect(raceFlagReason(flag('MS-2026'))).toBe(`${RACE_FLAG_REASON} (down $1,249,551, from $19,043,460 to $17,793,909)`)
  })

  it('is left out of the national card, and no other race changes', () => {
    expect(flaggedIds(flagged)).toEqual(['MS-2026'])
    expect(buildNationalCard(flagged.races, null).excludedRaces).toBeGreaterThan(buildNationalCard(plain.races, null).excludedRaces)
    for (const r of flagged.races.filter((x) => x.raceId !== 'MS-2026')) expect(r).toEqual(plain.races.find((p) => p.raceId === r.raceId))
  })

  it('is ignored when the flags were made for other spending data', () => {
    expect(flaggedIds(buildAllRaces(nominees, spending, { ...file('MS-2026'), fetchedAt: 'another fetch' }))).toEqual([])
    expect(flaggedIds(buildAllRaces(nominees, spending, null))).toEqual([])
  })

  it('flags the same races when the party labels are swapped', () => {
    const swap = (p: Party): Party => (p === 'D' ? 'R' : p === 'R' ? 'D' : p)
    const swapped: NomineesFile = { ...nominees, candidates: nominees.candidates.map((c) => ({ ...c, party: swap(c.party) })) }
    expect(flaggedIds(buildAllRaces(swapped, spending, file('MS-2026', 'OH-2026')))).toEqual(flaggedIds(buildAllRaces(nominees, spending, file('MS-2026', 'OH-2026'))))
  })
})
