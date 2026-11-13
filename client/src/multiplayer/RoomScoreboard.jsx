import { useEffect,useState } from 'react'
import { getCharacter } from '../../../shared/characters.js'
import { getMap } from '../../../shared/maps.js'
import { game,useGame } from '../game/store.js'
import { bindingLabel,canonicalCode } from '../settings/preferences.js'
import { lobby,useLobby } from './lobby.js'
import './scoreboard.css'

export default function RoomScoreboard() {
  const s=useLobby(),binding=useGame(s=>s.settings.bindings.scoreboard)
  const [held,setHeld]=useState(null)
  const scope=`${s.room?.code}:${s.room?.arenaEpoch}`
  useEffect(()=> {
    let pressed=null
    const clear=()=> { pressed=null;setHeld(null) }
    const down=event=> {
      if(event.code==='Escape') { clear();return }
      if(event.repeat || event.ctrlKey || event.metaKey || event.altKey || !lobby.get().room?.arenaActive || lobby.get().status!=='connected') return
      if(document.querySelector('.settings-dialog,.account-dialog') || (!lobby.get().captured && event.target.closest?.('button,a,input,textarea,select,[contenteditable="true"]'))) return
      if(canonicalCode(event,game.get().settings)!=='Tab') return
      event.preventDefault();event.stopImmediatePropagation()
      pressed=event.type==='mousedown' ? `Mouse${event.button}` : event.code
      setHeld({ scope,binding })
    }
    const up=event=> {
      const code=event.type==='mouseup' ? `Mouse${event.button}` : event.code
      if(code===pressed) { event.preventDefault();clear() }
    }
    const visibility=()=> { if(document.hidden) clear() }
    document.addEventListener('keydown',down,true);document.addEventListener('keyup',up,true)
    document.addEventListener('mousedown',down,true);document.addEventListener('mouseup',up,true)
    document.addEventListener('pointerlockchange',clear);document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',clear)
    return ()=> {
      document.removeEventListener('keydown',down,true);document.removeEventListener('keyup',up,true)
      document.removeEventListener('mousedown',down,true);document.removeEventListener('mouseup',up,true)
      document.removeEventListener('pointerlockchange',clear);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',clear)
    }
  },[scope,binding])
  const room=s.room
  if(held?.scope!==scope || held.binding!==binding || !room?.arenaActive || s.status!=='connected') return null
  const duel=room.format==='duel'
  const players=[...room.players].sort((a,b)=>(duel ? b.roundWins-a.roundWins : 0) || b.combat.kills-a.combat.kills || a.combat.deaths-b.combat.deaths || a.slot-b.slot)
  return <div className="room-scoreboard" data-testid="room-scoreboard"><section className="roster-panel" role="region" aria-label="Room scoreboard">
    <header><div><span className="eyebrow">LIVE ROOM ROSTER / {room.code}</span><h2>SCOREBOARD</h2></div><div className="roster-meta"><strong>{duel ? 'BEST OF THREE' : 'FREE PLAY'}</strong><span>{getMap(room.mapId).name} · {room.ranked ? 'RANKED' : 'CASUAL'}<br/>{players.length} PLAYERS</span></div></header>
    <table aria-label="Room player statistics"><thead><tr><th scope="col">PLAYER</th><th scope="col">KILLS</th><th scope="col">DEATHS</th><th scope="col">K/D</th>{duel && <th scope="col">ROUNDS</th>}<th scope="col">PING</th><th scope="col">STATUS</th></tr></thead><tbody>{players.map(player=> {
      const self=player.id===s.sessionId,c=player.combat,character=getCharacter(c.characterId),ping=player.connected ? player.ping : null
      const status=!player.connected ? 'RECONNECTING' : c.hp<=0 ? 'ELIMINATED' : room.matchPhase==='finished' ? 'FINISHED' : 'IN MATCH'
      return <tr key={player.id} className={self ? 'self' : ''} data-testid={`scoreboard-player-${player.id}`}>
        <td><div className="roster-player"><span className="roster-avatar" style={{ '--roster-color':character.color }} aria-hidden="true">{character.name.slice(0,1)}</span><div><strong>{player.name}{self && <b>YOU</b>}{player.id===room.hostId && <b className="host-tag">HOST</b>}</strong><small>{character.name} · {player.authenticated ? 'ACCOUNT' : 'GUEST'}</small></div></div></td>
        <td data-stat="kills">{c.kills}</td><td data-stat="deaths">{c.deaths}</td><td>{(c.kills/Math.max(1,c.deaths)).toFixed(2)}</td>{duel && <td>{player.roundWins}</td>}
        <td className={`roster-ping ${ping==null ? 'unknown' : ping<80 ? 'good' : ping<160 ? 'fair' : 'slow'}`} data-stat="ping" aria-label={ping==null ? 'Ping unavailable' : `${ping} milliseconds ping`}>{ping==null ? '—' : <>{ping}<small> ms</small></>}</td><td><span className={`roster-status ${!player.connected ? 'offline' : c.hp<=0 ? 'eliminated' : ''}`}>{status}</span></td>
      </tr>
    })}</tbody></table>
    <footer><span><kbd>{bindingLabel(binding)}</kbd> HOLD TO VIEW</span><small>LIVE STATS · ROUND-TRIP PING · MATCH CONTINUES</small></footer>
  </section></div>
}
