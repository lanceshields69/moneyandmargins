import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5, 39.5],
      zoom: 3,
      minZoom: 2,
      maxZoom: 6,
    })

    return () => map.remove()
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--color-ground)' }}>
      {!MAPBOX_TOKEN && (
        <p style={{ color: 'var(--color-muted)', padding: '1rem' }}>
          Set VITE_MAPBOX_TOKEN in .env to render the map.
        </p>
      )}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
