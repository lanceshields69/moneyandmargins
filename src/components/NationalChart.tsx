import type { NationalView, PartyBar, PartyGroup } from '../computeSpending'
import { formatDate, formatMoney, formatMoneyFull } from '../format'

function Segment({
  bar,
  group,
  striped,
  stateKey,
}: {
  bar: PartyBar
  group: PartyGroup
  striped: boolean
  stateKey: string | null
}) {
  if (bar.widthPct <= 0) return null
  return (
    <span className="seg" style={{ width: `${bar.widthPct}%` }}>
      <span
        className={striped ? 'seg-fill fill-striped' : 'seg-fill'}
        style={{ ['--bar-color' as string]: group.color }}
      />
      {bar.statePct > 0 && (
        <span
          key={stateKey}
          className={striped ? 'seg-state state-part-striped' : 'seg-state'}
          style={{ width: `${bar.statePct}%`, ['--tint' as string]: group.tint }}
        />
      )}
    </span>
  )
}

function PartyRow({ group, stateKey }: { group: PartyGroup; stateKey: string | null }) {
  const selected = stateKey !== null
  const detail = `Supporting ${formatMoneyFull(group.support.total)}, opposing ${formatMoneyFull(group.oppose.total)}`
  return (
    <div className="nat-line" title={`${group.nominees} nominees`}>
      <span className="nat-label">
        <span className="swatch" style={{ background: group.color }} aria-hidden="true" />
        {group.label}
      </span>
      <span className="track nat-track" aria-hidden="true">
        <Segment bar={group.support} group={group} striped={false} stateKey={stateKey} />
        <Segment bar={group.oppose} group={group} striped stateKey={stateKey} />
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
        <PartyRow key={group.party} group={group} stateKey={view.stateCode} />
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
    </section>
  )
}
