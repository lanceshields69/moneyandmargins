// The chamber at a glance, from the same civicAPI statuses as the map: seats each party has won or flipped, the
// seats still undecided, and the 65 seats not up in 2026. Pure and party-blind: the two parties go through the same
// loop and the same table, and nothing here reads who is ahead except the final headline, which asks one question
// of each party in turn.
import type { Callout } from './computeCallout'
import type { Party } from './types'

export interface SenateBaseline {
  /** Seats not up in 2026 that sit with the Democratic caucus (independents who caucus with it included). */
  notUpDemocraticCaucus: number
  notUpRepublican: number
}

export type SenateSegmentKey = 'dHeld' | 'dFlips' | 'undecided' | 'rFlips' | 'rHeld'

export interface SenateSegment {
  key: SenateSegmentKey
  seats: number
  /** The party whose color the segment takes. Null for undecided. */
  party: 'D' | 'R' | null
  /** A flip: seats that changed hands. */
  hatched: boolean
}

export interface SenateTally {
  /** Left to right: a party's held seats, its flips, the undecided seats, then the other party's flips and held seats. */
  segments: SenateSegment[]
  seats: Record<'D' | 'R', number>
  undecided: number
  headline: string
}

const PARTIES = ['D', 'R'] as const
const PLURAL: Record<'D' | 'R', string> = { D: 'Democrats', R: 'Republicans' }
/** A majority of the 100 seats. */
export const SENATE_MAJORITY = 51
export const SENATE_SEATS = 100

/**
 * Held = the seats not up plus races civicAPI shows as a Win for that party; flips = races it shows as a Flip to
 * that party. Every other race (Reporting, or no status, or a winner from neither major party) stays undecided,
 * so the five segments always total 100.
 */
export function buildSenateTally(callouts: ReadonlyMap<string, Callout>, baseline: SenateBaseline): SenateTally {
  const held: Record<'D' | 'R', number> = { D: baseline.notUpDemocraticCaucus, R: baseline.notUpRepublican }
  const flips: Record<'D' | 'R', number> = { D: 0, R: 0 }
  for (const { result } of callouts.values()) {
    const winner: Party | null = result.winnerParty
    if (winner !== 'D' && winner !== 'R') continue
    if (result.stage === 'win') held[winner] += 1
    else if (result.stage === 'flip') flips[winner] += 1
  }
  const seats = { D: held.D + flips.D, R: held.R + flips.R }
  const undecided = SENATE_SEATS - seats.D - seats.R

  const segment = (party: 'D' | 'R', hatched: boolean): SenateSegment => ({
    key: `${party.toLowerCase()}${hatched ? 'Flips' : 'Held'}` as SenateSegmentKey,
    seats: hatched ? flips[party] : held[party],
    party,
    hatched,
  })
  const segments: SenateSegment[] = [
    segment('D', false),
    segment('D', true),
    { key: 'undecided', seats: undecided, party: null, hatched: false },
    segment('R', true),
    segment('R', false),
  ]
  const majority = PARTIES.find((p) => seats[p] >= SENATE_MAJORITY)
  return { segments, seats, undecided, headline: majority ? `${PLURAL[majority]} win the Senate.` : 'Senate control is undecided.' }
}
