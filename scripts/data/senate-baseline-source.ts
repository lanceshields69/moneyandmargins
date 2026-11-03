// The party caucus of the 65 Senate seats not up for election in 2026. Needed only to turn a per-race forecast
// (PollingForecast, Bellwether) into a chamber-wide seat count; VotePredictor and CallTheMap already publish one.
export const SENATE_BASELINE = {
  notUpDemocraticCaucus: 34, // 32 Democrats + 2 independents who caucus with Democrats
  notUpRepublican: 31,
  asOf: '2026-11-02',
  sourceUrl: 'https://en.wikipedia.org/w/index.php?title=2026_United_States_Senate_elections&oldid=1383537498',
}
