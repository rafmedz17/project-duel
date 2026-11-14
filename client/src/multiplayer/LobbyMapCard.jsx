import {MAPS} from '../../../shared/maps.js'

export default function LobbyMapCard({mapId,disabled,onChange}) {
  const map=MAPS[mapId] || MAPS.facility
  return <div className="lobby-map-card" style={{'--map-color':map.accent}}>
    <div className="map-card-art" aria-hidden="true"><span>TACTICAL OVERVIEW</span><svg viewBox="0 0 300 170" fill="none"><g transform="translate(150 82) scale(1.75 .85) rotate(45)"><rect x="-47" y="-47" width="94" height="94" stroke="currentColor" opacity=".15"/><rect x="-40" y="-40" width="80" height="80" stroke="currentColor" strokeWidth="1.3"/>{[-20,0,20].map(x=><g key={x} opacity=".12"><path d={`M${x} -40V40M-40 ${x}H40`} stroke="currentColor"/></g>)}{map.cover.map(([x,,z,w,,d],i)=><g key={i}><rect x={x*2-w} y={z*2-d} width={w*2} height={d*2} fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth=".6"/></g>)}<circle cy="-30" r="3.5" fill="#8deeff"/><circle cy="30" r="3.5" fill="#ffab91"/></g></svg><small>SECTOR {Object.keys(MAPS).indexOf(mapId)+1} / 02 OPERATIVES</small></div>
    <label className="lobby-label map-select-label">ARENA MAP<select aria-label="Arena map" value={mapId} disabled={disabled} onChange={event=>onChange(event.target.value)}>{Object.entries(MAPS).map(([id,map])=><option key={id} value={id}>{map.name}</option>)}</select></label>
  </div>
}
