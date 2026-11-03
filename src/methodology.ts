import verifiedMd from '../docs/methodology.md?raw'
import partialMd from '../docs/methodology-partial.md?raw'
import { formatDate } from './format'

export type MethodBlock =
  | { kind: 'h1' | 'h2' | 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'more' }

export interface MethodologyValues {
  /** ISO timestamp of the latest data fetch. */
  updated: string
  /** ISO timestamp the forecast snapshot was frozen. */
  forecastFrozen: string
  /** True only for the snapshot tagged final-pre-election. Any earlier snapshot reads "latest as of", not "frozen". */
  forecastFinal?: boolean
  /** Latest dissemination date in the data, YYYY-MM-DD, or null when the data does not carry one. */
  latestFiling: string | null
  /** Spending not tied to a candidate, in dollars, or null when there is no such figure. */
  unattributedTotal: number | null
  /** Committees matched to periodic reports by key rather than by coverage date, and the dollars in those rows. */
  approxCommitteeCount: number | null
  approxTotal: number | null
  /** From verification.json, e.g. "Nationally this is at most about 3.4%."; null when there is no figure. */
  doubleCountSentence?: string | null
  /** From the pipeline data, e.g. "Races with incomplete data (Colorado, ...) are left out of the national card."; null when none. */
  incompleteRacesSentence?: string | null
  /** From data/methodology-figures.json, e.g. "As of the latest check, that affects about 0.07% ..."; null when there is no figure. */
  dedupShortfallSentence?: string | null
}

export const HOW_HASH = '#how-it-works'
/** The shareable link that opens the methodology dialog. */
export const isHowHash = (hash: string): boolean => hash.toLowerCase() === HOW_HASH

/** The verified method once the spending data is verified; until then, the partial text. */
export const methodologySource = (verified: boolean): string => (verified ? verifiedMd : partialMd)

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * Fills the {{placeholders}}. Whatever has no figure is dropped, never printed blank: a sentence that exists
 * only to carry a figure goes, a bullet whose figure is missing goes, and no brace ever reaches the screen.
 */
export function fillMethodology(md: string, v: MethodologyValues): string {
  let text = md
  const set = (name: string, value: string | null) => {
    if (value !== null) text = text.split(`{{${name}}}`).join(value)
  }
  set('updated_date', formatDate(v.updated))
  if (!v.forecastFinal) text = text.replace('frozen on {{forecast_freeze_date}}', 'latest as of {{forecast_freeze_date}}').replace('frozen {{forecast_freeze_date}}', 'latest as of {{forecast_freeze_date}}')
  set('forecast_freeze_date', formatDate(v.forecastFrozen))
  set('latest_filing_date', v.latestFiling ? formatDate(`${v.latestFiling}T00:00:00Z`) : null)
  set('approx_committee_count', v.approxCommitteeCount === null ? null : String(v.approxCommitteeCount))
  set('approx_total', v.approxTotal === null ? null : money.format(v.approxTotal))
  set('double_count_sentence', v.doubleCountSentence ?? '')
  set('incomplete_races_sentence', v.incompleteRacesSentence ?? null) // missing: the bullet is dropped below
  set('dedup_shortfall_sentence', v.dedupShortfallSentence ?? null) // missing: the bullet is dropped below
  set('unattributed_sentence', v.unattributedTotal !== null ? `Expenditures not tied to a candidate total ${money.format(v.unattributedTotal)}.` : '')

  return text
    .split('\n')
    .flatMap((line) => {
      if (!line.includes('{{')) return [line]
      if (line.startsWith('- ')) return [] // a bullet that needs a missing figure
      return [line.replace(/\s?[^.!?\n]*\{\{[a-z_]+\}\}[^.!?\n]*[.!?]?/g, '')] // a sentence that needs a missing figure
    })
    .join('\n')
    .replace(/[ \t]+$/gm, '')
}

export function parseMethodology(md: string): MethodBlock[] {
  const blocks: MethodBlock[] = []
  let paragraph: string[] = []
  let list: string[] | null = null
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'p', text: paragraph.join(' ') })
    if (list) blocks.push({ kind: 'ul', items: list })
    paragraph = []
    list = null
  }
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (line === '') flush()
    else if (line.trim() === '<!-- more -->') {
      flush()
      blocks.push({ kind: 'more' })
    } else if (line.startsWith('## ')) {
      flush()
      blocks.push({ kind: 'h2', text: line.slice(3) })
    } else if (line.startsWith('# ')) {
      flush()
      blocks.push({ kind: 'h1', text: line.slice(2) })
    } else if (line.startsWith('- ')) {
      if (paragraph.length > 0) flush()
      list = [...(list ?? []), line.slice(2)]
    } else paragraph.push(line)
  }
  flush()
  return blocks
}

export interface MethodologyParts {
  title: string
  short: MethodBlock[]
  full: MethodBlock[]
}

/** The short version is everything before the <!-- more --> marker; the rest sits under the "Show the full method" toggle. */
export function splitMethodology(blocks: MethodBlock[]): MethodologyParts {
  const title = blocks.find((b) => b.kind === 'h1')
  const rest = blocks.filter((b) => b !== title)
  const at = rest.findIndex((b) => b.kind === 'more')
  return {
    title: title && title.kind === 'h1' ? title.text : 'How this map works',
    short: at === -1 ? rest : rest.slice(0, at),
    full: at === -1 ? [] : rest.slice(at + 1),
  }
}

/** The double-count figure from the latest verification run: "Nationally this is at most about 3.4%." */
export function doubleCountSentence(verification: { runs: { checks: { id: string; summary: string }[] }[] } | null): string | null {
  const latest = verification?.runs.at(-1)?.checks.find((c) => c.id === 'double_count')
  const pct = latest ? /overall ([\d.]+)%/.exec(latest.summary)?.[1] : undefined
  return pct === undefined ? null : `Nationally this is at most about ${Number(pct).toFixed(1)}%.`
}

/** Races left out of the national card for incomplete data, by state name. */
export function incompleteRacesSentence(stateNames: string[]): string | null {
  const names = [...stateNames].sort((a, b) => a.localeCompare(b))
  return names.length === 0 ? null : `Races with incomplete data (${names.join(', ')}) are left out of the national card.`
}

/**
 * The shortfall figure from the latest methodology-figures.json. Null, so the bullet is dropped, when the file
 * is missing, has no figure, or was made for a different fetch than the spending data on the page.
 */
export function dedupShortfallSentence(figures: { fetchedAt?: string; dedupShortfallPct?: number } | null, spendingFetchedAt: string): string | null {
  if (!figures || figures.fetchedAt !== spendingFetchedAt) return null
  const pct = figures.dedupShortfallPct
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null
  return `As of the latest check, that affects about ${pct.toFixed(2)}% of total spending, and no race's shares moved by more than half a point.`
}
