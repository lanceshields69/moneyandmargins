import { Fragment, useEffect, useRef } from 'react'
import closeIcon from '../assets/close.svg'
import { splitMethodology, type MethodBlock } from '../methodology'

const FOCUSABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/** **bold** is the only inline markup in the methodology text. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
    </>
  )
}

function Blocks({ blocks }: { blocks: MethodBlock[] }) {
  return (
    <>
      {blocks.map((block, i) =>
        block.kind === 'ul' ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : block.kind === 'h2' ? (
          <h3 key={i}>{block.text}</h3>
        ) : block.kind === 'p' ? (
          <p key={i} className={block.text.startsWith('Last updated') ? 'how-updated' : undefined}>
            <Inline text={block.text} />
          </p>
        ) : null,
      )}
    </>
  )
}

interface MethodologyModalProps {
  blocks: MethodBlock[]
  onClose: () => void
}

export default function MethodologyModal({ blocks, onClose }: MethodologyModalProps) {
  const dialog = useRef<HTMLDivElement>(null)
  const { title, short, full } = splitMethodology(blocks)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLElement>('.how-close')?.focus()

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
      } else if (!dialog.current.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [onClose])

  return (
    <div className="how-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="how-dialog" role="dialog" aria-modal="true" aria-labelledby="how-title" ref={dialog}>
        <header className="how-head">
          <h2 id="how-title">{title}</h2>
          <button type="button" className="how-close" onClick={onClose} aria-label="Close">
            <img src={closeIcon} alt="" width={36} height={36} />
          </button>
        </header>
        <div className="how-body">
          <Blocks blocks={short} />
          {full.length > 0 && (
            <details className="how-more">
              <summary>
                <span className="how-more-closed">Show the full method</span>
                <span className="how-more-open">Hide the full method</span>
              </summary>
              <Blocks blocks={full} />
            </details>
          )}
        </div>
        <div className="how-fade" aria-hidden="true" />
      </div>
    </div>
  )
}
