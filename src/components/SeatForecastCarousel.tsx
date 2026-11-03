import { useEffect, useRef, useState } from 'react'
import domeRaw from '../assets/forecast/capitol-dome.svg?raw'
import { PARTY_DISPLAY } from '../computeSpending'
import { formatMonthDay } from '../format'
import type { SeatForecastEntry } from '../seatForecastSources'

const ROTATE_MS = 3000
const DOME_WIDTH = 663.755
const DOME_HEIGHT = 433.334
const DOME_PATH = (/<path[^>]*\bd="([^"]+)"/.exec(domeRaw)?.[1]) ?? ''
/** Halyard Display inherits font-variant-numeric: tabular-nums from body, which blows out its word-spacing at
 * large sizes; same fix as ShareCard.tsx's TIGHT constant. */
const TIGHT = { wordSpacing: '-0.08em' } as const

/** "Nov 2nd": a short month/day with an ordinal suffix, matching the Figma frame's "Forecast updated Nov 2nd". */
function ordinalMonthDay(iso: string): string {
  const day = new Date(iso).getUTCDate()
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${formatMonthDay(iso)}${suffix}`
}

function Card({ entry }: { entry: SeatForecastEntry }) {
  const boundaryX = (entry.dSeats / 100) * DOME_WIDTH
  const clipId = `seat-forecast-clip-${entry.key}`
  return (
    <svg viewBox={`0 0 ${DOME_WIDTH} 511`} width="100%" height="100%" role="img" aria-label={`${entry.sourceName}: ${entry.dSeats} Democratic seats, ${entry.rSeats} Republican seats, forecast as of ${entry.asOf}`}>
      <defs>
        <clipPath id={clipId}>
          <path d={DOME_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={0} y={0} width={boundaryX} height={DOME_HEIGHT} fill={PARTY_DISPLAY.D.color} />
        <rect x={boundaryX} y={0} width={DOME_WIDTH - boundaryX} height={DOME_HEIGHT} fill={PARTY_DISPLAY.R.color} />
      </g>

      <text x={17} y={123} fontFamily="var(--font-display)" fontWeight={600} fontSize={44} fill="var(--color-text)" style={TIGHT}>
        <tspan x={17} dy={0}>
          Forecast
        </tspan>
        <tspan x={17} dy={42}>
          to win the
        </tspan>
        <tspan x={17} dy={42}>
          Senate.
        </tspan>
      </text>

      <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
        <text x={DOME_WIDTH} y={121} textAnchor="end" fontFamily="var(--font-display)" fontWeight={600} fontSize={42} fill="var(--color-text)" style={TIGHT}>
          {entry.sourceName}
        </text>
      </a>
      <text x={DOME_WIDTH} y={147} textAnchor="end" fontFamily="var(--font-sans)" fontSize={14} fill="var(--color-text)">
        {`Forecast updated ${ordinalMonthDay(entry.asOf)}`}
      </text>
      <a href={entry.homeUrl} target="_blank" rel="noreferrer">
        <text x={DOME_WIDTH} y={168} textAnchor="end" fontFamily="var(--font-sans)" fontSize={13} fill="var(--color-text)" textDecoration="underline">
          {entry.sourceName}
        </text>
      </a>

      <text x={169} y={489} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={44} fill={PARTY_DISPLAY.D.color} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {entry.dSeats}
      </text>
      <text x={169} y={509} textAnchor="middle" fontFamily="var(--font-sans)" fontWeight={500} fontSize={18} letterSpacing={1} fill={PARTY_DISPLAY.D.color}>
        SEATS
      </text>
      <text x={495} y={489} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={44} fill={PARTY_DISPLAY.R.color} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {entry.rSeats}
      </text>
      <text x={495} y={509} textAnchor="middle" fontFamily="var(--font-sans)" fontWeight={500} fontSize={18} letterSpacing={1} fill={PARTY_DISPLAY.R.color}>
        SEATS
      </text>
    </svg>
  )
}

export interface SeatForecastCarouselProps {
  sources: readonly SeatForecastEntry[]
  /** The exact box size, computed by the caller from the "Spending aligned" card's own height. Falls back to the
   * Figma frame's native 664x511 (shrinking only on narrow/mobile widths) until that's been measured. */
  sizePx?: { width: number; height: number } | null
}

/** Crossfades every 3s through the chamber-wide seat forecast from each of several forecasters. Never fetches: the
 * data comes from a frozen snapshot (scripts/freeze-seat-forecasts.ts), the same philosophy as the race forecasts
 * powering the map callout. Pauses on a single card for a visitor who has asked for reduced motion. */
export default function SeatForecastCarousel({ sources, sizePx }: SeatForecastCarouselProps) {
  const [index, setIndex] = useState(0)
  const reducedMotion = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (reducedMotion.current || sources.length <= 1) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % sources.length), ROTATE_MS)
    return () => window.clearInterval(id)
  }, [sources.length])

  if (sources.length === 0) return null
  const current = sources[Math.min(index, sources.length - 1)]

  return (
    <div
      className="seat-forecast"
      role="group"
      aria-label="Forecast to win the Senate"
      style={sizePx ? { width: sizePx.width, height: sizePx.height, flex: 'none' } : undefined}
    >
      {sources.map((entry, i) => (
        <div key={entry.key} className={i === index ? 'seat-forecast-card seat-forecast-card-active' : 'seat-forecast-card'} aria-hidden={i === index ? undefined : true}>
          <Card entry={entry} />
        </div>
      ))}
      {sources.length > 1 && (
        <div className="seat-forecast-dots" aria-hidden="true">
          {sources.map((entry, i) => (
            <span key={entry.key} className={i === index ? 'seat-forecast-dot seat-forecast-dot-active' : 'seat-forecast-dot'} />
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {`${current.sourceName}: ${current.dSeats} Democratic seats, ${current.rSeats} Republican seats, forecast updated ${ordinalMonthDay(current.asOf)}.`}
      </p>
    </div>
  )
}
