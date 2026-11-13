import { lazy,Suspense,useState } from 'react'
import { WEAPONS,PRIMARY_IDS,SECONDARY_IDS,MELEE_IDS } from '../../../shared/weapons.js'
import './arsenal.css'
const ArsenalPreview=lazy(()=>import('../game/weapons/ArsenalPreview.jsx'))
const categories={ RIFLE:'ASSAULT RIFLES',SNIPER:'SNIPER RIFLES',SMG:'SUBMACHINE GUNS',LMG:'LIGHT MACHINE GUNS',SHOTGUN:'SHOTGUNS' }
export default function WeaponPicker({ value,choose,disabled }) {
  const [slot,setSlot]=useState('primary'),[category,setCategory]=useState(WEAPONS[value.primary].category),[preview,setPreview]=useState('inspect')
  const ids=slot==='primary' ? PRIMARY_IDS.filter(id=>WEAPONS[id].category===category) : slot==='secondary' ? SECONDARY_IDS : MELEE_IDS
  const weapon=WEAPONS[value[slot]]
  const stat=(name,text,percent)=> <div><span>{name}</span><strong>{text}</strong>{percent!==undefined && <i style={{ '--stat-width':`${percent}%` }}/>}</div>
  return <fieldset className="arsenal-picker" disabled={disabled}><legend>02 / WEAPONS ARSENAL / 17 SYSTEMS</legend>
    <div className="arsenal-slots" role="tablist" aria-label="Weapon slots">{[['primary','1','PRIMARY'],['secondary','2','PISTOL'],['melee','3','MELEE']].map(([key,binding,label])=><button type="button" role="tab" aria-selected={slot===key} aria-label={`${label} slot`} key={key} onClick={()=>setSlot(key)}><kbd>{binding}</kbd><span>{label}<strong>{WEAPONS[value[key]].name}</strong></span></button>)}</div>
    {slot==='primary' && <div className="arsenal-categories" aria-label="Primary categories">{Object.entries(categories).map(([id,label])=><button type="button" key={id} aria-pressed={id===category} onClick={()=>setCategory(id)}>{label}</button>)}</div>}
    <div className="arsenal-grid">{ids.map(id=>{ const w=WEAPONS[id];return <button type="button" key={id} aria-label={`Equip ${w.name}`} aria-pressed={value[slot]===id} className={`arsenal-card ${value[slot]===id ? 'selected' : ''}`} style={{ '--weapon-color':w.color }} onClick={()=>choose({ [slot]:id })}>
      <span className="arsenal-number">{w.number} / {w.category}</span><span className={`weapon-schematic ${w.category.toLowerCase()}`} aria-hidden="true"><i/><b/><em/></span><strong>{w.name}</strong><small>{w.fireMode==='burst' ? '3-ROUND BURST' : w.fireMode==='melee' ? 'MELEE' : w.fireMode==='auto' ? 'FULL AUTO' : 'SEMI AUTO'} / {w.magazine ? `${w.magazine} ROUNDS` : `${w.range}M REACH`}</small>
    </button>})}</div>
    <section className="arsenal-dossier" aria-label={`${weapon.name} weapon details`} style={{ '--weapon-color':weapon.color }}>
      <div><div className="arsenal-viewport"><span>LIVE ARMORY / {weapon.number}</span><Suspense fallback={<div className="arsenal-loading">ASSEMBLING WEAPON…</div>}><ArsenalPreview id={value[slot]} mode={preview}/></Suspense><small>LIVE 3D / {preview.toUpperCase()} ANIMATION</small></div><div className="arsenal-preview-controls">{['fire','reload','inspect'].map(mode=><button type="button" key={mode} disabled={mode==='reload' && !weapon.magazine} aria-pressed={preview===mode} onClick={()=>setPreview(mode)}>PREVIEW {mode.toUpperCase()}</button>)}</div></div>
      <div className="arsenal-specs"><span>{weapon.category} / {weapon.fireMode==='burst' ? 'BURST SYSTEM' : weapon.model.toUpperCase()}</span><h4>{weapon.name}</h4><p>{weapon.description}</p><div className="arsenal-stats">
        {stat('DAMAGE',weapon.pellets ? `${weapon.damage} × ${weapon.pellets} PELLETS` : weapon.scope ? `${weapon.damage} BODY / ${weapon.damage*(weapon.headMultiplier || 2)} HEAD` : weapon.damage)}
        {stat(weapon.burst ? 'BURST' : 'FIRE / ATTACK RATE',weapon.burst ? `3 ROUNDS / ${weapon.cooldown.toFixed(2)}s CYCLE` : `${weapon.rpm} RPM`)}
        {weapon.magazine ? <>{stat('MAGAZINE',weapon.magazine)}{stat('RELOAD',`${weapon.reload.toFixed(1)} SEC`)}{stat('ACCURACY',`${weapon.accuracy} / 100`,weapon.accuracy)}</> : stat('REACH',`${weapon.range} METERS`)}
        {stat('MOVEMENT',`${Math.round(weapon.movement*100)}%`)}
      </div></div>
    </section>
  </fieldset>
}
