import { useEffect, useState } from 'react'
import { FORMATS } from '../../../shared/match.js'
import { MAPS } from '../../../shared/maps.js'
import { useAccount } from '../accounts/store.js'
import { lobby, useLobby } from './lobby.js'
import './lobby.css'

function savedName() { try { return localStorage.getItem('duel-callsign') || '' } catch { return '' } }
function trapFocus(event) {
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}

export default function Lobby({ onClose, returnFocusRef }) {
  const s = useLobby()
  const account = useAccount()
  const [name,setName] = useState(savedName)
  const callsign = account.profile?.callsign || name
  const [code,setCode] = useState('')
  const [copyStatus,setCopyStatus] = useState({ code:'',message:'' })
  const busy = s.status === 'connecting'
  const connected = Boolean(s.room) && (s.status === 'connected' || s.status === 'reconnecting')
  const players = s.room?.players || []
  const self = players.find(player => player.id === s.sessionId)
  const canReady = s.status === 'connected' && players.length === 2 && players.every(player => player.connected)
  const close = () => { void lobby.leave(); onClose() }

  useEffect(() => {
    const previous = returnFocusRef.current
    const key = event => { if (event.key === 'Escape' && !lobby.get().room?.arenaActive) { event.preventDefault(); void lobby.leave(); onClose() } }
    document.addEventListener('keydown',key)
    return () => { document.removeEventListener('keydown',key); previous?.focus() }
  },[onClose,returnFocusRef])

  async function copyCode() {
    const code = s.room.code
    try { await navigator.clipboard.writeText(code); setCopyStatus({ code,message:'CODE COPIED' }) }
    catch { setCopyStatus({ code,message:'Select the code above and copy it manually.' }) }
  }

  if (s.room?.arenaActive) return null

  return <div className="overlay modal lobby-overlay" onKeyDown={trapFocus}>
    <section className="dialog lobby-dialog" role="dialog" aria-modal="true" aria-labelledby="lobby-title" aria-describedby="lobby-description">
      <div className="lobby-heading"><span className="eyebrow">PROJECT DUEL / PRIVATE LINK</span><span className={`connection-pill ${s.status}`} aria-label={`Connection: ${s.status}`}>{connected ? s.status === 'reconnecting' ? 'RECONNECTING' : 'CONNECTED' : busy ? 'CONNECTING' : 'LOBBY PREVIEW'}</span></div>
      <h2 id="lobby-title">PRIVATE MULTIPLAYER</h2>
      <p id="lobby-description">Invite a friend, ready up, then enter the shared facility together. Choose Best of Three for scored rounds, or Free Play for practice.</p>
      {s.error && <p className="lobby-error" role="alert">{s.error}</p>}
      {connected ? <>
        <div className="invite-card"><span className="eyebrow">YOUR INVITE CODE</span><div className="invite-code" data-testid="invite-code">{s.room?.code || '······'}</div><button onClick={copyCode} disabled={!s.room?.code}>COPY CODE</button><small role="status">{copyStatus.code === s.room?.code ? copyStatus.message : 'Share this code with your friend.'}</small></div>
        <div className="lobby-roster" aria-label="Room players">
          {[0,1].map(slot => {
            const player = players.find(item => item.slot === slot)
            return <div key={slot} className={`lobby-player ${player?.ready ? 'is-ready' : ''}`} data-testid={`lobby-slot-${slot}`}>
              <span className="player-avatar" aria-hidden="true">{slot === 0 ? '01' : '02'}</span>
              <div><strong>{player ? player.name : 'OPEN SLOT'} {player?.id === s.sessionId && <small>YOU</small>}</strong><span>{player ? `${player.id === s.room.hostId ? 'ROOM HOST' : 'CHALLENGER'} · ${player.authenticated ? 'SIGNED IN' : 'GUEST'}` : 'Waiting for your friend'}</span></div>
              <span className="player-ready">{!player ? '—' : !player.connected ? 'RECONNECTING' : player.ready ? 'READY' : 'NOT READY'}</span>
            </div>
          })}
        </div>
        <label className="lobby-label">MATCH FORMAT<select aria-label="Match format" value={s.room.format} disabled={s.room.hostId!==s.sessionId || s.status!=='connected' || s.room.phase==='countdown'} onChange={event => lobby.format(event.target.value)}>{Object.entries(FORMATS).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="lobby-label">ARENA MAP<select aria-label="Arena map" value={s.room.mapId} disabled={s.room.hostId!==s.sessionId || s.status!=='connected' || s.room.phase==='countdown'} onChange={e => lobby.map(e.target.value)}>{Object.entries(MAPS).map(([id,map]) => <option key={id} value={id}>{map.name}</option>)}</select></label><p className="muted">{MAPS[s.room.mapId]?.description} Changing maps resets readiness.</p>
        <label className="lobby-label">MATCH TYPE<select aria-label="Match type" value={s.room.ranked ? 'ranked' : 'casual'} disabled={s.room.hostId!==s.sessionId || s.status!=='connected' || s.room.phase==='countdown'} onChange={e => lobby.ranked(e.target.value==='ranked')}><option value="casual">CASUAL</option><option value="ranked" disabled={s.room.format!=='duel' || players.length!==2 || players.some(p => !p.authenticated)}>RANKED</option></select></label><p className="muted">Ranked requires two different signed-in accounts. Short matches and repeated pairings may save without changing Elo.</p>
        <p className="muted">{s.room.format==='duel' ? 'First to two round wins. Elimination or highest HP after 90 seconds wins the round. Draws replay. Changing format resets readiness.' : 'Unlimited practice with three-second respawns.'}</p>
        <div className={`lobby-state ${s.status === 'connected' && s.room?.phase === 'ready' ? 'all-ready' : ''}`} role="status">
          <strong>{s.status === 'reconnecting' ? 'RESTORING CONNECTION' : s.room?.phase === 'countdown' ? `ENTERING ARENA IN ${s.room.countdown}` : s.room?.phase === 'ready' ? 'BOTH PLAYERS READY' : s.room?.phase === 'reconnecting' ? 'HOLDING YOUR FRIEND’S SEAT' : players.length < 2 ? 'WAITING FOR A CHALLENGER' : 'WAITING FOR READY CHECKS'}</strong>
          <span>{s.room?.phase === 'countdown' ? 'Cancel readiness to stop the countdown.' : s.room?.phase === 'ready' ? 'The host can now launch the shared arena.' : s.room?.phase === 'reconnecting' ? 'Readiness resets when someone disconnects. Their seat is held for 15 seconds.' : 'Both players must be connected to ready up.'}</span>
        </div>
        {s.notice && <p className="muted" role="status">{s.notice}</p>}
        {s.room?.note && <p className="muted" role="status">{s.room.note}</p>}
        {s.room?.hostId === s.sessionId && s.room?.phase === 'ready' && <button className="primary" onClick={() => lobby.start()}>START SHARED ARENA</button>}
        <button className="primary" disabled={!canReady} onClick={() => lobby.ready(!self?.ready)}>{self?.ready ? 'CANCEL READY' : 'READY UP'}</button>
      </> : <>
        <label className="lobby-label">YOUR CALLSIGN<input autoFocus value={callsign} maxLength={18} disabled={busy || Boolean(account.user)} onChange={event => setName(event.target.value)} autoComplete="nickname" placeholder="e.g. Nova" /></label>
        {account.user && <p className="muted">Using your saved profile and loadout. Edit them from the main menu before joining.</p>}
        <button className="primary" disabled={busy || account.loading} onClick={() => lobby.connect('create',callsign)}>{busy ? 'CONNECTING…' : 'CREATE PRIVATE ROOM'}</button>
        <div className="lobby-divider"><span>OR JOIN A FRIEND</span></div>
        <form onSubmit={event => { event.preventDefault(); if (!busy && !account.loading) void lobby.connect('join',callsign,code) }}>
          <label className="lobby-label">INVITE CODE<input className="code-input" value={code} maxLength={6} disabled={busy} onChange={event => setCode(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} placeholder="ABC234" /></label>
          <button type="submit" disabled={busy || account.loading}>JOIN ROOM</button>
        </form>
      </>}
      <button className="lobby-back" onClick={close}>{connected ? 'LEAVE ROOM' : busy ? 'CANCEL / BACK' : 'BACK'}</button>
    </section>
  </div>
}
