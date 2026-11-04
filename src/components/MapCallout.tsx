import { GLOBAL_PARTIAL_NOTICE, SHARES_VERIFIED } from '../config'
import arrowIcon from '../assets/arrow-up-right.svg'
import infoIcon from '../assets/info.svg'
import { hasOtherForecasts } from '../otherForecasts'
import { OTHER_FORECASTS_TITLE, otherForecastsUrl } from '../votepredictor'
import { PARTIAL_CALLOUT_NOTICE, SHARES_PENDING_LEAD, SHARES_PENDING_LINK } from '../copy'
import { formatDateTime } from '../format'
import { useEffect, useState, type ReactNode } from 'react'
import leaderUrl from '../assets/callout-leader.svg'
import type { Callout, CalloutSide } from '../computeCallout'
import { RESULT_HEADING } from '../results'
import { CheckIcon } from './StateMarks'
import { usePhone } from '../usePhone'

// Measurements from the Figma design (node 4:2). Widened from the original 171px so "Results (unofficial):", the
// longest Result heading, fits on one line with its two values, same as every other row — must match .cc-card's
// width in app.css.
const CARD_WIDTH = 195
const LEADER_X = 96.5
const MARKER_CENTER = 35.5
/** Lifts the card, leader line and square together so they clear the prediction markers on the state's label point. */
const LIFT = '0 -20px'
const LEADER_HEIGHT = 39.0214
const EDGE = 4
/** Below this share of the map's height there is no room above the point, so the card goes underneath. */
const FLIP_BELOW_Y = 0.2

function Square({ side, checked }: { side: CalloutSide; checked?: boolean }) {
  return (
    <span
      className="cc-square"
      style={{ background: side.partyColor }}
      role="img"
      aria-label={`${side.partyLabel}, ${side.name}`}
    >
      {checked ? <CheckIcon /> : side.chip}
    </span>
  )
}

function Row({ label, sides, pick, flag, onInfo }: {
  label: string
  /** An info button next to the label that opens the methodology. */
  onInfo?: () => void
  sides: CalloutSide[]
  pick: (side: CalloutSide) => number | null
  flag: { label: string; reason: string | null } | null
}) {
  if (flag) {
    return (
      <div className="cc-row cc-row-flag">
        <span className="cc-label">
          {label}
          {onInfo && <InfoButton onClick={onInfo} />}
        </span>
        <span className="cc-flag">
          {flag.label}
          {flag.reason && <span className="cc-reason"> ({flag.reason})</span>}
        </span>
      </div>
    )
  }
  return (
    <div className="cc-row">
      <span className="cc-label">
        {label}
        {onInfo && <InfoButton onClick={onInfo} />}
      </span>
      {sides.map((side) => (
        <span key={side.candidateId} className="cc-value">
          {pick(side)}%
        </span>
      ))}
    </div>
  )
}

/**
 * The Result row: one heading from the race's single status (RESULT_HEADING), the same layout and column order in
 * every status. The columns are fixed by party, never by who leads, and no leader is named in text.
 */
function ResultRow({ sides, result }: { sides: CalloutSide[]; result: Callout['result'] }) {
  return (
    <>
      <div className="cc-row">
        <span className="cc-label">{RESULT_HEADING[result.stage]}</span>
        {sides.map((side) => (
          <span key={side.candidateId} className="cc-value">
            {result.stage === 'none' ? '--' : `${result.shares[side.candidateId] ?? '--'}%`}
          </span>
        ))}
      </div>
    </>
  )
}

/** Percent reporting to a whole number. A count short of 100 never reads as 100: 99.6 shows as 99%. */
export const wholePercentReporting = (pct: number): number => (pct >= 100 ? 100 : Math.min(99, Math.round(pct)))

/** "Source: civicAPI, [as-of time]." with the percent reporting while a race is still being counted. */
function ResultNote({ result }: { result: Callout['result'] }) {
  if (result.stage === 'none' || !result.asOf) return null
  return (
    <p className="cc-note cc-result-note">
      {result.stage === 'reporting' && result.percentReporting !== null && `${wholePercentReporting(result.percentReporting)}% reporting. `}
      {'Source: '}
      {result.sourceUrl ? (
        <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">
          civicAPI
        </a>
      ) : (
        'civicAPI'
      )}
      {`, ${formatDateTime(result.asOf)}.`}
    </p>
  )
}

/** A plain link out to VotePredictor's own page for the race. Nothing from that page is copied here. */
function OtherForecasts({ state, pill = false }: { state: string; pill?: boolean }) {
  if (!hasOtherForecasts(state)) return null
  return (
    <a className={pill ? 'cc-other cc-other-pill' : 'cc-other'} href={otherForecastsUrl(state)} target="_blank" rel="noopener noreferrer" title={OTHER_FORECASTS_TITLE}>
      Other forecasts
      <img src={arrowIcon} alt="" aria-hidden="true" />
    </a>
  )
}

function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="cc-info" aria-label="How this is counted" onClick={onClick}>
      <img src={infoIcon} alt="" width={11} height={11} />
    </button>
  )
}

/** The "Spent on ads" row while shares are unverified: the same words for every race and party. */
function PendingRow({ onOpenHow }: { onOpenHow?: () => void }) {
  return (
    <div className="cc-row cc-row-flag cc-row-pending">
      <span className="cc-label">Spent on ads:</span>
      <span className="cc-flag">
        {SHARES_PENDING_LEAD}
        <button type="button" className="link-button cc-how" onClick={onOpenHow}>
          {SHARES_PENDING_LINK}
        </button>
        .
      </span>
    </div>
  )
}

