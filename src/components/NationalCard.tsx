import type { AlignedPart, NationalCard as NationalCardData, PartyAligned } from '../computeNational'
import { formatMoney, formatMoneyFull } from '../format'

function Part({ part, group, outlined, selected }: { part: AlignedPart; group: PartyAligned; outlined: boolean; selected: boolean }) {
  if (part.widthPct <= 0) return null
  return (
    <span className={outlined ? 'seg seg-outlined' : 'seg'} style={{ width: `${part.widthPct}%`, ['--bar-color' as string]: group.color }}>
      {!outlined && <span className="seg-fill" />}
      {selected && part.statePct > 0 && (
        <span className={outlined ? 'seg-state seg-state-outlined' : 'seg-state'} style={{ width: `${part.statePct}%`, ['--tint' as string]: group.tint }} />
      )}
    </span>
  )
}

function Row({ group, selected }: { group: PartyAligned; selected: boolean }) {
  const detail = `Supporting its nominees ${formatMoneyFull(group.supporting.dollars)}, opposing the other side's nominees ${formatMoneyFull(group.opposing.dollars)}`
  return (
    <div className="nat-line">
      <span className="nat-label">
        <span className="swatch" style={{ background: group.color }} aria-hidden="true" />
        {group.label}
      </span>
      <span className="track nat-track" aria-hidden="true">
        <Part part={group.supporting} group={group} outlined={false} selected={selected} />
        <Part part={group.opposing} group={group} outlined selected={selected} />
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

interface NationalCardProps {
  card: NationalCardData
  stateName: string | null
  asOf: string
}

export default function NationalCard({ card, stateName, asOf }: NationalCardProps) {
  const selected = card.stateCode !== null
  return (
    <section className="national" aria-label="Spending aligned with each party's nominees">
      <h2>Spending aligned with each party&apos;s nominees</h2>
      <p className="muted nat-sub">
        Across the {card.includedRaces + card.excludedRaces} races, 2026 cycle, FEC data: {asOf}
      </p>
      {card.groups.map((group) => (
        <Row key={group.party} group={group} selected={selected} />
      ))}
      <p className="nat-key muted">
        <span className="key-item">
          <span className="key-solid" aria-hidden="true" />
          Supporting its nominees
        </span>
        <span className="key-item">
          <span className="key-outline" aria-hidden="true" />
          Opposing the other side&apos;s nominees
        </span>
        {stateName && <span className="key-item">Lighter shade and right-hand amount: {stateName}</span>}
      </p>
      {card.excludedRaces > 0 && (
        <p className="muted nat-excluded">
          Excludes {card.excludedRaces} race{card.excludedRaces === 1 ? '' : 's'} with incomplete data
        </p>
      )}
    </section>
  )
}
