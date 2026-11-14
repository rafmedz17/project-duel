import {useEffect,useRef,useState} from 'react'
import {FORMATS} from '../../../shared/match.js'
import {MAPS} from '../../../shared/maps.js'
import {useAccount} from '../accounts/store.js'
import {lobby,useLobby} from './lobby.js'
import LobbyPlayerCard from './LobbyPlayerCard.jsx'
import LobbyMapCard from './LobbyMapCard.jsx'
import './lobby.css'

function savedName() {let value;try{value=localStorage.getItem('duel-callsign')}catch{/* Device storage can be unavailable. */}return value || `Pilot ${Math.random().toString(36).slice(2,8)}`}
function trapFocus(event) {
  if(event.key!=='Tab') return
  const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
  const first=controls[0],last=controls.at(-1)
  if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus()}
  else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus()}
}

export default function Lobby({onClose,onProfile,returnFocusRef,mode='casual'}) {
  const s=useLobby(),account=useAccount()
  const [name,setName]=useState(savedName),[code,setCode]=useState('')
  const [requestedRanked,setRequestedRanked]=useState(mode==='ranked')
  const [copyStatus,setCopyStatus]=useState({code:'',message:''})
  const closeButton=useRef(),nameInput=useRef(),copyButton=useRef(),initialConnection=useRef(false)
  const room=s.room,players=room?.players || [],self=players.find(player=>player.id===s.sessionId)
  const busy=s.status==='connecting',connected=Boolean(room) && ['connected','reconnecting','connecting'].includes(s.status)
  const host=connected && room.hostId===s.sessionId
  const eligible=room?.format==='duel' && players.length===2 && players.every(player=>player.authenticated && player.connected)
  const seekingRanked=host && requestedRanked
  const canReady=s.status==='connected' && players.length===2 && players.every(player=>player.connected) && (!seekingRanked || room.ranked)
  const locked=!host || s.status!=='connected' || room.phase==='countdown'
  const rankedLocked=!connected && mode==='ranked' && !account.user
  const callsign=account.profile?.callsign || name
  const close=()=>{void lobby.leave();onClose()}
  const title=room?.ranked ? 'RANKED MATCH' : connected ? seekingRanked ? 'RANKED LOBBY' : 'CASUAL MATCH' : mode==='ranked' ? 'RANKED LOBBY' : 'CASUAL LOBBY'

  useEffect(()=>{
    if(initialConnection.current || account.loading || rankedLocked || s.status!=='idle') return
    initialConnection.current=true
    void lobby.connect('create',callsign)
  },[account.loading,rankedLocked,callsign,s.status])

  useEffect(()=>{
    const previous=returnFocusRef.current
    const key=event=>{if(event.key==='Escape' && !lobby.get().room?.arenaActive) {event.preventDefault();void lobby.leave();onClose()}}
    document.addEventListener('keydown',key)
    return ()=>{document.removeEventListener('keydown',key);previous?.focus()}
  },[onClose,returnFocusRef])
  useEffect(()=>{(connected ? copyButton.current : !nameInput.current?.disabled ? nameInput.current : closeButton.current)?.focus()},[connected])
  // Ranked remains a server decision. Do not enable ready/start until the
  // server confirms the requested mode for two eligible signed-in players.
  useEffect(()=>{
    if(seekingRanked && eligible && !room?.ranked && s.status==='connected') lobby.ranked(true)
  },[seekingRanked,eligible,room?.ranked,room?.code,s.status])

  async function connect(kind) {
    if(busy || account.loading || rankedLocked) return
    const joined=await lobby.connect(kind,callsign,code)
    if(joined) setRequestedRanked(kind==='create' && mode==='ranked')
  }
  async function copyCode() {
    const code=room.code
    try{await navigator.clipboard.writeText(code);setCopyStatus({code,message:'CODE COPIED'})}
    catch{setCopyStatus({code,message:'Select the code and copy it manually.'})}
  }
  function changeType(value) {setRequestedRanked(value==='ranked');lobby.ranked(value==='ranked')}
  const status=s.status==='reconnecting' ? 'RESTORING CONNECTION' : room?.phase==='countdown' ? `BOTH PLAYERS READY / STARTING IN ${room.countdown}` : room?.phase==='ready' ? 'BOTH PLAYERS READY' : room?.phase==='reconnecting' ? 'HOLDING YOUR FRIEND’S SEAT' : players.length<2 ? 'WAITING FOR A CHALLENGER' : 'WAITING FOR READY CHECKS'

  if(room?.arenaActive) return null
  return <div className="overlay modal lobby-overlay" onKeyDown={trapFocus}>
    <section className="dialog lobby-dialog" role="dialog" aria-modal="true" aria-labelledby="lobby-title" aria-describedby="lobby-description">
      <header className="lobby-topbar"><div className="lobby-title-block"><div className="eyebrow">PROJECT DUEL / PRIVATE LINK</div><h2 id="lobby-title">PRIVATE MULTIPLAYER</h2></div>
        <div className="room-invite"><span>INVITE CODE</span><div className="invite-code" data-testid={connected ? 'invite-code' : undefined}>{connected ? room.code : busy ? '......' : '------'}</div><button ref={copyButton} type="button" onClick={copyCode} disabled={!connected || busy} aria-label="COPY CODE"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 8h12v13H8zM16 8V3H3v13h5"/></svg></button></div>
        <form className="lobby-join" onSubmit={event=>{event.preventDefault();connect('join')}}><label className="lobby-label">ENTER CODE<input className="code-input" aria-label="INVITE CODE" value={code} maxLength={6} disabled={busy || rankedLocked || s.status==='reconnecting' || room?.phase==='countdown'} onChange={event=>setCode(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} placeholder="ABC234"/></label><button type="submit" disabled={busy || account.loading || rankedLocked || s.status==='reconnecting' || room?.phase==='countdown'} aria-label="JOIN ROOM">JOIN</button></form>
        <div className={`lobby-mode-badge ${room?.ranked || seekingRanked || !connected && mode==='ranked' ? 'ranked' : ''}`}><span>{title}</span><small>{connected ? s.status==='reconnecting' ? 'RECONNECTING' : 'PRIVATE / 1 VS 1' : 'INVITE A FRIEND'}</small></div>
        <button ref={closeButton} type="button" className="lobby-close" onClick={close} aria-label="Close multiplayer lobby">×</button>
      </header>
      <p id="lobby-description" className="lobby-intro">{connected ? 'Your arena. Your rival. Ready up and make it count.' : 'Create a private room or enter a friend’s invite code to join their lobby.'}</p>
      {s.error && <p className="lobby-error" role="alert">{s.error}</p>}
      {rankedLocked && <div className="lobby-ranked-notice"><div><strong>SIGN IN TO PLAY RANKED</strong><span>Ranked duels require two different signed-in accounts and Best of Three.</span></div><button type="button" onClick={onProfile}>SIGN IN / PROFILE</button></div>}
      {seekingRanked && !room.ranked && <p className="lobby-ranked-notice" role="status">{eligible ? 'CONFIRMING RANKED MODE…' : 'RANKED SETUP · Invite a second signed-in player. Ready checks unlock after ranked mode is confirmed.'}</p>}
      <div className="lobby-roster" aria-label="Room players">
        <LobbyPlayerCard slot={0} player={players.find(player=>player.slot===0)} selfId={s.sessionId} hostId={room?.hostId} preview={!connected} characterId={account.loadout.character}>
          {!connected && <label className="lobby-label callsign-label">YOUR CALLSIGN<input ref={nameInput} value={callsign} maxLength={18} disabled={busy || Boolean(account.user)} onChange={event=>setName(event.target.value)} autoComplete="nickname" placeholder="e.g. Nova"/></label>}
        </LobbyPlayerCard>
        <div className="lobby-match-center"><div className="lobby-versus" aria-hidden="true"><span/>VS<span/></div><span className="versus-caption">ONE ARENA. TWO OPERATIVES.</span>
          <label className="lobby-label format-select-label">MATCH FORMAT<select aria-label="Match format" value={room?.format || 'duel'} disabled={locked || seekingRanked || room?.ranked} onChange={event=>lobby.format(event.target.value)}>{Object.entries(FORMATS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
          <LobbyMapCard mapId={room?.mapId || 'facility'} disabled={locked} onChange={value=>lobby.map(value)}/>
          <p className="map-description">{MAPS[room?.mapId || 'facility'].description}</p>
        </div>
        <LobbyPlayerCard slot={1} player={players.find(player=>player.slot===1)} selfId={s.sessionId} hostId={room?.hostId}/>
      </div>
      {connected ? <>
        <div className="lobby-room-options"><label className="lobby-label">MATCH TYPE<select aria-label="Match type" value={room.ranked || seekingRanked ? 'ranked' : 'casual'} disabled={locked} onChange={event=>changeType(event.target.value)}><option value="casual">CASUAL</option><option value="ranked" disabled={!eligible}>RANKED</option></select></label><p>{room.ranked ? 'RANKED / BEST OF THREE · Verified accounts. Elo eligibility is checked when results are saved.' : seekingRanked ? 'Waiting for a verified rival. This room cannot launch as casual while ranked is requested.' : room.format==='duel' ? 'FIRST TO TWO WINS · 90-second rounds. Draws replay. Changing settings resets readiness.' : 'FREE PLAY · Five-second respawns. Change your preset between lives.'}</p></div>
        <div className={`lobby-state ${room.phase==='ready' ? 'all-ready' : ''}`} role="status"><i/><div><strong>{status}</strong><span>{room.phase==='countdown' ? 'Cancel readiness to stop the countdown.' : room.phase==='ready' ? 'Both players are ready to enter the arena.' : room.phase==='reconnecting' ? 'Their seat is held for 15 seconds. Readiness resets after a disconnect.' : 'Both players must be connected to ready up.'}</span></div></div>
        <div className="lobby-actions"><button type="button" className="lobby-back" onClick={close}>LEAVE ROOM</button><span className="invite-copy-status" role="status">{copyStatus.code===room.code ? copyStatus.message : 'Copy the code above to invite your rival.'}</span><button type="button" className="primary" disabled={!canReady} onClick={()=>lobby.ready(!self?.ready)}>{self?.ready ? 'CANCEL READY' : 'READY UP'}</button>{host && !room.autoStart && room.phase==='ready' && (!seekingRanked || room.ranked) && <button type="button" className="primary start-arena" onClick={()=>lobby.start()}>START SHARED ARENA</button>}</div>
        {s.notice && <p className="lobby-message" role="status">{s.notice}</p>}{room.note && <p className="lobby-message" role="status">{room.note}</p>}
      </> : <>
        <div className="lobby-setup-note">{account.user ? 'Your saved profile and active loadout are ready.' : 'Your device loadout is equipped. Both players ready up to begin the five-second countdown.'}</div>
        <div className="lobby-actions lobby-connect-actions"><button type="button" className="lobby-back" onClick={close}>{busy ? 'CANCEL / BACK' : 'BACK'}</button>{!busy && !rankedLocked && <button type="button" className="primary" disabled={account.loading} onClick={()=>connect('create')}>RETRY CONNECTION</button>}</div>
      </>}
      <div className="lobby-connection-footer"><span className={`connection-pill ${s.status}`} aria-label={`Connection: ${s.status}`}><i/>{connected ? s.status==='reconnecting' ? 'RECONNECTING' : 'CONNECTED' : busy ? 'CONNECTING' : 'LOBBY PREVIEW'}</span><span>PRIVATE UPLINK / PROJECT DUEL</span></div>
    </section>
  </div>
}
