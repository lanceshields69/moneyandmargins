import { useState } from 'react'
import { CONTACT_EMAIL } from '../config'
import { latestCorrections, type CorrectionEntry } from '../corrections'
import { formatDate } from '../format'

export function CorrectionsLog({ entries }: { entries: CorrectionEntry[] }) {
  const latest = latestCorrections(entries)
  if (latest.length === 0) return <p>No corrections yet.</p>
  return (
    <ul className="corrections-list">
      {latest.map((e) => (
        <li key={`${e.date}-${e.race}-${e.change}`}>
          {formatDate(e.date)}. {e.race}: {e.change} Why: {e.reason}
        </li>
      ))}
    </ul>
  )
}

export default function ContactFooter({ entries }: { entries: CorrectionEntry[] }) {
  const [copied, setCopied] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopied(true)
    } catch {
      window.prompt('Copy this address', CONTACT_EMAIL)
    }
  }

  return (
    <>
      <p className="contact-line">
        {CONTACT_EMAIL && (
          <>
            Questions or corrections? <a href={`mailto:${CONTACT_EMAIL}`}>Send an email</a>{' '}
            <button type="button" className="link-button" onClick={copy}>
              Copy
            </button>
            <span className="sr-only" role="status" aria-live="polite">
              {copied ? 'Address copied' : ''}
            </span>
            {' · '}
          </>
        )}
        <button type="button" className="link-button" aria-expanded={showLog} aria-controls="corrections-log" onClick={() => setShowLog((v) => !v)}>
          Corrections
        </button>
      </p>
      {showLog && (
        <div id="corrections-log">
          <CorrectionsLog entries={entries} />
        </div>
      )}
    </>
  )
}
