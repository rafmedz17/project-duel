import { useGame } from '../store.js'
import { BLADE, WEAPONS, WEAPON_SWITCH, ABILITIES } from '../config.js'
import AbilityHud, { TacticalStatus } from './AbilityHud.jsx'
import { weaponSlots } from '../../../../shared/loadout.js'
import ScannerMarkers from './ScannerMarkers.jsx'
import CombatFeedback from './CombatFeedback.jsx'

export default function Hud() {
  const s = useGame()
  const weapon = WEAPONS[s.weapon], melee = weapon.fireMode === 'melee'
  const ammo = s.magazines[s.weapon]
  const remaining = Math.max(0,s.attackReadyAt-s.time)
  const equipping = s.time-s.lastSwitch < WEAPON_SWITCH
  const status = equipping ? 'EQUIPPING' : remaining > 0 ? 'RECOVERING' : 'READY'
  const shield = s.time<s.abilities.shield.activeUntil && s.shieldCharge>0
  return <div className={`hud ${s.time-s.hurt<0.3 ? 'damage' : ''} ${shield ? 'shield-active' : ''} ${s.time<s.abilities.dash.activeUntil ? 'dash-active' : ''}`}>
    <div className="hud-top"><span className="eyebrow">● SIMULATION ACTIVE</span><div className="location">TRAINING FACILITY<small>SECTOR 01</small></div><span className="telemetry">{s.settings.fps && `${s.fps} FPS · `}{Math.floor(s.time/60).toString().padStart(2,'0')}:{Math.floor(s.time%60).toString().padStart(2,'0')}</span></div>
    <div className="score"><span className="eyebrow">TRAINING SCORE</span><strong>{String(s.score).padStart(4,'0')}</strong><small>{s.hits} RANGED HITS · {s.shots ? Math.round(s.hits/s.shots*100) : 0}% ACCURACY<br />PISTOL {s.weaponStats.pistol.hits}/{s.weaponStats.pistol.shots} · RIFLE {s.weaponStats.rifle.hits}/{s.weaponStats.rifle.shots}<br />SHOTGUN {s.weaponStats.shotgun.hits}/{s.weaponStats.shotgun.shots} · CHARACTER TRAINING<br />{s.meleeHits} BLADE HITS / {s.swings} SWINGS</small></div>
    <ScannerMarkers />
    <AbilityHud />
    {s.time<s.abilities.scanner.activeUntil && <div className="scan-status">SCANNER ONLINE · TARGET REVEAL</div>}
     <TacticalStatus state={s} />
    {s.mode === 'playing' && <div className={`crosshair ${melee ? 'melee-crosshair' : s.weapon === 'shotgun' ? 'shotgun-crosshair' : ''}`} aria-hidden="true">{s.weapon === 'shotgun' ? null : '+'}</div>}
    <CombatFeedback state={s} />
    <div className="hud-bottom">
      <div className="health"><span className="eyebrow">VITAL SYSTEMS / {s.hp > 30 ? 'STABLE' : 'CRITICAL'}</span><strong>{s.hp}<small> / 100 HP</small></strong><div className="health-track"><i style={{ width:`${s.hp}%` }} /></div>{shield && <div className="shield-charge" data-testid="shield-charge">SHIELD {s.shieldCharge} / {ABILITIES.shield.capacity}<i style={{ width:`${s.shieldCharge/ABILITIES.shield.capacity*100}%` }} /></div>}</div>
      <span className="hint">1-3 SELECT · Q CYCLE · R RELOAD · ESC PAUSE</span>
      <div className={`ammo ${melee ? 'blade-status' : s.weapon === 'rifle' ? 'rifle-status' : s.weapon === 'shotgun' ? 'shotgun-status' : ''}`}>
        <div className="weapon-slots" aria-label="Weapon selection">
          {weaponSlots(s.loadout).map((id,index) => <span key={id} className={s.weapon === id ? 'selected' : ''}>{index+1} {WEAPONS[id].shortName}</span>)}
        </div>
        <span className="eyebrow">{weaponSlots(s.loadout).indexOf(s.weapon)+1} / {weapon.name}</span>
        {melee ? <><strong>{status}</strong><div className="blade-cooldown"><i style={{ width:`${Math.max(0,1-remaining/BLADE.cooldown)*100}%` }} /></div><span>{BLADE.range} M REACH · {BLADE.damage} DAMAGE · NO AMMO</span></> : <><strong>{String(ammo).padStart(2,'0')}<small> / {weapon.magazine}</small></strong><span>{equipping ? 'EQUIPPING…' : s.reloading ? 'RELOADING ENERGY CELL…' : ammo === 0 ? 'AUTO RELOAD PENDING…' : weapon.fireMode === 'auto' ? 'FULL AUTO · HOLD LEFT CLICK' : 'SEMI AUTO · UNLIMITED RESERVE'}</span></>}
      </div>
    </div>
  </div>
}
