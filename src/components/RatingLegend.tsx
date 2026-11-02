import { RATING_COLORS } from '../ratings'

/** Legend under the map. Safe and Lean are split: the left half is Democratic, the right half Republican. */
export default function RatingLegend({ source }: { source: string }) {
  return (
    <div className="rating-legend" role="group" aria-label="Prediction legend">
      <span className="rating-key">
        <span className="rating-swatch" style={{ background: `linear-gradient(to right, ${RATING_COLORS.safe.D} 50%, ${RATING_COLORS.safe.R} 50%)` }} />
        Safe
      </span>
      <span className="rating-key">
        <span className="rating-swatch" style={{ background: `linear-gradient(to right, ${RATING_COLORS.lean.D} 50%, ${RATING_COLORS.lean.R} 50%)` }} />
        Lean (includes Likely)
      </span>
      <span className="rating-key">
        <span className="rating-swatch" style={{ background: RATING_COLORS.tossup }} />
        Toss-up
      </span>
      <span className="rating-source muted">Ratings: {source}</span>
    </div>
  )
}
