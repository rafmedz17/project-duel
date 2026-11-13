import { useGame } from '../store.js'
import { WEAPONS } from '../../../../shared/weapons.js'
import './weaponStatus.css'
export default function WeaponStatus({ state:s }) {
  const aiming=useGame(s=>s.aiming),weapon=WEAPONS[s.weapon]
  const charging=s.windupEnd>s.time && s.hp>0
  return <>
    {aiming && weapon.scope && s.hp>0 && <div className="scope-optics" aria-label="Precision scope"><div><i/><b/><em/><span>{weapon.name} / PRECISION OPTICS</span><small>{weapon.penetration ? 'RAIL PENETRATION READY' : 'PRECISION LOCK'} / 2.2×</small></div></div>}
    {charging && <div className="weapon-charge" role="status" style={{ '--weapon-color':weapon.color }}><span>{weapon.spinUp ? 'ROTARY SYSTEM SPINNING UP' : 'GRAVITY CORE CHARGING'}</span><strong>{Math.max(0,s.windupEnd-s.time).toFixed(1)}s</strong><i style={{ width:`${Math.min(1,(s.time-s.windupStart)/(s.windupEnd-s.windupStart))*100}%` }}/></div>}
    {weapon.scope && !aiming && <div className="scope-hint">HOLD RIGHT CLICK / PRECISION SCOPE</div>}
  </>
}
