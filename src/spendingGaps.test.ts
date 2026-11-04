import { describe, expect, it } from 'vitest'
import type { Callout } from './computeCallout'
import { allRaces, callouts, stateNames } from './data'
import type { RaceView, RowView } from './computeSpending'
import { incompleteRacesClause, outspentWins, spendingGapCopy, type OutspentWin } from './spendingGaps'
import type { ResultStage } from './results'
import type { Party } from './types'

const name = (s: string) => stateNames.get(s) ?? s

const row = (id: string, party: Party, support: number, oppose: number): RowView =>
  ({ candidateId: id, name: id, party, partyLabel: party, partyColor: '', incomplete: false, reason: null, support: { value: support, widthPct: 0 }, oppose: { value: oppose, widthPct: 0 }, topSupportCommittees: [], topOpposeCommittees: [], sourceUrl: null, asOf: null }) as RowView
const race = (state: string, rows: RowView[], incompleteCount = 0): RaceView => ({ raceId: `${state}-2026`, state, raceName: state, isSpecial: false, rows, scaleMax: 0, total: 0, incompleteCount, missingMajor: [] })
const call = (stage: ResultStage, winnerParty: Party | null): Callout => ({ result: { stage, winnerParty } }) as unknown as Callout

describe('big spending gaps', () => {
  // D aligned = 100 + 400 = 500; R aligned = 900 + 50 = 950, so the Democratic winner was outspent by 450.
  const dWinsOutspent = race('AA', [row('a-d', 'D', 100, 50), row('a-r', 'R', 900, 400)])
  // Mirror: the Republican wins while outspent by the same amount.
  const rWinsOutspent = race('BB', [row('b-d', 'D', 900, 400), row('b-r', 'R', 100, 50)])

  it('finds a winner whose party had less aligned spending, by how much, and against which party', () => {
    const wins = outspentWins([dWinsOutspent], new Map([['AA', call('flip', 'D')]]))
    expect(wins).toEqual([{ state: 'AA', winnerName: 'a-d', winnerParty: 'D', outspendingParty: 'R', gap: 450 }])
  })

  it('does the same for the other party, mirrored', () => {
    const wins = outspentWins([rWinsOutspent], new Map([['BB', call('win', 'R')]]))
    expect(wins).toEqual([{ state: 'BB', winnerName: 'b-r', winnerParty: 'R', outspendingParty: 'D', gap: 450 }])
  })

  it('leaves out a winner who was not outspent, a race still reporting, and a race with incomplete data', () => {
    expect(outspentWins([dWinsOutspent], new Map([['AA', call('win', 'R')]]))).toEqual([])
    expect(outspentWins([dWinsOutspent], new Map([['AA', call('reporting', null)]]))).toEqual([])
    expect(outspentWins([race('AA', dWinsOutspent.rows, 1)], new Map([['AA', call('win', 'D')]]))).toEqual([])
  })

  it('orders by the size of the gap', () => {
    const big = race('CC', [row('c-d', 'D', 0, 0), row('c-r', 'R', 5000, 0)])
    const wins = outspentWins([dWinsOutspent, big], new Map([['AA', call('win', 'D')], ['CC', call('win', 'D')]]))
    expect(wins.map((w) => w.state)).toEqual(['CC', 'AA'])
  })

  it('on the real data, names the winners who were outspent and the figures come from the data', () => {
    const wins = outspentWins(allRaces.races, callouts)
    expect(wins.length).toBeGreaterThan(0)
    for (const w of wins) expect(w.gap).toBeGreaterThan(0)
    const texas = wins.find((w) => w.state === 'TX')
    expect(texas?.winnerName).toBe('James Talarico')
    expect(texas?.outspendingParty).toBe('R')
  })
})

describe('the footer copy', () => {
  const win = (state: string, winnerName: string, winnerParty: 'D' | 'R', outspendingParty: 'D' | 'R', gap: number): OutspentWin => ({ state, winnerName, winnerParty, outspendingParty, gap })

  it('reads as the design text: a heading naming the winning party, and a sentence for each of the two largest gaps', () => {
    const copy = spendingGapCopy([win('TX', 'James Talarico', 'D', 'R', 177.4e6), win('OH', 'Sherrod Brown', 'D', 'R', 102.9e6)], name)!
    expect(copy.heading).toBe('Big spending gaps, Democratic wins')
    expect(copy.body).toBe(
      'In Texas, reported outside spending aligned with Republicans exceeded Democratic aligned spending by $177.4 million, yet James Talarico won. ' +
        'In Ohio, the Republican aligned spending advantage was $102.9 million, yet Sherrod Brown won. ' +
        'These figures show where outside groups spent their money; they do not establish why voters chose either candidate.',
    )
  })

  it('mirrors for the other party', () => {
    const copy = spendingGapCopy([win('TX', 'A Rep', 'R', 'D', 10e6), win('OH', 'B Rep', 'R', 'D', 5e6)], name)!
    expect(copy.heading).toBe('Big spending gaps, Republican wins')
    expect(copy.body).toContain('reported outside spending aligned with Democrats exceeded Republican aligned spending by $10.0 million, yet A Rep won.')
    expect(copy.body).toContain('the Democratic aligned spending advantage was $5.0 million')
  })

  it('does not name one party in the heading when the two winners are from different parties', () => {
    expect(spendingGapCopy([win('TX', 'A', 'D', 'R', 2e6), win('OH', 'B', 'R', 'D', 1e6)], name)!.heading).toBe('Big spending gaps, outspent candidates win')
  })

  it('handles one gap, and none', () => {
    const one = spendingGapCopy([win('TX', 'A', 'D', 'R', 2e6)], name)!
    expect(one.body).not.toContain('In Ohio')
    expect(one.body.match(/yet/g)).toHaveLength(1)
    expect(spendingGapCopy([], name)).toBeNull()
  })

  it('says how many races have incomplete data in words, and says nothing when there are none', () => {
    expect(incompleteRacesClause(6)).toBe('six races have incomplete data')
    expect(incompleteRacesClause(1)).toBe('one race has incomplete data')
    expect(incompleteRacesClause(14)).toBe('14 races have incomplete data')
    expect(incompleteRacesClause(0)).toBeNull()
  })
})
