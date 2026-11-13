import { lazy, Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { game, useGame } from './game/store.js'
import Hud from './game/hud/Hud.jsx'
import Lobby from './multiplayer/Lobby.jsx'
import { lobby, useLobby } from './multiplayer/lobby.js'
import OnlineOverlay from './multiplayer/OnlineOverlay.jsx'
import AccountPanel from './accounts/AccountPanel.jsx'
import { accounts, useAccount } from './accounts/store.js'
import { useGameAudio } from './audio/useGameAudio.js'
import Settings from './settings/Settings.jsx'
import { canonicalCode } from './settings/preferences.js'
import TrainingArmory from './game/training/TrainingArmory.jsx'
import RoomScoreboard from './multiplayer/RoomScoreboard.jsx'
import './App.css'

const World = lazy(() => import('./game/World.jsx'))

export default function App() {
  const mode = useGame(s => s.mode), ready = useGame(s => s.ready), error = useGame(s => s.error)
  const s = { mode, ready, error, time:game.get().time }
  const [panel,setPanel] = useState(() => lobby.hasRecovery() ? 'multiplayer' : null)
  const recovery = useAccount(s => s.recovery)
  useGameAudio(panel!=='multiplayer' && !recovery)
  const accountLoading = useAccount(s => s.loading)
  useEffect(() => { void accounts.init() },[])
  useEffect(() => { void lobby.restore() },[])
  const multiplayerButton = useRef(null)
  const online = useLobby(s => Boolean(s.room?.arenaActive))
  const arenaEpoch = useLobby(s => s.room?.arenaEpoch || 0)
  const enter = () => { game.reset({ loadout:accounts.get().loadout,bank:accounts.get().bank }); game.set({ mode:'paused', error:'' }); setPanel(null) }
  const restart = () => { game.reset({ loadout:game.get().loadout,bank:game.get().trainingBank });game.set({ mode:'paused',error:'' });setPanel(null) }
  const resume = useCallback(async () => {
    const canvas = document.querySelector('canvas')
    if (!canvas?.requestPointerLock) { game.set({ error:'This browser does not support mouse capture. Use desktop Chrome, Edge, or Firefox.' }); return }
    try { await canvas.requestPointerLock() } catch { game.set({ error:'Mouse capture was blocked. Click Resume to try again.' }) }
  },[])
  const closeArmory=useCallback((capture=false)=> { setPanel(null);game.set({ mode:'paused' });if(capture) void resume() },[resume])
  useEffect(()=> {
    const key=event=> {
      if(canonicalCode(event,game.get().settings)!=='KeyB' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || online || event.target.closest?.('input,textarea,select,[contenteditable="true"]')) return
      if(event.type==='mousedown' && document.pointerLockElement!==document.querySelector('canvas')) return
      if(panel==='training-loadout') { event.preventDefault();if(!accounts.get().busy) closeArmory(true);return }
      if(panel || !['playing','paused'].includes(game.get().mode) || !game.get().ready) return
      event.preventDefault();game.cancelAttack();game.set({ mode:'loadout',aiming:false });document.exitPointerLock();setPanel('training-loadout')
    }
    document.addEventListener('keydown',key);document.addEventListener('mousedown',key)
    return ()=> { document.removeEventListener('keydown',key);document.removeEventListener('mousedown',key) }
  },[online,panel,closeArmory])
  const menu = () => { document.exitPointerLock(); game.set({ mode:'menu', ready:false }); setPanel(null) }
  return <main>
    <RoomScoreboard/>
    <Suspense fallback={<div className="engine-loading" role="status">LOADING COMBAT SYSTEMS…</div>}><World online={online} arenaEpoch={arenaEpoch} /></Suspense>
    {online ? <OnlineOverlay onSettings={() => setPanel('settings')} onLeave={() => { void lobby.leave(); setPanel(null) }} /> : <>
    {s.mode !== 'menu' && <Hud />}
    {s.mode === 'menu' ? <div className="menu-shell">
      <header><a className="brand" href="#" onClick={e => { e.preventDefault(); setPanel(null) }}><span className="brand-mark">D</span> DUEL<span className="brand-label">TRAINING PROGRAM</span></a><span className="build">PROTOTYPE 02 <i /> LOCAL SYSTEM ONLINE</span></header>
      <section className="menu-content"><div className="eyebrow"><span className="line" /> THE NEXT GENERATION OF COMBAT</div><h1>PROJECT<br /><span>DUEL</span><sup>™</sup></h1><p className="subtitle">FUTURE COMBAT SIMULATION</p><p className="intro">Precision is earned.<br />Enter the facility. Find your edge.</p>
        <nav aria-label="Main menu"><div className="training-modes"><button className="primary" disabled={accountLoading} onClick={() => enter()}><span>ENTER TRAINING</span><span>↗</span></button></div><div className="menu-links"><button onClick={() => setPanel('settings')}>⚙ &nbsp; SETTINGS</button></div><div className="future"><button ref={multiplayerButton} className="multiplayer-entry" onClick={() => setPanel('multiplayer')}>MULTIPLAYER<small>PRIVATE LOBBIES</small></button>{[['loadout','CHARACTER & LOADOUT'],['profile','PLAYER PROFILE'],['leaderboard','LEADERBOARD']].map(([id,label]) => <button key={id} onClick={() => setPanel(id)}>{label}<small>{id==='loadout' ? 'EQUIPMENT' : id==='profile' ? 'ACCOUNT + HISTORY' : 'RANKED STANDINGS'}</small></button>)}</div></nav>
      </section>
      <aside className="sector-card"><div className="eyebrow">01 / TRAINING ENVIRONMENT</div><h2>THE FACILITY</h2><p>Sharpen your aim in a controlled combat space.</p><div><span>SECTOR 01</span><span>4 COURSES</span><span>21 ROBOTS + REFLEX LAB</span></div></aside>
      <footer><span>PROJECT DUEL 2026 © RAFAEL VINCENT D. MEDINA</span><span>PRIVATE LOBBIES · COMBAT TRAINING</span><span>DESKTOP / KEYBOARD + MOUSE</span></footer>
    </div> : s.mode !== 'playing' && s.mode !== 'loadout' && <div className="overlay"><section className="dialog"><div className="eyebrow">PROJECT DUEL / SECTOR 01</div><h2>{s.mode === 'dead' ? 'SYSTEM OFFLINE' : s.time > 0 ? 'SIMULATION PAUSED' : 'READY TO DEPLOY'}</h2><p>{s.mode === 'dead' ? 'Your health is depleted. Restart to deploy again.' : 'Capture your mouse to enter the facility. Press Escape to pause.'}</p>{s.error && <p role="alert" className="error">{s.error}</p>}{s.mode !== 'dead' && <button className="primary" disabled={!s.ready} onClick={resume}>{s.ready ? 'RESUME / ENTER ARENA →' : 'INITIALIZING PHYSICS…'}</button>}<button onClick={restart}>RESTART TRAINING</button><button onClick={() => setPanel('settings')}>SETTINGS</button><button onClick={menu}>RETURN TO MAIN MENU</button><p className="muted">{'Four courses surround the central hub. G controls the current course. B opens the field armory. Aim for robot heads for bonus damage.'}</p></section></div>}
    </>}
    {panel==='training-loadout' ? <TrainingArmory onClose={closeArmory}/> : recovery || ['profile','loadout','leaderboard'].includes(panel) ? <AccountPanel key={panel || 'recovery'} initial={panel || 'profile'} onShowProfile={() => setPanel('profile')} onClose={() => setPanel(null)} /> : panel === 'multiplayer' ? <Lobby returnFocusRef={multiplayerButton} onClose={() => setPanel(null)} /> : panel==='settings' ? <Settings onClose={() => setPanel(null)}/> : null}
  </main>
}

