// The footer's "Big spending gaps" note, from the data: the races where civicAPI shows a winner whose party's aligned
// outside spending was smaller than the other major party's. Aligned spending is the same measure as "Spent on ads":
// support for a party's nominee plus opposition to the other nominee. Party-blind: the same test runs for both
// parties, and the party names in the copy come from one table.
import { pickPair } from './computeCallout'
import type { Callout } from './computeCallout'
import type { RaceView } from './computeSpending'
import type { Party } from './types'

export interface OutspentWin {
  state: string
  winnerName: string
  winnerParty: 'D' | 'R'
  /** The party whose aligned spending was larger. */
  outspendingParty: 'D' | 'R'
  /** Aligned spending of the outspending party minus the winner's party, in dollars. */
  gap: number
}

const MAJOR = new Set<Party>(['D', 'R'])

/** Wins (civicAPI Win or Flip) where the winner's party was outspent, largest gap first. A race with incomplete data is left out. */
export function outspentWins(races: readonly RaceView[], callouts: ReadonlyMap<string, Callout>): OutspentWin[] {
  const out: OutspentWin[] = []
  for (const race of races) {
    const result = callouts.get(race.state)?.result
    const winnerParty = result?.winnerParty
    if (!result || (result.stage !== 'win' && result.stage !== 'flip') || !winnerParty || !MAJOR.has(winnerParty) || race.incompleteCount > 0) continue
    const pair = pickPair(race.rows)
    if (pair.length < 2) continue
    const [a, b] = pair
    const alignedA = (a.support?.value ?? 0) + (b.oppose?.value ?? 0)
    const alignedB = (b.support?.value ?? 0) + (a.oppose?.value ?? 0)
    const winner = a.party === winnerParty ? { row: a, aligned: alignedA, other: b, otherAligned: alignedB } : b.party === winnerParty ? { row: b, aligned: alignedB, other: a, otherAligned: alignedA } : null
    if (!winner || winner.otherAligned <= winner.aligned || !MAJOR.has(winner.other.party)) continue
    out.push({ state: race.state, winnerName: winner.row.name, winnerParty: winnerParty as 'D' | 'R', outspendingParty: winner.other.party as 'D' | 'R', gap: winner.otherAligned - winner.aligned })
  }
  return out.sort((x, y) => y.gap - x.gap || x.state.localeCompare(y.state))
}

const ADJECTIVE: Record<'D' | 'R', string> = { D: 'Democratic', R: 'Republican' }
const PLURAL: Record<'D' | 'R', string> = { D: 'Democrats', R: 'Republicans' }
const million = (v: number) => `$${(v / 1e6).toFixed(1)} million`

export interface SpendingGapCopy {
  heading: string
  body: string
}

/** The note for the two largest gaps, or null when no winner was outspent. */
export function spendingGapCopy(wins: readonly OutspentWin[], stateName: (state: string) => string): SpendingGapCopy | null {
  const [first, second] = wins
  if (!first) return null
  const sameParty = !second || second.winnerParty === first.winnerParty
  const heading = sameParty ? `Big spending gaps, ${ADJECTIVE[first.winnerParty]} wins` : 'Big spending gaps, outspent candidates win'
  const one = `In ${stateName(first.state)}, reported outside spending aligned with ${PLURAL[first.outspendingParty]} exceeded ${ADJECTIVE[first.winnerParty]} aligned spending by ${million(first.gap)}, yet ${first.winnerName} won.`
  const two = second ? ` In ${stateName(second.state)}, the ${ADJECTIVE[second.outspendingParty]} aligned spending advantage was ${million(second.gap)}, yet ${second.winnerName} won.` : ''
  return { heading, body: `${one}${two} These figures show where outside groups spent their money; they do not establish why voters chose either candidate.` }
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** "six races have incomplete data", "one race has incomplete data"; null when none. */
export function incompleteRacesClause(count: number): string | null {
  if (count <= 0) return null
  const word = WORDS[count] ?? String(count)
  return `${word} ${count === 1 ? 'race has' : 'races have'} incomplete data`
}
