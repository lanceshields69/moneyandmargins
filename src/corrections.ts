import { CONTACT_EMAIL } from './config'
import { formatDate } from './format'
import type { MethodBlock } from './methodology'

export interface CorrectionEntry {
  /** The deploy date the correction took effect, YYYY-MM-DD. */
  date: string
  text: string
}

export const CORRECTIONS_HASH = '#corrections'
export const isCorrectionsHash = (hash: string): boolean => hash.toLowerCase() === CORRECTIONS_HASH

/** Newest first. The log is append-only; this only orders a copy for display. */
export function latestCorrections(entries: CorrectionEntry[], limit = 10): CorrectionEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

/** The Corrections dialog reuses the methodology dialog: a title, then one paragraph per entry. */
export function correctionsBlocks(entries: CorrectionEntry[]): MethodBlock[] {
  const latest = latestCorrections(entries)
  return [
    { kind: 'h1', text: 'Corrections' },
    ...(latest.length === 0
      ? [{ kind: 'p' as const, text: 'No corrections yet.' }]
      : latest.map((e) => ({ kind: 'p' as const, text: `**${formatDate(`${e.date}T00:00:00Z`)}.** ${e.text} Corrected ${formatDate(`${e.date}T00:00:00Z`)}.` }))),
  ]
}

/** One template for every state: only the state name in the subject and the page link change. */
export function buildMailto(stateName: string | null, pageUrl: string, fetchedAt: string, to: string = CONTACT_EMAIL): string {
  const subject = stateName ? `Money & Margins correction: ${stateName}` : 'Money & Margins correction'
  const body = ['What looks wrong:', '', `Where you saw it: ${pageUrl}`, `Data as of: ${fetchedAt}`, 'Source link (optional):', ''].join('\n')
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
