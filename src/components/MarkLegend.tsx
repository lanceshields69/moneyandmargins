/** The map-mark legend: "Circle: forecast. Ring: counting. Square: reported result." (MVP.md, "Map"). */
export default function MarkLegend() {
  return (
    <div className="mark-legend" role="group" aria-label="Map mark legend">
      <span className="mark-key">
        <span className="mark-sample mark-sample-circle" aria-hidden="true" />
        Circle: forecast
      </span>
      <span className="mark-key">
        <span className="mark-sample mark-sample-ring" aria-hidden="true" />
        Ring: counting
      </span>
      <span className="mark-key">
        <span className="mark-sample mark-sample-square" aria-hidden="true" />
        Square: reported result
      </span>
    </div>
  )
}
