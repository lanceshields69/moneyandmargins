import type { RaceView } from './computeSpending'

/**
 * The state shown when nothing else is chosen: the highest total reported spending among races with no
 * incomplete-data flag. Only totals decide; party is never read. Ties go to the earlier state code.
 */
export function pickDefaultState(races: readonly RaceView[]): string | null {
  const eligible = races.filter((r) => r.incompleteCount === 0 && r.total !== null)
  if (eligible.length === 0) return null
  return [...eligible].sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || a.state.localeCompare(b.state))[0].state
}

/** `#TX` or `#tx` opens Texas. Anything that is not a state with a race is ignored. */
export function parseHashState(hash: string, valid: ReadonlySet<string>): string | null {
  const value = hash.replace(/^#/, '').trim().toUpperCase()
  return valid.has(value) ? value : null
}

export interface InitialSelection {
  state: string | null
  /** True only when the rule, not the visitor or a link, chose the state. */
  isDefault: boolean
}

/** A hash link always wins. With no hash, desktop uses the rule and a phone starts closed. */
export function initialSelection({ hash, isMobile, races }: { hash: string; isMobile: boolean; races: readonly RaceView[] }): InitialSelection {
  const fromHash = parseHashState(hash, new Set(races.map((r) => r.state)))
  if (fromHash) return { state: fromHash, isDefault: false }
  if (isMobile) return { state: null, isDefault: false }
  const picked = pickDefaultState(races)
  return { state: picked, isDefault: picked !== null }
}
