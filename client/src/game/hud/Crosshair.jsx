import { useGame } from '../store.js'
import { useEffect,useRef } from 'react'
import { WEAPONS } from '../../../../shared/weapons.js'
import { movementSpread,stanceSpread } from '../../../../shared/accuracy.js'
import { crosshairMotion } from '../weapons/accuracy.js'
import './crosshair.css'

export default function Crosshair({ settings,shotgun=false,melee=false,dynamic=false,weaponId='rifle' }) {
  const stored=useGame(s=>s.settings),c=(settings || stored).crosshair
  const radius=c.size+c.gap
  const root=useRef(),arms=useRef(),ring=useRef(),hint=useRef()
  useEffect(()=>{
    if(!dynamic || melee) return
    let frame
    const update=()=>{
      const motion=crosshairMotion(),spread=movementSpread(WEAPONS[weaponId],motion),stability=stanceSpread(motion),extra=Math.min(24,Math.tan(spread)*120)
      root.current.dataset.movementSpread=spread.toFixed(5)
      root.current.dataset.crouched=String(Boolean(motion?.crouched))
      const outer=radius*stability+extra,inner=c.gap*stability+extra
      arms.current?.setAttribute('d',`M${-outer} 0H${-inner}M${inner} 0H${outer}M0 ${-outer}V${-inner}M0 ${inner}V${outer}`)
      ring.current?.setAttribute('r',String((shotgun ? 22 : radius)*stability+extra))
      hint.current.hidden=spread<.008 && stability===1
      hint.current.dataset.steady=String(stability<1)
      hint.current.textContent=stability<1 ? 'CROUCHED / STEADY AIM' : spread<.008 ? '' : motion?.dashing ? 'DASH / LOW ACCURACY' : motion?.grounded===false ? 'AIRBORNE / LOW ACCURACY' : 'MOVING / LOW ACCURACY'
      frame=requestAnimationFrame(update)
    }
    update()
    return ()=>cancelAnimationFrame(frame)
  },[dynamic,melee,weaponId,radius,c.gap,shotgun])
  return <div ref={root} className={`crosshair custom-crosshair ${shotgun ? 'shotgun-crosshair' : melee ? 'melee-crosshair' : ''}`} aria-hidden="true" style={{ color:c.color,opacity:c.opacity }}>
    <svg viewBox="-40 -40 80 80" width="80" height="80" fill="none" stroke="currentColor" strokeWidth={c.thickness}>
      {shotgun ? <circle ref={ring} r="22" strokeDasharray="1 5" strokeLinecap="round"/> : c.style==='circle' ? <circle ref={ring} r={radius}/> : c.style==='cross' ? <path ref={arms} d={`M${-radius} 0H${-c.gap}M${c.gap} 0H${radius}M0 ${-radius}V${-c.gap}M0 ${c.gap}V${radius}`}/> : null}
      {!shotgun && (c.dot || c.style==='dot') && <circle r={c.style==='dot' ? c.thickness+1 : c.thickness/2} fill="currentColor" stroke="none"/>}
    </svg>
    {dynamic && !melee && <span ref={hint} className="movement-spread-hint" hidden/>}
  </div>
}
