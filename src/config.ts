// The one place the corrections address lives. While empty, the site hides the report link and the contact line.
export const CONTACT_EMAIL = 'lance@lanceshields.design'

// Both flags are build-time switches (see vite.config.ts). Each defaults to true, so the verified view needs no
// setup; set the environment variable to exactly "false" to turn one off.
// DATA_VERIFIED gates per-candidate dollar amounts, top committees, the map fill, the "itemized data through"
// labels, and the verified methodology text. While false, the panel shows no amounts, the map is one neutral fill, and the methodology modal renders
// docs/methodology-partial.md instead of docs/methodology.md.
export const DATA_VERIFIED: boolean = __DATA_VERIFIED__

// SHARES_VERIFIED gates the national party card and the "Spent on ads" percentages. While false, the callout's
// "Spent on ads" row says shares are being verified and links to the methodology.
export const SHARES_VERIFIED: boolean = __SHARES_VERIFIED__

// A visible line under the callout's rows: totals do not yet include 24- and 48-hour reports.
export const GLOBAL_PARTIAL_NOTICE = true

// The badge that prints the compiled flags shows on Vercel Preview builds only.
export const IS_PREVIEW_BUILD: boolean = __VERCEL_ENV__ === 'preview'
