import type { Committee } from '../types'
import { PARTY_DISPLAY, type RaceView, type RowView, type SideView } from '../computeSpending'
import { DATA_VERIFIED } from '../config'
import { AMOUNTS_PENDING_LEAD, LIMITS_SENTENCE, LIMITS_VERIFIED_SENTENCE, PANEL_PRIMARY_NOTE, SHARES_PENDING_LINK } from '../copy'
import { formatDate, formatMoney, formatMoneyFull } from '../format'
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

function Nominee({ row, index, dataVerified, asOf }: { row: RowView; index: number; dataVerified: boolean; asOf: string }) {
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

      {row.sourceUrl && row.asOf && (
        <p className="source muted">
          <a href={row.sourceUrl} target="_blank" rel="noreferrer">
            FEC record
          </a>
          , {dataVerified ? asOf : `processed data as of ${formatDate(row.asOf)}`}
        </p>
      )}
    </li>
  )
}

interface RacePanelProps {
  race: RaceView | null
  fetchedAt: string
  /** The as-of label: "itemized data through [date]; fetched [time]" once the data is verified. */
  asOf?: string
  /** Whether per-candidate dollar amounts and top committees may be shown. Defaults to the DATA_VERIFIED flag. */
  dataVerified?: boolean
  /** Opens the methodology modal from the "how this is counted" link. */
  onOpenHow?: () => void
}

export default function RacePanel({ race, fetchedAt, asOf = formatDate(fetchedAt), dataVerified = DATA_VERIFIED, onOpenHow }: RacePanelProps) {
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
              <>
                {race.total === null
                  ? 'Incomplete data'
                  : `Total independent expenditures, support plus oppose: ${formatMoney(race.total)} (${asOf})`}
                {race.incompleteCount > 0 &&
                  `. Leaves out ${race.incompleteCount} nominee${race.incompleteCount === 1 ? '' : 's'} with incomplete data, so this total may be low.`}
                {race.total !== null && ` ${PANEL_PRIMARY_NOTE}`}
              </>
            )}
          </p>
          {race.missingMajor.map((party) => (
            <p key={party} className="muted summary">
              No {PARTY_DISPLAY[party].label} nominee listed in the source data.
            </p>
          ))}
          <ul className="nominees">
            {race.rows.map((row, index) => (
              <Nominee key={row.candidateId} row={row} index={index} dataVerified={dataVerified} asOf={asOf} />
            ))}
          </ul>
          <p className="muted scale-note">Bars share one scale within this race. Supporting and opposing amounts are not netted.</p>
        </>
      )}
      <p className="muted disclaimer">
        Independent expenditures reported to the FEC for the 2026 cycle, including primary-season spending. Excludes
        candidate committee and party-coordinated spending. {dataVerified ? `FEC data: ${asOf}` : `Processed FEC data as of ${formatDate(fetchedAt)}`}. {dataVerified ? LIMITS_VERIFIED_SENTENCE : LIMITS_SENTENCE}{' '}
        <a href={FEC_SOURCE_URL} target="_blank" rel="noreferrer">
          FEC source
        </a>
        {CONTACT_EMAIL && (
          <>
            {' · '}
            <a href={buildMailto(race ? race.raceName.replace(/ Senate( special election)? 2026$/, '') : null, window.location.href, fetchedAt)}>
              See an error? Report it
            </a>
          </>
        )}
      </p>
    </section>
  )
}
