// VotePredictor race pages: the base URL and the fragment that scrolls to "Other forecasts" (a text fragment, since
// the page has no anchor ID). The link is built from the lowercase state abbreviation. Nothing is copied from the page.
export const VOTEPREDICTOR = {
  base: 'https://votepredictor.com/senate/',
  fragment: '#:~:text=Other%20forecasts',
} as const

export const otherForecastsUrl = (stateAbbreviation: string): string => `${VOTEPREDICTOR.base}${stateAbbreviation.toLowerCase()}${VOTEPREDICTOR.fragment}`
export const OTHER_FORECASTS_TITLE = 'Polls, other forecasts, and market odds for this race (VotePredictor)'
