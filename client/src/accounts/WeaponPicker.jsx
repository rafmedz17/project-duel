import {useState} from 'react'
import {WEAPONS,PRIMARY_IDS,SECONDARY_IDS,MELEE_IDS} from '../../../shared/weapons.js'
import LoadoutDetails,{WeaponGlyph} from './LoadoutDetails.jsx'

const categories={RIFLE:'ASSAULT RIFLES',SNIPER:'SNIPER RIFLES',SMG:'SUBMACHINE GUNS',LMG:'LIGHT MACHINE GUNS',SHOTGUN:'SHOTGUNS'}
export default function WeaponPicker({value,slot,choose,disabled}) {
  const [hovered,setHovered]=useState(value[slot])
  const groups=slot==='primary' ? Object.entries(categories).map(([id,title])=>({title,ids:PRIMARY_IDS.filter(key=>WEAPONS[key].category===id)})) : [{title:slot==='secondary' ? 'SIDEARMS' : 'MELEE WEAPONS',ids:slot==='secondary' ? SECONDARY_IDS : MELEE_IDS}]
  return <div className="weapon-selection-layout"><div className="weapon-catalog" aria-label="Weapons catalog">{groups.map(group=><section className="weapon-category" key={group.title}><h3>{group.title}<span>{String(group.ids.length).padStart(2,'0')} SYSTEMS</span></h3><div className="weapon-option-grid">{group.ids.map(id=>{
    const w=WEAPONS[id],selected=value[slot]===id
    return <button type="button" key={id} className={`weapon-option ${selected ? 'selected' : ''}`} aria-label={`Equip ${w.name}`} aria-pressed={selected} disabled={disabled} style={{'--weapon-color':w.color}} onMouseEnter={()=>setHovered(id)} onFocus={()=>setHovered(id)} onClick={()=>choose({[slot]:id})}>
      <span className="weapon-option-number">{w.number} / {selected ? 'EQUIPPED' : w.fireMode==='auto' ? 'FULL AUTO' : w.fireMode==='burst' ? 'BURST' : w.fireMode==='melee' ? 'MELEE' : 'SEMI AUTO'}</span><WeaponGlyph id={id}/><strong>{w.name}</strong><small>{w.magazine ? `${w.magazine} ROUNDS / ${w.damage} DAMAGE` : `${w.range}m REACH / ${w.damage} DAMAGE`}</small>
    </button>
  })}</div></section>)}</div><LoadoutDetails item={{type:'weapon',id:hovered}}/></div>
}
