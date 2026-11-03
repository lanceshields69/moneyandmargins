import { useEffect, useRef, useState } from 'react'
import closeIcon from '../assets/close.svg'
import copyIcon from '../assets/share/copy.svg'
import downloadIcon from '../assets/share/download-simple.svg'
import { downloadCardPng } from '../cardExport'
import { CC_BY_CREDIT, embedCode } from '../embed'
import ShareCard, { type ShareCardProps } from './ShareCard'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ShareEmbedModalProps {
  stateCode: string
  stateName: string
  card: Omit<ShareCardProps, 'stateName'>
  onClose: () => void
}

export default function ShareEmbedModal({ stateCode, stateName, card, onClose }: ShareEmbedModalProps) {
  const dialog = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const embedSection = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const code = embedCode(stateCode)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLElement>('.embed-close')?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog.current) return
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [onClose])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const svg = preview.current?.querySelector('svg')
    if (svg) void downloadCardPng(svg, `money-and-margins-${stateCode.toLowerCase()}-senate-2026.png`)
  }

  return (
    <div className="embed-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="embed-modal" role="dialog" aria-modal="true" aria-labelledby="share-title" ref={dialog}>
        <div className="embed-head">
          <h2 id="share-title">Share or embed: {stateName} Senate 2026</h2>
          <button type="button" className="embed-close" onClick={onClose} aria-label="Close">
            <img src={closeIcon} alt="" width={36} height={36} />
          </button>
        </div>
        <hr className="embed-rule" />

        <section className="embed-section">
          <h3>Share image</h3>
          <div className="embed-preview" ref={preview}>
            <ShareCard stateName={stateName} {...card} onUseOnSite={() => embedSection.current?.scrollIntoView({ block: 'center' })} />
          </div>
          <button type="button" className="embed-button" onClick={download}>
            Download PNG
            <img src={downloadIcon} alt="" width={18} height={18} />
          </button>
        </section>

        <section className="embed-section" ref={embedSection}>
          <h3>Get embed code</h3>
          <pre className="embed-code">
            <code>{code}</code>
          </pre>
          <button type="button" className="embed-button" onClick={copyCode}>
            {copied ? 'Copied' : 'Copy code'}
            <img src={copyIcon} alt="" width={18} height={18} />
          </button>
        </section>

        <p className="embed-credit">{CC_BY_CREDIT}</p>
      </div>
    </div>
  )
}
