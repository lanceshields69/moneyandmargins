import { CARD_HEIGHT, CARD_WIDTH } from './components/ShareCard'

/** Renders the card's SVG to a 1200x630 PNG and downloads it. The fonts are the system ones, as the SVG is drawn in an image. */
export async function downloadCardPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('width', String(CARD_WIDTH))
  copy.setAttribute('height', String(CARD_HEIGHT))
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = CARD_WIDTH
    canvas.height = CARD_HEIGHT
    canvas.getContext('2d')?.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  } finally {
    URL.revokeObjectURL(url)
  }
}
