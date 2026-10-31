import { CONTACT_EMAIL } from '../config'

export default function ContactFooter() {
  if (!CONTACT_EMAIL) return null
  return (
    <p>
      Questions or corrections? <a href={`mailto:${CONTACT_EMAIL}`}>Send an email</a>
    </p>
  )
}
