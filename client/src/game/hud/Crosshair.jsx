import { useGame } from '../store.js'
import './crosshair.css'

export default function Crosshair({ settings,shotgun=false,melee=false }) {
  const stored=useGame(s=>s.settings),c=(settings || stored).crosshair
  const radius=c.size+c.gap
  return <div className={`crosshair custom-crosshair ${shotgun ? 'shotgun-crosshair' : melee ? 'melee-crosshair' : ''}`} aria-hidden="true" style={{ color:c.color,opacity:c.opacity }}>
    <svg viewBox="-40 -40 80 80" width="80" height="80" fill="none" stroke="currentColor" strokeWidth={c.thickness}>
      {shotgun ? <circle r="22" strokeDasharray="1 5" strokeLinecap="round"/> : c.style==='circle' ? <circle r={radius}/> : c.style==='cross' ? <path d={`M${-radius} 0H${-c.gap}M${c.gap} 0H${radius}M0 ${-radius}V${-c.gap}M0 ${c.gap}V${radius}`}/> : null}
      {!shotgun && (c.dot || c.style==='dot') && <circle r={c.style==='dot' ? c.thickness+1 : c.thickness/2} fill="currentColor" stroke="none"/>}
    </svg>
  </div>
}
