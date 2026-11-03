import { pickPair } from './computeCallout'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MapCallout from './components/MapCallout'
import PreviewBadge from './components/PreviewBadge'
import RacePanel from './components/RacePanel'
import { forecastPhrase } from './copy'
import { formatMoney } from './format'
import { fillMethodology } from './methodology'
import { AMOUNTS_PENDING_LEAD, PARTIAL_CALLOUT_NOTICE, SHARES_PENDING_LEAD, SHARES_PENDING_LINK } from './copy'
import { allRaces, callouts } from './data'
import verifiedMd from '../docs/methodology.md?raw'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia

const SHARES_MESSAGE = 'Shares are being verified. Partial data: see how this is counted.'
const COMBOS = [
  { data: false, shares: false },
  { data: true, shares: false },
  { data: false, shares: true },
  { data: true, shares: true },
]
const text = (html: string) => html.replace(/<[^>]+>/g, '')
const callout = (state: string, sharesVerified: boolean) =>
  renderToStaticMarkup(<MapCallout callout={callouts.get(state)!} stateName={state} anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} sharesVerified={sharesVerified} />)

describe('SHARES_VERIFIED gates the "Spent on ads" percentages', () => {
  it('says shares are being verified, with a link to the methodology, in every race, and shows no percentages in that row', () => {
    expect(SHARES_PENDING_LEAD + SHARES_PENDING_LINK + '.').toBe(SHARES_MESSAGE)
    const seen = new Set<string>()
    for (const [state, c] of callouts) {
      const html = callout(state, false)
      const row = text(html.slice(html.indexOf('cc-row-pending')))
      expect(text(html)).toContain(SHARES_MESSAGE)
      expect(html).toContain('Spent on ads:')
      expect(html).not.toContain(PARTIAL_CALLOUT_NOTICE)
      // the Predicted to win row carries percentages (unless flagged), and the Result row's shares always render (as '--' until added)
      expect(html.split('cc-value').length - 1).toBe((c.winFlag ? 0 : c.sides.length) + c.sides.length)
      seen.add(row.split('Predicted')[0])
    }
    expect(seen.size).toBe(1) // identical for every race and party
  })

  it('shows the percentages and the partial-data line when shares are verified', () => {
    const state = [...callouts].find(([, c]) => !c.adFlag && !c.winFlag)![0]
    const html = callout(state, true)
    expect(text(html)).not.toContain(SHARES_MESSAGE)
    expect(html).not.toContain(PARTIAL_CALLOUT_NOTICE)
    // Spent on ads, Predicted to win, and the Result row's shares
    expect(html.split('cc-value').length - 1).toBe(callouts.get(state)!.sides.length * 3)
  })
})

describe('DATA_VERIFIED gates per-candidate amounts and top committees', () => {
  const withAmounts = allRaces.races.filter((r) => r.total !== null && r.rows.some((row) => row.support))

  it('hides dollar amounts, bars and top committees in every race and says so, the same way each time', () => {
    const lines = new Set<string>()
    for (const race of withAmounts) {
      const html = renderToStaticMarkup(<RacePanel race={race} fetchedAt={allRaces.fetchedAt} dataVerified={false} />)
      expect(text(html)).not.toMatch(/\$\d/)
      expect(html).not.toContain('Top committees')
      expect(html).not.toContain('class="bars"')
      const summary = /<p class="muted summary">(.*?)<\/p>/.exec(html)?.[1] ?? ''
      lines.add(text(summary))
    }
    expect([...lines]).toEqual([`${AMOUNTS_PENDING_LEAD}${SHARES_PENDING_LINK}.`])
  })

  it('shows amounts and committees when data is verified', () => {
    for (const race of withAmounts) {
      const html = renderToStaticMarkup(<RacePanel race={race} fetchedAt={allRaces.fetchedAt} dataVerified />)
      expect(text(html)).toMatch(/\$\d/)
      expect(text(html)).not.toContain(AMOUNTS_PENDING_LEAD)
    }
  })
})

describe('the Known gaps list', () => {
  it('names the contrast-ad double count', () => {
    expect(verifiedMd).toContain("A contrast ad can be reported on two lines, so a state's total can count some spending twice.")
  })
})

