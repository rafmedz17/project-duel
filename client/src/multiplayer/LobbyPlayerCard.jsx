import {getCharacter} from '../../../shared/characters.js'
import CharacterPortrait from '../game/characters/CharacterPortrait.jsx'

export default function LobbyPlayerCard({slot,player,selfId,hostId,preview,characterId,children}) {
  const character=getCharacter(player?.combat.characterId || characterId)
  const occupied=Boolean(player || preview)
  return <article className={`lobby-player ${player?.ready ? 'is-ready' : ''} ${!occupied ? 'open-player-slot' : ''}`} style={{'--operative-color':character.color}} data-testid={`lobby-slot-${slot}`}>
    <div className="player-card-top"><span>{slot===0 ? '01 / ALPHA' : '02 / OMEGA'}</span><span>{player?.id===selfId || preview ? 'YOU' : occupied ? 'OPPONENT' : 'OPEN SLOT'}</span></div>
    <div className="player-portrait-stage">{occupied ? <CharacterPortrait characterId={player?.combat.characterId || characterId}/> : <div className="empty-operative" aria-hidden="true"><span>+</span><i/><small>AWAITING UPLINK</small></div>}<div className="portrait-platform"/></div>
    <div className="player-card-details">{children || <><strong>{player?.name || 'WAITING FOR PLAYER'}</strong><span>{player ? `${player.id===hostId ? 'ROOM HOST' : 'CHALLENGER'} · ${player.authenticated ? 'SIGNED IN' : 'GUEST'}` : 'Share your invite code to begin'}</span></>}
      {occupied && <small className="operative-name">{character.name} / {character.role}</small>}
    </div>
    <div className="player-ready"><i/>{!occupied ? 'WAITING FOR A FRIEND' : preview ? 'PREPARING TO CONNECT' : !player.connected ? 'RECONNECTING' : player.ready ? 'READY' : 'NOT READY'}</div>
  </article>
}
