import type { Committee } from '../types'
import { pickPair } from '../computeCallout'
import { PARTY_DISPLAY, type RaceView, type RowView, type SideView } from '../computeSpending'
import { DATA_VERIFIED } from '../config'
import { AMOUNTS_PENDING_LEAD, SHARES_PENDING_LINK } from '../copy'
import { formatMoney, formatMoneyFull } from '../format'
import { CONTACT_EMAIL } from '../config'
import { buildMailto } from '../corrections'

const FEC_SOURCE_URL = 'https://www.fec.gov/data/independent-expenditures/'

function Bar({ label, side, color, striped }: { label: string; side: SideView; color: string; striped: boolean }) {
  const width = side.value > 0 ? Math.max(side.widthPct, 1) : 0
  return (
    <div className="bar-row">
      <dt>{label}</dt>
      <dd>
        <span className="track">
          <span
            className={striped ? 'fill fill-striped' : 'fill'}
            style={{ width: `${width}%`, ['--bar-color' as string]: color, ['--row' as string]: striped ? 1 : 0 }}
          />
        </span>
        <span className="amount" title={formatMoneyFull(side.value)}>
          {formatMoney(side.value)}
        </span>
      </dd>
    </div>
  )
}

function CommitteeList({ title, committees }: { title: string; committees: Committee[] }) {
  if (committees.length === 0) return null
  return (
    <>
      <h4>{title}</h4>
      <ol className="committees">
        {committees.map((c) => (
          <li key={c.id}>
            <a href={c.fecUrl} target="_blank" rel="noreferrer">
              {c.name}
            </a>
            <span className="amount">{formatMoneyFull(c.amount)}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

function Nominee({ row, index, dataVerified }: { row: RowView; index: number; dataVerified: boolean }) {
  return (
    <li className="nominee" style={{ ['--i' as string]: index }}>
      <div className="nominee-head">
        <span className="swatch" style={{ background: row.partyColor }} aria-hidden="true" />
        <span className="name">{row.name}</span>
        <span className="party">{row.partyLabel}</span>
      </div>

      {row.incomplete || !row.support || !row.oppose ? (
        <p className="incomplete">
          Incomplete data
          <span className="reason muted">{row.reason ?? 'ID needs review'}</span>
        </p>
      ) : !dataVerified ? null : (
        <>
          <dl className="bars">
            <Bar label="Supporting" side={row.support} color={row.partyColor} striped={false} />
            <Bar label="Opposing" side={row.oppose} color={row.partyColor} striped />
          </dl>
          {(row.topSupportCommittees.length > 0 || row.topOpposeCommittees.length > 0) && (
            <details>
              <summary>Top committees</summary>
              <CommitteeList title="Supporting" committees={row.topSupportCommittees} />
              <CommitteeList title="Opposing" committees={row.topOpposeCommittees} />
            </details>
          )}
        </>
      )}

      {row.sourceUrl && (
        <p className="source muted">
          <a href={row.sourceUrl} target="_blank" rel="noreferrer">
            FEC record
          </a>
        </p>
      )}
    </li>
  )
}

interface RacePanelProps {
  race: RaceView | null
  fetchedAt: string
  /** The latest filing date in the data, shown once in the panel's top line. */
  dataThrough?: string
  /** Whether per-candidate dollar amounts and top committees may be shown. Defaults to the DATA_VERIFIED flag. */
  dataVerified?: boolean
  /** Opens the methodology modal from the "how this is counted" link. */
  onOpenHow?: () => void
}

/**
 * Rows in the panel. A nominee the forecast covers always keeps a row, even at $0; any other candidate with
 * nothing reported collapses into one line. Candidates flagged incomplete keep their row and its reason.
 */
export function splitRows(race: RaceView, collapse: boolean): { listed: RowView[]; quiet: RowView[] } {
  if (!collapse) return { listed: race.rows, quiet: [] }
  const covered = new Set(pickPair(race.rows).map((r) => r.candidateId))
  const quiet = race.rows.filter((r) => !r.incomplete && !covered.has(r.candidateId) && (r.support?.value ?? 0) === 0 && (r.oppose?.value ?? 0) === 0)
  return { listed: race.rows.filter((r) => !quiet.includes(r)), quiet }
}

export default function RacePanel({ race, fetchedAt, dataThrough, dataVerified = DATA_VERIFIED, onOpenHow }: RacePanelProps) {
  const { listed, quiet } = race ? splitRows(race, dataVerified) : { listed: [], quiet: [] }
  return (
    <section id="race-details" className="panel" aria-label="Race details" tabIndex={-1}>
      {!race ? (
        <p className="muted prompt">Select a highlighted state to see its 2026 Senate race.</p>
      ) : (
        <>
          <h2>
            {race.raceName}
            {race.isSpecial && <span className="tag">Special election</span>}
            {race.incompleteCount > 0 && <span className="tag tag-incomplete">Incomplete data</span>}
          </h2>
          <p className="muted summary">
            {!dataVerified ? (
              <>
                {AMOUNTS_PENDING_LEAD}
                <button type="button" className="link-button" onClick={onOpenHow}>
                  {SHARES_PENDING_LINK}
                </button>
                .
              </>
            ) : (
              `Total reported: ${race.total === null ? 'incomplete data' : formatMoney(race.total)}.${dataThrough ? ` Data through ${dataThrough}.` : ''}`
            )}
          </p>
          {race.missingMajor.map((party) => (
            <p key={party} className="muted summary">
              No {PARTY_DISPLAY[party].label} nominee listed in the source data.
            </p>
          ))}
          <p className="muted order-note">Listed alphabetically by party</p>
          <ul className="nominees">
            {listed.map((row, index) => (
              <Nominee key={row.candidateId} row={row} index={index} dataVerified={dataVerified} />
            ))}
          </ul>
          {quiet.length > 0 && <p className="muted quiet">{`Also on the ballot, no reported spending: ${quiet.map((r) => r.name).join(', ')}`}</p>}
          <p className="muted scale-note">Bars share one scale within this race. Supporting and opposing amounts are not netted.</p>
        </>
      )}
      <p className="muted disclaimer">
        <button type="button" className="link-button" onClick={onOpenHow}>
          How this map works
        </button>
        {' · '}
        <a href={FEC_SOURCE_URL} target="_blank" rel="noreferrer">
          FEC source
        </a>
        {CONTACT_EMAIL && (
          <>
            {' · '}
            <a href={buildMailto(race ? race.raceName.replace(/ Senate( special election)? 2026$/, '') : null, window.location.href, fetchedAt)}>
              Report an error
            </a>
          </>
        )}
      </p>
    </section>
  )
}
