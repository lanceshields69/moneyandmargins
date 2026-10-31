import type { NationalView, PartyBar, PartyGroup } from '../computeSpending'
import { formatDate, formatMoney, formatMoneyFull } from '../format'

const FEC_SOURCE_URL = 'https://www.fec.gov/data/independent-expenditures/'

function Segment({ bar, group, striped }: { bar: PartyBar; group: PartyGroup; striped: boolean }) {
  if (bar.widthPct <= 0) return null
  return (
    <span className="seg" style={{ width: `${bar.widthPct}%` }}>
      <span
        className={striped ? 'seg-fill fill-striped' : 'seg-fill'}
        style={{ ['--bar-color' as string]: group.color }}
      />
      {bar.statePct > 0 && (
        <span
          className={striped ? 'seg-state state-part-striped' : 'seg-state'}
          style={{ width: `${bar.statePct}%`, ['--tint' as string]: group.tint }}
        />
      )}
    </span>
  )
}

function PartyRow({ group, selected }: { group: PartyGroup; selected: boolean }) {
  const detail = `Supporting ${formatMoneyFull(group.support.total)}, opposing ${formatMoneyFull(group.oppose.total)}`
  return (
    <div className="nat-line" title={`${group.nominees} nominees`}>
      <span className="nat-label">
        <span className="swatch" style={{ background: group.color }} aria-hidden="true" />
        {group.label}
      </span>
      <span className="track nat-track" aria-hidden="true">
        <Segment bar={group.support} group={group} striped={false} />
        <Segment bar={group.oppose} group={group} striped />
      </span>
      <span className="amount" title={detail}>
        {formatMoney(group.total)}
        <span className="sr-only">. {detail}</span>
      </span>
      <span className="state-amt" style={{ color: group.tint }}>
        {selected ? formatMoney(group.stateTotal) : ''}
      </span>
    </div>
  )
}

interface NationalChartProps {
  view: NationalView
  stateName: string | null
  fetchedAt: string
}

export default function NationalChart({ view, stateName, fetchedAt }: NationalChartProps) {
  return (
    <section className="national" aria-label="Spending for and against each party's nominees, all races">
      <div className="national-head">
        <h2>Spending by party of nominee</h2>
        <span className="muted nat-date">As of {formatDate(fetchedAt)}</span>
      </div>
      {view.groups.map((group) => (
        <PartyRow key={group.party} group={group} selected={view.stateCode !== null} />
      ))}
      <p className="nat-key muted">
        <span className="key-item">
          <span className="key-solid" aria-hidden="true" />
          Supporting
        </span>
        <span className="key-item">
          <span className="key-striped" aria-hidden="true" />
          Opposing
        </span>
        {stateName && <span className="key-item">Lighter shade and right-hand amount: {stateName}</span>}
      </p>
      <p className="muted nat-note">
        All 35 races. Independents and nominees with incomplete data are not counted. Includes primary-season spending;
        recent {'24- and 48-hour'} reports may not be included. Snapshot of FEC processed data.{' '}
        <a href={FEC_SOURCE_URL} target="_blank" rel="noreferrer">
          FEC source
        </a>
      </p>
    </section>
  )
}
