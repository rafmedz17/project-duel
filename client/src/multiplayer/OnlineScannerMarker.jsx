import { useEffect, useRef } from 'react'
import { arenaView } from './poses.js'

export default function OnlineScannerMarker({ other }) {
  const element = useRef()
  useEffect(() => {
    let frame
    const update = () => {
      const marker = arenaView.scanMarker
      element.current.style.opacity = marker?.visible ? '1' : '0'
      if (marker?.visible) {
        element.current.style.transform = `translate(${marker.x}px,${marker.y}px) translate(-50%,-100%)`
        element.current.querySelector('small').textContent = `${marker.distance} M`
      }
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  },[])
  return <div className="scan-markers" aria-hidden="true"><div ref={element} className="scan-marker" data-testid="online-scan-opponent"><b>{other?.name}</b><span>{other?.combat.hp} HP</span><small /></div></div>
}
