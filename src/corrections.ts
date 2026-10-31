import { CONTACT_EMAIL } from './config'

export interface CorrectionEntry {
  date: string
  race: string
  change: string
  reason: string
}

/** Newest first. The log itself is append-only; this only orders a copy for display. */
export function latestCorrections(entries: CorrectionEntry[], limit = 5): CorrectionEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

/** One template for every state: only the state name in the subject and the page link change. */
export function buildMailto(stateName: string | null, pageUrl: string, fetchedAt: string, to: string = CONTACT_EMAIL): string {
  const subject = stateName ? `Money & Margins correction: ${stateName}` : 'Money & Margins correction'
  const body = ['What looks wrong:', '', `Where you saw it: ${pageUrl}`, `Data as of: ${fetchedAt}`, 'Source link (optional):', ''].join('\n')
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
