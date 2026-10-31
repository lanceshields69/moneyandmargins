import type { Committee } from '../types'
import { PARTY_DISPLAY, type RaceView, type RowView, type SideView } from '../computeSpending'
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

function Nominee({ row, index }: { row: RowView; index: number }) {
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
      ) : (
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
          , processed data as of {formatDate(row.asOf)}
        </p>
      )}
    </li>
  )
}

interface RacePanelProps {
  race: RaceView | null
  fetchedAt: string
}

export default function RacePanel({ race, fetchedAt }: RacePanelProps) {
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
            {race.total === null
              ? 'Incomplete data'
              : `Total independent expenditures, support plus oppose: ${formatMoney(race.total)} (FEC processed data as of ${formatDate(fetchedAt)})`}
            {race.incompleteCount > 0 &&
              `. Leaves out ${race.incompleteCount} nominee${race.incompleteCount === 1 ? '' : 's'} with incomplete data, so this total may be low.`}
            {race.total !== null && ' Includes primary-season spending.'}
          </p>
          {race.missingMajor.map((party) => (
            <p key={party} className="muted summary">
              No {PARTY_DISPLAY[party].label} nominee listed in the source data.
            </p>
          ))}
          <ul className="nominees">
            {race.rows.map((row, index) => (
              <Nominee key={row.candidateId} row={row} index={index} />
            ))}
          </ul>
          <p className="muted scale-note">Bars share one scale within this race. Supporting and opposing amounts are not netted.</p>
        </>
      )}
      <p className="muted disclaimer">
        Independent expenditures reported to the FEC for the 2026 cycle, including primary-season spending. Excludes
        candidate committee and party-coordinated spending. Processed FEC data as of {formatDate(fetchedAt)}; recent{' '}
        {'24- and 48-hour'} reports may not be included.{' '}
        <a href={FEC_SOURCE_URL} target="_blank" rel="noreferrer">
          FEC source
        </a>
        {CONTACT_EMAIL && (
          <>
            {' · '}
            <a href={buildMailto(race ? race.raceName.replace(/ Senate( special election)? 2026$/, '') : null, window.location.href, fetchedAt)}>
              Send me a message
            </a>
          </>
        )}
      </p>
    </section>
  )
}
