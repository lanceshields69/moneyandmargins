// Renders the two article pages from docs/ into static HTML after `vite build`. The text is in the page source,
// not drawn by JavaScript. The publish guard stops the build if a body has an unfilled [bracketed] note, a leftover
// {{ }} placeholder, or the hero image is missing.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { ALL_ARTICLES, CLAUDE_ARTICLE, type Article } from '../src/articles'

const SITE = 'https://moneyandmargins.app'
const PUBLISH_DATE = 'November 1, 2026'
const ISO_DATE = '2026-11-01'
const dist = new URL('../dist/', import.meta.url)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function frontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(raw)
  if (!m) throw new Error('missing front matter')
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { meta, body: raw.slice(m[0].length) }
}

/** Inline markdown: links, bold, italic. Text is escaped first, so nothing in the source becomes markup by accident. */
function inline(text: string): string {
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => `<a href="${href}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

type Block = { kind: 'h2' | 'p'; text: string }

function blocks(body: string, subtitle: string): Block[] {
  const out: Block[] = []
  for (const chunk of body.split(/\n\s*\n/)) {
    const text = chunk.replace(/\n/g, ' ').trim()
    if (!text || text.startsWith('# ')) continue // the H1 comes from the title
    if (text.startsWith('## ')) out.push({ kind: 'h2', text: text.slice(3) })
    else if (text === `*${subtitle}*`) continue // the deck is already under the H1
    else out.push({ kind: 'p', text })
  }
  return out
}

function renderBody(list: Block[], noteHeading: string | null): string {
  const note = noteHeading ? list.findIndex((b) => b.kind === 'h2' && b.text === noteHeading) : -1
  if (note === -1) return list.map(renderBlock).join('\n')
  const before = list.slice(0, note)
  const after = list.slice(note + 1)
  const disclosure = after.length > 0 && after[after.length - 1].text.startsWith('*Written by') ? after.pop() : undefined
  const parts = [...before.map(renderBlock)]
  parts.push(`<aside class="lance-note"><p class="label">A note from Lance</p>\n${after.map(renderBlock).join('\n')}\n</aside>`)
  if (disclosure) parts.push(`<p class="disclosure">${inline(disclosure.text)}</p>`)
  return parts.join('\n')
}

function renderBlock(b: Block): string {
  return b.kind === 'h2' ? `<h2>${inline(b.text)}</h2>` : `<p>${inline(b.text)}</p>`
}

/** Head tags shared with the home page: icon, fonts, the Ahrefs script, and the built stylesheet. */
function sharedHead(): string {
  const html = readFileSync(new URL('index.html', dist), 'utf-8')
  const keep = html
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /rel="(icon|apple-touch-icon|preconnect|stylesheet)"/.test(l) || /analytics\.ahrefs\.com/.test(l))
    .filter((l) => !/type="module"/.test(l))
  return keep.join('\n    ')
}

function headerHtml(): string {
  return `<header class="header article-header">
      <a href="/"><img class="logo" src="/images/logo.png" alt="Money &amp; Margins" width="399" height="59" /></a>
      <p class="muted">The ads are everywhere. The receipts are here.</p>
    </header>`
}

function footerHtml(): string {
  return `<footer class="footer muted">
      <p><a href="/">Money &amp; Margins</a>, the map of 2026 Senate outside spending.</p>
      <p>Official voting information: <a href="https://vote.gov" target="_blank" rel="noreferrer">vote.gov</a></p>
      <p>© 2026 <a href="https://www.lanceshields.design/" target="_blank" rel="noreferrer">Lance Shields</a>. All rights reserved.</p>
    </footer>`
}

function shareBar(url: string, title: string): string {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return `<div class="share-bar" role="group" aria-label="Share this page">
        <a href="https://twitter.com/intent/tweet?text=${t}&amp;url=${u}" target="_blank" rel="noopener noreferrer">X</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener noreferrer">Facebook</a>
        <a href="mailto:?subject=${t}&amp;body=${u}">Email</a>
        <button type="button" class="link-button" data-copy="${esc(url)}">Copy link</button>
      </div>`
}

function page(a: Article, problems: string[]): string {
  const raw = readFileSync(new URL(a.source, import.meta.url), 'utf-8')
  const { meta, body } = frontMatter(raw)
  const url = `${SITE}/${a.slug}`
  const subtitle = meta.subtitle
  const title = meta.title
  const description = meta.description
  const heroAlt = a.heroAlt ?? ''
  const isClaude = a.slug === CLAUDE_ARTICLE.slug

  // Guard. Anything here stops the build, so nothing ships with an open placeholder.
  const filled = body.replace(/\{\{publish_date\}\}/g, PUBLISH_DATE)
  const prose = filled.replace(/\[[^\]]+\]\([^)]*\)/g, '')
  for (const m of prose.match(/\[[^\]]+\]/g) ?? []) problems.push(`${a.slug}: unfilled bracketed text ${m}`)
  if (/\{\{|\}\}/.test(filled)) problems.push(`${a.slug}: a {{ }} placeholder is left`)
  if (isClaude && !existsSync(new URL('../public/images/claude-article-hero.png', import.meta.url))) problems.push(`${a.slug}: hero image is missing`)

  const dateLine = `<p class="muted dateline">${PUBLISH_DATE}</p>`
  const pill = isClaude
    ? `<div class="byline-row"><span class="pill">Written by Claude</span><span class="muted">with Lance Shields</span></div>`
    : ''
  const hero = isClaude
    ? `<figure class="hero"><img src="/images/claude-article-hero.png" alt="${esc(heroAlt)}" width="2400" height="1260" /></figure>`
    : ''
  const ogImage = isClaude
    ? `<meta property="og:image" content="${SITE}/images/claude-article-hero-og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(heroAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE}/images/claude-article-hero-og.png" />`
    : `<meta name="twitter:card" content="summary" />`
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: ISO_DATE,
    dateModified: ISO_DATE,
    ...(isClaude ? { image: [`${SITE}/images/claude-article-hero-og.png`] } : {}),
    author: { '@type': 'Person', name: meta.author },
    publisher: { '@type': 'Person', name: 'Lance Shields' },
    mainEntityOfPage: url,
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(meta.seo_title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Money &amp; Margins" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    ${ogImage}
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="theme-color" content="#181714" />
    ${sharedHead()}
    <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
  </head>
  <body class="article-page">
    <div class="article-wrap">
    ${headerHtml()}
    <nav class="back"><a href="/">Back to the map</a></nav>
    <main class="article">
      <h1>${esc(title)}</h1>
      <p class="deck">${esc(subtitle)}</p>
      ${pill}
      ${dateLine}
      ${shareBar(url, title)}
      ${hero}
      ${renderBody(blocks(filled, subtitle), isClaude ? 'A note from Lance' : null)}
    </main>
    ${footerHtml()}
    </div>
    <script>
      document.querySelectorAll('[data-copy]').forEach(function (b) {
        b.addEventListener('click', function () {
          navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () { b.textContent = 'Link copied' })
        })
      })
    </script>
  </body>
</html>
`
}

const problems: string[] = []
const pages = ALL_ARTICLES.map((a) => ({ a, html: page(a, problems) }))
if (problems.length > 0) {
  console.error('Publish guard: not publishing the articles.')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
for (const { a, html } of pages) {
  mkdirSync(new URL(a.slug + '/', dist), { recursive: true })
  writeFileSync(new URL(a.slug + '/index.html', dist), html)
  console.log(`Wrote ${a.slug}/index.html`)
}
const urls = [SITE + '/', ...ALL_ARTICLES.map((a) => `${SITE}/${a.slug}`)]
writeFileSync(
  new URL('sitemap.xml', dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${ISO_DATE}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
)
console.log('Wrote sitemap.xml')
