import type { Callout, CalloutSide } from '../computeCallout'
import type { NationalCard as NationalCardData } from '../computeNational'
import { formatMoney } from '../format'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

export interface ShareCardProps {
  stateName: string
  callout: Callout
  /** The map's national "Spending aligned" card, built for this state. */
  national: NationalCardData
  /** The state's outline, cropped to shapeBox (an SVG viewBox string). */
  shapePath: string
  shapeBox: string
  /** As-of text from the data, e.g. "Oct 31, 2026". */
  dataAsOf: string
  /** The forecast source's name and link host, from the frozen snapshot. */
  forecastSource: string
}

const SIDE_X = [1020, 1090] as const

function Chip({ side, x }: { side: CalloutSide; x: number }) {
  return (
    <g>
      <rect x={x - 11} y={138} width={22} height={22} rx={3} fill={side.partyColor} />
      <text x={x} y={153} textAnchor="middle" fontSize={12} fontWeight={700} fill="#181714">
        {side.chip}
      </text>
    </g>
  )
}

function Value({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={18} fontWeight={600} fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </text>
  )
}

function percent(value: number | null, flag: string | null): string {
  if (value !== null) return `${value}%`
  return flag ?? '--'
}

export default function ShareCard({ stateName, callout, national, shapePath, shapeBox, dataAsOf, forecastSource }: ShareCardProps) {
  const { sides, result } = callout
  const resultHeading =
    result.stage === 'not-added'
      ? 'Results (not added):'
      : result.stage === 'counting'
        ? 'Results (counting):'
        : result.stage === 'unofficial'
          ? 'Results (unofficial):'
          : 'Results (certified):'
  const adFlag = callout.adFlag?.label ?? null
  const winFlag = callout.winFlag?.label ?? null
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`} width="100%" height="100%" fontFamily="Public Sans, system-ui, sans-serif" role="img" aria-label={`${stateName} Senate 2026: spending, forecast, and results`}>
      <rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="#181714" />
      <rect x={40} y={40} width={1120} height={550} rx={16} fill="#3a336a" stroke="#5e5896" />

      <svg x={80} y={110} width={440} height={380} viewBox={shapeBox} preserveAspectRatio="xMidYMid meet">
        <path d={shapePath} fill="#544a99" stroke="#eae8e2" strokeOpacity={0.3} />
      </svg>
      <text x={80} y={535} fontSize={34} fontWeight={700} fill="#fff">
        {stateName} Senate
      </text>
      <text x={80} y={570} fontSize={34} fontWeight={700} fill="#fff">
        2026
      </text>

      <text x={580} y={130} fontSize={26} fontWeight={700} fill="#fff">
        Spending, forecasts &amp; results
      </text>
      {sides.map((side, i) => (
        <Chip key={side.candidateId} side={side} x={SIDE_X[i]} />
      ))}

      <text x={580} y={200} fontSize={18} fill="#eae8e2">
        Spent on ads:
      </text>
      <text x={580} y={240} fontSize={18} fill="#eae8e2">
        Predicted to win:
      </text>
      <text x={580} y={280} fontSize={18} fill="#eae8e2">
        {resultHeading}
      </text>
      {sides.map((side, i) => (
        <g key={side.candidateId}>
          <Value text={adFlag ?? percent(side.adPct, null)} x={SIDE_X[i]} y={200} />
          <Value text={winFlag ?? percent(side.winPct, null)} x={SIDE_X[i]} y={240} />
          <Value text={result.stage === 'not-added' ? '--' : `${result.shares[side.candidateId] ?? '--'}%`} x={SIDE_X[i]} y={280} />
        </g>
      ))}
      {result.stage !== 'not-added' && result.asOf && (
        <text x={1120} y={305} textAnchor="end" fontSize={13} fill="#eae8e2" opacity={0.8}>
          {result.stage === 'counting' && result.percentReporting !== null ? `${result.percentReporting}% reporting · ` : ''}
          {result.asOf.slice(0, 16).replace('T', ' ')} UTC
        </text>
      )}

      <rect x={580} y={330} width={540} height={180} rx={8} fill="#181714" opacity={0.35} />
      <text x={600} y={358} fontSize={16} fontWeight={700} fill="#fff">
        Spending aligned with each party&apos;s nominees
      </text>
      {!adFlag && (
        <g fontSize={12} fill="#eae8e2" opacity={0.8}>
          <text x={1030} y={356} textAnchor="end">Nation</text>
          <text x={1100} y={356} textAnchor="end">{stateName}</text>
        </g>
      )}
      {adFlag ? (
        <text x={600} y={400} fontSize={16} fill="#eae8e2">
          {callout.adFlag?.reason ? `${adFlag}: ${callout.adFlag.reason}` : adFlag}
        </text>
      ) : (
        national.groups.map((group, i) => {
          const y = 378 + i * 42
          const supportWidth = (group.supporting.widthPct / 100) * 200
          const opposeWidth = (group.opposing.widthPct / 100) * 200
          return (
            <g key={group.party}>
              <text x={600} y={y + 12} fontSize={14} fill="#eae8e2">
                {group.label}
              </text>
              <rect x={740} y={y} width={200} height={10} rx={5} fill="#393834" />
              <rect x={740} y={y} width={supportWidth} height={10} rx={5} fill={group.color} />
              <rect x={740} y={y} width={(group.supporting.statePct / 100) * supportWidth} height={10} rx={5} fill={group.tint} />
              <rect x={740} y={y + 14} width={200} height={10} rx={5} fill="none" stroke={group.color} strokeWidth={1.5} strokeDasharray="3 3" />
              <rect x={740} y={y + 14} width={opposeWidth} height={10} rx={5} fill={group.color} opacity={0.5} />
              <rect x={740} y={y + 14} width={(group.opposing.statePct / 100) * opposeWidth} height={10} rx={5} fill={group.tint} />
              <text x={1030} y={y + 12} textAnchor="end" fontSize={14} fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(group.total)}
              </text>
              <text x={1100} y={y + 12} textAnchor="end" fontSize={14} fill={group.tint} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(group.stateTotal)}
              </text>
            </g>
          )
        })
      )}
      <text x={580} y={548} fontSize={24} fontWeight={600} fill="#eae8e2">
        Money &amp; Margins
      </text>
      <text x={1120} y={548} textAnchor="end" fontSize={14} fill="#fff">
        moneyandmargins.app
      </text>
      <text x={580} y={572} fontSize={11} fill="#eae8e2" opacity={0.6}>
        {`Data as of ${dataAsOf} from: ${forecastSource}`}
      </text>
      <text x={580} y={592} fontSize={10} fill="#eae8e2" opacity={0.6}>
        Spending data compiled by Money &amp; Margins from FEC records, licensed CC BY 4.0. Credit: Lance Shields, moneyandmargins.app.
      </text>
    </svg>
  )
}
