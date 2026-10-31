import { pickPair } from './computeCallout'
import { PARTY_DISPLAY, type RaceView } from './computeSpending'
import type { Party } from './types'

export interface AlignedPart {
  dollars: number
  /** Length as a percent of the shared scale (the larger party's aligned total). */
  widthPct: number
  stateDollars: number
  /** The selected state's share of this part, as a percent of the part. */
  statePct: number
}

export interface PartyAligned {
  party: Party
  label: string
  color: string
  tint: string
  races: number
  /** Spending that supports this party's nominees. */
  supporting: AlignedPart
  /** Spending that opposes the other side's nominees in the same races. */
  opposing: AlignedPart
  total: number
  stateTotal: number
}

export interface NationalCard {
  groups: PartyAligned[]
  scaleMax: number
  includedRaces: number
  /** Races left out because a nominee in them has incomplete data. */
  excludedRaces: number
  stateCode: string | null
}

// Democratic and Republican first, in label order. An independent bar follows only when that nominee has spending.
const MAJOR: readonly Party[] = ['D', 'R']
const INDEPENDENT: Party = 'I'

/**
 * Spending aligned with each party's nominees across the races with complete data. In every race, the two
 * nominees A and B are the pair shown in the callout. A's aligned spending is support for A plus opposition to B,
 * exactly the "Spent on ads" numerator; B's is the mirror. Supporting and opposing stay separate parts of the bar.
 */
export function buildNationalCard(races: readonly RaceView[], stateCode: string | null): NationalCard {
  const blank = () => ({ races: 0, support: 0, oppose: 0, stateSupport: 0, stateOppose: 0, own: 0 })
  const sums = new Map<Party, ReturnType<typeof blank>>([...MAJOR, INDEPENDENT].map((p) => [p, blank()]))
  let included = 0
  let excluded = 0

  for (const race of races) {
    if (race.incompleteCount > 0) {
      excluded += 1
      continue
    }
    const pair = pickPair(race.rows)
    if (pair.length < 2) continue
    included += 1
    const here = race.state === stateCode
    for (const member of pair) {
      const other = pair.find((r) => r !== member)!
      const sum = sums.get(member.party)!
      const supporting = member.support?.value ?? 0
      const opposing = other.oppose?.value ?? 0
      sum.races += 1
      sum.own += (member.support?.value ?? 0) + (member.oppose?.value ?? 0)
      sum.support += supporting
      sum.oppose += opposing
      if (here) {
        sum.stateSupport += supporting
        sum.stateOppose += opposing
      }
    }
  }

  const parties = [...MAJOR].sort((a, b) => PARTY_DISPLAY[a].label.localeCompare(PARTY_DISPLAY[b].label))
  const independent = sums.get(INDEPENDENT)!
  // Shown only when the independent nominee's own reported spending (for or against them) is above zero.
  if (independent.own > 0) parties.push(INDEPENDENT)

  const scaleMax = Math.max(0, ...parties.map((p) => sums.get(p)!.support + sums.get(p)!.oppose))
  const part = (dollars: number, stateDollars: number): AlignedPart => ({
    dollars,
    widthPct: scaleMax > 0 ? (dollars / scaleMax) * 100 : 0,
    stateDollars,
    statePct: dollars > 0 ? (stateDollars / dollars) * 100 : 0,
  })
  const groups = parties.map((party): PartyAligned => {
    const s = sums.get(party)!
    return {
      party,
      label: PARTY_DISPLAY[party].label,
      color: PARTY_DISPLAY[party].color,
      tint: PARTY_DISPLAY[party].tint,
      races: s.races,
      supporting: part(s.support, s.stateSupport),
      opposing: part(s.oppose, s.stateOppose),
      total: s.support + s.oppose,
      stateTotal: s.stateSupport + s.stateOppose,
    }
  })
  return { groups, scaleMax, includedRaces: included, excludedRaces: excluded, stateCode }
}
