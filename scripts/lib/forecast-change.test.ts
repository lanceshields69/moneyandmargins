import { describe, expect, it } from 'vitest'
import { forecastChanged } from './forecast-change'

const point = (rating: string | null, pDemWin: number | null) => ({ rating, pDemWin })

describe('when to freeze a new snapshot', () => {
  it('does nothing when nothing moved', () => {
    const frozen = new Map([['TX', point('Lean D', 0.64)]])
    expect(forecastChanged(frozen, new Map([['TX', point('Lean D', 0.64)]])).changed).toBe(false)
  })

  it('freezes on a rating label change, even with the same probability', () => {
    const out = forecastChanged(new Map([['TX', point('Toss-up', 0.5)]]), new Map([['TX', point('Lean D', 0.5)]]))
    expect(out.changed).toBe(true)
    expect(out.reasons[0]).toContain('Toss-up -> Lean D')
  })

  it('freezes on a probability move of one point or more, and not below it', () => {
    expect(forecastChanged(new Map([['TX', point('Lean D', 0.64)]]), new Map([['TX', point('Lean D', 0.655)]])).changed).toBe(true)
    expect(forecastChanged(new Map([['TX', point('Lean D', 0.64)]]), new Map([['TX', point('Lean D', 0.645)]])).changed).toBe(false)
  })

  it('treats a race with no forecast on either side as unchanged, and a new forecast as a change', () => {
    expect(forecastChanged(new Map([['NE', point(null, null)]]), new Map([['NE', point(null, null)]])).changed).toBe(false)
    expect(forecastChanged(new Map([['SD', point(null, null)]]), new Map([['SD', point('Safe R', 0.01)]])).changed).toBe(true)
  })

  it('gives the same answer for a Democratic and a Republican race with the same move', () => {
    const d = forecastChanged(new Map([['AA', point('Lean D', 0.6)]]), new Map([['AA', point('Lean D', 0.62)]]))
    const r = forecastChanged(new Map([['BB', point('Lean R', 0.4)]]), new Map([['BB', point('Lean R', 0.38)]]))
    expect(d.changed).toBe(r.changed)
  })
})