function summary(stateName: string, callout: Callout, sharesVerified: boolean): string {
  const part = (label: string, pick: (s: CalloutSide) => number | null, flag: { label: string; reason: string | null } | null) =>
    flag
      ? `${label}: ${flag.label}${flag.reason ? `, ${flag.reason}` : ''}.`
      : `${label}: ${callout.sides.map((s) => `${s.partyLabel} ${s.name} ${pick(s)} percent`).join(', ')}.`
  const ads = sharesVerified ? part('Spent on ads', (s) => s.adPct, callout.adFlag) : `Spent on ads: ${SHARES_PENDING_LEAD}${SHARES_PENDING_LINK}.`
  return `${stateName}. ${ads} ${part('Predicted to win', (s) => s.winPct, callout.winFlag)}`
}

interface MapCalloutProps {
  callout: Callout
  stateName: string
  /** The state's label point as fractions (0 to 1) of the map's width and height. */
  anchor: { x: number; y: number }
  /** Shows the line explaining that the rule, not the visitor, picked this state. */
  isDefault: boolean
  /** Whether the "Spent on ads" percentages may be shown. Defaults to the SHARES_VERIFIED flag. */
  sharesVerified?: boolean
  /** Opens the methodology modal from the "how this is counted" link. */
  onOpenHow?: () => void
  /** Shows the partial-data line instead of the primary-season note. Defaults to the GLOBAL_PARTIAL_NOTICE flag. */
  globalPartialNotice?: boolean
  /** The race detail panel, shown inside the bottom sheet when it is expanded (phones only). */
  detail?: ReactNode
  /** Starts the bottom sheet expanded, e.g. when a link asks to open the share panel directly. */
  initialExpanded?: boolean
  onClose: () => void
}

export default function MapCallout({ callout, stateName, anchor, isDefault, detail, initialExpanded, onClose, sharesVerified = SHARES_VERIFIED, onOpenHow, globalPartialNotice = GLOBAL_PARTIAL_NOTICE }: MapCalloutProps) {
  const sheet = usePhone()
  const [expanded, setExpanded] = useState(initialExpanded ?? false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const notes = [callout.isSpecial ? 'Special election' : null, callout.incompleteNote].filter((n): n is string => n !== null)
  const card = (
    <div className="cc-card" role="group" aria-label={`${stateName} Senate race`}>
      <div className="cc-body">
        <div className="cc-head">
          <h2 className="cc-title">{stateName}</h2>
          {callout.sides.map((side) => {
            const wonHere = side.candidateId === callout.result.winnerCandidateId
            return (
              <span key={side.candidateId} className="cc-head-cell">
                <Square side={side} checked={wonHere && callout.result.stage === 'win'} />
              </span>
            )
          })}
          {sheet && (
            <button type="button" className="cc-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        {sharesVerified ? (
          <Row label="Spent on ads:" sides={callout.sides} pick={(s) => s.adPct} flag={callout.adFlag} onInfo={onOpenHow} />
        ) : (
          <PendingRow onOpenHow={onOpenHow} />
        )}
        <Row label="Predicted to win:" sides={callout.sides} pick={(s) => s.winPct} flag={callout.winFlag} />
        <ResultRow sides={callout.sides} result={callout.result} />
      </div>
      <ResultNote result={callout.result} />
      {notes.map((note) => (
        <p key={note} className="cc-note">
          {note}
        </p>
      ))}
      {sharesVerified && globalPartialNotice && <p className="cc-partial">{PARTIAL_CALLOUT_NOTICE}</p>}
      {!sheet && callout.result.stage === 'none' && <OtherForecasts state={callout.state} />}
    </div>
  )
  const live = <p className="sr-only" aria-live="polite">{summary(stateName, callout, sharesVerified)}</p>

  if (sheet) {
    return (
      <>
        <div className={expanded ? 'cc-sheet cc-sheet-open' : 'cc-sheet'}>
          {card}
          {(detail || hasOtherForecasts(callout.state)) && (
            <div className="cc-sheet-extra">
              <div className="cc-sheet-links">
                {detail ? (
                  <button type="button" className="cc-toggle" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                    {expanded ? 'Hide details' : 'Show details'}
                  </button>
                ) : (
                  <span />
                )}
                {callout.result.stage === 'none' && <OtherForecasts state={callout.state} pill />}
              </div>
              {expanded && detail && <div className="cc-detail">{detail}</div>}
            </div>
          )}
        </div>
        {live}
      </>
    )
  }

  // Everything is placed with percentages of the map, so it needs no measuring and cannot go stale.
  const x = anchor.x * 100
  const y = anchor.y * 100
  const below = anchor.y < FLIP_BELOW_Y
  const cardStyle = {
    translate: LIFT,
    left: `clamp(${EDGE}px, calc(${x}% - ${LEADER_X}px), calc(100% - ${CARD_WIDTH + EDGE}px))`,
    ...(below ? { top: `calc(${y}% + ${MARKER_CENTER}px)` } : { bottom: `calc(${100 - y}% + ${MARKER_CENTER}px)` }),
  }
  const leaderStyle = {
    translate: LIFT,
    left: `calc(${x}% - 3.5px)`,
    top: below ? `calc(${y}% - 3.5px)` : `calc(${y}% - ${MARKER_CENTER}px)`,
  }

  return (
    <div className="cc-layer">
      <div className={below ? 'cc-float cc-below' : 'cc-float'} style={cardStyle}>
        {card}
        {isDefault && <p className="cc-default">Showing the state with the most reported spending. Select another.</p>}
      </div>
      <img className={below ? 'cc-leader cc-leader-flipped' : 'cc-leader'} src={leaderUrl} alt="" width={7} height={LEADER_HEIGHT} style={leaderStyle} />
      {live}
    </div>
  )
}
