import { describe, expect, it } from 'vitest'
import { buildMarkers } from './components/RatingMarkers'
import { markerColor, ratingBand, ratingSide, RATING_COLORS } from './ratings'
import { allRaces, forecastSnapshot } from './data'
import { labelPoints, mapViewBox } from './data'

describe('rating bands', () => {
  it('maps Safe, Lean and Likely to two bands and Toss-up to its own', () => {
    expect(ratingBand('Safe R')).toBe('safe')
    expect(ratingBand('Safe D')).toBe('safe')
    expect(ratingBand('Lean R')).toBe('lean')
    expect(ratingBand('Lean D')).toBe('lean')
    expect(ratingBand('Likely D')).toBe('lean')
    expect(ratingBand('Toss-up')).toBe('tossup')
    expect(ratingBand(null)).toBeNull()
    expect(ratingBand('Some new label')).toBeNull()
  })

  it('reads the side from the trailing D or R, and Toss-up has none', () => {
    expect(ratingSide('Likely D')).toBe('D')
    expect(ratingSide('Safe R')).toBe('R')
    expect(ratingSide('Toss-up')).toBeNull()
  })
})

describe('symmetry: swapping the sides swaps the colors and nothing else', () => {
  it('a Democratic rating and its Republican mirror get each other\'s side color', () => {
    expect(markerColor('Lean D')).toBe(RATING_COLORS.lean.D)
    expect(markerColor('Lean R')).toBe(RATING_COLORS.lean.R)
    expect(markerColor('Safe D')).toBe(RATING_COLORS.safe.D)
    expect(markerColor('Safe R')).toBe(RATING_COLORS.safe.R)
    expect(markerColor('Likely D')).toBe(markerColor('Lean D'))
  })

  it('Toss-up has one color whichever side the rating names', () => {
    expect(markerColor('Toss-up')).toBe(RATING_COLORS.tossup)
  })
})

describe('markers on the map', () => {
  it('places one marker per state with a rating, and none with no forecast', () => {
    const markers = buildMarkers(
      [{ state: 'TX', rating: 'Lean D' }, { state: 'NE', rating: null }, { state: 'SD', rating: null }],
      (st) => labelPoints.get(st),
      mapViewBox,
    )
    expect(markers.map((m) => m.state)).toEqual(['TX'])
    expect(markers[0].x).toBeGreaterThanOrEqual(0)
    expect(markers[0].x).toBeLessThanOrEqual(1)
  })

  it('shows a marker for every state the snapshot rates, and none for Nebraska or South Dakota', () => {
    const markers = buildMarkers(forecastSnapshot.races, (st) => labelPoints.get(st), mapViewBox)
    const states = markers.map((m) => m.state)
    expect(states).not.toContain('NE')
    expect(states).not.toContain('SD')
    expect(states.length).toBe(forecastSnapshot.races.filter((r) => r.rating).length)
    for (const race of allRaces.races) if (race.state !== 'NE' && race.state !== 'SD') expect(states).toContain(race.state)
  })
})
