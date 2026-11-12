import { useEffect, useRef } from 'react'
import { useGame } from '../store.js'
import { runtime } from '../runtime.js'

export default function ScannerMarkers() {
  const refs = useRef([]), s = useGame()
  const active = s.time<s.abilities.scanner.activeUntil
  useEffect(() => {
    let frame
    const update = () => {
      runtime.scanMarkers.forEach((marker,index) => {
        const element = refs.current[index]
        if (!element) return
        element.style.opacity = active && marker.visible ? '1' : '0'
        element.style.transform = `translate(${marker.x}px,${marker.y}px) translate(-50%,-100%)`
        element.querySelector('small').textContent = `${marker.distance} M`
      })
      if (active) frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  },[active])
  return <div className="scan-markers" aria-hidden="true">{s.targets.map((target,index) => <div ref={element => { refs.current[index] = element }} key={index} data-testid={`scan-target-${index}`} className="scan-marker">
    <b>{`T-${String(index+1).padStart(2,'0')}`}</b><span>{target.hp} HP {s.time<target.disabledUntil ? ' / JAMMED' : ''}</span><small />
  </div>)}</div>
}
