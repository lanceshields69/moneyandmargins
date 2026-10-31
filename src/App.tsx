import { useEffect, useMemo, useRef, useState } from 'react'
import UsStatesMap, { rampColor } from './components/UsStatesMap'
import RacePanel from './components/RacePanel'
import { allRaces } from './data'
import { formatDate, formatMoney } from './format'

function stateFromUrl(valid: Set<string>): string | null {
  const value = new URLSearchParams(window.location.search).get('state')?.toUpperCase() ?? null
  return value && valid.has(value) ? value : null
}

export default function App() {
  const raceByState = useMemo(() => new Map(allRaces.races.map((r) => [r.state, r])), [])
  const sortedRaces = useMemo(() => [...allRaces.races].sort((a, b) => a.raceName.localeCompare(b.raceName)), [])
  const [selected, setSelected] = useState<string | null>(() => stateFromUrl(new Set(raceByState.keys())))
  const announce = useRef<HTMLParagraphElement>(null)

  const race = selected ? (raceByState.get(selected) ?? null) : null

  useEffect(() => {
    const url = new URL(window.location.href)
    if (selected) url.searchParams.set('state', selected)
    else url.searchParams.delete('state')
    window.history.replaceState(null, '', url)
    if (announce.current) announce.current.textContent = race ? `${race.raceName} selected. Details are below the map.` : ''
  }, [selected, race])

  return (
    <div className="page">
      <a className="skip" href="#race-details">
        Skip to race details
      </a>
      <header className="header">
        <h1>Money &amp; Margins</h1>
        <p className="muted">
          Independent expenditures reported to the FEC in 2026 Senate races, by candidate state.
        </p>
      </header>

      <main className="layout">
        <div className="map-column">
          <label className="jump">
            <span>Jump to a race</span>
            <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value || null)}>
              <option value="">Choose a state</option>
              {sortedRaces.map((r) => (
                <option key={r.raceId} value={r.state}>
                  {r.raceName.replace(/ Senate( special election)? 2026$/, '')}
                  {r.isSpecial ? ' (special election)' : ''}
                  {r.incompleteCount > 0 ? ' (incomplete data)' : ''}
                </option>
              ))}
            </select>
          </label>

          <UsStatesMap
            raceByState={raceByState}
            maxTotal={allRaces.maxTotal}
            selected={selected}
            onSelect={setSelected}
          />

          <div className="legend" aria-label="Map legend">
            <p className="legend-title">Total dollars, not per voter</p>
            <div
              className="ramp"
              style={{ background: `linear-gradient(to right, ${rampColor(0)}, ${rampColor(0.5)}, ${rampColor(1)})` }}
              role="img"
              aria-label="Color scale from low to high total independent expenditures"
            />
            <div className="ramp-labels muted">
              <span>$0</span>
              <span>{formatMoney(allRaces.maxTotal)}</span>
            </div>
            <p className="muted legend-note">
              Support plus oppose, all candidates in the race. Color scale is square root. Dark states have no 2026
              Senate race. FEC processed data as of {formatDate(allRaces.fetchedAt)}.
            </p>
            <p className="legend-hatch muted">
              <svg width="18" height="12" aria-hidden="true">
                <rect width="18" height="12" fill={rampColor(0.5)} />
                <rect width="18" height="12" fill="url(#incomplete-hatch)" />
              </svg>
              Hatched: at least one nominee has incomplete data, so the total may be low.
            </p>
          </div>
        </div>

        <aside className="panel-column">
          <RacePanel race={race} fetchedAt={allRaces.fetchedAt} />
        </aside>
      </main>

      <p ref={announce} className="sr-only" aria-live="polite" />

      <footer className="footer muted">
        <p>
          <strong>Early version.</strong> This map shows independent expenditures that outside groups reported to the
          FEC for 2026 Senate races, placed in the candidate&apos;s state. It does not show candidate committee or
          party-coordinated spending, donors, or where ads ran.
        </p>
        <p>
          Official voting information:{' '}
          <a href="https://vote.gov" target="_blank" rel="noreferrer">
            vote.gov
          </a>
        </p>
      </footer>
    </div>
  )
}
