import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ShareCard from './components/ShareCard'
import { buildNationalCard } from './computeNational'
import { allRaces, callouts, stateBoxes, statePaths } from './data'
import type { Callout } from './computeCallout'

const render = (callout: Callout, state: string) =>
  renderToStaticMarkup(
    <ShareCard
      stateName="Texas"
      callout={callout}
      national={buildNationalCard(allRaces.races, state)}
      shapePath={statePaths.get(state) ?? ''}
      shapeBox={stateBoxes.get(state) ?? '0 0 1 1'}
      dataAsOf="Oct 31, 2026"
      forecastSource="VotePredictor, votepredictor.com"
    />,
  )

describe('the share card numbers', () => {
  it('shows the same spent-on-ads and predicted percentages as the map callout', () => {
    const callout = callouts.get('TX')!
    const html = render(callout, 'TX')
    for (const side of callout.sides) {
      if (side.adPct !== null) expect(html).toContain(`${side.adPct}%`)
      if (side.winPct !== null) expect(html).toContain(`${side.winPct}%`)
    }
  })

  it('shows the spent-on-ads flag in place of percentages when the callout flags it', () => {
    const callout = callouts.get('TX')!
    const flagged: Callout = { ...callout, adFlag: { label: 'Incomplete data', reason: 'Missing FEC match' } }
    const html = render(flagged, 'TX')
    expect(html).toContain('Incomplete data')
    expect(html).toContain('Missing FEC match')
  })

  it('mirrors every percentage when the two parties swap, with no party branch', () => {
    const callout = callouts.get('TX')!
    const [a, b] = callout.sides
    const swapped: Callout = { ...callout, sides: [{ ...b, chip: a.chip }, { ...a, chip: b.chip }] }
    const original = render(callout, 'TX').match(/>\d+%</g) ?? []
    const mirrored = render(swapped, 'TX').match(/>\d+%</g) ?? []
    expect([...mirrored].sort()).toEqual([...original].sort())
  })
})
