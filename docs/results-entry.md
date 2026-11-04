# Results

Results come from civicAPI only (`scripts/fetch-results.ts`, off unless `RESULTS_AUTO=true`). Hand entry is retired.
The files it writes are `data/results-races.csv` and `data/results-votes.csv`, checked by `scripts/validate-results.ts`
before every build.

## data/results-races.csv

| Column | Meaning |
|---|---|
| `race_id` | A race id in `data/nominees.json`, e.g. `TX-2026`. |
| `status` | `Reporting` (votes in, no winner flagged) or `Win` (civicAPI flags exactly one winner). A `Win` row is shown as Win or Flip, by the seat's prior holder (below). |
| `percent_reporting` | 0 to 100. |
| `note` | Optional. |
| `source_url` | civicAPI's page, or the state's page when one is set in `data/results-feed-map.json`. |
| `as_of` | When the row was pulled, an ISO timestamp. |
| `winner` | The flagged winner, named as in `nominees.json`. Required when `Win`, blank when `Reporting`. |

## data/results-votes.csv

One row per nominee per race: `race_id`, `candidate`, `party` (reference only; the site reads party from `nominees.json`), `votes`.

## What the page shows

One status per race, read from these files and `data/seat-holders.json` (the party that held each seat before the election):

- **Win:** status `Win`, and the winner's party held the seat. Solid party-color chip with a black checkmark.
- **Flip:** status `Win`, and the winner's party did not hold the seat (derived, never stored). Party-color chip with a 2px dashed border.
- **Reporting:** `Reporting`. Off-white chip, no party color.
- **None:** no row. No chip; the race keeps its forecast circle.

A status is never inferred from vote counts. A `Win` row whose seat holder is unknown is held as Reporting.
