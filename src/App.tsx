import { useState } from 'react'
import UsStatesMap from './components/UsStatesMap'

export default function App() {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--color-ground)' }}>
      <UsStatesMap selected={selected} onSelect={setSelected} />
    </div>
  )
}
