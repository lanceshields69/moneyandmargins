import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MapCallout from './components/MapCallout'
import { buildStateMarks, marksFromCallouts } from './components/StateMarks'
import type { Callout } from './computeCallout'
import { allRaces, callouts, labelPoints, mapViewBox, stateNames } from './data'
import type { ResultCallout } from './results'

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

const tx = callouts.get('TX')!
const [demId, repId] = tx.sides.map((s) => s.candidateId) // alphabetical by party label: Democratic, then Republican

const withResult = (result: ResultCallout): Callout => ({ ...tx, result })
const render = (callout: Callout) => renderToStaticMarkup(<MapCallout callout={callout} stateName="Texas" anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} onOpenHow={() => {}} sharesVerified />)

const notAdded: ResultCallout = { stage: 'not-added', percentReporting: null, shares: { [demId]: null, [repId]: null }, leadingCandidateId: null, asOf: null, sourceUrl: null, note: null }
const counting: ResultCallout = { stage: 'counting', percentReporting: 41, shares: { [demId]: 58, [repId]: 42 }, leadingCandidateId: null, asOf: '2026-11-03T20:00:00Z', sourceUrl: 'https://x.test/tx', note: null }
const unofficial: ResultCallout = { stage: 'unofficial', percentReporting: 98, shares: { [demId]: 55, [repId]: 45 }, leadingCandidateId: demId, asOf: '2026-11-03T21:00:00Z', sourceUrl: 'https://x.test/tx', note: null }
const certified: ResultCallout = { stage: 'certified', percentReporting: 100, shares: { [demId]: 55, [repId]: 45 }, leadingCandidateId: demId, asOf: '2026-11-10T12:00:00Z', sourceUrl: 'https://x.test/tx', note: null }

describe('the four Result stages', () => {
  it('not-added: the heading, "--" placeholders, and the Other forecasts link', () => {
    const html = render(withResult(notAdded))
    expect(html).toContain('Results (not added)')
    expect(html.match(/--%/g) ?? []).toHaveLength(0)
    expect(html).toContain('--') // placeholders, not percentages
    expect(html).not.toMatch(/\d+%<\/span><\/div>\s*$/) // no stray percent in the result row
    expect(html).toContain('Other forecasts')
  })

  it('counting: the heading with percent reporting, shares, and no leader mark, no Other forecasts link', () => {
    const html = render(withResult(counting))
    expect(html).toContain('Results (counting)')
    expect(html).toContain('41% reporting')
    expect(html).toContain('58%')
    expect(html).toContain('42%')
    expect(html).not.toContain('cc-square-dashed')
    expect(html).not.toContain('cc-square-solid')
    expect(html).not.toContain('✓')
    expect(html).not.toContain('Other forecasts')
  })

  it('unofficial: the heading, shares, a dashed box on the leader, no checkmark, no Other forecasts link', () => {
    const html = render(withResult(unofficial))
    expect(html).toContain('Results (unofficial)')
    expect(html).toContain('55%')
    expect(html).toContain('45%')
    expect(html).toContain('cc-square-dashed')
    expect(html).not.toContain('cc-square-solid')
    expect(html).not.toContain('✓')
    expect(html).not.toContain('Other forecasts')
  })

  it('certified: the heading, shares, a solid box and a checkmark on the leader, no Other forecasts link', () => {
    const html = render(withResult(certified))
    expect(html).toContain('Results (certified)')
    expect(html).toContain('cc-square-solid')
    expect(html).not.toContain('cc-square-dashed')
    expect(html).toContain('✓')
    expect(html.match(/✓/g) ?? []).toHaveLength(1) // the checkmark marks only the leader, never both sides
    expect(html).not.toContain('Other forecasts')
  })

  it('the checkmark appears in no other stage', () => {
    for (const result of [notAdded, counting, unofficial]) expect(render(withResult(result))).not.toContain('✓')
  })

  it('the Other forecasts link appears only at not-added', () => {
    for (const result of [counting, unofficial, certified]) expect(render(withResult(result))).not.toContain('Other forecasts')
    expect(render(withResult(notAdded))).toContain('Other forecasts')
  })

  it('every stage shows an as-of time and a source line, except not-added', () => {
    expect(render(withResult(notAdded))).not.toContain('Source')
    for (const result of [counting, unofficial, certified]) expect(render(withResult(result))).toContain('Source')
  })

  it('the forecast row ("Predicted to win") stays visible in every stage', () => {
    for (const result of [notAdded, counting, unofficial, certified]) expect(render(withResult(result))).toContain('Predicted to win')
  })

  it('swapping which side is leading mirrors the dashed/solid box and the checkmark, with no party branch', () => {
    const demLeads = render(withResult({ ...certified, leadingCandidateId: demId }))
    const repLeads = render(withResult({ ...certified, leadingCandidateId: repId }))
    expect(demLeads.split('cc-square-solid').length).toBe(repLeads.split('cc-square-solid').length)
    expect(demLeads.split('✓').length).toBe(repLeads.split('✓').length)
  })
})

