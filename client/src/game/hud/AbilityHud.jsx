import { ABILITIES } from '../config.js'
import { useGame } from '../store.js'
import { abilityKey } from '../../settings/preferences.js'
import { getCharacter,ultimateModifiers } from '../../../../shared/characters.js'
import SkillIcon from './SkillIcon.jsx'
import './tactical.css'
import './abilities.css'

export default function AbilityHud() {
  const s = useGame()
  return <AbilityBar state={s} />
}

export function AbilityBar({ state:s }) {
  const settings=useGame(s=>s.settings)
  const dead = s.hp<=0, character = getCharacter(s.loadout.character), modifiers = ultimateModifiers(s)
  return <div className="ability-bar skill-bar" aria-label="Abilities">
    {s.loadout.abilities.map(id => {
      const tuning = ABILITIES[id], jammed = id==='dash' && s.time<(s.rootedUntil || 0)
      const ability = s.abilities[id], remaining = Math.max(0,ability.readyAt-s.time)
      const active = !jammed && !dead && s.time<ability.activeUntil && (id !== 'shield' || s.shieldCharge>0)
      const status = dead ? 'OFFLINE' : jammed ? 'ROOTED' : id==='dash' && modifiers.unlimitedDash ? 'UNLIMITED' : ability.flying ? 'THROWN' : active ? `${(ability.activeUntil-s.time).toFixed(1)}s ACTIVE` : remaining>0 ? `${remaining.toFixed(1)}s` : 'READY'
      const name = id==='ultimate' ? character.ultimate : tuning.name
      const unlimited=id==='dash' && modifiers.unlimitedDash
      const charge=unlimited ? 1 : Math.max(0,Math.min(1,1-remaining/tuning.cooldown))
      const cooling=remaining>0 && !unlimited
      return <div key={id} data-testid={`ability-${id}`} style={{ '--skill-color':id==='ultimate' ? character.color : tuning.color,'--skill-fill':`${charge*100}%`,'--skill-charge':charge }} className={`ability ${id==='ultimate' ? 'ultimate-slot' : ''} ${jammed || dead ? 'jammed' : active ? 'active' : cooling ? 'cooling' : 'ready'}`} aria-label={`${name} ${status}`} title={`${name} / ${abilityKey(id,settings)} / ${status}`}>
        <div className="skill-emblem">
          <div className="skill-charge-fill"/>
          <div className="skill-icon-base"><SkillIcon id={id} effect={character.effect}/></div>
          <div className="skill-icon-fill"><SkillIcon id={id} effect={character.effect}/></div>
          <kbd>{abilityKey(id,settings)}</kbd>
          {cooling && <div className="skill-cooldown" role="progressbar" aria-label={`${name} cooldown`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(charge*100)} aria-valuetext={`${remaining.toFixed(1)} seconds remaining`}>{!active && <span>{remaining.toFixed(1)}</span>}</div>}
        </div>
        <span className="skill-name">{name}</span><strong className="skill-status">{status}</strong>
      </div>
    })}
  </div>
}

export function TacticalStatus({ state:s, obscured = false }) {
  const flashColor=useGame(s=>s.settings.flashColor)
  const character = getCharacter(s.loadout.character), ult = ultimateModifiers(s), alive = s.hp>0
  const flash = alive && s.mode!=='paused' && s.time<s.flashUntil, rooted = alive && s.time<s.rootedUntil
  return <>
    {obscured && alive && <div className="smoke-screen" aria-label="Inside enemy smoke"/>}
    {flash && <div className={`flash-screen ${flashColor==='black' ? 'black-flash' : ''}`} data-testid="flash-screen" style={{ opacity:Math.min(1,(s.flashUntil-s.time)/0.8) }}><span>OPTICS OVERLOADED</span></div>}
    {rooted && <div className="root-notice" role="status">LEGS ROOTED · {(s.rootedUntil-s.time).toFixed(1)}s <small>AIM AND FIRE TO DEFEND</small></div>}
    {ult.active && <div className="ultimate-notice" style={{ '--skill-color':character.color }} role="status"><small>{character.name} / ULTIMATE ACTIVE</small><strong>{character.ultimate}</strong><span>{(s.abilities.ultimate.activeUntil-s.time).toFixed(1)}s</span></div>}
    {alive && s.ultimateShield>0 && ult.effect==='shield' && <div className="fortress-charge" data-testid="ultimate-shield">FORTRESS SHIELD +{s.ultimateShield}<i style={{ width:`${s.ultimateShield/2}%` }}/></div>}
  </>
}
