import { markerColor } from '../ratings'

export interface RatingMarker {
  state: string
  /** Position as fractions (0 to 1) of the map's width and height. */
  x: number
  y: number
  color: string
}

/** One marker per state with a forecast, at the state's label point. Clicks pass through to the state beneath. */
export default function RatingMarkers({ markers }: { markers: RatingMarker[] }) {
  return (
    <>
      {markers.map((m) => (
        <span
          key={m.state}
          className="rating-marker"
          style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, background: m.color }}
          aria-hidden="true"
        >
          {m.state}
        </span>
      ))}
    </>
  )
}

export function buildMarkers(
  forecasts: { state: string; rating: string | null }[],
  labelPoint: (state: string) => [number, number] | undefined,
  viewBox: [number, number, number, number],
): RatingMarker[] {
  const [vx, vy, vw, vh] = viewBox
  return forecasts.flatMap((f) => {
    const color = markerColor(f.rating)
    const point = labelPoint(f.state)
    if (color === null || point === undefined) return []
    return [{ state: f.state, x: (point[0] - vx) / vw, y: (point[1] - vy) / vh, color }]
  })
}