describe('headings and shapes use the same rule for every race', () => {
  it('shows the same heading text for every race at the same stage, and the same layout', () => {
    const headings = new Set<string>()
    for (const [state, callout] of callouts) {
      const html = render({ ...callout, result: counting })
      const m = /Results \(counting\)/.exec(html)
      expect(m).not.toBeNull()
      headings.add(state ? 'Results (counting)' : '')
    }
    expect(headings.size).toBe(1)
  })
})

describe('state marks: circle, ring, square', () => {
  const stateName = (st: string) => stateNames.get(st) ?? st

  it('draws a ring while counting, with an aria-label naming the percent reporting, not a party', () => {
    const marked = new Map(callouts)
    marked.set('TX', withResult(counting))
    const marks = buildStateMarks(marksFromCallouts(marked, stateName), (st) => labelPoints.get(st), mapViewBox)
    const tx = marks.find((m) => m.state === 'TX')!
    expect(tx.kind).toBe('ring')
    expect(tx.color).toBeNull()
    expect(tx.ariaLabel).toContain('41 percent reporting')
    expect(tx.ariaLabel).not.toMatch(/Democratic|Republican/)
  })

  it('draws a square with the party letter and a dashed outline at unofficial, solid at certified', () => {
    const marked = new Map(callouts)
    marked.set('TX', withResult(unofficial))
    let marks = buildStateMarks(marksFromCallouts(marked, stateName), (st) => labelPoints.get(st), mapViewBox)
    let tx = marks.find((m) => m.state === 'TX')!
    expect(tx.kind).toBe('square')
    expect(tx.outline).toBe('dashed')
    expect(tx.letter).not.toBeNull()

    marked.set('TX', withResult(certified))
    marks = buildStateMarks(marksFromCallouts(marked, stateName), (st) => labelPoints.get(st), mapViewBox)
    tx = marks.find((m) => m.state === 'TX')!
    expect(tx.outline).toBe('solid')
  })

  it('draws a party-tinted circle before counting, when the forecast covers the race', () => {
    const marks = buildStateMarks(marksFromCallouts(callouts, stateName), (st) => labelPoints.get(st), mapViewBox)
    const tx = marks.find((m) => m.state === 'TX')!
    expect(tx.kind).toBe('circle')
    expect(tx.color).not.toBeNull()
  })

  it('every mark covers a real race, and every race with a known outcome has a mark', () => {
    const marks = buildStateMarks(marksFromCallouts(callouts, stateName), (st) => labelPoints.get(st), mapViewBox)
    const states = new Set(marks.map((m) => m.state))
    for (const m of marks) expect(allRaces.races.some((r) => r.state === m.state)).toBe(true)
    expect(states.size).toBe(marks.length) // one mark per state
  })

  it('swapping the leading party swaps the mark color and letter, symmetrically', () => {
    const demLeads = new Map(callouts)
    demLeads.set('TX', withResult({ ...certified, leadingCandidateId: demId }))
    const repLeads = new Map(callouts)
    repLeads.set('TX', withResult({ ...certified, leadingCandidateId: repId }))
    const a = buildStateMarks(marksFromCallouts(demLeads, stateName), (st) => labelPoints.get(st), mapViewBox).find((m) => m.state === 'TX')!
    const b = buildStateMarks(marksFromCallouts(repLeads, stateName), (st) => labelPoints.get(st), mapViewBox).find((m) => m.state === 'TX')!
    expect(a.letter).not.toBe(b.letter)
    expect(a.color).not.toBe(b.color)
    expect(a.outline).toBe(b.outline)
  })
})
