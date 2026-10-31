import { useEffect, useState } from 'react'
import leaderUrl from '../assets/callout-leader.svg'
import type { Callout, CalloutSide } from '../computeCallout'

// Measurements from the Figma design (node 4:2).
const CARD_WIDTH = 171
const LEADER_X = 84.5
const MARKER_CENTER = 35.5
const LEADER_HEIGHT = 39.0214
const EDGE = 4
/** Below this share of the map's height there is no room above the point, so the card goes underneath. */
const FLIP_BELOW_Y = 0.2

function useMobileSheet(): boolean {
  const query = '(max-width: 600px)'
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

function Square({ side }: { side: CalloutSide }) {
  return (
    <span className="cc-square" style={{ background: side.partyColor }} role="img" aria-label={`${side.partyLabel}, ${side.name}`}>
      {side.letter}
    </span>
  )
}

function Row({ label, sides, pick, flag }: {
  label: string
  sides: CalloutSide[]
  pick: (side: CalloutSide) => number | null
  flag: { label: string; reason: string | null } | null
}) {
  if (flag) {
    return (
      <div className="cc-row cc-row-flag">
        <span className="cc-label">{label}</span>
        <span className="cc-flag">
          {flag.label}
          {flag.reason && <span className="cc-reason"> ({flag.reason})</span>}
        </span>
      </div>
    )
  }
  return (
    <div className="cc-row">
      <span className="cc-label">{label}</span>
      {sides.map((side) => (
        <span key={side.candidateId} className="cc-value">
          {pick(side)}%
        </span>
      ))}
    </div>
  )
}

function summary(stateName: string, callout: Callout): string {
  const part = (label: string, pick: (s: CalloutSide) => number | null, flag: { label: string; reason: string | null } | null) =>
    flag
      ? `${label}: ${flag.label}${flag.reason ? `, ${flag.reason}` : ''}.`
      : `${label}: ${callout.sides.map((s) => `${s.partyLabel} ${s.name} ${pick(s)} percent`).join(', ')}.`
  return `${stateName}. ${part('Spent on ads', (s) => s.adPct, callout.adFlag)} ${part('Predicted to win', (s) => s.winPct, callout.winFlag)}`
}

interface MapCalloutProps {
  callout: Callout
  stateName: string
  /** The state's label point as fractions (0 to 1) of the map's width and height. */
  anchor: { x: number; y: number }
  /** Shows the line explaining that the rule, not the visitor, picked this state. */
  isDefault: boolean
  onClose: () => void
}

export default function MapCallout({ callout, stateName, anchor, isDefault, onClose }: MapCalloutProps) {
  const sheet = useMobileSheet()

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
      <Row label="Spent on ads:" sides={callout.sides} pick={(s) => s.adPct} flag={callout.adFlag} />
      <Row label="Predicted to win:" sides={callout.sides} pick={(s) => s.winPct} flag={callout.winFlag} />
      {notes.map((note) => (
        <p key={note} className="cc-note">
          {note}
        </p>
      ))}
    </div>
  )
  const live = <p className="sr-only" aria-live="polite">{summary(stateName, callout)}</p>

  if (sheet) {
    return (
      <>
        <div className="cc-sheet">{card}</div>
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
