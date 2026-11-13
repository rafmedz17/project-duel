import { useGame } from '../store.js'
import { WEAPONS } from '../../../../shared/weapons.js'
import { activeOptic,reflexProfile } from '../weapons/optics.js'
import './weaponStatus.css'
export default function WeaponStatus({ state:s }) {
  const aiming=useGame(s=>s.aiming),weapon=WEAPONS[s.weapon]
  const optic=activeOptic(s,s.time,aiming),reflex=reflexProfile(weapon)
  const charging=s.windupEnd>s.time && s.hp>0
  return <>
    {optic==='precision' && <div className="scope-optics" aria-label="Precision scope"><div><i/><b/><em/><span>{weapon.name} / PRECISION OPTICS</span><small>{weapon.penetration ? 'RAIL PENETRATION READY' : 'PRECISION LOCK'} / 2.2×</small></div></div>}
    {optic==='reflex' && <div className={`reflex-optics ${reflex.variant}`} role="img" aria-label="Holographic red-dot sight" data-testid="reflex-sight" data-weapon={s.weapon}>
      <svg viewBox="-40 -40 80 80" aria-hidden="true">
        {reflex.variant==='angular' ? <path className="reflex-brackets" d="M-15-7v-7h7M15-7v-7H8M-15 7v7h7M15 7v7H8"/> : reflex.variant==='compact' ? <path className="reflex-ring" d="M-4-13a13 13 0 0 0-9 9M4-13a13 13 0 0 1 9 9M-4 13a13 13 0 0 1-9-9M4 13a13 13 0 0 0 9-9"/> : <><path className="reflex-brackets" d="M-18-5v10M18-5v10"/><path className="reflex-chevron" d="m-7 12 7-5 7 5m-4 7 4-3 4 3"/></>}
        <circle className="reflex-dot" data-testid="reflex-dot" cx="0" cy="0" r="1.7"/>
      </svg>
      <small>{reflex.name}<span>{reflex.zoom}</span></small>
    </div>}
    {charging && <div className="weapon-charge" role="status" style={{ '--weapon-color':weapon.color }}><span>{weapon.spinUp ? 'ROTARY SYSTEM SPINNING UP' : 'GRAVITY CORE CHARGING'}</span><strong>{Math.max(0,s.windupEnd-s.time).toFixed(1)}s</strong><i style={{ width:`${Math.min(1,(s.time-s.windupStart)/(s.windupEnd-s.windupStart))*100}%` }}/></div>}
    {(weapon.scope || reflex) && !optic && <div className="scope-hint">HOLD RIGHT CLICK / {reflex ? 'RED-DOT AIM' : 'PRECISION SCOPE'}</div>}
  </>
}
