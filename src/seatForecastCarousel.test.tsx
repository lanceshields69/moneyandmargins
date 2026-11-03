import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SeatForecastCarousel from './components/SeatForecastCarousel'
import type { SeatForecastEntry } from './seatForecastSources'

window.matchMedia = ((q: string) => ({
  matches: false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  onchange: null,
  dispatchEvent: () => false,
})) as typeof window.matchMedia

const entry = (over: Partial<SeatForecastEntry> = {}): SeatForecastEntry => ({
  key: 'votepredictor',
  sourceName: 'VotePredictor',
  sourceUrl: 'https://votepredictor.com/senate',
  homeUrl: 'https://votepredictor.com',
  asOf: '2026-11-02',
  dSeats: 52,
  rSeats: 48,
  ...over,
})

describe('SeatForecastCarousel', () => {
  it('renders one card per source, each with its own link, home link, and as-of date', () => {
    const sources = [entry(), entry({ key: 'callthemap', sourceName: 'CallTheMap', sourceUrl: 'https://www.callthemap.com/senate', homeUrl: 'https://www.callthemap.com', asOf: '2026-11-01', dSeats: 51, rSeats: 49 })]
    const html = renderToStaticMarkup(<SeatForecastCarousel sources={sources} />)
    expect(html).toContain('href="https://votepredictor.com/senate"')
    expect(html).toContain('href="https://votepredictor.com"')
    expect(html).toContain('href="https://www.callthemap.com/senate"')
    expect(html).toContain('href="https://www.callthemap.com"')
    expect(html.match(/seat-forecast-card/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("every card's two numbers sum to 100", () => {
    const sources = [entry({ dSeats: 60, rSeats: 40 }), entry({ key: 'b', dSeats: 33, rSeats: 67 })]
    const html = renderToStaticMarkup(<SeatForecastCarousel sources={sources} />)
    expect(html).toContain('>60<')
    expect(html).toContain('>40<')
    expect(html).toContain('>33<')
    expect(html).toContain('>67<')
  })

  it('never renders a literal party hex, only the shared party color tokens', () => {
    const html = renderToStaticMarkup(<SeatForecastCarousel sources={[entry()]} />)
    expect(html).not.toMatch(/#6f97e2|#d87972/i)
    expect(html).toContain('var(--color-dem)')
    expect(html).toContain('var(--color-rep)')
  })

  it('marks only the first card active and the rest aria-hidden on first render', () => {
    const sources = [entry(), entry({ key: 'b' }), entry({ key: 'c' })]
    const html = renderToStaticMarkup(<SeatForecastCarousel sources={sources} />)
    expect(html.match(/seat-forecast-card-active/g)?.length).toBe(1)
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(sources.length - 1 + 1) // the other cards, plus the dots row
  })

  it('shows one dot per source, not a hardcoded four', () => {
    const html3 = renderToStaticMarkup(<SeatForecastCarousel sources={[entry(), entry({ key: 'b' }), entry({ key: 'c' })]} />)
    const dotCount = (html: string) => (html.match(/class="seat-forecast-dot(?:"| seat-forecast-dot-active")/g) ?? []).length
    expect(dotCount(html3)).toBe(3)
  })

  it('renders nothing for an empty source list', () => {
    expect(renderToStaticMarkup(<SeatForecastCarousel sources={[]} />)).toBe('')
  })

  it('renders no rotation dots for a single source', () => {
    const html = renderToStaticMarkup(<SeatForecastCarousel sources={[entry()]} />)
    expect(html).not.toContain('seat-forecast-dot')
  })
})
