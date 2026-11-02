// Prediction markers. Ratings come from the frozen VotePredictor snapshot, never at runtime. "Likely" is shown with
// "Lean" (both in one band), so the map has three bands: Safe, Lean, Toss-up.
export type RatingBand = 'safe' | 'lean' | 'tossup'
export type RatingSide = 'D' | 'R'

/** Colors per band and side, from the approved Figma design. Toss-up has one color for both sides. */
export const RATING_COLORS: Record<'safe' | 'lean', Record<RatingSide, string>> & { tossup: string } = {
  safe: { D: '#587cbf', R: '#d85c53' },
  lean: { D: '#85a4de', R: '#e88179' },
  tossup: '#ebb3ae',
}

export function ratingBand(rating: string | null): RatingBand | null {
  if (!rating) return null
  const r = rating.trim().toLowerCase()
  if (r.startsWith('safe')) return 'safe'
  if (r.startsWith('lean') || r.startsWith('likely')) return 'lean'
  if (r.startsWith('toss')) return 'tossup'
  return null
}

/** The side a rating leans toward, from its trailing D or R. Toss-up has none. */
export function ratingSide(rating: string | null): RatingSide | null {
  const last = rating?.trim().slice(-1).toUpperCase()
  return last === 'D' || last === 'R' ? last : null
}

export function markerColor(rating: string | null): string | null {
  const band = ratingBand(rating)
  if (band === null) return null
  if (band === 'tossup') return RATING_COLORS.tossup
  const side = ratingSide(rating)
  return side === null ? null : RATING_COLORS[band][side]
}
