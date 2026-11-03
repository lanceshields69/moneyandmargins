export const CC_BY_CREDIT =
  'Spending data compiled by Money & Margins from FEC records, licensed CC BY 4.0. Credit: Lance Shields, Money & Margins, moneyandmargins.app. The FEC is the original source. The logo and design are not included in this license.'

export const EMBED_SCRIPT_URL = 'https://moneyandmargins.app/embed/mm-card.js'

/** The snippet a newsroom pastes. Only the state code changes between races. */
export function embedCode(stateCode: string): string {
  const code = stateCode.toUpperCase()
  return [
    `<!-- Money & Margins: ${code} Senate, 2026 -->`,
    `<div data-mm-card="${code}" data-mm-race="2026-SEN-${code}"></div>`,
    `<script async src="${EMBED_SCRIPT_URL}"></script>`,
    `<noscript>Data: FEC. Map: Money &amp; Margins, moneyandmargins.app. <a href="https://moneyandmargins.app/#${code}">View ${code} Senate, 2026</a></noscript>`,
  ].join('')
}
