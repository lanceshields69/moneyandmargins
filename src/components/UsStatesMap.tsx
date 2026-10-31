import usStatesData from '../../data/us-states.json'
import { fillFraction, type RaceView } from '../computeSpending'
import { formatMoney } from '../format'

interface StateFeature {
  fips: string
  usps: string
  name: string
  d: string
}

const { viewBox, states } = usStatesData as { viewBox: string; states: StateFeature[] }

// Neutral grey to a muted brass. Pure brass (--color-brass) is reserved for selection and focus.
const RAMP_LOW: [number, number, number] = [0x4a, 0x49, 0x45]
const RAMP_HIGH: [number, number, number] = [0xb0, 0xa2, 0x6c]

export function rampColor(fraction: number): string {
  const [r, g, b] = RAMP_LOW.map((low, i) => Math.round(low + (RAMP_HIGH[i] - low) * fraction))
  return `rgb(${r}, ${g}, ${b})`
}

interface UsStatesMapProps {
  raceByState: Map<string, RaceView>
  maxTotal: number
  selected: string | null
  onSelect: (usps: string) => void
}

export default function UsStatesMap({ raceByState, maxTotal, selected, onSelect }: UsStatesMapProps) {
  // Selected state is drawn last so its brass outline is not covered by neighbors.
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
        const fill = race.total === null ? 'var(--color-rule)' : rampColor(fillFraction(race.total, maxTotal))
        const incompleteNote = race.incompleteCount > 0 ? ', some nominees have incomplete data' : ''
        const summary =
          race.total === null
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
