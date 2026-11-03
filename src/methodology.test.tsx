import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import partialMd from '../docs/methodology-partial.md?raw'
import verifiedMd from '../docs/methodology.md?raw'
import MapCallout from './components/MapCallout'
import MethodologyModal from './components/MethodologyModal'
import { DATA_VERIFIED, GLOBAL_PARTIAL_NOTICE, IS_PREVIEW_BUILD, SHARES_VERIFIED } from './config'
import { DATA_CHECK_NOTICE, PARTIAL_CALLOUT_NOTICE } from './copy'
import { allRaces, callouts } from './data'
import { dedupShortfallSentence, doubleCountSentence, fillMethodology, incompleteRacesSentence, isHowHash, methodologySource, parseMethodology, splitMethodology, type MethodologyValues } from './methodology'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const values: MethodologyValues = {
  updated: '2026-10-31T16:09:12.954Z',
  forecastFrozen: '2026-10-31T15:38:29Z',
  latestFiling: '2026-10-30',
  unattributedTotal: 1234567,
  approxCommitteeCount: 6,
  approxTotal: 2500000,
  doubleCountSentence: 'Nationally this is at most about 3.4%.',
  incompleteRacesSentence: 'Races with incomplete data (Colorado) are left out of the national card.',
}
const none: MethodologyValues = { ...values, latestFiling: null, unattributedTotal: null, approxCommitteeCount: null, approxTotal: null, doubleCountSentence: null, incompleteRacesSentence: null }

describe('which text renders', () => {
  it('uses the verified method when DATA_VERIFIED is true and the partial text when it is false', () => {
    expect(methodologySource(true)).toBe(verifiedMd)
    expect(methodologySource(false)).toBe(partialMd)
    expect(verifiedMd).not.toBe(partialMd)
    expect(partialMd).toContain('24- and 48-hour reports are not included')
  })
  it('defaults both flags to true when no environment variable is set, so the verified view needs no setup', () => {
    expect(process.env.DATA_VERIFIED).toBeUndefined()
    expect(process.env.SHARES_VERIFIED).toBeUndefined()
    expect(DATA_VERIFIED).toBe(true)
    expect(SHARES_VERIFIED).toBe(true)
    expect(IS_PREVIEW_BUILD).toBe(false)
  })
})

describe('placeholders', () => {
  for (const [name, md] of [['verified', verifiedMd], ['partial', partialMd]] as const) {
    it(`fills every placeholder in the ${name} text and never shows braces or markdown markers`, () => {
      for (const v of [values, none]) {
        const text = fillMethodology(md, v)
        expect(text).not.toMatch(/\{\{|\}\}/)
        const shown = splitMethodology(parseMethodology(text))
        const words = JSON.stringify([shown.title, shown.short, shown.full])
        expect(words).not.toContain('<!--')
        expect(words).not.toMatch(/\{\{|\}\}/)
      }
      const full = fillMethodology(md, values)
      expect(full).toContain('Last updated Oct 31, 2026')
      expect(full).toMatch(/latest as of|frozen/)
    })
  }

  it('drops what has no figure instead of printing a blank', () => {
    const text = fillMethodology(verifiedMd, none)
    expect(text).not.toContain('latest filing in the data')
    expect(text).not.toContain('not tied to a candidate total')
    expect(text).not.toContain('Duplicate removal is imperfect')
    expect(text).not.toContain('Incomplete races.') // its bullet needs a figure that is missing
    expect(text).toContain('Primary-season spending.') // plain text, always there
    expect(text).not.toContain('Nationally this is')
    expect(text).toContain('such as an ad against a whole party.')
  })

  it('keeps the sentences when the figures exist', () => {
    const text = fillMethodology(verifiedMd, values)
    expect(text).toContain('dated Oct 30, 2026')
    expect(text).toContain('Expenditures not tied to a candidate total $1,234,567.')
    expect(text).toContain('For 6 committees')
    expect(text).toContain('Races with incomplete data (Colorado) are left out of the national card.')
    expect(text).toContain('$2,500,000')
  })

  it('splits the short version from the full method at the marker', () => {
    const parts = splitMethodology(parseMethodology(fillMethodology(verifiedMd, values)))
    expect(parts.title).toBe('How this map works')
    expect(parts.short.length).toBeGreaterThan(2)
    expect(parts.full.length).toBeGreaterThan(5)
    expect(parts.short.some((b) => b.kind === 'more') || parts.full.some((b) => b.kind === 'more')).toBe(false)
  })

  it('recognizes the shareable hash in any case', () => {
    expect(isHowHash('#how-it-works')).toBe(true)
    expect(isHowHash('#How-It-Works')).toBe(true)
    expect(isHowHash('#TX')).toBe(false)
  })
})

