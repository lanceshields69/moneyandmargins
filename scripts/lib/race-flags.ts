// Decides which races carry the "total dropped, under review" flag. Pure and party-blind: it sees race IDs and
// totals only.
import type { RaceFlag, RaceReview } from '../../src/raceFlags'

export const FLAG_MAX_PCT = 2
export const FLAG_MAX_DOLLARS = 100_000

const round = (n: number) => Math.round(n * 100) / 100
const isLargeDrop = (before: number, now: number) => before - now > FLAG_MAX_DOLLARS && (100 * (before - now)) / before > FLAG_MAX_PCT

export function validateReviews(reviews: RaceReview[]): void {
  for (const r of reviews) {
    if (!r.raceId || !r.reason?.trim() || !r.date || !Number.isFinite(r.total)) {
      throw new Error(`data/race-review.json: every entry needs raceId, total, reason and date (bad entry: ${JSON.stringify(r)})`)
    }
  }
}

/**
 * - A race that dropped by more than 2% and $100K since the previous run is flagged.
 * - A flag carries over to later runs until a person reviews the race.
 * - A reviewed race is unflagged and stays so until its total drops, from the total the person accepted, by more
 *   than 2% and $100K again; that is the next large change, not the next run.
 */
export function computeRaceFlags(input: {
  previous: Record<string, number> | null
  current: Record<string, { state: string; total: number }>
  carried: RaceFlag[]
  reviews: RaceReview[]
  fetchedAt: string
}): RaceFlag[] {
  const carried = new Map(input.carried.map((f) => [f.raceId, f]))
  const reviewed = new Map(input.reviews.map((r) => [r.raceId, r]))
  const out: RaceFlag[] = []
  for (const [raceId, { state, total }] of Object.entries(input.current).sort(([a], [b]) => a.localeCompare(b))) {
    const review = reviewed.get(raceId)
    const before = review ? review.total : input.previous?.[raceId]
    if (before !== undefined && isLargeDrop(before, total)) {
      out.push({ raceId, state, prior: round(before), now: round(total), drop: round(before - total), dropPct: round((100 * (before - total)) / before), flaggedAt: input.fetchedAt })
    } else if (!review && carried.has(raceId)) {
      out.push(carried.get(raceId) as RaceFlag)
    }
  }
  return out
}
