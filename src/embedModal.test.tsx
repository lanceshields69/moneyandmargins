import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ShareEmbedModal from './components/ShareEmbedModal'
import { CC_BY_CREDIT, embedCode } from './embed'
import { allRaces, callouts, mapViewBox, stateBoxes, stateNames, statePaths } from './data'
import { buildNationalCard } from './computeNational'

const cardFor = (state: string) => ({
  callout: callouts.get(state)!,
  national: buildNationalCard(allRaces.races, state),
  shapePath: statePaths.get(state) ?? '',
  shapeBox: stateBoxes.get(state) ?? mapViewBox.join(' '),
  dataAsOf: 'Oct 31, 2026',
  forecastSource: 'VotePredictor, votepredictor.com',
})
const render = (state: string) =>
  renderToStaticMarkup(<ShareEmbedModal stateCode={state} stateName={stateNames.get(state) ?? state} card={cardFor(state)} onClose={() => {}} />)

describe('embed code', () => {
  it('names the state and race in the snippet, in upper case', () => {
    const code = embedCode('tx')
    expect(code).toContain('data-mm-card="TX"')
    expect(code).toContain('data-mm-race="2026-SEN-TX"')
    expect(code).toContain('src="https://moneyandmargins.app/embed/mm-card.js"')
  })

  it('differs between states only in the state code', () => {
    expect(embedCode('TX').replaceAll('TX', 'XX')).toBe(embedCode('XX'))
  })
})

describe('the share and embed modal', () => {
  it('shows the Texas title, the embed snippet, and the CC BY 4.0 credit', () => {
    const html = render('TX')
    expect(html).toContain('Share or embed: Texas Senate 2026')
    expect(html).toContain('data-mm-card=&quot;TX&quot;')
    expect(html).toContain(CC_BY_CREDIT.replace(/&/g, '&amp;'))
  })

  it('shows the same fixed labels for every state with a race', () => {
    const states = [...new Set(allRaces.races.map((r) => r.state))]
    for (const state of states) {
      const html = render(state)
      for (const label of ['Spent on ads:', 'Predicted to win:', 'Spending aligned with each party', 'Money &amp; Margins', 'moneyandmargins.app', 'Download PNG', 'Copy code']) {
        expect(html, `${state}: ${label}`).toContain(label)
      }
    }
  })

  it('shows the card with the Predicted to win and Results rows', () => {
    const html = render('TX')
    expect(html).toContain('Predicted to win:')
    expect(html).toContain('Results (')
  })

  it('carries the close button and the download and copy controls', () => {
    const html = render('TX')
    expect(html).toContain('aria-label="Close"')
    expect(html).toContain('Download PNG')
    expect(html).toContain('Copy code')
  })
})
