import type { Callout } from '../computeCallout'
import { PARTY_DISPLAY } from '../computeSpending'
import type { ResultStage } from '../results'
import type { Party } from '../types'

/**
 * One mark per race, read from the race's single status:
 * - win:       solid party color and the state code
 * - flip:      the party color with a 2px dashed border and the state code
 * The checkmark is never on the map: it sits only in the callout, inside the winner's color square.
 * - reporting: off-white, no party color, the state code
 * - none:      no chip; the race keeps its forecast circle
 */
export type MarkKind = 'circle' | 'win' | 'flip' | 'reporting'

export interface StateMark {
  state: string
  x: number
  y: number
  kind: MarkKind
  /** Fill color: the winner's party token for win and flip, the favored party's for the forecast circle. Null for reporting. */
  color: string | null
  /** Standard two-letter state code, shown inside a result chip. Null for the forecast circle. */
  code: string | null
  /** "[State name]: [party], [status]." e.g. "Texas: Democratic, Flip." */
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
    stage: ResultStage
    winnerParty: Party | null
  }
}

const STATUS_WORD: Record<'win' | 'flip' | 'reporting', string> = { win: 'Win', flip: 'Flip', reporting: 'Reporting' }

export function buildStateMarks(
  races: MarkRaceInput[],
  labelPoint: (state: string) => [number, number] | undefined,
  viewBox: [number, number, number, number],
): StateMark[] {
  const [vx, vy, vw, vh] = viewBox
  return races.flatMap((race): StateMark[] => {
    const point = labelPoint(race.state)
    if (!point) return []
    const base = { state: race.state, x: (point[0] - vx) / vw, y: (point[1] - vy) / vh, nudgePx: MARK_NUDGE_PX[race.state] ?? 0 }
    const { stage, winnerParty } = race.result

    if (stage === 'reporting') {
      return [{ ...base, kind: 'reporting', color: null, code: race.state, ariaLabel: `${race.stateName}: ${STATUS_WORD.reporting}.` }]
    }
    if ((stage === 'win' || stage === 'flip') && winnerParty) {
      return [{
        ...base,
        kind: stage,
        color: PARTY_DISPLAY[winnerParty].color,
        code: race.state,
        ariaLabel: `${race.stateName}: ${PARTY_DISPLAY[winnerParty].label}, ${STATUS_WORD[stage]}.`,
      }]
    }
    if (race.favoredParty === null) return []
    return [{
      ...base,
      kind: 'circle',
      color: PARTY_DISPLAY[race.favoredParty].color,
      code: null,
      ariaLabel: `${race.stateName}: forecast favors ${PARTY_DISPLAY[race.favoredParty].label}.`,
    }]
  })
}

/** A result chip, or the plain forecast chip when the race has no status. Not focusable: the state shape underneath
 * handles selection. It is announced with its own label, "[State name]: [party], [status]." */
export default function StateMarks({ marks }: { marks: StateMark[] }) {
  return (
    <>
      {marks.map((m) => (
        <span
          key={m.state}
          className={m.kind === 'circle' ? 'state-chip' : `state-chip state-chip-result state-chip-${m.kind}`}
          style={{ left: `${m.x * 100}%`, top: `calc(${m.y * 100}% + ${m.nudgePx}px)`, ...(m.color ? { background: m.color } : {}) }}
          role="img"
          aria-label={m.ariaLabel}
        >
          {m.code}
        </span>
      ))}
    </>
  )
}

/** The black checkmark inside the winner's color square in the callout, for Win and Flip. Black, not a party color, so it adds no second party signal. */
export function CheckIcon({ size = 8 }: { size?: number }) {
  return (
    <svg className="chip-check" width={size} height={size} viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <path d="M1 4.2 3.1 6.3 7 1.7" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Builds the mark input straight from the callouts the page already computed, so nothing here re-derives the forecast. */
export function marksFromCallouts(callouts: Map<string, Callout>, stateName: (state: string) => string): MarkRaceInput[] {
  return [...callouts.entries()].map(([state, callout]) => {
    const favoredSide = callout.sides
      .filter((s) => s.winPct !== null && (s.party === 'D' || s.party === 'R'))
      .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))[0]
    return {
      state,
      stateName: stateName(state),
      favoredParty: favoredSide ? favoredSide.party : null,
      result: { stage: callout.result.stage, winnerParty: callout.result.winnerParty },
    }
  })
}
