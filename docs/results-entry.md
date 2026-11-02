# Entering election results

Two hand-entered files feed the Result row. No feed, no admin page, and nothing publishes automatically; this is
the manual path only (see "Automatic publishing" and "Automated results" in docs/MVP.md for the later, unbuilt step).

## data/results-races.csv

One row per race, added when that race first has anything to report.

| Column | Meaning |
|---|---|
| `race_id` | Must match a race id in `data/nominees.json` exactly, e.g. `TX-2026`. |
| `status` | `Counting`, `Unofficial`, or `Certified`. Nothing else. |
| `percent_reporting` | A number from 0 to 100. |
| `note` | Optional. A short note, e.g. "Ranked-choice tabulation pending." Leave blank if none. |
| `source_url` | The state's official results page for this race. Required. |
| `as_of` | When this row's numbers were pulled, as an ISO timestamp (e.g. `2026-11-03T21:00:00Z`). Required. |

Example row (for illustration only; the committed file ships with headers and no rows):

```
race_id,status,percent_reporting,note,source_url,as_of
OH-2026,Unofficial,98,,https://www.ohiosos.gov/elections/results/,2026-11-03T21:00:00Z
```

## data/results-votes.csv

One row per candidate per race, only for races that also have a row in `results-races.csv`.

| Column | Meaning |
|---|---|
| `race_id` | Must match a race id in `data/nominees.json`, and must have a row in `results-races.csv`. |
| `candidate` | Must match that candidate's `name` in `data/nominees.json` exactly, for that race. |
| `party` | The candidate's party, for reference; the site reads the candidate's party from `nominees.json`, not this column. |
| `votes` | A whole, non-negative number. |

Example row:

```
race_id,candidate,party,votes
OH-2026,Sherrod Brown,D,2104332
```

## Statuses

- **Counting.** Votes are still coming in. The callout shows "XX% reporting" and the shares, with no leader named,
  no leader color, and no checkmark.
- **Unofficial.** The count is done but not certified. The leading party's square gets a dashed box in the callout
  and a dashed outline on the map. No checkmark.
- **Certified.** The state has certified. The leading party's square gets a checkmark and a solid box, and the map
  square gets a solid outline. The checkmark appears only at this stage.

A race with no row in `results-races.csv` shows "Results (not added)" with "--" placeholders, and keeps its
forecast row and "Other forecasts ↗" link.

## Validation

`npx tsx scripts/validate-results.ts` runs before every build (via `npm run prebuild`) and in the test suite. It
fails with a specific message for: an unknown `race_id`; a candidate not in `nominees.json` for that race; an
invalid `status`; `percent_reporting` outside 0 to 100; negative or non-integer `votes`; a missing `source_url` or
`as_of`; or a vote row for a race with no row in `results-races.csv`.
