import { CARD_HEIGHT, CARD_WIDTH } from './components/ShareCard'

const TYPEKIT_CSS = 'https://use.typekit.net/wai6ebo.css'

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/** The page's Halyard faces as data URLs, so the card rasterizes with the same fonts the page uses. */
async function embeddedFontCss(): Promise<string> {
  const sheet = await fetch(TYPEKIT_CSS).then((r) => r.text())
  const faces = sheet.match(/@font-face\s*\{[^}]*\}/g) ?? []
  const urls = Array.from(new Set(faces.flatMap((face) => Array.from(face.matchAll(/url\((["']?)(https:[^)"']+)\1\)/g), (m) => m[2]))))
  const data = new Map<string, string>()
  await Promise.all(
    urls.map(async (url) => {
      const buffer: ArrayBuffer = await (await fetch(url)).arrayBuffer()
      const bytes = new Uint8Array(buffer)
      data.set(url, `data:font/woff2;base64,${bytesToBase64(bytes)}`)
    }),
  )
  return faces
    .map((face) => face.replace(/url\((["']?)(https:[^)"']+)\1\)/g, (_, _q, url: string) => `url(${data.get(url) ?? url})`))
    .join('\n')
}

/** An SVG drawn as an image cannot see the page's CSS variables, so each fill and stroke takes its resolved color. */
function resolveColors(source: SVGSVGElement, copy: SVGSVGElement): void {
  const from = [source, ...Array.from(source.querySelectorAll('*'))]
  const to = [copy, ...Array.from(copy.querySelectorAll('*'))]
  from.forEach((el, i) => {
    const computed = getComputedStyle(el)
    for (const prop of ['fill', 'stroke'] as const) {
      const value = to[i].getAttribute(prop)
      if (value?.includes('var(')) to[i].setAttribute(prop, computed.getPropertyValue(prop))
    }
  })
}

/** The card as a 1200x630 PNG, with the Use-on-your-site link left out. */
export async function cardPngBlob(svg: SVGSVGElement): Promise<Blob> {
  const copy = svg.cloneNode(true) as SVGSVGElement
  resolveColors(svg, copy)
  copy.querySelectorAll('[data-export-omit]').forEach((node) => node.remove())
  copy.setAttribute('width', String(CARD_WIDTH))
  copy.setAttribute('height', String(CARD_HEIGHT))
  const fonts = await embeddedFontCss().catch(() => '')
  if (fonts) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = fonts
    copy.insertBefore(style, copy.firstChild)
  }
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
    if (!blob) throw new Error('The card could not be rendered as a PNG.')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function downloadCardPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const blob = await cardPngBlob(svg)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
