import { useEffect, useState } from 'react'

const QUERY = '(max-width: 600px)'

/** True on phone-width screens, where the callout is a bottom sheet and the detail panel lives inside it. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const update = () => setPhone(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return phone
}
