# Money & Margins: one-day build

Goal for today: a private map of outside spending in every 2026 Senate general election race, built from FEC records, with every number sourced and dated. One screen. No forecasts, polls, results, or models.

The full plan is parked in `docs/later/`. Do not build anything from it today.

## What it does

A dark map of the U.S. States with a 2026 Senate general election are filled by total independent expenditures per citizen of voting age, using one neutral sequential ramp (not party colors, because the fill combines both sides). States without a Senate race recede to the ground color. Two specials in one state show as two races in the panel.

Clicking a state opens a side panel:

- Race name, incumbent and party.
- One row per general election candidate: spending supporting them and spending opposing them, as two separate bars on one shared scale across the whole panel. Party shown by color and by text label.
- Top five committees by amount for each candidate, with support or oppose and a link to the FEC record.
- "Data as of" date from FEC's last update, and a link to the FEC source page.

A thin footer: one sentence on what the map does and does not show, and "Find official voting information" linking to vote.gov. Same footer for every visitor.

## Data

- FEC independent expenditures for 2026 Senate general election candidates. Use FEC's processed data only (aggregate by-candidate endpoints if their fields fit; verify against current docs). No raw e-filings today, so nothing can be double counted. Label the map "as of FEC's latest processed data."
- Nominee list: built from each state's certified general election ballot (Ballotpedia where a state site is unavailable), one source URL per race, then matched to FEC candidate IDs. FEC alone cannot supply nominees: it returns every filer, including primary losers, retirees, and people who have left office, and it omits any nominee who never crossed FEC's registration threshold. Inclusion rule, identical for every race: all major-party nominees, plus any independent or minor-party candidate on the ballot who has independent expenditures reported for or against them. A nominee with no FEC record stays in the race with a "no FEC filing found" flag, so no race shows one side only.
- Party codes come from one lookup table: DFL maps to D, IND and NPA map to I, every other third party maps to other. A blank code fails the run.
- Race count: 35 races in 35 states (33 regular elections plus the Florida and Ohio specials). One race per state, no splits.
- Citizen voting-age population by state from the Census ACS CVAP special tabulation, committed as a small static CSV with its vintage noted.
- State boundaries: a simplified Census cartographic boundary file, converted once by a build script into a local SVG asset with state identifiers. No tiles, map token, or mapping service. Target: zero external map requests per visit.

Run the fetch script once, commit the JSON, deploy. Refresh by rerunning the script by hand. No cron, no database, no serverless functions.

## Rules that still apply today

- Party symmetry: one code path for every party, enforced by `symmetry.test.ts`.
- Support and oppose never netted.
- Spending appears only at the candidate's state. No donor data, no ad geography.
- Every number has source and date on screen.
- Private Vercel preview only. Not shared publicly until a two-sided review pass.

## Done means

- Every 2026 Senate general election race appears, hand-checked.
- Clicking any state shows its candidates with support and oppose bars and top committees.
- `npm test` passes, including the symmetry test.
- Works at desktop and phone widths, keyboard can reach every state and the panel.

## Out of scope today

Forecasts, polling, results, seat importance, path to 51, timeline, donor views, ad data, House races, live updates, pre-registration analysis.
