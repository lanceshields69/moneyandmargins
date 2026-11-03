import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import MapCallout from './components/MapCallout'
import MethodologyModal from './components/MethodologyModal'
import MarkLegend from './components/MarkLegend'
import StateMarks, { buildStateMarks, marksFromCallouts } from './components/StateMarks'
import NationalCard from './components/NationalCard'
import RacePanel from './components/RacePanel'
import ContactFooter from './components/ContactFooter'
import PreviewBadge from './components/PreviewBadge'
import infoIcon from './assets/info.svg'
import Vote411Banner from './components/Vote411Banner'
import ShareMenu from './components/ShareMenu'
import UsStatesMap, { rampColor } from './components/UsStatesMap'
import { buildNationalCard } from './computeNational'
import { allRaces, callouts, forecastSnapshot, labelPoints, mapViewBox, seatForecastSources, stateNames } from './data'
import SeatForecastCarousel from './components/SeatForecastCarousel'
import logo from '../images/logo.png'
import { DATA_VERIFIED, SHARES_VERIFIED } from './config'
import { DATA_CHECK_NOTICE, FINAL_FORECAST_TAG, forecastPhrase } from './copy'
import corrections from '../data/corrections.json'
import { correctionsBlocks, isCorrectionsHash, type CorrectionEntry } from './corrections'
import { formatDate, formatDateOnly, formatMoney, formatMonthDay } from './format'
import { initialSelection, parseHashState } from './defaultState'
import verification from '../data/verification.json'
import { doubleCountSentence, fillMethodology, incompleteRacesSentence, isHowHash, methodologySource, parseMethodology } from './methodology'
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
  const [howOpen, setHowOpen] = useState(() => isHowHash(window.location.hash))
  const [corrOpen, setCorrOpen] = useState(() => isCorrectionsHash(window.location.hash))
  // An embedded card's "Use this on your site?" link sends visitors here with ?share=1, asking the race's own
  // share and embed panel to open right away instead of making them find it themselves.
  const [shareRequested] = useState(() => new URLSearchParams(window.location.search).get('share') === '1')
  // Sizes the forecast carousel to match the race panel's own height; the panel's content (and so its height)
  // changes with the selected race, and the panel only exists on desktop (phones use the bottom sheet instead).
  const panelColumnRef = useRef<HTMLElement>(null)
  const [panelHeight, setPanelHeight] = useState<number | null>(null)
  const mapTopRef = useRef<HTMLDivElement>(null)
  const [carouselAvailableWidth, setCarouselAvailableWidth] = useState<number | null>(null)
  useEffect(() => {
    if (!shareRequested) return
    const url = new URL(window.location.href)
    url.searchParams.delete('share')
    window.history.replaceState(null, '', url.hash ? url : url.pathname + url.search)
  }, [shareRequested])
  const openCorr = useCallback(() => {
    setCorrOpen(true)
    const url = new URL(window.location.href)
    url.hash = 'corrections'
    window.history.replaceState(null, '', url)
  }, [])
  const openHow = useCallback(() => {
    setHowOpen(true)
    const url = new URL(window.location.href)
    url.hash = 'how-it-works'
    window.history.replaceState(null, '', url)
  }, [])

  // Any choice by the visitor replaces the rule's pick. Focus is never moved here.
  const choose = useCallback((state: string | null) => {
    setActive(state)
    setIsDefault(false)
    const url = new URL(window.location.href)
    url.hash = state ?? ''
    window.history.replaceState(null, '', state ? url : url.pathname + url.search)
  }, [])
  const close = useCallback(() => choose(null), [choose])
  const closeCorr = useCallback(() => {
    setCorrOpen(false)
    const url = new URL(window.location.href)
    url.hash = active ?? ''
    window.history.replaceState(null, '', active ? url : url.pathname + url.search)
  }, [active])
  const closeHow = useCallback(() => {
    setHowOpen(false)
    const url = new URL(window.location.href)
    url.hash = active ?? ''
    window.history.replaceState(null, '', active ? url : url.pathname + url.search)
  }, [active])
  const phone = usePhone()

  useEffect(() => {
    const el = panelColumnRef.current
    if (!el || typeof ResizeObserver === 'undefined') {
      setPanelHeight(null)
      return
    }
    const observer = new ResizeObserver((entries) => setPanelHeight(entries[0].contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [phone])

  // The carousel's own CSS can't be told "as tall as the panel, but never wider than the row has room for": a
  // non-replaced box with an explicit height and a max-width either overflows or lets a mismatched max-height
  // sit unused, since nothing shrinks the explicit height back down when width is the binding constraint. So the
  // available width (the row's width, minus the dropdown) is measured here and the final box is sized in JS.
  useEffect(() => {
    const row = mapTopRef.current
    if (!row || typeof ResizeObserver === 'undefined') {
      setCarouselAvailableWidth(null)
      return
    }
    const measure = () => {
      const jump = row.querySelector<HTMLElement>('.jump')
      const gap = parseFloat(getComputedStyle(row).columnGap || '0') || 0
      const jumpWidth = jump?.getBoundingClientRect().width ?? 0
      setCarouselAvailableWidth(Math.max(0, row.clientWidth - jumpWidth - gap))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    measure()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      if (isHowHash(window.location.hash)) setHowOpen(true)
      if (isCorrectionsHash(window.location.hash)) setCorrOpen(true)
      const fromHash = parseHashState(window.location.hash, validStates)
      if (fromHash) {
        setActive(fromHash)
        setIsDefault(false)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [validStates])

  const stateMarks = useMemo(
    () => buildStateMarks(marksFromCallouts(callouts, (st) => stateNames.get(st) ?? st), (st) => labelPoints.get(st), mapViewBox),
    [],
  )
  const callout = active ? callouts.get(active) : undefined
  const race = active ? (raceByState.get(active) ?? null) : null
  const national = useMemo(() => buildNationalCard(allRaces.races, active), [active])
  // Figma node 77:1812's card is 664x511; keep this ratio in sync with SeatForecastCarousel's own SVG viewBox.
  const carouselSize = useMemo(() => {
    if (!panelHeight) return null
    const ratio = 664 / 511
    const width = carouselAvailableWidth ? Math.min(panelHeight * ratio, carouselAvailableWidth) : panelHeight * ratio
    return { width, height: width / ratio }
  }, [panelHeight, carouselAvailableWidth])
  const point = active ? labelPoints.get(active) : undefined
  const [vx, vy, vw, vh] = mapViewBox
  const anchor = point ? { x: (point[0] - vx) / vw, y: (point[1] - vy) / vh } : null
  const snapshotHost = new URL(forecastSnapshot.sourceUrl).host
  const dataThrough = allRaces.latestDissemination ? formatDateOnly(`${allRaces.latestDissemination}T00:00:00Z`) : undefined
  const correctionBlocks = useMemo(() => correctionsBlocks(corrections as CorrectionEntry[]), [])
  const methodologyBlocks = useMemo(
    () =>
      parseMethodology(
        fillMethodology(methodologySource(DATA_VERIFIED), {
          updated: allRaces.fetchedAt,
          forecastFrozen: forecastSnapshot.fetchedAt,
          forecastFinal: forecastSnapshot.tag === FINAL_FORECAST_TAG,
          latestFiling: allRaces.latestDissemination,
          unattributedTotal: allRaces.unattributedTotal,
          approxCommitteeCount: allRaces.approxCommitteeCount,
          approxTotal: allRaces.approxTotal,
          doubleCountSentence: doubleCountSentence(verification),
          incompleteRacesSentence: incompleteRacesSentence(allRaces.races.filter((r) => r.incompleteCount > 0).map((r) => stateNames.get(r.state) ?? r.state)),
        }),
      ),
    [],
  )

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
        <div className="header-actions">
          <a className="header-link" href="/claude-on-building-an-election-map">Claude on building this map</a>
          <button type="button" className="how-button" onClick={openHow}>
            <img src={infoIcon} alt="" width={24} height={24} />
            <span className="how-button-label">How this map works</span>
          </button>
          <ShareMenu />
        </div>
        <h1>
          <img className="logo" src={logo} alt="Money & Margins" width={399} height={59} />
        </h1>
        <p className="muted">The ads are everywhere. The receipts are here.</p>
        {!DATA_VERIFIED && <p className="data-check">{DATA_CHECK_NOTICE}</p>}
      </header>

      <main className="layout">
        <div className="map-column">
          <div className="map-top" ref={mapTopRef}>
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
            {seatForecastSources.length > 0 && <SeatForecastCarousel sources={seatForecastSources} sizePx={carouselSize} />}
            {SHARES_VERIFIED && <NationalCard card={national} stateName={active ? (stateNames.get(active) ?? active) : null} />}
          </div>

        <div className="map-wrap" id="map">
          <StateMarks marks={stateMarks} />
          <UsStatesMap
            raceByState={raceByState}
            maxTotal={allRaces.maxTotal}
            selected={active}
            onSelect={choose}
            onFocusState={choose}
            fillVerified={DATA_VERIFIED}
          />
          {callout && anchor && active && (
            <ErrorBoundary key={active}>
              <MapCallout sharesVerified={SHARES_VERIFIED} onOpenHow={openHow} callout={callout} stateName={stateNames.get(active) ?? active} anchor={anchor} isDefault={isDefault}
                initialExpanded={shareRequested}
                detail={phone ? <RacePanel race={race} fetchedAt={allRaces.fetchedAt} dataThrough={dataThrough} dataVerified={DATA_VERIFIED} onOpenHow={openHow} autoOpenShare={shareRequested} /> : undefined}
                onClose={close}
              />
            </ErrorBoundary>
          )}
          <div className="legend" role="group" aria-label="Map legend">
            {DATA_VERIFIED ? (
              <>
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
              </>
            ) : (
              <p className="legend-title legend-neutral">
                <svg width="18" height="12" aria-hidden="true">
                  <rect width="18" height="12" fill={rampColor(0.3)} />
                </svg>
                State with a 2026 Senate race
              </p>
            )}
            <p className="how-link">
              <button type="button" className="link-button" onClick={openHow}>
                How is this counted?
              </button>
            </p>
          </div>
          <MarkLegend />
        </div>

        {!active && <p className="map-hint muted">Tap a highlighted state to see its race.</p>}

        <div className="map-notes muted">
          <p>
            {DATA_VERIFIED
              ? 'Support plus oppose, all candidates in the race. Dark states have no 2026 Senate race.'
              : 'Dark states have no 2026 Senate race. Spending amounts are being verified.'}
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
            forecast, {forecastPhrase(forecastSnapshot.tag)} {formatMonthDay(forecastSnapshot.fetchedAt)}.
          </p>
        </div>
        <div className="vote411-wrap">
          <Vote411Banner />
        </div>
        </div>

        {!phone && (
          <aside className="panel-column" ref={panelColumnRef}>
            <RacePanel race={race} fetchedAt={allRaces.fetchedAt} dataThrough={dataThrough} dataVerified={DATA_VERIFIED} onOpenHow={openHow} autoOpenShare={shareRequested} />
          </aside>
        )}
      </main>

      <footer className="footer muted">
        <div className="footer-grid">
          <div className="footer-notes">
            <p>
              <strong className="footer-lead">Early version.</strong> This map shows outside groups’ independent spending reported to the FEC for
              2026 Senate races, placed in the candidate’s state.{' '}
              <button type="button" className="link-button" onClick={openHow}>
                How this works
              </button>{' '}
              explains what’s left out.
            </p>
            <p>
              <strong className="footer-lead">Supporting and opposing.</strong> Groups label each filing as supporting or opposing a candidate, and
              they choose the label. We show both and never subtract one from the other.
            </p>
            <p>
              <strong className="footer-lead">Predicted to win:</strong> {forecastSnapshot.sourceName} forecast (
              <a href={forecastSnapshot.sourceUrl} target="_blank" rel="noreferrer">
                {snapshotHost}
              </a>
              ), {forecastPhrase(forecastSnapshot.tag)} {formatDate(forecastSnapshot.fetchedAt)}. <strong>Spent on ads:</strong> each
              party&apos;s share of reported spending for its nominee or against the other.{' '}
              <button type="button" className="link-button" onClick={openHow}>
                How this is counted
              </button>
            </p>
            <p>
              Official voting information:{' '}
              <a href="https://vote.gov" target="_blank" rel="noreferrer">
                vote.gov
              </a>
            </p>
            <p>
              <a href="/claude-on-building-an-election-map">Claude on building this map</a>
              {' · '}
              <a href="/how-to-write-an-mvp-md">How to write an MVP.md</a>
            </p>
            <p>
              <button type="button" className="link-button" onClick={openHow}>
                How this map works
              </button>
            </p>
          </div>
          <section className="faq" aria-labelledby="faq-heading">
            <h2 id="faq-heading">FAQs</h2>
            <h3>Why did you build this?</h3>
            <p>
              Election ads are everywhere, but the records of who pays for them are hard to read, so I built a place to
              look up any Senate race and check the sources yourself.
             <a href="/claude-on-building-an-election-map">Read the longer story</a></p>
            <h3>Is this data biased toward either party?</h3>
            <p>
              Every candidate gets the same calculations and labels whatever their party, but the map shows only
              independent expenditures reported to the FEC, so it can’t capture all spending for either side.
            </p>
            <h3>How fresh is this data?</h3>
            <p>
              It refreshes every few hours from FEC filings, and each race panel shows the date of the latest filing in
              the data, so very recent filings may not appear yet.
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
            <ContactFooter onOpenCorrections={openCorr} />
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
      <PreviewBadge />
      {howOpen && <MethodologyModal blocks={methodologyBlocks} onClose={closeHow} />}
      {corrOpen && <MethodologyModal blocks={correctionBlocks} onClose={closeCorr} />}
    </div>
  )
}
