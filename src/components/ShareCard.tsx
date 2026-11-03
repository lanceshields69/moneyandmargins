import logoIconRaw from '../assets/share/currency-circle-dollar.svg?raw'
import arrowRaw from '../assets/arrow-up-right.svg?raw'
import type { Callout } from '../computeCallout'
import type { NationalCard as NationalCardData, PartyAligned } from '../computeNational'
import { formatMoney } from '../format'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

// Layout from the Figma frame (node 57-1288), in its own 700 x 367.5 design units, scaled to 1200 x 630.
const W = 700
const H = 367.5
const T = 21.25
const FONT_DISPLAY = "'halyard-display', 'halyard-micro', system-ui, sans-serif"
const FONT_TEXT = "'halyard-micro', system-ui, sans-serif"
const TRACK = '#0a2540'
const TIGHT = { wordSpacing: '-0.25em' } as const

export interface ShareCardProps {
  stateName: string
  /** Opens the embed code. The link is left out of the downloaded PNG. */
  onUseOnSite?: () => void
  callout: Callout
  /** The map's "Spending aligned" card, built for this state. */
  national: NationalCardData
  /** The state's outline and its bounding box (an SVG viewBox string). */
  shapePath: string
  shapeBox: string
  /** As-of text from the data, e.g. "Nov 2, 2026". */
  dataAsOf: string
  /** The forecast source's host, from the frozen snapshot, e.g. "votepredictor.com". */
  forecastHost: string
}

function Icon({ raw, x, y, size }: { raw: string; x: number; y: number; size: number }) {
  const viewBox = /viewBox="([^"]+)"/.exec(raw)?.[1] ?? '0 0 1 1'
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/ id="[^"]*"/g, '')
  return <svg x={x} y={y} width={size} height={size} viewBox={viewBox} fill="none" dangerouslySetInnerHTML={{ __html: inner }} />
}

/** Title lines, shrunk so the longest line fits the 183-unit text box in the frame; the same rule for every state. */
function titleLines(stateName: string): { lines: [string, string]; size: number } {
  const width = (text: string) => text.length * 0.49
  const design: [string, string] = [`${stateName} Senate`, '2026']
  const lines: [string, string] = width(design[0]) * 30 <= 183 ? design : [stateName, 'Senate 2026']
  const longest = Math.max(width(lines[0]), width(lines[1]))
  return { lines, size: Math.min(30, Math.floor(183 / longest)) }
}

const SEGMENT_X = 445
const SEGMENT_W = 108

/** The page's segmented bar: supporting (solid) then opposing (outlined), with the state's share in the lighter tint. */
function Track({ group, y, height }: { group: PartyAligned; y: number; height: number }) {
  const supportW = (group.supporting.widthPct / 100) * SEGMENT_W
  const opposeW = (group.opposing.widthPct / 100) * SEGMENT_W
  return (
    <g>
      <rect x={SEGMENT_X} y={y} width={SEGMENT_W} height={height} rx={1} fill={TRACK} />
      {supportW > 0 && <rect x={SEGMENT_X} y={y} width={supportW} height={height} fill={group.color} />}
      {supportW > 0 && group.supporting.statePct > 0 && (
        <rect x={SEGMENT_X} y={y} width={(group.supporting.statePct / 100) * supportW} height={height} fill={group.tint} />
      )}
      {opposeW > 0 && (
        <rect x={SEGMENT_X + supportW + 0.75} y={y + 0.75} width={Math.max(0, opposeW - 1.5)} height={height - 1.5} fill="none" stroke={group.color} strokeWidth={1.5} />
      )}
      {opposeW > 0 && group.opposing.statePct > 0 && (
        <rect x={SEGMENT_X + supportW} y={y} width={(group.opposing.statePct / 100) * opposeW} height={height} fill={group.tint} opacity={0.55} />
      )}
    </g>
  )
}

