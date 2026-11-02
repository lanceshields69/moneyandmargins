// Decides whether VotePredictor has moved enough to freeze a new snapshot. A rating label change always counts;
// a probability move counts from one point up. Party-blind: the comparison never reads which side is which.
export interface ForecastPoint {
  rating: string | null
  pDemWin: number | null
}

export const PROBABILITY_THRESHOLD = 0.01

export function forecastChanged(frozen: Map<string, ForecastPoint>, live: Map<string, ForecastPoint>): { changed: boolean; reasons: string[] } {
  const reasons: string[] = []
  for (const [state, now] of live) {
    const was = frozen.get(state)
    if (!was) continue
    if (was.rating !== now.rating) reasons.push(`${state}: rating ${was.rating ?? 'none'} -> ${now.rating ?? 'none'}`)
    if (was.pDemWin !== null && now.pDemWin !== null && Math.abs(now.pDemWin - was.pDemWin) >= PROBABILITY_THRESHOLD) {
      reasons.push(`${state}: probability moved ${((now.pDemWin - was.pDemWin) * 100).toFixed(1)} points`)
    }
  }
  return { changed: reasons.length > 0, reasons }
}
