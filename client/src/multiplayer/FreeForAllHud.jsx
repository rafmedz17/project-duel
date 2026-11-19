import {FREE_FOR_ALL} from '../../../shared/match.js'
import {lobby} from './lobby.js'
import KillBadge from '../game/hud/KillBadge.jsx'

export default function FreeForAllHud({state:s,feedback,onLeave,interrupted}) {
  const room=s.room,finished=room.matchPhase==='finished'
  const players=[...(finished ? room.results : room.players)].sort((a,b)=>(b.kills ?? b.combat?.kills)-(a.kills ?? a.combat?.kills) || (a.deaths ?? a.combat?.deaths)-(b.deaths ?? b.combat?.deaths) || a.slot-b.slot)
  const self=players.find(p=>p.id===s.sessionId),leader=players[0],winner=players.find(p=>p.id===room.winnerId)
  const kills=self?.kills ?? self?.combat.kills ?? 0
  return <>
    <div className="ffa-match-strip" data-testid="ffa-score"><div><span>FREE FOR ALL</span><strong>{kills}<small> / {FREE_FOR_ALL.killsToWin} KILLS</small></strong></div><div><span>LEADER</span><b>{leader?.name || '—'}</b><small>{leader?.kills ?? leader?.combat.kills ?? 0} KILLS</small></div><i style={{width:`${kills/FREE_FOR_ALL.killsToWin*100}%`}}/></div>
    {finished && !interrupted && <div className="overlay online-overlay match-results"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="ffa-result-title">
      <div className="eyebrow">MATCH COMPLETE / FREE FOR ALL</div><h2 id="ffa-result-title">{room.winnerId===s.sessionId ? 'VICTORY' : 'MATCH COMPLETE'}</h2>
      {feedback && <div className="match-kill-feedback"><KillBadge state={feedback}/></div>}
      <p>{winner?.name || 'The winner'} reached {FREE_FOR_ALL.killsToWin} kills.</p>
      <table className="match-scoreboard" aria-label="Free for All final standings"><thead><tr><th>PLACE</th><th>PLAYER</th><th>KILLS</th><th>DEATHS</th></tr></thead><tbody>{players.map((p,i)=><tr key={p.id} className={p.id===s.sessionId ? 'self' : ''}><td>{i+1}</td><td>{p.name}{p.id===s.sessionId && <small> YOU</small>}</td><td>{p.kills}</td><td>{p.deaths}</td></tr>)}</tbody></table>
      <button className="primary" onClick={()=>lobby.backToLobby()}>RETURN TO LOBBY</button><button onClick={onLeave}>LEAVE ROOM</button>
      <p className="muted">Ready up again for a new Free for All match.</p>
    </section></div>}
  </>
}