describe('each flag combination on the whole page', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
    vi.doUnmock('./config')
    vi.resetModules()
    window.history.replaceState(null, '', '/')
  })

  async function renderPage(flags: { data: boolean; shares: boolean }, hash = '', preview = false) {
    vi.resetModules()
    vi.doMock('./config', () => ({ CONTACT_EMAIL: 'a@b.test', DATA_VERIFIED: flags.data, SHARES_VERIFIED: flags.shares, GLOBAL_PARTIAL_NOTICE: false, IS_PREVIEW_BUILD: preview }))
    window.history.replaceState(null, '', `/${hash}`)
    const { default: App } = await import('./App')
    const root = createRoot(host)
    act(() => root.render(<App />))
    return { page: host, unmount: () => act(() => root.unmount()) }
  }

  for (const flags of COMBOS) {
    it(`DATA_VERIFIED=${flags.data}, SHARES_VERIFIED=${flags.shares}`, async () => {
      const { page, unmount } = await renderPage(flags, '#TX')
      const body = page.textContent ?? ''
      // national card: shares only
      expect(body.includes("Spending aligned with each party's nominees")).toBe(flags.shares)
      // spent-on-ads row: shares only
      expect(body.includes(SHARES_MESSAGE)).toBe(!flags.shares)
      // slim notice under the subhead only while the data is unverified; the panel's pending text likewise
      expect(body.includes('Data check in progress')).toBe(!flags.data)
      expect(body.includes('Dollar amounts are being verified')).toBe(!flags.data)
      // dollar amounts and top committees in the panel, and the map legend ramp: data only
      expect(page.querySelector('#race-details')?.textContent?.includes('Top committees') ?? false).toBe(flags.data)
      expect(/\$\d/.test(page.querySelector('#race-details')?.textContent ?? '')).toBe(flags.data)
      expect(page.querySelector('.ramp') !== null).toBe(flags.data)
      // the data-through date shows in the panel's top line when data is verified, and the fetch time never shows on the page
      expect((page.querySelector('#race-details')?.textContent ?? '').includes('Data through')).toBe(flags.data)
      expect(body.includes('fetched')).toBe(false)
      // map fill: one neutral color for every race state when data is unverified
      const fills = new Set([...page.querySelectorAll('path.state-race')].map((p) => p.getAttribute('fill')))
      expect(fills.size === 1).toBe(!flags.data)
      unmount()
    })

    it(`the methodology link opens the ${flags.data ? 'verified' : 'partial'} text (data=${flags.data}, shares=${flags.shares})`, async () => {
      const { page, unmount } = await renderPage(flags, '#how-it-works')
      const dialog = page.querySelector('[role="dialog"]')!
      expect(dialog).not.toBeNull()
      const body = dialog.textContent ?? ''
      expect(body.includes('Contrast ads') || (page.ownerDocument.body.textContent ?? '').includes('count some spending twice')).toBe(flags.data)
      expect(body.includes('This version uses the FEC')).toBe(!flags.data)
      expect(body).not.toMatch(/\{\{|\}\}/)
      expect(body.toLowerCase()).not.toContain('hidden')
      unmount()
    })
  }

  it('fills the methodology placeholders from the pipeline metadata when data is verified', async () => {
    const { page, unmount } = await renderPage({ data: true, shares: false }, '#how-it-works')
    const body = page.querySelector('[role="dialog"]')?.textContent ?? ''
    // The count moves with every refresh, so the expected values come from the same data the page reads.
    const n = allRaces.approxCommitteeCount
    expect(n).toBeGreaterThan(0)
    expect(body).toContain(`For ${n} ${n === 1 ? 'committee' : 'committees'}`)
    expect(body).toContain(`Those rows total ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(allRaces.approxTotal as number)}.`)
    expect(body).toContain("Totals and shares include primary-season spending as labeled by the filer, which can count toward the other side's share. I'm moving the shares to general-election spending only.")
    expect(body).toContain('Nationally this is at most about 3.4%.')
    expect(body).toContain('Races with incomplete data (Colorado, Michigan, Nebraska, Oklahoma, South Carolina) are left out of the national card.')
    expect(body).toContain("A contrast ad can be reported on two lines, so a state's total can count some spending twice.")
    expect(body).not.toContain('not tied to a candidate total') // no figure, so the sentence is dropped
    expect(body).not.toMatch(/\{\{|\}\}/)
    unmount()
  })

  it('opens the Corrections dialog from its link and shows the logged entry', async () => {
    const { page, unmount } = await renderPage({ data: true, shares: true }, '#corrections')
    const body = page.querySelector('[role="dialog"]')?.textContent ?? ''
    expect(body).toContain('Corrections')
    expect(body).toContain('The first version left out 24- and 48-hour reports, which is where most recent spending is filed.')
    expect(body).toContain('understated Republican-aligned spending more than Democratic-aligned spending')
    expect(body).toMatch(/Corrected [A-Z][a-z]{2} \d+, 2026 UTC\./)
    unmount()
  })
})

