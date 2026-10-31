import { CONTACT_EMAIL } from '../config'

export default function ContactFooter({ onOpenCorrections }: { onOpenCorrections: () => void }) {
  return (
    <p>
      {CONTACT_EMAIL && (
        <>
          Questions or corrections? <a href={`mailto:${CONTACT_EMAIL}`}>Send an email</a>
          {' · '}
        </>
      )}
      <button type="button" className="link-button" onClick={onOpenCorrections}>
        Corrections
      </button>
    </p>
  )
}
