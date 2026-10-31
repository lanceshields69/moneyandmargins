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

export default function ContactFooter() {
  if (!CONTACT_EMAIL) return null
  return (
    <p>
      Questions or corrections? <a href={`mailto:${CONTACT_EMAIL}`}>Send an email</a>
    </p>
  )
}
