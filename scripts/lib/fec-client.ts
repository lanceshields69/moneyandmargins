// A polite FEC API client: one request at a time, spaced out, under a rolling hourly budget, with
// backoff on 429 and on server errors. The FEC allows 1,000 requests per hour per key.

export interface FecClientOptions {
  apiKey: string
  /** Stay under the FEC's 1,000 per hour with room for other use of the same key. */
  maxPerHour?: number
  minIntervalMs?: number
  maxRetries?: number
  baseUrl?: string
}

export type Params = [string, string][]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createFecClient(options: FecClientOptions) {
  const { apiKey, maxPerHour = 900, minIntervalMs = 1200, maxRetries = 6, baseUrl = 'https://api.open.fec.gov/v1' } = options
  const sent: number[] = []
  let last = 0
  let total = 0
  let coolUntil = 0

  async function waitForBudget(): Promise<void> {
    for (;;) {
      const now = Date.now()
      while (sent.length > 0 && now - sent[0] > 3_600_000) sent.shift()
      const spacing = Math.max(last + minIntervalMs, coolUntil) - now
      if (sent.length < maxPerHour && spacing <= 0) return
      if (sent.length >= maxPerHour) await sleep(Math.max(1000, 3_600_000 - (now - sent[0]) + 1000))
      else await sleep(spacing)
    }
  }

  async function get<T>(path: string, params: Params): Promise<T> {
    const url = new URL(`${baseUrl}${path}`)
    for (const [key, value] of params) url.searchParams.append(key, value)
    url.searchParams.set('api_key', apiKey)

    for (let attempt = 0; ; attempt += 1) {
      await waitForBudget()
      sent.push(Date.now())
      last = Date.now()
      total += 1
      try {
        const res = await fetch(url)
        // The FEC also meters a short window (a 60-request bucket that refills); back off before it empties.
        const remaining = Number(res.headers.get('x-ratelimit-remaining'))
        if (Number.isFinite(remaining) && remaining < 6) coolUntil = Date.now() + 10_000
        if (total % 50 === 0) console.log(`  ${total} FEC requests so far`)
        if (res.ok) return (await res.json()) as T
        const retryable = res.status === 429 || res.status >= 500
        if (!retryable || attempt >= maxRetries) throw new Error(`FEC API request failed: ${res.status} ${res.statusText} (${path})`)
        const retryAfter = Number(res.headers.get('retry-after'))
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(120_000, 2000 * 2 ** attempt)
        console.warn(`FEC ${res.status} on ${path}; retrying in ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${maxRetries})`)
        await sleep(wait)
      } catch (err) {
        // The key is only in the URL, so never print the URL or the thrown request.
        if (err instanceof Error && err.message.startsWith('FEC API request failed')) throw err
        if (attempt >= maxRetries) throw new Error(`FEC API network error after ${maxRetries} retries (${path})`)
        await sleep(Math.min(60_000, 2000 * 2 ** attempt))
      }
    }
  }

  return { get, requestCount: () => total }
}

export type FecClient = ReturnType<typeof createFecClient>
