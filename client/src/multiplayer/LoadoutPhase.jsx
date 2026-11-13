import { useEffect } from 'react'
import LoadoutSlots from '../accounts/LoadoutSlots.jsx'
import { WEAPONS } from '../../../shared/weapons.js'
import { getCharacter } from '../../../shared/characters.js'
import { ABILITIES } from '../../../shared/abilities.js'
import { lobby } from './lobby.js'

export default function LoadoutPhase({ state:s,combat,onLeave }) {
  const duel=s.room.format==='duel',seconds=Math.max(0,Math.ceil(duel ? s.room.phaseRemaining : combat.respawnAt-s.room.time))
  useEffect(()=> { if(document.pointerLockElement) document.exitPointerLock() },[])
  const selected=s.bank?.slots[combat.activeSlot]
  return <div className="overlay online-overlay loadout-phase"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="loadout-phase-title">
    <div className="eyebrow">{duel ? `ROUND ${s.room.roundNumber} / BEST OF THREE` : 'SYSTEM OFFLINE / FREE PLAY'}</div>
    <div className="loadout-phase-heading"><h2 id="loadout-phase-title">{duel ? 'LOADOUT PHASE' : 'RESPAWN LOADOUT'}</h2><span className="loadout-phase-clock" role="timer" aria-label="Loadout time remaining">{seconds}<small>s</small></span></div>
    <p>{duel ? 'Choose your preset for this round. Your selected slot deploys automatically when the timer ends.' : 'Choose a preset during your five-second respawn window. Keeping the current slot is automatic.'}</p>
    {s.bank ? <LoadoutSlots slots={s.bank.slots} selected={combat.activeSlot} onSelect={slot=>lobby.selectLoadout(slot)}/> : <p role="status">Loading your saved presets…</p>}
    {selected && <div className="loadout-phase-summary" role="status">SLOT {combat.activeSlot+1} / {getCharacter(selected.character).name}<br/>{WEAPONS[selected.primary].name} · {WEAPONS[selected.secondary].name} · {WEAPONS[selected.melee].name}<br/>{ABILITIES[selected.unique].name} / {getCharacter(selected.character).ultimate}</div>}
    <p className="preset-help">Edit your five presets in Character &amp; Loadout before joining a room.</p>
    <button className="phase-link" onClick={onLeave}>LEAVE ROOM</button>
  </section></div>
}
