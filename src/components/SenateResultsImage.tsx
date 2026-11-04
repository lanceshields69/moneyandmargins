import domeRaw from '../assets/forecast/capitol-dome.svg?raw'
import { PARTY_DISPLAY } from '../computeSpending'
import { formatSpentCompact } from '../format'
import type { SenateSegment, SenateTally } from '../senateResults'

const DOME_WIDTH = 663.755
const DOME_HEIGHT = 433.334
const DOME_PATH = (/<path[^>]*\bd="([^"]+)"/.exec(domeRaw)?.[1]) ?? ''
/** Halyard Display inherits font-variant-numeric: tabular-nums from body, which widens the space glyph at large
 * sizes (the same fix as the article headings). */
const HEADLINE = { fontVariantNumeric: 'normal', wordSpacing: 0, textShadow: '0 4px 4px rgba(0, 0, 0, 0.25)' } as const
/** Figma 77:1792: the undecided seats are the cream divider between the two parties. */
const UNDECIDED_FILL = '#d6cfba'
/** A flip is its party's color, darkened, with diagonal lines over it. The same rule for both parties. */
const flipFill = (color: string) => `color-mix(in oklab, ${color} 65%, black)`
const LABEL_BASELINE = 422
const HATCH_ID = 'senate-flip-hatch'

export interface SenateResultsImageProps {
  tally: SenateTally
  /** National spending aligned with each party's nominees, in dollars. Null leaves that figure out. */
  spent: Record<'D' | 'R', number | null>
  /** The exact box size, computed by the caller from the "Spending aligned" card's own height. */
  sizePx?: { width: number; height: number } | null
}

const labelOf = (s: SenateSegment) => (s.hatched ? 'Flip' : 'Win')

/**
 * One image of the chamber (Figma node 77:1792): the Capitol split by seats, a party's held seats in its color, its
 * flips hatched, the undecided seats as a cream divider, each party's seat count and its national aligned spending.
 * Everything comes from data: the civicAPI statuses (src/senateResults.ts) and the national card. No carousel.
 */
export default function SenateResultsImage({ tally, spent, sizePx }: SenateResultsImageProps) {
  let x = 0
  const placed = tally.segments.map((s) => {
    const width = (s.seats / 100) * DOME_WIDTH
    const out = { s, x, width }
    x += width
    return out
  })
  const label = `${tally.headline} Democrats ${tally.seats.D} seats, Republicans ${tally.seats.R} seats, ${tally.undecided} undecided.`

  return (
    <div className="seat-forecast" style={sizePx ? { width: sizePx.width, height: sizePx.height, flex: 'none' } : undefined}>
      <svg viewBox={`0 0 ${DOME_WIDTH} 511`} width="100%" height="100%" role="img" aria-label={label}>
        <defs>
          <clipPath id="senate-dome-clip">
            <path d={DOME_PATH} />
          </clipPath>
          <pattern id={HATCH_ID} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.2" />
          </pattern>
        </defs>
        <g clipPath="url(#senate-dome-clip)">
          {placed.map(({ s, x: sx, width }) => {
            if (s.seats === 0) return null
            const color = s.party ? PARTY_DISPLAY[s.party].color : UNDECIDED_FILL
            return (
              <g key={s.key} data-segment={s.key}>
                <rect x={sx} y={0} width={width} height={DOME_HEIGHT} fill={s.hatched ? flipFill(color) : color} />
                {s.hatched && <rect x={sx} y={0} width={width} height={DOME_HEIGHT} fill={`url(#${HATCH_ID})`} />}
              </g>
            )
          })}
        </g>

        <text x={DOME_WIDTH / 2} y={134} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={600} fontSize={48} fill="var(--color-text)" style={HEADLINE}>
          {tally.headline}
        </text>

        {spent.D !== null && (
          <text x={101.5} y={222} textAnchor="middle" fontFamily="var(--font-display)" fontSize={32} fill={PARTY_DISPLAY.D.color} style={{ fontVariantNumeric: 'normal' }}>
            {`Spent: ${formatSpentCompact(spent.D)}`}
          </text>
        )}
        {spent.R !== null && (
          <text x={563} y={222} textAnchor="middle" fontFamily="var(--font-display)" fontSize={32} fill={PARTY_DISPLAY.R.color} style={{ fontVariantNumeric: 'normal' }}>
            {`Spent: ${formatSpentCompact(spent.R)}`}
          </text>
        )}

        {placed.map(({ s, x: sx, width }) =>
          s.party && s.seats > 0 ? (
            <text key={s.key} x={sx + width / 2} y={LABEL_BASELINE} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={15} fill="#fff">
              {labelOf(s)}
            </text>
          ) : null,
        )}

        <text x={169} y={489} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={44} fill={PARTY_DISPLAY.D.color} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {tally.seats.D}
        </text>
        <text x={169} y={509} textAnchor="middle" fontFamily="var(--font-sans)" fontWeight={500} fontSize={18} letterSpacing={1} fill={PARTY_DISPLAY.D.color}>
          SEATS
        </text>
        <text x={495} y={489} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={44} fill={PARTY_DISPLAY.R.color} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {tally.seats.R}
        </text>
        <text x={495} y={509} textAnchor="middle" fontFamily="var(--font-sans)" fontWeight={500} fontSize={18} letterSpacing={1} fill={PARTY_DISPLAY.R.color}>
          SEATS
        </text>
      </svg>
    </div>
  )
}
