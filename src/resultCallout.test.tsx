import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MapCallout from './components/MapCallout'
import StateMarks, { buildStateMarks, marksFromCallouts } from './components/StateMarks'
import { buildCallout, type Callout } from './computeCallout'
import { allRaces, callouts, labelPoints, mapViewBox, stateNames } from './data'
import { buildResultCallout, RESULT_HEADING, type RaceResultData, type ResultCallout, type ResultStage } from './results'
import type { Party } from './types'

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
const [demId, repId] = tx.sides.map((s) => s.candidateId) // fixed order: Democrats left, Republicans right

const withResult = (result: ResultCallout): Callout => ({ ...tx, result })
const render = (callout: Callout) => renderToStaticMarkup(<MapCallout callout={callout} stateName="Texas" anchor={{ x: 0.5, y: 0.5 }} isDefault={false} onClose={() => {}} onOpenHow={() => {}} sharesVerified />)
const stateName = (st: string) => stateNames.get(st) ?? st
const marksFor = (callout: Callout) => {
  const marked = new Map(callouts)
  marked.set('TX', callout)
  return buildStateMarks(marksFromCallouts(marked, stateName), (st) => labelPoints.get(st), mapViewBox).find((m) => m.state === 'TX')!
}

const none: ResultCallout = { stage: 'none', percentReporting: null, shares: { [demId]: null, [repId]: null }, winnerCandidateId: null, winnerParty: null, asOf: null, sourceUrl: null, note: null }
const reporting: ResultCallout = { stage: 'reporting', percentReporting: 41, shares: { [demId]: 58, [repId]: 42 }, winnerCandidateId: null, winnerParty: null, asOf: '2026-11-03T20:00:00Z', sourceUrl: 'https://civicapi.org/decision-2026', note: null }
const win = (winner: string, party: Party): ResultCallout => ({ stage: 'win', percentReporting: 100, shares: { [demId]: 55, [repId]: 45 }, winnerCandidateId: winner, winnerParty: party, asOf: '2026-11-04T01:00:00Z', sourceUrl: 'https://civicapi.org/decision-2026', note: null })
const flip = (winner: string, party: Party): ResultCallout => ({ ...win(winner, party), stage: 'flip' })
const STAGES: [ResultStage, ResultCallout][] = [['none', none], ['reporting', reporting], ['win', win(demId, 'D')], ['flip', flip(demId, 'D')]]

const checks = (html: string) => html.match(/chip-check/g)?.length ?? 0

describe('the four statuses in the callout', () => {
  it('none: "Results" with "--" only where civicAPI has no data, and the Other forecasts link', () => {
    const html = render(withResult(none))
    expect(html).toContain('Results:')
    expect(html).not.toContain('not added')
    expect(html).toContain('--')
    expect(html).toContain('Other forecasts')
    expect(html).not.toContain('Source: ')
    expect(checks(html)).toBe(0)
  })

  it('reporting: the "Reporting" heading with the current counts, no checkmark, no party-color result', () => {
    const html = render(withResult(reporting))
    expect(html).toContain('Reporting:')
    expect(html).not.toContain('Results (win)')
    expect(html).not.toContain('Results (flip)')
    expect(html).toContain('58%')
    expect(html).toContain('42%')
    expect(html).toContain('41% reporting')
    expect(checks(html)).toBe(0)
    expect(html).not.toContain('Other forecasts')
  })

  it('win: "Results (win)" and the black checkmark on the winner\'s square', () => {
    const html = render(withResult(win(demId, 'D')))
    expect(html).toContain('Results (win):')
    expect(html).not.toContain('Reporting:')
    expect(checks(html)).toBe(1)
    expect(html).toContain('stroke="#000"') // black, not a party color
    expect(html).toContain('55%')
  })

  it('flip: "Results (flip)" and no checkmark', () => {
    const html = render(withResult(flip(demId, 'D')))
    expect(html).toContain('Results (flip):')
    expect(html).not.toContain('Reporting:')
    expect(checks(html)).toBe(0)
  })

  it('has no outline box around a result, in any status', () => {
    for (const [, result] of STAGES) expect(render(withResult(result))).not.toContain('cc-lead-col')
  })

  it('every status that has data shows "Source: civicAPI, [as-of time]." and keeps "Predicted to win"', () => {
    for (const [stage, result] of STAGES) {
      const html = render(withResult(result))
      expect(html).toContain('Predicted to win:')
      if (stage === 'none') continue
      expect(html).toContain('Source: ')
      expect(html).toMatch(/>civicAPI<\/a>, [A-Z][a-z]{2} \d{1,2}, /)
    }
  })

  it('the checkmark appears on Win only', () => {
    for (const [stage, result] of STAGES) expect(checks(render(withResult(result)))).toBe(stage === 'win' ? 1 : 0)
  })
})

