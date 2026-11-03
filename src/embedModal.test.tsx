import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ShareEmbedModal from './components/ShareEmbedModal'
import { CC_BY_CREDIT, embedCode } from './embed'
import { allRaces, mapViewBox, stateNames } from './data'

const viewBox = mapViewBox.join(' ')
const render = (stateCode: string) =>
  renderToStaticMarkup(
    <ShareEmbedModal stateCode={stateCode} stateName={stateNames.get(stateCode) ?? stateCode} shapePath="M0 0L10 0L10 10Z" viewBox={viewBox} onClose={() => {}} />,
  )

describe('embed code', () => {
  it('names the state and race in the snippet, in upper case', () => {
    const code = embedCode('tx')
    expect(code).toContain('data-mm-card="TX"')
    expect(code).toContain('data-mm-race="2026-SEN-TX"')
    expect(code).toContain('src="https://moneyandmargins.app/embed/mm-card.js"')
  })

  it('differs between states only in the state code', () => {
    const tx = embedCode('TX').replaceAll('TX', 'XX')
    expect(tx).toBe(embedCode('XX'))
  })
})

describe('the share and embed modal', () => {
  it('shows the Texas title, the embed snippet, and the CC BY 4.0 credit', () => {
    const html = render('TX')
    expect(html).toContain('Share or embed: Texas Senate 2026')
    expect(html).toContain("data-mm-card=&quot;TX&quot;")
    expect(html).toContain(CC_BY_CREDIT.replace(/&/g, '&amp;'))
    expect(html).toContain('licensed CC BY 4.0')
  })

  it('has the same structure for every state with a race', () => {
    const states = [...new Set(allRaces.races.map((r) => r.state))]
    const shape = (state: string) => render(state).replace(/Share or embed: [^<]*/, '').replaceAll(state, 'XX')
    const reference = shape(states[0])
    for (const state of states) expect(shape(state)).toBe(reference)
  })

  it('never shows the Predicted or Results rows', () => {
    const html = render('TX')
    expect(html).not.toMatch(/Predicted to win|Results \(/)
  })

  it('carries the close button and the download and copy controls', () => {
    const html = render('TX')
    expect(html).toContain('aria-label="Close"')
    expect(html).toContain('Download PNG')
    expect(html).toContain('Copy code')
  })
})
