import { writeFileSync } from 'node:fs'
import { geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
// Types above resolve via @types/topojson-specification, a transitive dev
// dependency of @types/topojson-client.
import topology from 'us-atlas/states-albers-10m.json' with { type: 'json' }

const STATE_NAMES: Record<string, { usps: string; name: string }> = {
  '01': { usps: 'AL', name: 'Alabama' },
  '02': { usps: 'AK', name: 'Alaska' },
  '04': { usps: 'AZ', name: 'Arizona' },
  '05': { usps: 'AR', name: 'Arkansas' },
  '06': { usps: 'CA', name: 'California' },
  '08': { usps: 'CO', name: 'Colorado' },
  '09': { usps: 'CT', name: 'Connecticut' },
  '10': { usps: 'DE', name: 'Delaware' },
  '11': { usps: 'DC', name: 'District of Columbia' },
  '12': { usps: 'FL', name: 'Florida' },
  '13': { usps: 'GA', name: 'Georgia' },
  '15': { usps: 'HI', name: 'Hawaii' },
  '16': { usps: 'ID', name: 'Idaho' },
  '17': { usps: 'IL', name: 'Illinois' },
  '18': { usps: 'IN', name: 'Indiana' },
  '19': { usps: 'IA', name: 'Iowa' },
  '20': { usps: 'KS', name: 'Kansas' },
  '21': { usps: 'KY', name: 'Kentucky' },
  '22': { usps: 'LA', name: 'Louisiana' },
  '23': { usps: 'ME', name: 'Maine' },
  '24': { usps: 'MD', name: 'Maryland' },
  '25': { usps: 'MA', name: 'Massachusetts' },
  '26': { usps: 'MI', name: 'Michigan' },
  '27': { usps: 'MN', name: 'Minnesota' },
  '28': { usps: 'MS', name: 'Mississippi' },
  '29': { usps: 'MO', name: 'Missouri' },
  '30': { usps: 'MT', name: 'Montana' },
  '31': { usps: 'NE', name: 'Nebraska' },
  '32': { usps: 'NV', name: 'Nevada' },
  '33': { usps: 'NH', name: 'New Hampshire' },
  '34': { usps: 'NJ', name: 'New Jersey' },
  '35': { usps: 'NM', name: 'New Mexico' },
  '36': { usps: 'NY', name: 'New York' },
  '37': { usps: 'NC', name: 'North Carolina' },
  '38': { usps: 'ND', name: 'North Dakota' },
  '39': { usps: 'OH', name: 'Ohio' },
  '40': { usps: 'OK', name: 'Oklahoma' },
  '41': { usps: 'OR', name: 'Oregon' },
  '42': { usps: 'PA', name: 'Pennsylvania' },
  '44': { usps: 'RI', name: 'Rhode Island' },
  '45': { usps: 'SC', name: 'South Carolina' },
  '46': { usps: 'SD', name: 'South Dakota' },
  '47': { usps: 'TN', name: 'Tennessee' },
  '48': { usps: 'TX', name: 'Texas' },
  '49': { usps: 'UT', name: 'Utah' },
  '50': { usps: 'VT', name: 'Vermont' },
  '51': { usps: 'VA', name: 'Virginia' },
  '53': { usps: 'WA', name: 'Washington' },
  '54': { usps: 'WV', name: 'West Virginia' },
  '55': { usps: 'WI', name: 'Wisconsin' },
  '56': { usps: 'WY', name: 'Wyoming' },
}

const topo = topology as unknown as Topology
const statesObject = topo.objects.states as GeometryCollection
const collection = feature(topo, statesObject)

const path = geoPath()

type Point = [number, number]
type Ring = Point[]

function ringArea(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i += 1) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  return Math.abs(sum / 2)
}

function inRing(pt: Point, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPolygon(pt: Point, rings: Ring[]): boolean {
  return inRing(pt, rings[0]) && !rings.slice(1).some((hole) => inRing(pt, hole))
}

function distanceToRings(pt: Point, rings: Ring[]): number {
  let best = Infinity
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [ax, ay] = ring[i]
      const [bx, by] = ring[i + 1]
      const dx = bx - ax
      const dy = by - ay
      const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / (dx * dx + dy * dy)))
      best = Math.min(best, Math.hypot(pt[0] - (ax + t * dx), pt[1] - (ay + t * dy)))
    }
  }
  return best
}

/** Centroid of the largest landmass; if that falls outside the shape, the interior point farthest from the edge. */
function labelPoint(geometry: { type: string; coordinates: unknown }): Point {
  const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as Ring[][]
  const largest = polygons.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a))
  const centroid = path.centroid({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: largest } } as never)
  if (inPolygon(centroid as Point, largest)) return [Math.round(centroid[0] * 10) / 10, Math.round(centroid[1] * 10) / 10]

  const xs = largest[0].map((p) => p[0])
  const ys = largest[0].map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  let best: Point = [centroid[0], centroid[1]]
  let bestDistance = -1
  for (let i = 0; i <= 40; i += 1) {
    for (let j = 0; j <= 40; j += 1) {
      const pt: Point = [minX + ((maxX - minX) * i) / 40, minY + ((maxY - minY) * j) / 40]
      if (!inPolygon(pt, largest)) continue
      const distance = distanceToRings(pt, largest)
      if (distance > bestDistance) {
        best = pt
        bestDistance = distance
      }
    }
  }
  return [Math.round(best[0] * 10) / 10, Math.round(best[1] * 10) / 10]
}

const states = collection.features
  .map((f) => {
    const fips = String(f.id).padStart(2, '0')
    const meta = STATE_NAMES[fips]
    if (!meta) return null
    const d = path(f)
    if (!d) return null
    return { fips, usps: meta.usps, name: meta.name, d, labelPoint: labelPoint(f.geometry as unknown as { type: string; coordinates: unknown }) }
  })
  .filter((s): s is { fips: string; usps: string; name: string; d: string; labelPoint: Point } => s !== null)
  .sort((a, b) => a.usps.localeCompare(b.usps))

const [[x0, y0], [x1, y1]] = path.bounds(collection)
const viewBox = `${Math.floor(x0)} ${Math.floor(y0)} ${Math.ceil(x1 - x0)} ${Math.ceil(y1 - y0)}`

writeFileSync(
  new URL('../data/us-states.json', import.meta.url),
  JSON.stringify({ viewBox, states }, null, 2) + '\n',
)

console.log(`Wrote ${states.length} states to data/us-states.json`)
