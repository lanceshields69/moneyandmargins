import { CONTACT_EMAIL } from '../config'

export default function ContactFooter() {
  return (
    <p>
      {CONTACT_EMAIL && (
        <>
          Questions or corrections? <a href={`mailto:${CONTACT_EMAIL}`}>Send an email</a>
        </>
      )}
    </p>
  )
}
