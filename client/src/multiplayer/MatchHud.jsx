import { MATCH } from '../../../shared/match.js'
import { lobby } from './lobby.js'

function Scoreboard({ players, selfId }) {
  return <table className="match-scoreboard" aria-label="Match scoreboard"><thead><tr><th>PLAYER</th><th>ROUNDS</th><th>K / D</th></tr></thead><tbody>{players.map(player => <tr key={player.id} className={player.id===selfId ? 'self' : ''}><td>{player.name}{player.id===selfId && <small> YOU</small>}</td><td>{player.roundWins}</td><td>{player.kills ?? player.combat?.kills} / {player.deaths ?? player.combat?.deaths}</td></tr>)}</tbody></table>
}

export default function MatchHud({ state:s, onLeave, interrupted }) {
  const room = s.room
  if (room.format!=='duel') return null
  const finished = room.matchPhase==='finished'
  const players = finished ? room.results : room.players
  const slots = [...players].sort((a,b) => a.slot-b.slot)
  const wonRound = room.roundWinnerId===s.sessionId
  const winner = players.find(player => player.id===room.winnerId)
  const seconds = Math.ceil(room.roundRemaining)
  const saved = { saving:'Saving match result…',saved:room.resultRanked ? 'Result saved · Elo updated.' : 'Result saved · Casual record updated. Elo unchanged.',pending:'Result queued on the server. Cloud sync will retry automatically.',failed:'The server could not save this result. Your record may not update.',skipped:'Guest match · No cloud record saved.' }
  return <>
    <div className="match-strip" data-testid="match-score"><strong>{slots[0]?.roundWins || 0}</strong><div><span data-testid="match-round">ROUND {room.roundNumber} / 3</span><small>FIRST TO {MATCH.winsToTakeMatch} · <time data-testid="match-clock">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</time></small></div><strong>{slots[1]?.roundWins || 0}</strong></div>
    {!interrupted && room.matchPhase==='roundOver' && <div className={`round-banner ${wonRound ? 'won' : ''}`} role="status" data-testid="round-result"><span className="eyebrow">ROUND {room.roundNumber} COMPLETE</span><strong>{!room.roundWinnerId ? 'ROUND DRAW' : wonRound ? 'ROUND WON' : 'ROUND LOST'}</strong><span>{room.matchReason==='draw' ? 'EQUAL HEALTH · REPLAYING ROUND' : room.matchReason==='time' ? 'TIME LIMIT · HIGHER HEALTH WINS' : 'ELIMINATION'}</span><small>NEXT ROUND IN {Math.ceil(room.phaseRemaining)+MATCH.loadoutSeconds+MATCH.countdownSeconds}</small></div>}
    {!interrupted && room.matchPhase==='countdown' && <div className="round-banner" role="status" data-testid="round-countdown"><span className="eyebrow">ROUND {room.roundNumber} / BEST OF THREE</span><strong>{Math.max(1,Math.ceil(room.phaseRemaining))}</strong><span>GET READY · FRESH LOADOUT</span></div>}
    {finished && !interrupted && <div className="overlay online-overlay match-results"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="match-title"><div className="eyebrow">MATCH COMPLETE / BEST OF THREE</div><h2 id="match-title">{room.winnerId===s.sessionId ? 'VICTORY' : room.winnerId ? 'DEFEAT' : 'MATCH ENDED'}</h2><p>{winner ? `${winner.name} wins the match.` : 'The match has ended.'} {room.matchReason==='forfeit' ? 'Decided by forfeit.' : 'First to two round wins.'}</p><Scoreboard players={slots} selfId={s.sessionId} /><p role="status" data-testid="result-save-status">{saved[room.saveStatus] || 'Finalizing result…'}</p><button className="primary" onClick={() => lobby.backToLobby()}>RETURN TO LOBBY</button><button onClick={onLeave}>LEAVE ROOM</button><p className="muted">Ready up again in the lobby to play a fresh match.</p></section></div>}
  </>
}
