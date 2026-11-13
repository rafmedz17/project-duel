import { useGame } from '../store.js'
import { bindingLabel } from '../../settings/preferences.js'
import { WEAPONS } from '../../../../shared/weapons.js'
import { activeOptic,reflexProfile } from '../weapons/optics.js'
import { weaponFinish } from '../weapons/weaponFinish.js'
import './weaponStatus.css'
export default function WeaponStatus({ state:s }) {
  const settings=useGame(s=>s.settings)
  const aiming=useGame(s=>s.aiming),weapon=WEAPONS[s.weapon]
  const optic=activeOptic(s,s.time,aiming),reflex=reflexProfile(weapon)
  const charging=s.windupEnd>s.time && s.hp>0
  return <>
    {optic==='precision' && <div className="scope-optics" aria-label="Precision scope"><div><i/><b/><em/><span>{weapon.name} / PRECISION OPTICS</span><small>{weapon.penetration ? 'RAIL PENETRATION READY' : 'PRECISION LOCK'} / 2.2×</small></div></div>}
    {optic==='reflex' && <div className={`reflex-optics iron-optics ${reflex.variant}`} style={{ '--reticle':weaponFinish(weapon).accent }} role="img" aria-label="Open energy iron sight" data-testid="reflex-sight" data-weapon={s.weapon}>
      <svg viewBox="-12 -12 24 24" aria-hidden="true">
        <path className="iron-zero" d="M0-3.2 3.2 0 0 3.2-3.2 0Z"/>
        <circle className="reflex-dot" data-testid="reflex-dot" cx="0" cy="0" r="1.1"/>
      </svg>
    </div>}
    {charging && <div className="weapon-charge" role="status" style={{ '--weapon-color':weapon.color }}><span>{weapon.spinUp ? 'ROTARY SYSTEM SPINNING UP' : 'GRAVITY CORE CHARGING'}</span><strong>{Math.max(0,s.windupEnd-s.time).toFixed(1)}s</strong><i style={{ width:`${Math.min(1,(s.time-s.windupStart)/(s.windupEnd-s.windupStart))*100}%` }}/></div>}
    {(weapon.scope || reflex) && !optic && <div className="scope-hint">{settings.scopeMode==='tap' ? 'TAP' : 'HOLD'} {bindingLabel(settings.bindings.aim)} / {reflex ? 'ENERGY IRON SIGHT' : 'PRECISION SCOPE'}</div>}
  </>
}
