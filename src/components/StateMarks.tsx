import type { Callout } from '../computeCallout'
import { PARTY_DISPLAY } from '../computeSpending'
import type { Party } from '../types'

export type MarkKind = 'circle' | 'ring' | 'square'

export interface StateMark {
  state: string
  x: number
  y: number
  kind: MarkKind
  /** Fill color: the favored party's token for a circle, the leader's for a square. Null for the neutral ring. */
  color: string | null
  /** The party letter shown in a square mark. Null for circle and ring. */
  letter: Party | null
  /** Dashed at Unofficial, solid at Certified. Null everywhere else. */
  outline: 'dashed' | 'solid' | null
  /** e.g. "Texas: Republican, unofficial, 52 percent." */
  ariaLabel: string
  /** Extra downward offset in px, for a label point too close to the state's top edge. */
  nudgePx: number
}

/** Marks moved down by hand, in px, where the state's label point sits too close to its top edge. */
export const MARK_NUDGE_PX: Record<string, number> = { MT: 14, ME: 14 }

export interface MarkRaceInput {
  state: string
  stateName: string
  /** Set only for a two-major-party forecast (NE, ID, SD and any no-forecast race pass null). */
  favoredParty: Party | null
  result: {
    stage: 'not-added' | 'counting' | 'unofficial' | 'certified'
    percentReporting: number | null
    leadingParty: Party | null
  }
}

/** One mark per race: a square once there is a result past counting, a ring while counting, else a forecast circle. */
export function buildStateMarks(
  races: MarkRaceInput[],
  labelPoint: (state: string) => [number, number] | undefined,
  viewBox: [number, number, number, number],
): StateMark[] {
  const [vx, vy, vw, vh] = viewBox
  return races.flatMap((race): StateMark[] => {
    const point = labelPoint(race.state)
    if (!point) return []
    const x = (point[0] - vx) / vw
    const y = (point[1] - vy) / vh
    const nudgePx = MARK_NUDGE_PX[race.state] ?? 0

    if (race.result.stage === 'counting') {
      const pct = race.result.percentReporting
      return [{
        state: race.state,
        x,
        y,
        nudgePx,
        kind: 'ring' as const,
        color: null,
        letter: null,
        outline: null,
        ariaLabel: `${race.stateName}: counting${pct !== null ? `, ${pct} percent reporting` : ''}.`,
      }]
    }
    if (race.result.stage === 'unofficial' || race.result.stage === 'certified') {
      if (!race.result.leadingParty) return []
      const pct = race.result.percentReporting
      return [{
        state: race.state,
        x,
        y,
        nudgePx,
        kind: 'square' as const,
        color: PARTY_DISPLAY[race.result.leadingParty].color,
        letter: race.result.leadingParty,
        outline: race.result.stage === 'unofficial' ? ('dashed' as const) : ('solid' as const),
        ariaLabel: `${race.stateName}: ${PARTY_DISPLAY[race.result.leadingParty].label}, ${race.result.stage}${pct !== null ? `, ${pct} percent` : ''}.`,
      }]
    }
    if (race.favoredParty === null) return []
    return [{
      state: race.state,
      x,
      y,
      nudgePx,
      kind: 'circle' as const,
      color: PARTY_DISPLAY[race.favoredParty].color,
      letter: null,
      outline: null,
      ariaLabel: `${race.stateName}: forecast favors ${PARTY_DISPLAY[race.favoredParty].label}.`,
    }]
  })
}

/** Keyboard-focusable marks on the map, with a visible focus ring and an aria-label. They do not react to clicks;
 * the state shape underneath still handles selection. */
export default function StateMarks({ marks }: { marks: StateMark[] }) {
  return (
    <>
      {marks.map((m) => (
        <span
          key={m.state}
          className={`state-mark state-mark-${m.kind}${m.outline ? ` state-mark-${m.outline}` : ''}`}
          style={{ left: `${m.x * 100}%`, top: `calc(${m.y * 100}% + ${m.nudgePx}px)`, ...(m.color ? { background: m.kind === 'ring' ? 'transparent' : m.color, borderColor: m.color } : {}) }}
          role="img"
          aria-label={m.ariaLabel}
          tabIndex={0}
        >
          {m.letter}
        </span>
      ))}
    </>
  )
}

/** Builds the mark input straight from the callouts the page already computed, so nothing here re-derives the forecast. */
export function marksFromCallouts(callouts: Map<string, Callout>, stateName: (state: string) => string): MarkRaceInput[] {
  return [...callouts.entries()].map(([state, callout]) => {
    const favoredSide = callout.sides
      .filter((s) => s.winPct !== null && (s.party === 'D' || s.party === 'R'))
      .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))[0]
    const leadingSide = callout.sides.find((s) => s.candidateId === callout.result.leadingCandidateId)
    return {
      state,
      stateName: stateName(state),
      favoredParty: favoredSide ? favoredSide.party : null,
      result: {
        stage: callout.result.stage,
        percentReporting: callout.result.percentReporting,
        leadingParty: leadingSide ? leadingSide.party : null,
      },
    }
  })
}
