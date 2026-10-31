import { tryMapPartyCode } from '../scripts/lib/party'
import type { Candidate, Party } from './types'

// Conditions are written out in docs/incomplete-data-rules.md. Party is read
// only to compare ballot party against FEC party; no rule branches on which party.
export type IncompleteCode =
  | 'no-fec-match'
  | 'missing-spending-record'
  | 'id-claimed-twice'
  | 'party-mismatch'
  | 'uncorroborated-name-match'
  | 'multiple-ids'
  | 'id-not-in-2026-cycle'

export type IncompleteReason = 'No FEC match' | 'ID needs review'

export const REASON_TEXT: Record<IncompleteCode, IncompleteReason> = {
  'no-fec-match': 'No FEC match',
  'missing-spending-record': 'ID needs review',
  'id-claimed-twice': 'ID needs review',
  'party-mismatch': 'ID needs review',
  'uncorroborated-name-match': 'ID needs review',
  'multiple-ids': 'ID needs review',
  'id-not-in-2026-cycle': 'ID needs review',
}

export interface KnownIncomplete {
  candidateId: string
  reason: string
}

export function countFecIdClaims(candidates: Candidate[]): Map<string, number> {
  const claims = new Map<string, number>()
  for (const c of candidates) for (const id of c.fecIds) claims.set(id, (claims.get(id) ?? 0) + 1)
  return claims
}

/** FEC party code reduced to the display categories; null when the code is not in the lookup. */
function fecDisplayParty(code: string): Party | null {
  const category = tryMapPartyCode(code)
  if (category === null) return null
  return category === 'other' ? 'I' : category
}

export function incompleteCodes(
  candidate: Candidate,
  claims: Map<string, number>,
  hasSpendingRecord: boolean,
): IncompleteCode[] {
  if (candidate.fecIds.length === 0) return ['no-fec-match']

  const codes = new Set<IncompleteCode>()
  if (!hasSpendingRecord) codes.add('missing-spending-record')
  if (candidate.fecIds.length > 1) codes.add('multiple-ids')

  for (const id of candidate.fecIds) {
    if ((claims.get(id) ?? 0) > 1) codes.add('id-claimed-twice')
    const match = candidate.fecMatches?.find((m) => m.id === id)
    if (!match) continue
    if (!match.cycles.includes(2026)) codes.add('id-not-in-2026-cycle')
    const fecParty = fecDisplayParty(match.fecParty)
    if (fecParty !== null && fecParty !== candidate.party) codes.add('party-mismatch')
    if (match.method === 'fec-name-search' && fecParty === null) codes.add('uncorroborated-name-match')
  }
  return [...codes]
}

export function reasonFor(codes: IncompleteCode[]): IncompleteReason | null {
  if (codes.length === 0) return null
  return codes.includes('no-fec-match') ? 'No FEC match' : 'ID needs review'
}

const MAJOR_PARTIES: ReadonlySet<Party> = new Set<Party>(['D', 'R'])

/** Problems with the reviewed list: unreviewed major-party flags, and stale list entries. */
export function knownIncompleteProblems(
  candidates: Candidate[],
  spendingIds: ReadonlySet<string>,
  known: KnownIncomplete[],
): string[] {
  const claims = countFecIdClaims(candidates)
  const knownIds = new Set(known.map((k) => k.candidateId))
  const flagged = new Map(
    candidates.map((c) => [c.id, incompleteCodes(c, claims, spendingIds.has(c.id))] as const),
  )
  const problems: string[] = []

  for (const c of candidates) {
    const codes = flagged.get(c.id) ?? []
    if (codes.length > 0 && MAJOR_PARTIES.has(c.party) && !knownIds.has(c.id)) {
      problems.push(`${c.id} (${c.party}) is flagged [${codes.join(', ')}] and is not in data/known-incomplete.json`)
    }
  }
  for (const k of known) {
    if (!k.reason.trim()) problems.push(`${k.candidateId} is in data/known-incomplete.json without a reason`)
    if ((flagged.get(k.candidateId) ?? []).length === 0) {
      problems.push(`${k.candidateId} is in data/known-incomplete.json but is no longer flagged`)
    }
  }
  return problems
}
