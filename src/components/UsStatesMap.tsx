import usStatesData from '../../data/us-states.json'

interface StateFeature {
  fips: string
  usps: string
  name: string
  d: string
}

const { viewBox, states } = usStatesData as { viewBox: string; states: StateFeature[] }

interface UsStatesMapProps {
  selected: string | null
  onSelect: (usps: string) => void
}

export default function UsStatesMap({ selected, onSelect }: UsStatesMapProps) {
  return (
    <svg
      viewBox={viewBox}
      role="group"
      aria-label="Map of U.S. states"
      style={{ width: '100%', height: '100%' }}
    >
      {states.map((state) => {
        const isSelected = state.usps === selected
        return (
          <path
            key={state.fips}
            d={state.d}
            role="button"
            tabIndex={0}
            aria-label={state.name}
            aria-pressed={isSelected}
            onClick={() => onSelect(state.usps)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(state.usps)
              }
            }}
            fill="var(--color-rule)"
            stroke={isSelected ? 'var(--color-brass)' : 'var(--color-ground)'}
            strokeWidth={isSelected ? 2 : 0.5}
          />
        )
      })}
    </svg>
  )
}
