// Copy that is the same for every race and every party.
export const PARTIAL_CALLOUT_NOTICE = 'Partial data: recent filings missing. Shares may change.'
export const DATA_CHECK_NOTICE = 'Data check in progress: totals for some races are being corrected.'
export const SHARES_PENDING_LEAD = 'Shares are being verified. Partial data: see '
export const SHARES_PENDING_LINK = 'how this is counted'
export const AMOUNTS_PENDING_LEAD = 'Dollar amounts are being verified. Partial data: see '

/** "frozen [date]" only for the snapshot tagged final-pre-election; any earlier snapshot is "latest as of [date]". */
export const FINAL_FORECAST_TAG = 'final-pre-election'
export const forecastPhrase = (tag: string | null): string => (tag === FINAL_FORECAST_TAG ? 'frozen' : 'latest as of')

/** The FEC's independent expenditures page, linked from the race panel and the footer. */
export const FEC_SOURCE_URL = 'https://www.fec.gov/data/independent-expenditures/'
