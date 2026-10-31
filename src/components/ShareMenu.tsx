import { useEffect, useRef, useState } from 'react'
import shareIcon from '../assets/share/share-fat.svg'
import shareNetworkIcon from '../assets/share/share-network.svg'
import linkIcon from '../assets/share/link.svg'
import xIcon from '../assets/share/x.svg'
import linkedinIcon from '../assets/share/linkedin.svg'
import facebookIcon from '../assets/share/facebook.svg'
import whatsappIcon from '../assets/share/whatsapp.svg'
import emailIcon from '../assets/share/email.svg'

const SHARE_TEXT = 'Money & Margins: 2026 U.S. Senate outside spending, from FEC filings'

// Links are built when the menu opens, so they carry the selected state's hash. Nothing is requested until a visitor clicks one.
const targets = (url: string) => {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(SHARE_TEXT)
  return [
    { label: 'X', icon: xIcon, href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: 'LinkedIn', icon: linkedinIcon, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: 'Facebook', icon: facebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: 'WhatsApp', icon: whatsappIcon, href: `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${url}`)}` },
    { label: 'Email', icon: emailIcon, href: `mailto:?subject=${t}&body=${u}` },
  ]
}

export default function ShareMenu() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      setUrl(window.location.href)
      setCopied(false)
    }
    setOpen(!open)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  return (
    <div className="share" ref={root}>
      <button ref={button} type="button" className="share-button" aria-expanded={open} aria-controls="share-menu" onClick={toggle}>
        <span>Share this on social</span>
        <img className="share-icon-wide" src={shareIcon} alt="" width={24} height={24} />
        <img className="share-icon-phone" src={shareNetworkIcon} alt="" width={22} height={22} />
      </button>
      {open && (
        <ul className="share-menu" id="share-menu">
          <li>
            <button type="button" onClick={copy}>
              <img src={linkIcon} alt="" width={18} height={18} />
              <span>{copied ? 'Link copied' : 'Copy link'}</span>
            </button>
          </li>
          {targets(url).map((t) => (
            <li key={t.label}>
              <a href={t.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                <img src={t.icon} alt="" width={18} height={18} />
                <span>{t.label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only" role="status">{copied ? 'Link copied' : ''}</span>
    </div>
  )
}