describe('corrections log', () => {
  it('says "No corrections yet." when the log is empty', async () => {
    const { correctionsBlocks } = await import('./corrections')
    expect(correctionsBlocks([])).toEqual([{ kind: 'h1', text: 'Corrections' }, { kind: 'p', text: 'No corrections yet.' }])
  })
  it('puts the newest entry first', async () => {
    const { latestCorrections } = await import('./corrections')
    expect(latestCorrections([{ date: '2026-10-01', text: 'a' }, { date: '2026-10-20', text: 'b' }]).map((e) => e.text)).toEqual(['b', 'a'])
  })
})

describe('the Preview badge', () => {
  it('prints the compiled flag values, and renders nothing outside Preview builds', () => {
    expect(renderToStaticMarkup(<PreviewBadge show dataVerified sharesVerified={false} />)).toContain('DATA_VERIFIED=true · SHARES_VERIFIED=false')
    expect(renderToStaticMarkup(<PreviewBadge show={false} dataVerified sharesVerified />)).toBe('')
  })

  it('shows on the page only when the build is a Preview build', async () => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
    for (const preview of [true, false]) {
      vi.resetModules()
      vi.doMock('./config', () => ({ CONTACT_EMAIL: 'a@b.test', DATA_VERIFIED: true, SHARES_VERIFIED: true, GLOBAL_PARTIAL_NOTICE: false, IS_PREVIEW_BUILD: preview }))
      const host = document.createElement('div')
      document.body.appendChild(host)
      const { default: App } = await import('./App')
      const root = createRoot(host)
      act(() => root.render(<App />))
      expect(host.querySelector('.preview-badge') !== null).toBe(preview)
      act(() => root.unmount())
      host.remove()
      vi.doUnmock('./config')
    }
  })
})