export default function ShareCard({ stateName, callout, national, shapePath, shapeBox, dataAsOf, forecastHost, onUseOnSite }: ShareCardProps) {
  const { sides, result } = callout
  const title = titleLines(stateName)
  const lineGap = (36 * title.size) / 30
  const centerX = 170.5
  const centerY = T + 162.5
  const resultSuffix = result.stage === 'not-added' ? ' (not added):' : ` (${result.stage}):`
  const adFlag = callout.adFlag?.label ?? null
  const winFlag = callout.winFlag?.label ?? null
  const valueRight = [621, 662.8] as const
  const squareX = [592.8, 633.9] as const
  const rowBaselines = [T + 56, T + 74, T + 92]
  const rows = national.groups
  const pitch = Math.min(19, 41 / Math.max(rows.length, 1))
  const graphTop = T + 182

  const value = (index: number, kind: 'ad' | 'win' | 'result'): string => {
    const side = sides[index]
    if (kind === 'ad') return `${side.adPct}%`
    if (kind === 'win') return `${side.winPct}%`
    return result.stage === 'not-added' ? '--' : `${result.shares[side.candidateId] ?? '--'}%`
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={`${stateName} Senate 2026: spending, forecast, and results`}>
      <rect width={W} height={H} fill="#181714" />

      <rect x={22.5} y={T + 0.5} width={295} height={324} rx={8} fill="#3a336a" stroke="#5e5896" />
      <svg x={35} y={T + 34} width={271} height={257} viewBox={shapeBox} preserveAspectRatio="xMidYMid meet">
        <path d={shapePath} fill="#544a99" stroke="#eae8e2" strokeOpacity={0.3} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      </svg>
      {title.lines.map((line, i) => {
        const baseline = centerY - lineGap / 2 + lineGap * i + title.size * 0.35
        return (
          <g key={line} fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={title.size} textAnchor="middle" style={TIGHT}>
            <text x={centerX + 2.333} y={baseline + 2.917} fill="#000" opacity={0.25}>
              {line}
            </text>
            <text x={centerX} y={baseline} fill="#fff">
              {line}
            </text>
          </g>
        )
      })}

      <g fontFamily={FONT_TEXT} fontWeight={400}>
        <rect x={338.6} y={T + 0.6} width={338.8} height={128.8} rx={8} fill="#544a99" stroke="#7771b8" strokeWidth={1.164} />
        <text x={352} y={T + 28.5} fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={16} letterSpacing={0.08} fill="#fff" style={TIGHT}>
          Spending, forecasts &amp; results
        </text>
        {sides.map((side, i) => (
          <g key={side.candidateId}>
            <rect x={squareX[i]} y={T + 14.1} width={17.725} height={17.725} rx={3.492} fill={side.partyColor} />
            <text x={squareX[i] + 8.86} y={T + 27.2} textAnchor="middle" fontSize={10} fontWeight={700} fill="#181714">
              {side.chip}
            </text>
          </g>
        ))}
        <g fontSize={15} fill="#fff" textAnchor="end" fontWeight={400}>
          <text x={564} y={rowBaselines[0]}>Spent on ads:</text>
          <text x={564} y={rowBaselines[1]}>
            Predicted<tspan fontSize={9.675} dy={-5}>1</tspan>
            <tspan dy={5}> to win:</tspan>
          </text>
          <text x={564} y={rowBaselines[2]}>
            Results<tspan fontSize={9.675} dy={-5}>2</tspan>
            <tspan dy={5}>{resultSuffix}</tspan>
          </text>
          {(['ad', 'win', 'result'] as const).map((kind, r) => {
            const flag = kind === 'ad' ? adFlag : kind === 'win' ? winFlag : null
            if (flag) {
              return (
                <text key={kind} x={valueRight[1]} y={rowBaselines[r]}>
                  {flag}
                </text>
              )
            }
            return sides.map((side, i) => (
              <text key={`${kind}-${side.candidateId}`} x={valueRight[i]} y={rowBaselines[r]} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {value(i, kind)}
              </text>
            ))
          })}
        </g>
        <text x={508} y={T + 115} textAnchor="middle" fontSize={10} fill="#eae8e2" opacity={0.6} textLength={300} lengthAdjust="spacingAndGlyphs">
          {`Data as of ${dataAsOf} from:  1. `}
          <tspan textDecoration="underline">{forecastHost}</tspan>
          {': and 2. '}
          <tspan textDecoration="underline">civicAPI</tspan>
        </text>
        {(callout.adFlag?.reason || callout.winFlag?.reason) && (
          <text x={508} y={T + 125.5} textAnchor="middle" fontSize={8.5} fill="#eae8e2" opacity={0.8}>
            {[callout.adFlag, callout.winFlag].filter((f) => f?.reason).map((f) => `${f!.label}: ${f!.reason}`).join(' · ')}
          </text>
        )}
      </g>

      <rect x={338.5} y={T + 150.5} width={339} height={81} rx={8} fill="#3a336a" stroke="#5e5896" strokeWidth={0.972} />
      <text x={508} y={T + 171.5} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={15} letterSpacing={0.15} fill="#eae8e2" style={TIGHT}>
        Spending aligned with each party&apos;s nominees
      </text>
      {rows.map((group, i) => {
        const center = graphTop + pitch * i + pitch / 2
        const trackHeight = Math.min(9, pitch - 4)
        return (
          <g key={group.party} fontFamily={FONT_TEXT} fontSize={9.5}>
            <rect x={358} y={center - 3} width={6} height={6} rx={1.5} fill={group.color} />
            <text x={369} y={center + 3.5} fontWeight={700} fill="#eae8e2">
              {group.label.split(' ')[0]}
            </text>
            <Track group={group} y={center - trackHeight / 2} height={trackHeight} />
            <text x={606} y={center + 3.5} textAnchor="end" fontWeight={700} fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatMoney(group.total)}
            </text>
            <text x={660} y={center + 3.5} textAnchor="end" fontWeight={700} fill={group.tint} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatMoney(group.stateTotal)}
            </text>
          </g>
        )
      })}

      <Icon raw={logoIconRaw} x={472.5} y={T + 246.6} size={28.1} />
      <text x={504.6} y={T + 269} fontFamily={FONT_DISPLAY} fontWeight={500} fontSize={25} letterSpacing={-0.25} fill="#eae8e2" style={TIGHT} textLength={173.4} lengthAdjust="spacingAndGlyphs">
        Money &amp; Margins
      </text>
      <text x={513} y={T + 294} fontFamily={FONT_TEXT} fontSize={14} letterSpacing={-0.28} fill="#fff" textLength={165} lengthAdjust="spacingAndGlyphs">
        MoneyandMargins.app
      </text>
      <g
        data-export-omit="true"
        role={onUseOnSite ? 'button' : undefined}
        tabIndex={onUseOnSite ? 0 : undefined}
        style={onUseOnSite ? { cursor: 'pointer' } : undefined}
        onClick={onUseOnSite}
        onKeyDown={onUseOnSite ? (event) => (event.key === 'Enter' || event.key === ' ') && onUseOnSite() : undefined}
      >
        <text x={498} y={T + 316} fontFamily={FONT_TEXT} fontSize={14} fill="#eae8e2" textLength={158.5} lengthAdjust="spacingAndGlyphs">
          Use this on your site?
        </text>
        <Icon raw={arrowRaw} x={661.5} y={T + 303.5} size={16.5} />
      </g>
    </svg>
  )
}