describe('the map chip for each status', () => {
  it('win: solid party color, the state code, a checkmark, and the accessible label "[State]: [party], Win."', () => {
    const m = marksFor(withResult(win(demId, 'D')))
    expect(m).toMatchObject({ kind: 'win', code: 'TX', check: true, ariaLabel: 'Texas: Democratic, Win.' })
    expect(m.color).not.toBeNull()
  })

  it('flip: party color with the dashed border class, no checkmark, label ends ", Flip."', () => {
    const m = marksFor(withResult(flip(demId, 'D')))
    expect(m).toMatchObject({ kind: 'flip', code: 'TX', check: false, ariaLabel: 'Texas: Democratic, Flip.' })
    expect(m.color).not.toBeNull()
    const html = renderToStaticMarkup(<StateMarks marks={[m]} />)
    expect(html).toContain('state-chip-flip')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Texas: Democratic, Flip."')
    expect(checks(html)).toBe(0)
  })

  it('reporting: off-white, no party color, no checkmark, no party in the label', () => {
    const m = marksFor(withResult(reporting))
    expect(m).toMatchObject({ kind: 'reporting', code: 'TX', color: null, check: false, ariaLabel: 'Texas: Reporting.' })
    expect(m.ariaLabel).not.toMatch(/Democratic|Republican/)
  })

  it('none: no chip; the race keeps its forecast circle', () => {
    const m = marksFor(withResult(none))
    expect(m.kind).toBe('circle')
    expect(m.code).toBeNull()
    expect(m.check).toBe(false)
    const html = renderToStaticMarkup(<StateMarks marks={[m]} />)
    expect(html).not.toContain('state-chip-result')
  })

  it('a race never shows two statuses: the chip, heading and checkmark all read the one status', () => {
    const expected: Record<ResultStage, { kind: string; heading: string }> = {
      none: { kind: 'circle', heading: 'Results:' },
      reporting: { kind: 'reporting', heading: 'Reporting:' },
      win: { kind: 'win', heading: 'Results (win):' },
      flip: { kind: 'flip', heading: 'Results (flip):' },
    }
    for (const [stage, result] of STAGES) {
      const callout = withResult(result)
      const html = render(callout)
      expect(marksFor(callout).kind).toBe(expected[stage].kind)
      expect(RESULT_HEADING[stage]).toBe(expected[stage].heading)
      const headings = Object.values(RESULT_HEADING).filter((h) => html.includes(h))
      expect(headings).toEqual([expected[stage].heading])
    }
  })

  it('every mark covers a real race, with one mark per state', () => {
    const marks = buildStateMarks(marksFromCallouts(callouts, stateName), (st) => labelPoints.get(st), mapViewBox)
    for (const m of marks) expect(allRaces.races.some((r) => r.state === m.state)).toBe(true)
    expect(new Set(marks.map((m) => m.state)).size).toBe(marks.length)
  })
})