describe('panel, labels and header fixes', () => {
  const rowOf = (over: Record<string, unknown>) => ({
    candidateId: 'X--A', name: 'A Person', party: 'D', partyLabel: 'Democratic', partyColor: 'c', incomplete: false, reason: null,
    support: { value: 0, widthPct: 0 }, oppose: { value: 0, widthPct: 0 }, topSupportCommittees: [], topOpposeCommittees: [], sourceUrl: 'https://x.test', asOf: '2026-10-31T00:00:00Z', ...over,
  })
  const raceOf = (rows: unknown[]) => ({ raceId: 'XX-2026', state: 'XX', raceName: 'Test Senate 2026', isSpecial: false, rows, scaleMax: 1, total: 10, incompleteCount: 0, missingMajor: [] }) as never
  const panel = (race: never) => renderToStaticMarkup(<RacePanel race={race} fetchedAt={allRaces.fetchedAt} dataThrough="Oct 31, 2026" dataVerified />)

  it('lists by party name with a note, and collapses candidates with no reported spending into one line', () => {
    for (const race of allRaces.races) {
      const html = panel(race as never)
      expect(html).toContain('Listed alphabetically by party')
      const labels = [...html.matchAll(/class="party">([^<]+)</g)].map((m) => m[1])
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    }
    // Any candidate with nothing reported collapses to one line; none gets a row. Read from the data, not fixed names.
    for (const race of allRaces.races) {
      const covered = new Set(pickPair(race.rows).map((r) => r.candidateId))
      const quiet = race.rows.filter((r) => !r.incomplete && !covered.has(r.candidateId) && (r.support?.value ?? 0) === 0 && (r.oppose?.value ?? 0) === 0)
      const html = panel(race as never)
      for (const q of quiet) {
        expect(html).not.toContain(`class="name">${q.name}</span>`)
      }
    }
  })

  it('keeps a row, at $0, for a nominee the forecast covers', () => {
    const race = raceOf([
      rowOf({ candidateId: 'X--D', name: 'Dee Dem', party: 'D', partyLabel: 'Democratic', support: { value: 5, widthPct: 5 } }),
      rowOf({ candidateId: 'X--R', name: 'Ray Rep', party: 'R', partyLabel: 'Republican' }),
      rowOf({ candidateId: 'X--I', name: 'Ivy Ind', party: 'I', partyLabel: 'Independent or other party' }),
    ])
    const html = panel(race)
    expect(html).toContain('class="name">Ray Rep')
    expect(html).not.toContain('class="name">Ivy Ind')
    expect(html).toContain('no reported spending: Ivy Ind')
  })

  it('opens with one line, "Total reported: $X. Data through [date].", and each candidate line says just "FEC record"', () => {
    const html = panel(allRaces.races.find((r) => r.state === 'OH') as never)
    const top = text(/<p class="muted summary">(.*?)<\/p>/.exec(html)?.[1] ?? '')
    expect(top).toMatch(/^Total reported: \$[\d.,]+[KMB]?\. Data through Oct 31, 2026\.$/)
    expect(html.split('Data through').length - 1).toBe(1)
    expect(html).not.toContain('fetched')
    expect(html).not.toContain('Includes primary-season')
    for (const m of html.matchAll(/<p class="source muted">(.*?)<\/p>/g)) expect(text(m[1])).toBe('FEC record')
  })

  it('ends with one line of links: How this map works · FEC source · Report an error', () => {
    const html = panel(allRaces.races.find((r) => r.state === 'TX') as never)
    const bottom = /<p class="muted disclaimer">(.*?)<\/p>/.exec(html)?.[1] ?? ''
    expect(text(bottom)).toBe('How this map works · FEC source · Report an error')
    expect(bottom).toContain('mailto:')
    expect(bottom).toContain('https://www.fec.gov/data/independent-expenditures/')
    expect(html).not.toContain('24- and 48-hour')
  })

  it('draws opposing bars outlined and unfilled, never hatched', () => {
    const css = readFileSync(join(process.cwd(), 'src/app.css'), 'utf-8')
    const block = /\.fill-striped\s*\{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(block).toContain('background: transparent')
    expect(block).toContain('box-shadow: inset')
    expect(block).not.toContain('repeating-linear-gradient')
  })

  it('formats millions with one decimal and billions with two', () => {
    expect(formatMoney(95_000_000)).toBe('$95.0M')
    expect(formatMoney(100_000_000)).toBe('$100.0M')
    expect(formatMoney(1_040_700_000)).toBe('$1.04B')
    expect(formatMoney(784_700)).toBe('$784.7K')
    expect(formatMoney(950)).toBe('$950')
  })

  it('says "frozen" only for the snapshot tagged final-pre-election, otherwise "latest as of"', () => {
    expect(forecastPhrase('final-pre-election')).toBe('frozen')
    expect(forecastPhrase(null)).toBe('latest as of')
    expect(forecastPhrase('anything-else')).toBe('latest as of')
    const text = fillMethodology('VotePredictor\'s forecast, frozen {{forecast_freeze_date}}.', { updated: '2026-10-31T00:00:00Z', forecastFrozen: '2026-10-31T15:38:29Z', latestFiling: null, unattributedTotal: null, approxCommitteeCount: null, approxTotal: null })
    expect(text).toBe("VotePredictor's forecast, latest as of Oct 31, 2026 UTC.")
    expect(fillMethodology("forecast, frozen {{forecast_freeze_date}}.", { updated: '2026-10-31T00:00:00Z', forecastFrozen: '2026-11-02T23:00:00Z', forecastFinal: true, latestFiling: null, unattributedTotal: null, approxCommitteeCount: null, approxTotal: null })).toBe('forecast, frozen Nov 2, 2026 UTC.')
  })

  it('puts the How this map works button left of Share, opens the modal, and shortens the footer paragraph to a link', async () => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
    vi.resetModules()
    vi.doMock('./config', () => ({ CONTACT_EMAIL: 'a@b.test', DATA_VERIFIED: true, SHARES_VERIFIED: true, GLOBAL_PARTIAL_NOTICE: false, IS_PREVIEW_BUILD: false }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    const { default: App } = await import('./App')
    const root = createRoot(host)
    act(() => root.render(<App />))
    const actions = host.querySelector('.header-actions')!
    expect([...actions.children].map((c) => c.className.split(' ')[0])).toEqual(['header-link', 'how-button', 'share'])
    expect(actions.querySelector('.header-link')?.textContent).toBe('Claude on building this map')
    expect(actions.querySelector('.how-button')?.textContent).toBe('How this map works')
    const footerLine = [...host.querySelectorAll('.footer-notes p')].find((p) => p.textContent?.startsWith('Predicted to win'))!
    expect((footerLine.textContent ?? '').length).toBeLessThan(230)
    expect(footerLine.textContent).toContain('latest as of')
    act(() => footerLine.querySelector<HTMLButtonElement>('button')!.click())
    expect(host.querySelector('[role="dialog"]')).not.toBeNull()
    // the map legend note, and the fetch time nowhere on the page outside the modal
    const notes = host.querySelector('.map-notes p')?.textContent
    expect(notes).toBe('Support plus oppose, all candidates in the race. Dark states have no 2026 Senate race.')
    act(() => root.unmount())
    host.remove()
    vi.doUnmock('./config')
  })
})

describe('the info button in the callout', () => {
  it('opens the methodology when pressed', () => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const opened = vi.fn()
    const [state, callout] = [...callouts][0]
    act(() => root.render(<MapCallout callout={callout} stateName={state} anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} onOpenHow={opened} sharesVerified />))
    const button = host.querySelector<HTMLButtonElement>('button.cc-info')!
    expect(button.getAttribute('aria-label')).toBe('How this is counted')
    act(() => button.click())
    expect(opened).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
    host.remove()
  })
})
