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
- Nominee list: general election major candidates per race, built by Claude Code from FEC candidate data, then checked by Lance by hand before use.
- Citizen voting-age population by state from the Census ACS CVAP special tabulation, committed as a small static CSV with its vintage noted.
- State boundaries: Mapbox's built-in boundaries or a Census cartographic file.

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
