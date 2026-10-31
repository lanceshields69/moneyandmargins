# Incomplete data rules

A nominee is shown as "Incomplete data" when any rule below fires. The rules live in `src/incomplete.ts` and apply to every party identically. Party is read only to compare the ballot party with FEC's party code; no rule branches on which party it is.

A nominee whose FEC ID resolved and whose query returned no rows is **not** incomplete. It shows $0.

| Code | Fires when | Reason shown |
|---|---|---|
| `no-fec-match` | The nominee has no FEC candidate ID. | No FEC match |
| `missing-spending-record` | The nominee has an ID but `spending.json` has no entry. | ID needs review |
| `id-claimed-twice` | Any of the nominee's FEC IDs also appears on another nominee. | ID needs review |
| `party-mismatch` | FEC's party code maps to a display party (D, R, I) that differs from the ballot party. Third parties map to I. | ID needs review |
| `uncorroborated-name-match` | The ID came from the looser FEC name search (`fec-name-search`) and FEC's party code is not in the lookup, so party cannot corroborate it. | ID needs review |
| `multiple-ids` | The nominee matched more than one FEC ID. | ID needs review |
| `id-not-in-2026-cycle` | The FEC record for an ID does not list 2026 among its cycles. | ID needs review |

`No FEC match` wins when both reasons apply.

## What the display does

- The nominee row shows "Incomplete data" with the reason beneath it. No dollar figures are shown for it.
- The race panel header shows an incomplete marker and says the race total leaves those nominees out.
- The state fill is hatched on the map, and the legend explains the hatch.

## Hard failures, not flags

- `fetch-spending` stops if any returned expenditure row has a cycle other than 2026.
- `fetch-spending` stops if one FEC ID is assigned to two nominees.
- `npm run build` and `npm test` fail if a Democratic or Republican nominee is flagged and not listed in `data/known-incomplete.json` with a reason, or if a listed entry is no longer flagged. The list is expected to stay very small. If it grows, matching is broken.

## Known limits

- A nickname match from the first matching pass (`2a-name-match`) is not tracked as fuzzy, because that pass did not record whether a nickname was needed.
- A match that passes party corroboration is trusted. A wrong person of the same party and state would not be caught by these rules.
