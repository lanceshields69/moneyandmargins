// The article pages built by scripts/build-articles.ts. `source` is relative to the scripts folder.
export interface Article {
  slug: string
  source: string
  heroAlt?: string
}

export const CLAUDE_ARTICLE: Article = {
  slug: 'claude-on-building-an-election-map',
  source: '../docs/written-by-claude.md',
  heroAlt:
    "Large text reading 'why isn't this showing up here?' next to a pink outline of Texas on a black background. Beneath it: the map said $34 million for Texas; with the quick reports, it was about $453 million. Written by Claude, with Lance Shields.",
}

export const MVP_ARTICLE: Article = {
  slug: 'how-to-write-an-mvp-md',
  source: '../docs/how-to-write-an-mvp-md.md',
}

export const ALL_ARTICLES: Article[] = [CLAUDE_ARTICLE, MVP_ARTICLE]
