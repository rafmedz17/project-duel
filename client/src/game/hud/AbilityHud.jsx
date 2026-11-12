import { ABILITIES } from '../config.js'
import { useGame } from '../store.js'

export default function AbilityHud() {
  const s = useGame()
  return <AbilityBar state={s} />
}

export function AbilityBar({ state:s }) {
  const jammed = s.time<(s.disabledUntil || 0), dead = s.hp<=0
  return <div className="ability-bar" aria-label="Abilities">
    {Object.entries(ABILITIES).map(([id,tuning]) => {
      const ability = s.abilities[id], remaining = Math.max(0,ability.readyAt-s.time)
      const equipped = !s.loadout || s.loadout.abilities.includes(id)
      const active = !jammed && !dead && s.time<ability.activeUntil && (id !== 'shield' || s.shieldCharge>0)
      const status = !equipped ? 'UNEQUIPPED' : dead ? 'OFFLINE' : jammed ? 'JAMMED' : active ? 'ACTIVE' : remaining>0 ? `${remaining.toFixed(1)}s` : 'READY'
      return <div key={id} data-testid={`ability-${id}`} className={`ability ${!equipped ? 'unequipped' : jammed || dead ? 'jammed' : active ? 'active' : remaining>0 ? 'cooling' : 'ready'}`} aria-label={`${tuning.name} ${status}`}>
        <span><kbd>{tuning.key}</kbd>{tuning.name}</span><strong>{status}</strong>
        <i style={{ width:`${Math.max(0,Math.min(1,1-remaining/tuning.cooldown))*100}%` }} />
      </div>
    })}
  </div>
}