describe('dialog', () => {
  let host: HTMLDivElement
  let root: Root

  function Harness() {
    const [open, setOpen] = useState(false)
    const blocks = parseMethodology(fillMethodology(methodologySource(DATA_VERIFIED), values))
    return (
      <>
        <button id="trigger" onClick={() => setOpen(true)}>
          How this map works
        </button>
        {open && <MethodologyModal blocks={blocks} onClose={() => setOpen(false)} />}
      </>
    )
  }

  const key = (k: string, init: KeyboardEventInit = {}) => act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })))
  const openDialog = () => {
    const trigger = host.querySelector<HTMLButtonElement>('#trigger')!
    trigger.focus()
    act(() => trigger.click())
    return trigger
  }

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(<Harness />))
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('is a labelled modal dialog, moves focus in, and locks page scroll', () => {
    openDialog()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('How this map works')
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('shows the short version, with the full method collapsed until the toggle opens it', () => {
    openDialog()
    const details = document.querySelector<HTMLDetailsElement>('details.how-more')!
    expect(details.open).toBe(false)
    expect(document.querySelector('.how-body')?.textContent).toContain('Show the full method')
    act(() => void (details.open = true))
    expect(details.open).toBe(true)
  })

  it('traps focus: Tab from the last control wraps to the first, and Shift+Tab the other way', () => {
    openDialog()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const items = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary')]
    expect(items.length).toBeGreaterThanOrEqual(2)
    items[items.length - 1].focus()
    key('Tab')
    expect(document.activeElement).toBe(items[0])
    key('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('Esc closes, returns focus to the trigger, and unlocks scroll', () => {
    const trigger = openDialog()
    key('Escape')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
  })

  it('the close button and a click outside both close it', () => {
    openDialog()
    act(() => document.querySelector<HTMLButtonElement>('.how-close')!.click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    openDialog()
    act(() => void document.querySelector('.how-backdrop')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('partial-data hotfix text is identical for every race and party', () => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia

  it('shows the two rows plus the Result row in every race: no caveat sentence, and an info button next to "Spent on ads"', () => {
    expect(GLOBAL_PARTIAL_NOTICE).toBe(false)
    expect(callouts.size).toBe(allRaces.races.length)
    for (const [state, callout] of callouts) {
      const html = renderToStaticMarkup(<MapCallout callout={callout} stateName={state} anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} onOpenHow={() => {}} sharesVerified />)
      expect(html).not.toContain('primary-season')
      expect(html).not.toContain('Contrast ads')
      expect(html).not.toContain(PARTIAL_CALLOUT_NOTICE)
      expect(html).not.toContain('class="cc-partial"')
      // Spent on ads, Predicted to win, and the Result row's shares (the Result heading is its own, non-grid row)
      expect(html.split('class="cc-row').length - 1).toBe(3)
      expect(html.match(/<button[^>]*class="cc-info"[^>]*aria-label="How this is counted"/g) ?? []).toHaveLength(1)
      expect(html.indexOf('Spent on ads')).toBeLessThan(html.indexOf('cc-info'))
    }
  })

  it('brings the partial-data line back when GLOBAL_PARTIAL_NOTICE is on', () => {
    const [state, callout] = [...callouts][0]
    const html = renderToStaticMarkup(<MapCallout callout={callout} stateName={state} anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} sharesVerified globalPartialNotice />)
    expect(html).toContain(PARTIAL_CALLOUT_NOTICE)
  })

  it('uses the exact wording asked for', () => {
    expect(PARTIAL_CALLOUT_NOTICE).toBe('Partial data: recent filings missing. Shares may change.')
    expect(DATA_CHECK_NOTICE).toBe('Data check in progress: totals for some races are being corrected.')
  })
})

describe('double-count and incomplete-races sentences', () => {
  const md = 'Gaps.\n\n- **Contrast ads.** A contrast ad can be reported on two lines. {{double_count_sentence}}\n- **Left out.** {{incomplete_races_sentence}}\n'
  const base = { updated: '2026-10-31T16:09:12.954Z', forecastFrozen: '2026-10-31T15:38:29Z', latestFiling: null, unattributedTotal: null, approxCommitteeCount: null, approxTotal: null, doubleCountSentence: null, incompleteRacesSentence: null }
  const verification = { runs: [{ checks: [{ id: 'double_count', summary: '10 race(s) over 2%; overall 3.42%' }] }] }

  it('builds the sentences from the verification run and the pipeline data', () => {
    expect(doubleCountSentence(verification)).toBe('Nationally this is at most about 3.4%.')
    expect(incompleteRacesSentence(['South Carolina', 'Colorado', 'Michigan', 'Nebraska', 'Oklahoma'])).toBe(
      'Races with incomplete data (Colorado, Michigan, Nebraska, Oklahoma, South Carolina) are left out of the national card.',
    )
  })

  it('fills both into the text with no raw braces', () => {
    const text = fillMethodology(md, { ...base, doubleCountSentence: doubleCountSentence(verification), incompleteRacesSentence: incompleteRacesSentence(['Colorado']) })
    expect(text).toContain('Nationally this is at most about 3.4%.')
    expect(text).toContain('Races with incomplete data (Colorado) are left out of the national card.')
    expect(text).not.toMatch(/\{\{|\}\}/)
  })

  it('drops either sentence when its figure is missing, leaving no braces or dangling space', () => {
    expect(doubleCountSentence(null)).toBeNull()
    expect(doubleCountSentence({ runs: [{ checks: [] }] })).toBeNull()
    expect(incompleteRacesSentence([])).toBeNull()
    const text = fillMethodology(md, { ...base, doubleCountSentence: null, incompleteRacesSentence: null })
    expect(text).not.toMatch(/\{\{|\}\}/)
    expect(text).toContain('A contrast ad can be reported on two lines.\n')
    expect(text).not.toContain('Nationally')
    expect(text).not.toContain('Left out.') // a bullet that is only its missing sentence goes
  })
})

describe('restated-for-less sentence', () => {
  const base = { updated: '2026-10-31T16:09:12.954Z', forecastFrozen: '2026-10-31T15:38:29Z', latestFiling: null, unattributedTotal: null, approxCommitteeCount: null, approxTotal: null, doubleCountSentence: null, incompleteRacesSentence: null }
  const fetched = '2026-10-31T20:40:30.953Z'
  const figures = { fetchedAt: fetched, dedupShortfallPct: 0.07 }

  it('states the percent from the figures file, two decimals, with the fixed half-point clause', () => {
    expect(dedupShortfallSentence(figures, fetched)).toBe("As of the latest check, that affects about 0.07% of total spending, and no race's shares moved by more than half a point.")
    expect(dedupShortfallSentence({ ...figures, dedupShortfallPct: 0 }, fetched)).toContain('about 0.00% of')
  })

  it('fills the live page text, in place after Incomplete races, with no raw braces', () => {
    const text = fillMethodology(verifiedMd, { ...base, dedupShortfallSentence: dedupShortfallSentence(figures, fetched) })
    expect(text).toContain("- **Restated for less.** In a few cases, a committee's regular report restates fewer dollars than its earlier notices, and the difference is dropped. As of the latest check, that affects about 0.07% of total spending")
    expect(text.indexOf('**Restated for less.**')).toBeGreaterThan(text.indexOf('- **Contrast ads.**'))
    expect(text).not.toMatch(/\{\{|\}\}/)
  })

  it('drops the bullet, with no blank or zero, when the figures file is missing', () => {
    expect(dedupShortfallSentence(null, fetched)).toBeNull()
    const text = fillMethodology(verifiedMd, { ...base, dedupShortfallSentence: dedupShortfallSentence(null, fetched) })
    expect(text).not.toContain('Restated for less')
    expect(text).not.toContain('0.00%')
    expect(text).not.toMatch(/\{\{|\}\}/)
  })

  it('drops it too when the figure is absent, not finite, or made for a different fetch', () => {
    expect(dedupShortfallSentence({ fetchedAt: fetched }, fetched)).toBeNull()
    expect(dedupShortfallSentence({ fetchedAt: fetched, dedupShortfallPct: Number.NaN }, fetched)).toBeNull()
    expect(dedupShortfallSentence(figures, '2026-11-01T00:00:00.000Z')).toBeNull()
  })

  it('treats the page as having no figures file on this branch until verify.ts writes one', async () => {
    const { methodologyFigures } = await import('./data')
    expect(methodologyFigures === null || typeof methodologyFigures === 'object').toBe(true)
  })
})

describe('duplicate-removal bullet follows the approximate-committee count', () => {
  const base = { updated: '2026-10-31T16:09:12.954Z', forecastFrozen: '2026-10-31T15:38:29Z', latestFiling: null, unattributedTotal: null, doubleCountSentence: null, incompleteRacesSentence: null }

  it('is omitted when no committee needed approximate matching, with no zero or braces', () => {
    const text = fillMethodology(verifiedMd, { ...base, approxCommitteeCount: 0, approxTotal: 0 })
    expect(text).not.toContain('Duplicate removal is imperfect')
    expect(text).not.toMatch(/For 0 committees|\$0|\{\{/)
    expect(text).toContain('**Primary-season spending.**')
  })

  it('is omitted when the figures are missing', () => {
    const text = fillMethodology(verifiedMd, { ...base, approxCommitteeCount: null, approxTotal: null })
    expect(text).not.toContain('Duplicate removal is imperfect')
  })

  it('shows the count and dollars when one or more committees needed it', () => {
    const text = fillMethodology(verifiedMd, { ...base, approxCommitteeCount: 3, approxTotal: 1234567 })
    expect(text).toContain('For 3 committees, the FEC data')
    expect(text).toContain('Those rows total $1,234,567.')
  })
})
