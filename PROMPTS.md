# Today's prompts

All Sonnet 5.5. Effort level is set per prompt to save usage: low for mechanical work a compiler or test can check, medium where a wrong answer can look right. Plan mode for each. `/clear` between them.

| Prompt | Effort | Time |
|---|---|---|
| 1. Scaffold | Low | 45 min |
| 2a. Race list | Medium | 1 hr incl. your check |
| 2b. FEC spending and symmetry test | Medium | 1.5 hrs |
| 2c. Census population join | Low | 30 min |
| 3. Map and panel | Medium | 2.5 hrs |
| 4a. Fairness review | Medium | 30 min |
| 4b. Deploy | Low | 15 min |
| Any small fix: lint, type errors, typos, copy tweaks | Low | as needed |

If a low-effort prompt fails twice on the same problem, rerun it at medium rather than retrying a third time.

## 1. Scaffold (low)

Read CLAUDE.md and docs/SPEC.md. Scaffold Vite, React, TypeScript strict, Mapbox GL JS v3, vitest, tsx. Create a types file for races, candidates, and expenditure totals. Add symmetry.test.ts as a failing stub. Render an empty dark map with the token colors. Nothing else.

## 2a. Race list (medium)

Write scripts/fetch-races.ts. Build the list of 2026 Senate general election races and their major candidates from FEC candidate data, including special elections. Verify endpoints and field names against current FEC docs first. Stop and show me the list as a table so I can check it by hand. Save to data/races.json only after I approve.

## 2b. FEC spending and symmetry test (medium)

Write scripts/fetch-spending.ts. For the approved candidates in data/races.json, fetch independent expenditure totals from FEC's processed data, kept separate by support and oppose, plus the top five committees per candidate. No raw e-filings. Verify field names against current FEC docs. Write to data/ with a fetched_at timestamp and save a fixture. Make symmetry.test.ts real: swapping party labels in the fixture must mirror every computed value and sort order.

## 2c. Census population join (low)

Add the Census ACS CVAP state CSV to data/ with its vintage noted. Join it to the race data to compute spending per citizen of voting age. Add a unit test for the join.

## 3. Map and panel (medium)

Build the map and side panel exactly as described in docs/SPEC.md. Neutral fill ramp for total spending per eligible citizen. Panel bars share one scale across all candidates in the panel. Every number shows source and date. Footer with the vote.gov link. Keyboard access to states and panel, visible brass focus ring, reduced motion respected. Show me screenshots at desktop and 390px.

## 4a. Fairness review (medium, fresh session)

Run all tests. Then review every screen as a skeptical Republican reader, then as a skeptical Democratic reader, and list anything that favors one side: wording, ordering, color weight, defaults. Fix and list what changed.

## 4b. Deploy (low)

Deploy to a Vercel preview. Confirm environment variables are set in Vercel, not committed. Give me the preview URL.
