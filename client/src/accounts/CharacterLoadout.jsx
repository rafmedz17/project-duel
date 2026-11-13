import { useState } from 'react'
import { accounts } from './store.js'
import { CHARACTERS,getCharacter } from '../../../shared/characters.js'
import { ABILITIES,UNIQUE_SKILLS } from '../../../shared/abilities.js'
import WeaponPicker from './WeaponPicker.jsx'
import { weaponSlots,validateLoadout } from '../../../shared/loadout.js'
import { WEAPONS } from '../../../shared/weapons.js'
import CharacterPortrait from '../game/characters/CharacterPortrait.jsx'
import './loadout.css'

export default function CharacterLoadout({ s }) {
  const [value,setValue] = useState(s.loadout), c = getCharacter(value.character)
  const choose = patch => setValue(old => {
    const next = { character:old.character,primary:old.primary,secondary:old.secondary,melee:old.melee,unique:old.unique,startingWeapon:old.startingWeapon,...patch }
    for (const slot of ['primary','secondary','melee']) if (patch[slot] && old.startingWeapon===old[slot]) next.startingWeapon=patch[slot]
    if (!weaponSlots(next).includes(next.startingWeapon)) next.startingWeapon=next.secondary
    return validateLoadout(next)
  })
  return <form className="operative-loadout" style={{ '--operative':c.color }} onSubmit={event => { event.preventDefault(); void accounts.saveLoadout(value) }}>
    <div className="armory-heading"><span>OPERATIVE DIVISION / 04 UNITS</span><span>BUILD YOUR COMBAT IDENTITY</span></div>
    <fieldset className="character-roster" disabled={s.busy || s.loading}><legend>01 / CHOOSE YOUR CHARACTER</legend>
      <div className="character-cards">{Object.entries(CHARACTERS).map(([id,character]) => <button type="button" className={`character-card ${value.character===id ? 'selected' : ''}`} style={{ '--unit':character.color }} key={id} aria-label={`Select ${character.name}`} aria-pressed={value.character===id} onClick={() => choose({ character:id })}>
        <span className="unit-number">{character.number}</span><CharacterPortrait characterId={id}/><strong>{character.name}</strong><small>{character.role}</small><i>{value.character===id ? 'EQUIPPED' : 'SELECT UNIT'}</i>
      </button>)}</div>
    </fieldset>
    <section className="operative-dossier" aria-label={`${c.name} character details`}>
      <div className="dossier-art"><CharacterPortrait characterId={value.character}/><span>UNIT / {c.number}<br/>CLASS / {c.role}</span></div>
      <div className="dossier-copy"><span className="eyebrow">{c.title}</span><h3>{c.name}<small>{c.role} OPERATIVE</small></h3><p>{c.description}</p><div className="ultimate-dossier"><span><kbd>X</kbd> CHARACTER ULTIMATE <b>5 SECONDS</b></span><h4>{c.ultimate}</h4><strong>{c.summary}</strong><p>{c.detail}</p><small>45 SECOND COOLDOWN · FIXED TO THIS CHARACTER</small></div></div>
    </section>
    <WeaponPicker value={value} choose={choose} disabled={s.busy || s.loading}/>
    <label className="deploy-weapon">DEPLOY WITH<select aria-label="Starting weapon" value={value.startingWeapon} onChange={event => choose({ startingWeapon:event.target.value })}>{weaponSlots(value).map(id => <option key={id} value={id}>{WEAPONS[id].name}</option>)}</select></label>
    <fieldset disabled={s.busy || s.loading}><legend>03 / GENERAL SKILLS · AVAILABLE TO EVERY OPERATIVE</legend><div className="general-slots">{['dash','shield'].map(id => <div key={id}><kbd>{ABILITIES[id].key}</kbd><span><strong>{ABILITIES[id].name}</strong><small>{id==='dash' ? 'Directional phase burst · 3s cooldown' : '50-point energy shield · 9s cooldown'}</small></span><i>STANDARD ISSUE</i></div>)}</div></fieldset>
    <fieldset disabled={s.busy || s.loading}><legend>04 / UNIQUE SKILL · CHOOSE ANY ONE</legend><div className="unique-cards">{UNIQUE_SKILLS.map(id => <button type="button" key={id} aria-label={`Equip ${ABILITIES[id].name}`} aria-pressed={value.unique===id} className={`unique-card ${value.unique===id ? 'selected' : ''}`} onClick={() => choose({ unique:id })}><span className={`skill-symbol ${id}`} aria-hidden="true">{({ flashbang:'✦',smoke:'◉',stun:'⌁',scanner:'◎' })[id]}</span><strong>{ABILITIES[id].name}</strong><p>{ABILITIES[id].description}</p><small>C · {ABILITIES[id].cooldown}s COOLDOWN</small></button>)}</div></fieldset>
    <div className="loadout-footer"><div><strong>{c.name} / {WEAPONS[value.primary].name} / {ABILITIES[value.unique].name}</strong><small>{s.user ? 'Saves to your account. Equipment locks when you join a room.' : 'Saves on this device. Equipment locks when you join a room.'}</small></div><button className="primary" disabled={s.busy || s.loading}>{s.busy ? 'SAVING…' : 'SAVE & EQUIP →'}</button></div>
  </form>
}
