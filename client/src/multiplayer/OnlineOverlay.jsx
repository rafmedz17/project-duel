import { WEAPONS } from '../../../shared/weapons.js'
import CombatFeedback from '../game/hud/CombatFeedback.jsx'
import { getMap } from '../../../shared/maps.js'
import { AbilityBar } from '../game/hud/AbilityHud.jsx'
import { ABILITIES } from '../../../shared/abilities.js'
import OnlineScannerMarker from './OnlineScannerMarker.jsx'
import MatchHud from './MatchHud.jsx'
import { canPlayArena } from '../../../shared/match.js'
import { lobby, useLobby } from './lobby.js'
import './online.css'

export default function OnlineOverlay({ onLeave }) {
  const s = useLobby()
  const interrupted = s.status!=='connected' || s.room.phase!=='arena'
  const duel = s.room.format==='duel', finished = s.room.matchPhase==='finished', live = canPlayArena(s.room)
  const self = s.room.players.find(player => player.id===s.sessionId)
  const other = s.room.players.find(player => player.id!==s.sessionId)
  const combat = self?.combat
  if (!combat) return null
  const weapon = WEAPONS[combat.weapon], melee = combat.weapon==='blade', dead = combat.hp===0
  const feedback = { ...combat,time:s.room.time,generation:s.room.arenaEpoch,mode:interrupted ? 'paused' : 'playing' }
  const shield = combat.shieldCharge>0 && s.room.time<combat.abilities.shield.activeUntil
  const jammed = s.room.time<combat.disabledUntil
  return <>
    <div className={`online-hud ${s.room.time-combat.hurt<0.3 ? 'damage' : ''} ${shield ? 'shield-active' : ''} ${s.room.time<combat.abilities.dash.activeUntil ? 'dash-active' : ''}`}>
      <div className="online-top"><span className="eyebrow">PRIVATE ARENA / {s.room.code}</span><strong>{getMap(s.room.mapId).name}<small>{s.room.ranked ? 'RANKED' : 'CASUAL'} · SERVER VALIDATED COMBAT</small></strong><span className="online-link">{interrupted ? 'LINK INTERRUPTED' : 'CONNECTED · 2 PLAYERS'}</span></div>
      <div className="online-names"><span>{self.name} <small>YOU · {combat.kills} KILLS / {combat.deaths} DEATHS</small></span><span>{other?.name || 'OPEN SLOT'} <small>{other?.connected ? `CHALLENGER · ${other.combat.kills} KILLS` : 'RECONNECTING'}</small></span></div>
      {s.captured && !dead && live && <div className={`crosshair ${melee ? 'melee-crosshair' : combat.weapon==='shotgun' ? 'shotgun-crosshair' : ''}`} aria-hidden="true">{combat.weapon==='shotgun' ? null : '+'}</div>}
      <CombatFeedback state={feedback} />
      <AbilityBar state={feedback} />
      <OnlineScannerMarker other={other} />
      {jammed ? <div className="scan-status online-jam" role="status">EMP JAMMED · {Math.max(0,combat.disabledUntil-s.room.time).toFixed(1)}s</div> : s.room.time<combat.abilities.scanner.activeUntil && !dead && <div className="scan-status">SCANNER ONLINE · OPPONENT REVEAL</div>}
      {s.room.time-combat.abilities.emp.startedAt<1.8 && <div className="ability-toast" role="status">EMP BLAST · {combat.abilities.emp.result ? 'OPPONENT DISRUPTED' : 'NO OPPONENT IN RANGE'}</div>}
      {dead && !duel && <div className="online-respawn" role="status"><strong>SYSTEM OFFLINE</strong><span>RESPAWNING IN {Math.max(0,combat.respawnAt-s.room.time).toFixed(1)}s</span></div>}
      <div className="online-vitals"><div className="health"><span className="eyebrow">VITAL SYSTEMS</span><strong data-testid="online-health">{combat.hp}<small> / 100 HP</small></strong><div className="health-track"><i style={{ width:`${combat.hp}%` }} /></div>{shield && <div className="shield-charge" data-testid="online-shield-charge">SHIELD {combat.shieldCharge} / {ABILITIES.shield.capacity}<i style={{ width:`${combat.shieldCharge/ABILITIES.shield.capacity*100}%` }} /></div>}</div>
        <div className="ammo"><div className="weapon-slots" aria-label="Weapon selection">{Object.entries(WEAPONS).map(([id,item]) => <span key={id} className={!combat.loadout.weapons.includes(id) ? 'unequipped' : id===combat.weapon ? 'selected' : ''}>{item.slot} {item.shortName}</span>)}</div><span className="eyebrow">{weapon.slot} / {weapon.name}</span><strong data-testid="online-ammo">{melee ? 'BLADE' : String(combat.magazines[combat.weapon]).padStart(2,'0')}{!melee && <small> / {weapon.magazine}</small>}</strong><span>{dead ? duel ? 'ROUND ENDED' : 'RESPAWNING' : combat.reloading ? 'RELOADING ENERGY CELL' : s.room.time<combat.attackReadyAt ? 'RECOVERING' : melee ? 'LEFT CLICK TO SWING' : weapon.fireMode==='auto' ? 'HOLD LEFT CLICK · FULL AUTO' : 'LEFT CLICK TO FIRE'}</span></div>
      </div>
      <div className="online-bottom"><span>WASD MOVE · SHIFT SPRINT · SPACE JUMP · ESC RELEASE</span><span>1–4 SELECT · Q CYCLE · R RELOAD</span></div>
    </div>
    <MatchHud state={s} onLeave={onLeave} interrupted={interrupted} />
    {((!s.captured && !finished && (!duel || s.room.matchPhase==='live')) || interrupted) && <div className="overlay online-overlay"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="online-title">
      <div className="eyebrow">ROOM {s.room.code} / CONNECTED ARENA</div>
      <h2 id="online-title">{interrupted ? 'CONNECTION INTERRUPTED' : 'SHARED ARENA'}</h2>
      <p>{interrupted ? 'Combat and movement are paused while the connection recovers.' : duel ? 'First to two round wins. Each elimination ends the round. Fresh spawns and loadouts follow the countdown. Higher health wins at the 90-second limit; equal health replays the round.' : 'Capture your mouse to move, aim and fire. Headshots deal double damage; foot hits deal half. Eliminated players respawn after three seconds.'}</p>
      {s.captureError && <p className="error" role="alert">{s.captureError}</p>}
      {!finished && <button className="primary" disabled={interrupted || !live || !s.arenaReady} onClick={() => lobby.capture()}>ENTER ARENA</button>}
      {!s.arenaReady && <p role="status">Loading arena controls…</p>}
      <button disabled={s.status!=='connected'} onClick={() => duel && !finished ? lobby.forfeit() : lobby.backToLobby()}>{duel && !finished ? 'FORFEIT MATCH' : 'RETURN TO LOBBY'}</button>
      <button onClick={onLeave}>LEAVE ROOM</button>
      <p className="muted">E Dash · F Shield · C Scanner · V EMP · {duel ? 'Forfeiting awards the match to your opponent.' : 'Free Play · Unlimited practice.'}</p>
    </section></div>}
  </>
}
