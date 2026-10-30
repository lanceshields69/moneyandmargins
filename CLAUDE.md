# Money & Margins

One-day build. Read `docs/SPEC.md` first. Ignore `docs/later/` unless asked.

## Rules

1. Party symmetry. Calculations, scales, labels, and sort orders take party as a parameter. No party-specific branches. `symmetry.test.ts` must pass before every commit.
2. Support and oppose stay separate. Never net them.
3. Spending is shown only at the candidate's state. No donor or ad geography.
4. Every number on screen shows its source and as-of date.
5. Neutral copy. Describe what filings show. The voting link is vote.gov, identical for everyone.

## Stack

Vite, React, TypeScript strict, a local SVG map of U.S. states built from Census cartographic boundary data (generated once by a build script, no runtime map API), vitest. A one-off fetch script in `scripts/` run with `tsx` writes JSON to `data/`. Static deploy to a Vercel preview. Secrets: `FEC_API_KEY`. Never commit or log it.

## How to work

Plan mode first, wait for approval. Verify FEC field names against current FEC API docs, not memory. Develop against saved fixtures after the first live fetch. Small commits.

## Design tokens

| Token | Hex | Use |
|---|---|---|
| ground | #181714 | page, and fill for states with no race |
| panel | #22221E | side panel |
| rule | #393834 | hairlines |
| text | #E9E8E2 | primary text |
| muted | #9A9893 | secondary text, dates |
| dem | #6F97E2 | Democratic |
| rep | #D87972 | Republican |
| ind | #3EAF86 | Independent |
| brass | #D4BC79 | selection and focus only |

Party colors share OKLCH lightness 0.68 and chroma 0.12. Change all or none. The state fill uses a neutral grey-to-brass ramp, never party colors. State borders use the rule color. No basemap, water, or road layers. Type: Public Sans, tabular figures. Sentence case, no all-caps labels.
