import { useCallback, useEffect, useMemo, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import MapCallout from './components/MapCallout'
import NationalCard from './components/NationalCard'
import RacePanel from './components/RacePanel'
import ContactFooter from './components/ContactFooter'
import ShareMenu from './components/ShareMenu'
import UsStatesMap, { rampColor } from './components/UsStatesMap'
import { buildNationalCard } from './computeNational'
import { allRaces, callouts, forecastSnapshot, labelPoints, mapViewBox, stateNames } from './data'
import logo from '../images/logo.png'
import { formatDate, formatMoney, formatMonthDay } from './format'
import { initialSelection, parseHashState } from './defaultState'
import { usePhone } from './usePhone'

export default function App() {
  const raceByState = useMemo(() => new Map(allRaces.races.map((r) => [r.state, r])), [])
  const validStates = useMemo(() => new Set(raceByState.keys()), [raceByState])
  const sortedRaces = useMemo(() => [...allRaces.races].sort((a, b) => a.raceName.localeCompare(b.raceName)), [])
  const [initial] = useState(() =>
    initialSelection({ hash: window.location.hash, isMobile: window.matchMedia('(max-width: 600px)').matches, races: allRaces.races }),
  )
  const [active, setActive] = useState<string | null>(initial.state)
  const [isDefault, setIsDefault] = useState(initial.isDefault)

  // Any choice by the visitor replaces the rule's pick. Focus is never moved here.
  const choose = useCallback((state: string | null) => {
    setActive(state)
    setIsDefault(false)
    const url = new URL(window.location.href)
    url.hash = state ?? ''
    window.history.replaceState(null, '', state ? url : url.pathname + url.search)
  }, [])
  const close = useCallback(() => choose(null), [choose])
  const phone = usePhone()

  useEffect(() => {
    const onHashChange = () => {
      const fromHash = parseHashState(window.location.hash, validStates)
      if (fromHash) {
        setActive(fromHash)
        setIsDefault(false)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [validStates])

  const callout = active ? callouts.get(active) : undefined
  const race = active ? (raceByState.get(active) ?? null) : null
  const national = useMemo(() => buildNationalCard(allRaces.races, active), [active])
  const point = active ? labelPoints.get(active) : undefined
  const [vx, vy, vw, vh] = mapViewBox
  const anchor = point ? { x: (point[0] - vx) / vw, y: (point[1] - vy) / vh } : null
  const snapshotHost = new URL(forecastSnapshot.sourceUrl).host

  return (
    <div className="page">
      <a className="skip" href="#map">
        Skip to map
      </a>
      {!phone && (
        <a className="skip skip-second" href="#race-details">
          Skip to race details
        </a>
      )}
      <header className="header">
        <ShareMenu />
        <h1>
          <img className="logo" src={logo} alt="Money & Margins" width={399} height={59} />
        </h1>
        <p className="muted">The ads are everywhere. The receipts are here.</p>
      </header>

      <main className="layout">
        <div className="map-column">
          <div className="map-top">
          <label className="jump">
            <span>Jump to a race</span>
            <select value={active ?? ''} onChange={(e) => choose(e.target.value || null)}>
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
            <NationalCard card={national} stateName={active ? (stateNames.get(active) ?? active) : null} fetchedAt={allRaces.fetchedAt} />
          </div>

        <div className="map-wrap" id="map">
          <UsStatesMap
            raceByState={raceByState}
            maxTotal={allRaces.maxTotal}
            selected={active}
            onSelect={choose}
            onFocusState={choose}
          />
          {callout && anchor && active && (
            <ErrorBoundary key={active}>
              <MapCallout callout={callout} stateName={stateNames.get(active) ?? active} anchor={anchor} isDefault={isDefault}
                detail={phone ? <RacePanel race={race} fetchedAt={allRaces.fetchedAt} /> : undefined}
                onClose={close}
              />
            </ErrorBoundary>
          )}
          <div className="legend" role="group" aria-label="Map legend">
            <p className="legend-title">Total dollars, not per voter</p>
            <div
              className="ramp"
              style={{ background: `linear-gradient(to right, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(rampColor).join(', ')})` }}
              role="img"
              aria-label="Color scale from low to high total independent expenditures"
            />
            <div className="ramp-labels muted">
              <span>$0</span>
              <span>{formatMoney(allRaces.maxTotal)}</span>
            </div>
          </div>
        </div>

        {!active && <p className="map-hint muted">Tap a highlighted state to see its race.</p>}

        <div className="map-notes muted">
          <p>
            Support plus oppose, all candidates in the race. Color scale is square root. Dark states have no 2026 Senate
            race. FEC processed data as of {formatDate(allRaces.fetchedAt)}.
          </p>
          <p className="legend-hatch">
            <svg width="18" height="12" aria-hidden="true">
              <rect width="18" height="12" fill={rampColor(0.6)} />
              <rect width="18" height="12" fill="url(#incomplete-hatch)" />
            </svg>
            Hatched: at least one nominee has incomplete data, so the total may be low.
          </p>
          <p>
            Predicted to win:{' '}
            <a href={forecastSnapshot.sourceUrl} target="_blank" rel="noopener">
              {forecastSnapshot.sourceName}
            </a>{' '}
            forecast, frozen {formatMonthDay(forecastSnapshot.fetchedAt)}.
          </p>
        </div>
        </div>

        {!phone && (
          <aside className="panel-column">
            <RacePanel race={race} fetchedAt={allRaces.fetchedAt} />
          </aside>
        )}
      </main>

      <footer className="footer muted">
        <div className="footer-grid">
          <div className="footer-notes">
            <p>
              <strong>Early version.</strong> This map shows independent expenditures that outside groups reported to the
              FEC for 2026 Senate races, placed in the candidate&apos;s state. It does not show candidate committee or
              party-coordinated spending, donors, or where ads ran.
            </p>
            <p>
              <strong>Supporting and opposing.</strong> Outside groups report each independent expenditure to the FEC as
              supporting or opposing a named candidate. Supporting means spending to elect that candidate. Opposing means
              spending to defeat them. The groups choose the label. The two amounts are shown as reported and are never
              subtracted from each other, and opposing one candidate is not counted as supporting another.
            </p>
            <p>
              <strong>Predicted to win:</strong> each nominee&apos;s chance of winning in {forecastSnapshot.sourceName}&apos;s
              forecast (
              <a href={forecastSnapshot.sourceUrl} target="_blank" rel="noreferrer">
                {snapshotHost}
              </a>
              ), frozen {formatDate(forecastSnapshot.fetchedAt)}. A 55% chance is not a prediction that someone will win.{' '}
              <strong>Spent on ads:</strong> each party&apos;s share of independent expenditures reported to the FEC in the
              2026 cycle that support its nominee or oppose the other nominee. Includes primary-season spending and
              excludes candidate and party-coordinated spending. Processed FEC data as of {formatDate(allRaces.fetchedAt)};
              recent 24- and 48-hour reports may not be included.
            </p>
            <p>
              Official voting information:{' '}
              <a href="https://vote.gov" target="_blank" rel="noreferrer">
                vote.gov
              </a>
            </p>
          </div>
          <section className="faq" aria-labelledby="faq-heading">
            <h2 id="faq-heading">FAQs</h2>
            <h3>Why did you build this?</h3>
            <p>
              Election ads are everywhere, but the records of who pays for them are hard to read, so I built a place to
              look up any Senate race and check the sources yourself.
            </p>
            <h3>Is this data biased toward either party?</h3>
            <p>
              Every candidate gets the same calculations and labels whatever their party, but the map shows only
              independent expenditures reported to the FEC, so it can’t capture all spending for either side.
            </p>
            <h3>How fresh is this data?</h3>
            <p>
              It updates twice a day from the FEC’s processed records, and each page shows its last update time, so
              very recent filings may not appear yet.
            </p>
            <h3>Who made this?</h3>
            <p>
              I’m Lance Shields, a product design director in Los Angeles with more than 20 years of experience, and I
              built this on my own with Claude Code.{' '}
              <a href="https://www.lanceshields.design/" target="_blank" rel="noreferrer">
                See my work &gt;
              </a>
            </p>
          </section>
          <div className="footer-meta">
            <ContactFooter />
            <p>
              © 2026{' '}
              <a href="https://www.lanceshields.design/" target="_blank" rel="noreferrer">
                Lance Shields
              </a>
              . All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
