import { useGame } from '../store.js'
import { OPPONENT } from '../config.js'

export default function OpponentHud() {
  const s = useGame(), enemy = s.opponent
  if (!enemy.enabled) return <div className="drone-panel offline">TARGET PRACTICE / DRONE OFFLINE</div>
  const jammed = s.time<enemy.disabledUntil && enemy.hp>0
  const phase = enemy.hp === 0 ? `RESPAWN ${Math.max(0,enemy.resetAt-s.time).toFixed(1)}s` : jammed ? 'EMP JAMMED' : enemy.phase.toUpperCase()
  return <>
    <div className={`drone-panel ${enemy.phase === 'windup' ? 'charging' : ''}`} data-testid="opponent-hud">
      <span className="eyebrow">SPARRING DRONE</span><strong>{enemy.hp}<small> / {OPPONENT.health} HP</small></strong>
      <div className="drone-health"><i style={{ width:`${enemy.hp/OPPONENT.health*100}%` }} /></div>
      <span>{phase}</span><small>{enemy.defeats} DEFEATED · {enemy.attacks} PULSES FIRED</small>
    </div>
    {enemy.phase === 'windup' && <div className="drone-warning" role="status">DRONE CHARGING · MOVE OR TAKE COVER</div>}
  </>
}
