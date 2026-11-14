import {useEffect,useRef,useState} from 'react'
import {MAPS} from '../../../shared/maps.js'

function MapOverview({mapId}) {
  const map=MAPS[mapId] || MAPS.facility
  return <>
    <div className="map-card-art" aria-hidden="true"><span>TACTICAL OVERVIEW</span><svg viewBox="0 0 300 170" fill="none"><g transform="translate(150 82) scale(1.75 .85) rotate(45)"><rect x="-47" y="-47" width="94" height="94" stroke="currentColor" opacity=".15"/><rect x="-42" y="-42" width="84" height="84" stroke="currentColor" strokeWidth="1.3"/>{[-20,0,20].map(x=><g key={x} opacity=".12"><path d={`M${x} -40V40M-40 ${x}H40`} stroke="currentColor"/></g>)}{map.cover.map(([x,,z,w,,d],i)=><g key={i}><rect x={x*2-w} y={z*2-d} width={w*2} height={d*2} fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth=".6"/></g>)}{mapId==='spire' && <><circle r="11" stroke="#c080ff" strokeWidth="1"/><rect x="-2" y="-2" width="4" height="4" fill="#d6abff"/>{[-1,1].map(side=><g key={side}><rect x="-10" y={side*35-5} width="20" height="10" fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth=".5"/><path d={`M-29 ${side*22}H29`} stroke="#50dcff" strokeWidth=".8" strokeDasharray="3 2"/></g>)}</>}{map.spawns.map((spawn,i)=><circle key={i} cx={spawn.position[0]*2} cy={spawn.position[2]*2} r="3.5" fill={i===0 ? '#8deeff' : '#ff849f'}/>)}</g></svg><small>SECTOR {Object.keys(MAPS).indexOf(mapId)+1} / 02 OPERATIVES</small></div>
  </>
}

function MapGallery({mapId,disabled,onSelect,onClose,returnFocusRef}) {
  const dialog=useRef(null)
  useEffect(()=>{
    const element=dialog.current,previous=returnFocusRef.current
    element.showModal()
    element.querySelector('[aria-pressed="true"]')?.focus()
    return ()=>{element.close();if(previous?.isConnected) previous.focus()}
  },[returnFocusRef])

  return <dialog ref={dialog} className="lobby-map-gallery" aria-labelledby="map-gallery-title" aria-describedby="map-gallery-description"
    onKeyDown={event=>event.stopPropagation()}
    onCancel={event=>{event.preventDefault();onClose()}}
    onClick={event=>{if(event.target===event.currentTarget) onClose()}}>
    <div className="map-gallery-content">
      <header><div><div className="eyebrow">MISSION LOCATION / {Object.keys(MAPS).length} ARENAS</div><h2 id="map-gallery-title">CHOOSE YOUR ARENA</h2></div><button type="button" className="map-gallery-close" aria-label="Close map selection" onClick={onClose}>×</button></header>
      <p id="map-gallery-description">{disabled ? 'Map selection is locked while the match is starting.' : 'Select a map to update the room. Changing maps resets both players’ readiness.'}</p>
      <div className="map-gallery-grid">
        {Object.entries(MAPS).map(([id,map])=><button key={id} type="button" disabled={disabled} className="map-gallery-option" style={{'--map-color':map.accent}} aria-label={`Select ${map.name}`} aria-pressed={id===mapId} onClick={()=>onSelect(id)}>
          <MapOverview mapId={id}/>
          <span className="map-gallery-details"><span className="map-gallery-name">{map.name}<small>{id===mapId ? '✓ SELECTED' : 'SELECT MAP →'}</small></span><span className="map-gallery-description">{map.description}</span></span>
        </button>)}
      </div>
      <footer>HOST SELECTION <span>ESC TO CLOSE</span></footer>
    </div>
  </dialog>
}

export default function LobbyMapCard({mapId,disabled,onChange}) {
  const [open,setOpen]=useState(false)
  const trigger=useRef(null)
  const map=MAPS[mapId] || MAPS.facility
  return <>
    <button ref={trigger} type="button" className="lobby-map-card" style={{'--map-color':map.accent}} disabled={disabled} aria-label="Arena map" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>
      <MapOverview mapId={mapId}/>
      <span className="lobby-label map-select-label">ARENA MAP<strong>{map.name}<span aria-hidden="true">↗</span></strong><small>{disabled ? 'HOST SELECTS THE ARENA' : 'CLICK TO BROWSE MAPS'}</small></span>
    </button>
    {open && <MapGallery mapId={mapId} disabled={disabled} returnFocusRef={trigger} onClose={()=>setOpen(false)} onSelect={id=>{if(id!==mapId) onChange(id);setOpen(false)}}/>}
  </>
}
