import {MAPS} from '../../../shared/maps.js'

export default function LobbyMapCard({mapId,disabled,onChange}) {
  const map=MAPS[mapId] || MAPS.facility
  return <div className="lobby-map-card" style={{'--map-color':map.accent}}>
    <div className="map-card-art" aria-hidden="true"><span>TACTICAL OVERVIEW</span><svg viewBox="0 0 300 170" fill="none"><g transform="translate(150 82) scale(1.75 .85) rotate(45)"><rect x="-47" y="-47" width="94" height="94" stroke="currentColor" opacity=".15"/><rect x="-42" y="-42" width="84" height="84" stroke="currentColor" strokeWidth="1.3"/>{[-20,0,20].map(x=><g key={x} opacity=".12"><path d={`M${x} -40V40M-40 ${x}H40`} stroke="currentColor"/></g>)}{map.cover.map(([x,,z,w,,d],i)=><g key={i}><rect x={x*2-w} y={z*2-d} width={w*2} height={d*2} fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth=".6"/></g>)}{mapId==='spire' && <><circle r="11" stroke="#c080ff" strokeWidth="1"/><rect x="-2" y="-2" width="4" height="4" fill="#d6abff"/>{[-1,1].map(side=><g key={side}><rect x="-10" y={side*35-5} width="20" height="10" fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth=".5"/><path d={`M-29 ${side*22}H29`} stroke="#50dcff" strokeWidth=".8" strokeDasharray="3 2"/></g>)}</>}{map.spawns.map((spawn,i)=><circle key={i} cx={spawn.position[0]*2} cy={spawn.position[2]*2} r="3.5" fill={i===0 ? '#8deeff' : '#ff849f'}/>)}</g></svg><small>SECTOR {Object.keys(MAPS).indexOf(mapId)+1} / 02 OPERATIVES</small></div>
    <label className="lobby-label map-select-label">ARENA MAP<select aria-label="Arena map" value={mapId} disabled={disabled} onChange={event=>onChange(event.target.value)}>{Object.entries(MAPS).map(([id,map])=><option key={id} value={id}>{map.name}</option>)}</select></label>
  </div>
}
