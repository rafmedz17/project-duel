import {useRef,useState} from 'react'
import {accounts} from './store.js'
import {CHARACTERS,getCharacter,ULTIMATE_DURATION} from '../../../shared/characters.js'
import {ABILITIES,UNIQUE_SKILLS} from '../../../shared/abilities.js'
import {validateLoadout} from '../../../shared/loadout.js'
import {WEAPONS} from '../../../shared/weapons.js'
import CharacterPortrait from '../game/characters/CharacterPortrait.jsx'
import LoadoutSlots from './LoadoutSlots.jsx'
import WeaponPicker from './WeaponPicker.jsx'
import LoadoutDetails,{WeaponGlyph,SkillGlyph} from './LoadoutDetails.jsx'
import LoadoutPickerDialog from './LoadoutPickerDialog.jsx'
import './loadout.css'

export default function CharacterLoadout({s,onSave,training=false}) {
  const [bank,setBank]=useState(s.bank),[picker,setPicker]=useState(null),[status,setStatus]=useState('saved'),[error,setError]=useState('')
  const [detail,setDetail]=useState({type:'weapon',id:s.bank.slots[s.bank.activeSlot].primary})
  const latest=useRef(bank),pending=useRef(null),running=useRef(false)
  const value=bank.slots[bank.activeSlot],c=getCharacter(value.character),disabled=s.loading
  const flush=async()=>{
    if(running.current || !pending.current) return
    running.current=true;setStatus('saving');setError('')
    try {
      while(pending.current) {
        const next=pending.current;pending.current=null
        const saved=await (onSave ? onSave(next) : accounts.saveBank(next))
        if(!saved) {
          pending.current ||= next
          setStatus('failed');setError(accounts.get().error || 'Could not save your loadout. Retry to keep your latest choices.');return
        }
      }
      setStatus('saved')
    } catch(error) {pending.current ||= latest.current;setStatus('failed');setError(error.message || 'Could not save your loadout.')}
    finally {running.current=false}
  }
  const commit=next=>{latest.current=next;pending.current=next;setBank(next);void flush()}
  const choose=patch=>{
    const previous=latest.current,old=previous.slots[previous.activeSlot]
    const next=validateLoadout({character:old.character,primary:old.primary,secondary:old.secondary,melee:old.melee,unique:old.unique,...patch,startingWeapon:patch.primary || old.primary})
    if(!next) return
    commit({...previous,slots:previous.slots.map((gear,i)=>i===previous.activeSlot ? next : gear)})
    const id=Object.values(patch)[0],type=patch.character ? 'character' : patch.unique ? 'skill' : 'weapon'
    setDetail({type,id});setPicker(null)
  }
  const selectSlot=activeSlot=>{
    if(activeSlot===latest.current.activeSlot) return
    const next={...latest.current,activeSlot};commit(next);setDetail({type:'weapon',id:next.slots[activeSlot].primary})
  }
  const tile=(slot,label,type,id,extra='')=><button type="button" className={`loadout-equipment equipment-${slot}`} aria-label={slot==='ultimate' ? 'View ultimate skill' : `Change ${label.toLowerCase()}`} aria-haspopup="dialog" disabled={disabled} onMouseEnter={()=>setDetail({type,id})} onFocus={()=>setDetail({type,id})} onClick={()=>setPicker(slot)}>
    <span className="equipment-label">{label}<span>{slot==='ultimate' ? `${ULTIMATE_DURATION}s` : '↗'}</span></span>
    {type==='weapon' ? <WeaponGlyph id={id}/> : <SkillGlyph id={slot==='ultimate' ? 'ultimate' : id}/>}
    <strong>{type==='weapon' ? WEAPONS[id].name : slot==='ultimate' ? c.ultimate : ABILITIES[id].name}</strong><small>{extra || (type==='weapon' ? WEAPONS[id].category : 'CLICK TO CHANGE')}</small>
  </button>
  return <div className="operative-loadout loadout-workbench" style={{'--operative':c.color}}>
    <div className="loadout-workbench-top"><span className="loadout-kicker">{training ? 'FIELD CONFIGURATION' : 'YOUR COMBAT IDENTITY'} / 05 PRESETS</span><div className={`loadout-save-state ${status}`} role="status" aria-live="polite"><i/>{status==='saving' ? 'SAVING CHANGES…' : status==='failed' ? 'CHANGES NOT SAVED' : s.user ? 'AUTO-SAVED TO ACCOUNT' : 'AUTO-SAVED ON DEVICE'}</div></div>
    {error && <div className="loadout-save-error" role="alert"><span>{error}</span><button type="button" onClick={()=>void flush()}>RETRY AUTO-SAVE</button></div>}
    <div className="loadout-dashboard">
      <aside className="loadout-operative"><button type="button" className="loadout-hero" aria-label="Change character" aria-haspopup="dialog" disabled={disabled} onClick={()=>setPicker('character')} onMouseEnter={()=>setDetail({type:'character',id:value.character})} onFocus={()=>setDetail({type:'character',id:value.character})}><span className="hero-corner">OPERATIVE / {c.number}<b>↗</b></span><CharacterPortrait characterId={value.character}/><div className="hero-name"><small>{c.title}</small><strong>{c.name}</strong><span>{c.role} / CHANGE OPERATIVE</span></div></button>
        <div className="loadout-build-summary"><span className="loadout-kicker">FULL LOADOUT / SLOT 0{bank.activeSlot+1}</span><p>{c.description}</p><ul>{[[WEAPONS[value.primary].name,'PRIMARY'],[WEAPONS[value.secondary].name,'PISTOL'],[WEAPONS[value.melee].name,'MELEE'],[ABILITIES[value.unique].name,'UNIQUE']].map(([name,label])=><li key={label}><span>{label}</span><strong>{name}</strong></li>)}</ul></div>
      </aside>
      <div className="loadout-configuration"><LoadoutSlots slots={bank.slots} selected={bank.activeSlot} onSelect={selectSlot} disabled={disabled} compact/>
        <div className="loadout-equipment-grid">{tile('ultimate','ULTIMATE','ultimate',value.character,'FIXED TO OPERATIVE')}{tile('primary','PRIMARY GUN','weapon',value.primary)}{tile('unique','UNIQUE SKILL','skill',value.unique)}{tile('melee','MELEE','weapon',value.melee)}{tile('secondary','PISTOL','weapon',value.secondary)}</div>
        <div className="loadout-inspector"><div className="inspector-heading"><span>FIELD INTELLIGENCE</span><small>HOVER OR FOCUS ANY CARD TO INSPECT</small></div><LoadoutDetails item={detail} compact animate={!picker}/></div>
      </div>
    </div>
    {picker && <LoadoutPickerDialog title={({character:'CHOOSE YOUR OPERATIVE',primary:'PRIMARY ARSENAL',secondary:'SECONDARY ARSENAL',melee:'MELEE ARSENAL',unique:'CHOOSE YOUR UNIQUE SKILL',ultimate:c.ultimate})[picker]} subtitle={picker==='ultimate' ? `${c.name}'S ULTIMATE / FIXED TO THIS OPERATIVE` : undefined} onClose={()=>setPicker(null)}>
      {['primary','secondary','melee'].includes(picker) ? <WeaponPicker value={value} slot={picker} choose={choose} disabled={disabled}/> : picker==='character' ? <div className="operative-selection-grid">{Object.entries(CHARACTERS).map(([id,character])=><button type="button" key={id} aria-label={`Select ${character.name}`} aria-pressed={value.character===id} disabled={disabled} className={`operative-option ${value.character===id ? 'selected' : ''}`} style={{'--unit':character.color}} onClick={()=>choose({character:id})}><span className="loadout-kicker">UNIT {character.number} / {character.role}</span><CharacterPortrait characterId={id}/><strong>{character.name}</strong><small>{character.ultimate}</small><p>{character.summary}</p><span className="option-equip">{value.character===id ? 'EQUIPPED' : 'SELECT OPERATIVE ↗'}</span></button>)}</div> : picker==='unique' ? <div className="skill-selection-grid">{UNIQUE_SKILLS.map(id=>{const skill=ABILITIES[id];return <button type="button" key={id} aria-label={`Equip ${skill.name}`} aria-pressed={value.unique===id} disabled={disabled} className={`skill-option ${value.unique===id ? 'selected' : ''}`} style={{'--unit':skill.color}} onClick={()=>choose({unique:id})}><SkillGlyph id={id}/><strong>{skill.name}</strong><p>{skill.description}</p><div><span>{skill.duration}s ACTIVE</span><span>{skill.cooldown}s COOLDOWN</span></div><span className="option-equip">{value.unique===id ? 'EQUIPPED' : 'EQUIP SKILL ↗'}</span></button>})}</div> : <LoadoutDetails item={{type:'ultimate',id:value.character}}/>}
    </LoadoutPickerDialog>}
  </div>
}