describe('Win or Flip comes from the seat\'s prior holder', () => {
  const race: RaceResultData = { status: 'Win', percentReporting: 100, note: null, sourceUrl: 'https://x.test', asOf: '2026-11-04T01:00:00Z', winnerCandidateId: demId, votesByCandidate: new Map([[demId, 55], [repId, 45]]) }
  const parties = new Map<string, Party>([[demId, 'D'], [repId, 'R']])
  const stageFor = (winner: string, holder: Party | null) => buildResultCallout([demId, repId], { ...race, winnerCandidateId: winner }, parties, holder).stage

  it('a Democratic win in a Republican-held seat is Flip, and the reverse holds', () => {
    expect(stageFor(demId, 'R')).toBe('flip')
    expect(stageFor(repId, 'D')).toBe('flip')
  })

  it('a win by the party that held the seat is Win, for either party', () => {
    expect(stageFor(demId, 'D')).toBe('win')
    expect(stageFor(repId, 'R')).toBe('win')
  })

  it('a race with a winner and an unknown prior holder is held as Reporting, never guessed', () => {
    expect(stageFor(demId, null)).toBe('reporting')
  })

  it('no winner flag from civicAPI means Reporting, whatever the votes say', () => {
    const out = buildResultCallout([demId, repId], { ...race, status: 'Reporting', winnerCandidateId: null, votesByCandidate: new Map([[demId, 99], [repId, 1]]) }, parties, 'R')
    expect(out.stage).toBe('reporting')
    expect(out.winnerCandidateId).toBeNull()
  })

  it('the seven flipped seats in the data are Flip when a Democrat wins, and Win when the holder wins', () => {
    const holders = Object.fromEntries(['TX', 'KS', 'OH', 'ME', 'IA', 'NC', 'SC'].map((s) => [s, 'R' as Party]))
    const stages = Object.keys(holders).map((st) => {
      const c = callouts.get(st)!
      const d = c.sides.find((s) => s.party === 'D')!.candidateId
      const result = buildResultCallout(c.sides.map((s) => s.candidateId), { ...race, winnerCandidateId: d, votesByCandidate: new Map(c.sides.map((s, i) => [s.candidateId, i === 0 ? 55 : 45])) }, new Map(c.sides.map((s) => [s.candidateId, s.party])), holders[st])
      return result.stage
    })
    expect(stages.every((s) => s === 'flip')).toBe(true)
  })
})

describe('the callout order is fixed by party', () => {
  it('Democrats left, Republicans right, whichever side leads', () => {
    const demWins = render(withResult(win(demId, 'D')))
    const repWins = render(withResult(win(repId, 'R')))
    const order = (html: string) => [...html.matchAll(/aria-label="(Democratic|Republican)[^"]*"/g)].map((m) => m[1])
    expect(order(demWins)).toEqual(['Democratic', 'Republican'])
    expect(order(repWins)).toEqual(['Democratic', 'Republican'])
    expect(tx.sides.map((s) => s.party)).toEqual(['D', 'R'])
  })

  it('puts an independent after the Democrat or the Republican, never before', () => {
    const ne = callouts.get('NE')!
    expect(ne.sides.map((s) => s.party)).toEqual(['R', 'I'])
    const rows = allRaces.races.find((r) => r.state === 'NE')!
    expect(buildCallout(rows, undefined).sides.map((s) => s.party)).toEqual(['R', 'I'])
  })
})

describe('swapping party labels mirrors every chip and value, except the fixed order', () => {
  it('the same status, the mirrored party color, and the same shares', () => {
    const a = marksFor(withResult(flip(demId, 'D')))
    const b = marksFor(withResult(flip(repId, 'R')))
    expect(a.kind).toBe(b.kind)
    expect(a.check).toBe(b.check)
    expect(a.color).not.toBe(b.color)
    expect(a.ariaLabel.replace('Democratic', 'X')).toBe(b.ariaLabel.replace('Republican', 'X'))
    expect(tx.sides.map((s) => s.party)).toEqual(['D', 'R']) // the order does not mirror
  })

  it('a Republican win in a Democratic-held seat mirrors a Democratic win in a Republican-held one', () => {
    const parties = new Map<string, Party>([[demId, 'D'], [repId, 'R']])
    const swapped = new Map<string, Party>([[demId, 'R'], [repId, 'D']])
    const base: RaceResultData = { status: 'Win', percentReporting: 100, note: null, sourceUrl: 'https://x.test', asOf: '2026-11-04T01:00:00Z', winnerCandidateId: demId, votesByCandidate: new Map([[demId, 61], [repId, 39]]) }
    const a = buildResultCallout([demId, repId], base, parties, 'R')
    const b = buildResultCallout([demId, repId], base, swapped, 'D')
    expect(b.stage).toBe(a.stage)
    expect(b.shares).toEqual(a.shares)
    expect(b.winnerParty).toBe('R')
    expect(a.winnerParty).toBe('D')
  })
})
