import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ShareCard from './components/ShareCard'
import { buildNationalCard } from './computeNational'
import { allRaces, callouts, forecastSnapshot, stateBoxes, statePaths } from './data'
import { formatDateOnly } from './format'
import './tokens.css'

const state = (new URLSearchParams(window.location.search).get('state') ?? '').toUpperCase()
const callout = callouts.get(state)
const dataAsOf = allRaces.latestDissemination ? formatDateOnly(`${allRaces.latestDissemination}T00:00:00Z`) : 'unknown'
const forecastHost = new URL(forecastSnapshot.sourceUrl).host.replace(/^www\./, '')

function Embed() {
  if (!callout) return <p style={{ color: '#eae8e2', fontFamily: 'system-ui, sans-serif' }}>No 2026 Senate race for this state.</p>
  return (
    <div style={{ width: '100%', maxWidth: 1200, aspectRatio: '1200 / 630' }}>
      <ShareCard
        stateName={callout.raceName.replace(/ Senate 2026$/, '')}
        callout={callout}
        national={buildNationalCard(allRaces.races, state)}
        shapePath={statePaths.get(state) ?? ''}
        shapeBox={stateBoxes.get(state) ?? '0 0 1 1'}
        dataAsOf={dataAsOf}
        forecastHost={forecastHost}
        onUseOnSite={() => window.open(`${window.location.origin}/embed`, '_blank', 'noopener')}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Embed />
  </StrictMode>,
)
