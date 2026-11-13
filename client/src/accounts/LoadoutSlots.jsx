import { getCharacter } from '../../../shared/characters.js'
import { WEAPONS } from '../../../shared/weapons.js'
import './loadoutSlots.css'
export default function LoadoutSlots({ slots,selected,onSelect,disabled=false,compact=false }) {
  return <div className={`loadout-slot-list ${compact ? 'compact' : ''}`} role="group" aria-label="Five loadout slots">
    {slots.map((gear,i)=> {
      const character=getCharacter(gear.character)
      return <button key={i} type="button" disabled={disabled} aria-label={`Loadout slot ${i+1}`} aria-pressed={selected===i} className={selected===i ? 'selected' : ''} style={{ '--slot-color':character.color }} onClick={()=>onSelect(i)}>
        <span className="preset-number">0{i+1}<i>{selected===i ? 'SELECTED' : 'PRESET'}</i></span><strong>{character.name}</strong><span>{WEAPONS[gear.primary].name}</span>{!compact && <small>{WEAPONS[gear.secondary].name} / {WEAPONS[gear.melee].name}</small>}
      </button>
    })}
  </div>
}
