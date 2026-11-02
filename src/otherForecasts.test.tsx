import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import pagesJson from '../data/votepredictor-pages.json'
import MapCallout from './components/MapCallout'
import { allRaces, callouts } from './data'
import { hasOtherForecasts } from './otherForecasts'
import { OTHER_FORECASTS_TITLE, otherForecastsUrl, VOTEPREDICTOR } from './votepredictor'

const stub = (matches: boolean) =>
  (window.matchMedia = ((q: string) => ({ matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia)
stub(false)
const callout = (state: string) =>
  renderToStaticMarkup(<MapCallout callout={callouts.get(state)!} stateName={state} anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} onOpenHow={() => {}} sharesVerified />)

describe('the Other forecasts link', () => {
  it('keeps the base URL and the fragment in one constant, and builds the link from the lowercase abbreviation', () => {
    expect(VOTEPREDICTOR).toEqual({ base: 'https://votepredictor.com/senate/', fragment: '#:~:text=Other%20forecasts' })
    expect(otherForecastsUrl('TX')).toBe('https://votepredictor.com/senate/tx#:~:text=Other%20forecasts')
    expect(otherForecastsUrl('ne')).toBe('https://votepredictor.com/senate/ne#:~:text=Other%20forecasts')
    expect(OTHER_FORECASTS_TITLE).toBe('Polls, other forecasts, and market odds for this race (VotePredictor)')
  })

  it('was verified for all 35 races, the FL and OH specials, NE and SD included', () => {
    expect(Object.keys(pagesJson.pages)).toHaveLength(35)
    for (const race of allRaces.races) expect(hasOtherForecasts(race.state)).toBe(true)
    for (const state of ['FL', 'OH', 'NE', 'SD']) expect(hasOtherForecasts(state)).toBe(true)
    expect(hasOtherForecasts('CA')).toBe(false) // no 2026 Senate race
  })

  it('records only a status and checks, never a rating, probability or other VotePredictor content', () => {
    for (const entry of Object.values(pagesJson.pages)) expect(Object.keys(entry).sort()).toEqual(['hasOtherForecasts', 'ok', 'status', 'titleMatches'])
  })

  it('opens the race page from every callout, in a new tab, with the title text, once', () => {
    for (const [state] of callouts) {
      const html = callout(state)
      const link = new RegExp(`<a class="cc-other" href="${otherForecastsUrl(state).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" target="_blank" rel="noopener noreferrer" title="${OTHER_FORECASTS_TITLE.replace(/[()]/g, '\\$&')}">Other forecasts`)
      expect(html).toMatch(link)
      expect(html.split('Other forecasts').length - 1).toBe(1)
    }
  })

  it('shows no percentage or rating from VotePredictor: the callout holds only our rows and the link', () => {
    const html = callout('TX')
    // Spent on ads, Predicted to win, and the Result row's shares
    expect(html.split('class="cc-row').length - 1).toBe(3)
  })
})

describe('omitting the link when a race has no working page', () => {
  afterEach(() => {
    stub(false)
    vi.doUnmock('./otherForecasts')
    vi.resetModules()
  })

  it('leaves the link out of the callout', async () => {
    vi.resetModules()
    vi.doMock('./otherForecasts', () => ({ hasOtherForecasts: () => false }))
    const { default: Callout } = await import('./components/MapCallout')
    const html = renderToStaticMarkup(<Callout callout={callouts.get('TX')!} stateName="Texas" anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} sharesVerified />)
    expect(html).not.toContain('Other forecasts')
  })
})

describe('the mobile bottom sheet', () => {
  it('has the close button in the title row, and the toggle with the Other forecasts pill in one row', () => {
    stub(true)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => root.render(<MapCallout callout={callouts.get('TX')!} stateName="Texas" anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} onOpenHow={() => {}} detail={<p>detail</p>} sharesVerified />))
    const head = host.querySelector('.cc-head')!
    expect([...head.children].map((c) => c.className.split(' ')[0])).toEqual(['cc-title', 'cc-head-cell', 'cc-head-cell', 'cc-close'])
    expect(host.querySelectorAll('.cc-close')).toHaveLength(1)
    const links = host.querySelector('.cc-sheet-links')!
    expect(links.querySelector('.cc-toggle')?.textContent).toBe('Show details')
    expect(links.querySelector('a.cc-other-pill')?.textContent).toBe('Other forecasts')
    act(() => host.querySelector<HTMLButtonElement>('.cc-toggle')!.click())
    expect(host.querySelector('.cc-toggle')?.textContent).toBe('Hide details')
    expect(host.querySelector('.cc-detail')?.textContent).toBe('detail')
    act(() => root.unmount())
    host.remove()
    stub(false)
  })
})
