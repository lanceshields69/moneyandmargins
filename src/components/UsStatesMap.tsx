import usStatesData from '../../data/us-states.json'
import { DATA_VERIFIED } from '../config'
import { fillFraction, type RaceView } from '../computeSpending'
import { formatMoney } from '../format'

interface StateFeature {
  fips: string
  usps: string
  name: string
  d: string
}

const { viewBox, states } = usStatesData as { viewBox: string; states: StateFeature[] }

// Spend ramp from the project palette: indigo, purple, pink, then a lighter pink shade for the highest totals.
// Never party colors: the fill combines both sides. Teal (--color-focus) is reserved for selection and focus.
const RAMP_STOPS: { at: number; rgb: [number, number, number] }[] = [
  { at: 0, rgb: [0x3a, 0x33, 0x6a] },
  { at: 0.4, rgb: [0x8a, 0x27, 0x8d] },
  { at: 0.8, rgb: [0xf0, 0x02, 0x8d] },
  { at: 1, rgb: [0xff, 0x96, 0xcd] },
]

export function rampColor(fraction: number): string {
  const f = Math.min(Math.max(fraction, 0), 1)
  const upper = RAMP_STOPS.findIndex((stop) => stop.at >= f)
  const hi = RAMP_STOPS[Math.max(upper, 1)]
  const lo = RAMP_STOPS[Math.max(upper, 1) - 1]
  const t = (f - lo.at) / (hi.at - lo.at)
  const [r, g, b] = lo.rgb.map((low, i) => Math.round(low + (hi.rgb[i] - low) * t))
  return `rgb(${r}, ${g}, ${b})`
}

/** One color for every state with a race while the spending amounts are being verified. */
const NEUTRAL_FILL = rampColor(0.3)

interface UsStatesMapProps {
  raceByState: Map<string, RaceView>
  maxTotal: number
  selected: string | null
  onSelect: (usps: string) => void
  onFocusState: (usps: string) => void
  /** Whether the spending ramp may color the states. Off: one neutral fill for every state with a race. */
  fillVerified?: boolean
}

export default function UsStatesMap({ raceByState, maxTotal, selected, onSelect, onFocusState, fillVerified = DATA_VERIFIED }: UsStatesMapProps) {
  // Selected state is drawn last so its teal outline is not covered by neighbors.
  const ordered = [...states].sort((a, b) => Number(a.usps === selected) - Number(b.usps === selected))

  return (
    <svg viewBox={viewBox} role="group" aria-label="Map of U.S. states with 2026 Senate races" className="map">
      <defs>
        <pattern id="incomplete-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-ground)" strokeWidth="2" />
        </pattern>
      </defs>
      {ordered.map((state) => {
        const race = raceByState.get(state.usps)
        if (!race) {
          return <path key={state.fips} d={state.d} className="state state-none" aria-hidden="true" />
        }
        const isSelected = state.usps === selected
        const fill = !fillVerified ? NEUTRAL_FILL : race.total === null ? 'var(--color-rule)' : rampColor(fillFraction(race.total, maxTotal))
        const incompleteNote = race.incompleteCount > 0 ? ', some nominees have incomplete data' : ''
        const summary =
          !fillVerified
            ? `2026 Senate race${incompleteNote}`
            : race.total === null
              ? 'Incomplete data'
              : `total independent expenditures ${formatMoney(race.total)}${incompleteNote}`
        return (
          <g key={state.fips}>
          <path
            d={state.d}
            className={isSelected ? 'state state-race state-selected' : 'state state-race'}
            role="button"
            tabIndex={0}
            aria-label={`${state.name}${race.isSpecial ? ' special election' : ''}, ${summary}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(state.usps)}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) onFocusState(state.usps)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(state.usps)
              }
            }}
            fill={fill}
          />
          {race.incompleteCount > 0 && (
            <path d={state.d} fill="url(#incomplete-hatch)" className="state-hatch" aria-hidden="true" />
          )}
          </g>
        )
      })}
    </svg>
  )
}
