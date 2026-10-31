const compactK = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** $950, $784.7K, $95.0M (always one decimal), $1.04B (always two). */
export function formatMoney(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return value < 1000 ? full.format(value) : compactK.format(value)
}

export function formatMoneyFull(value: number): string {
  return full.format(value)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' UTC'
}

export function formatMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  return `${date}, ${time} UTC`
}

/**
 * The as-of label. Verified data: "itemized data through Oct 30, 2026 UTC; fetched Oct 31, 2026, 16:09 UTC", where the
 * date is the latest dissemination date among the rows that count. Otherwise: "latest filing ...; fetched ...".
 */
export function formatAsOf(latestDissemination: string | null, fetchedAt: string, itemized = false): string {
  const fetched = `fetched ${formatDateTime(fetchedAt)}`
  if (!latestDissemination) return fetched
  const through = formatDate(`${latestDissemination}T00:00:00Z`)
  return itemized ? `itemized data through ${through}; ${fetched}` : `latest filing ${through}; ${fetched}`
}
