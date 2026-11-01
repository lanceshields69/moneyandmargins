import { GLOBAL_PARTIAL_NOTICE, SHARES_VERIFIED } from '../config'
import arrowIcon from '../assets/arrow-up-right.svg'
import infoIcon from '../assets/info.svg'
import { hasOtherForecasts } from '../otherForecasts'
import { OTHER_FORECASTS_TITLE, otherForecastsUrl } from '../votepredictor'
import { PARTIAL_CALLOUT_NOTICE, SHARES_PENDING_LEAD, SHARES_PENDING_LINK } from '../copy'
import { useEffect, useState, type ReactNode } from 'react'
import leaderUrl from '../assets/callout-leader.svg'
import type { Callout, CalloutSide } from '../computeCallout'
import { usePhone } from '../usePhone'

// Measurements from the Figma design (node 4:2).
const CARD_WIDTH = 171
const LEADER_X = 84.5
const MARKER_CENTER = 35.5
const LEADER_HEIGHT = 39.0214
const EDGE = 4
/** Below this share of the map's height there is no room above the point, so the card goes underneath. */
const FLIP_BELOW_Y = 0.2

function Square({ side }: { side: CalloutSide }) {
  return (
    <span className="cc-square" style={{ background: side.partyColor }} role="img" aria-label={`${side.partyLabel}, ${side.name}`}>
      {side.chip}
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
  onClose: () => void
}

export default function MapCallout({ callout, stateName, anchor, isDefault, detail, onClose, sharesVerified = SHARES_VERIFIED, onOpenHow, globalPartialNotice = GLOBAL_PARTIAL_NOTICE }: MapCalloutProps) {
  const sheet = usePhone()
  const [expanded, setExpanded] = useState(false)

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
      <div className="cc-head">
        <h2 className="cc-title">{stateName}</h2>
        {callout.sides.map((side) => (
          <span key={side.candidateId} className="cc-head-cell">
            <Square side={side} />
          </span>
        ))}
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
      {notes.map((note) => (
        <p key={note} className="cc-note">
          {note}
        </p>
      ))}
      {sharesVerified && globalPartialNotice && <p className="cc-partial">{PARTIAL_CALLOUT_NOTICE}</p>}
      {!sheet && <OtherForecasts state={callout.state} />}
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
                <OtherForecasts state={callout.state} pill />
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
    left: `clamp(${EDGE}px, calc(${x}% - ${LEADER_X}px), calc(100% - ${CARD_WIDTH + EDGE}px))`,
    ...(below ? { top: `calc(${y}% + ${MARKER_CENTER}px)` } : { bottom: `calc(${100 - y}% + ${MARKER_CENTER}px)` }),
  }
  const leaderStyle = {
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
