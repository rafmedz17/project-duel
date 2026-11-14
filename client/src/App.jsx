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
import MainMenu from './menu/MainMenu.jsx'
import FullscreenNotice from './menu/FullscreenNotice.jsx'
import './App.css'

const World = lazy(() => import('./game/World.jsx'))

export default function App() {
  const mode = useGame(s => s.mode), ready = useGame(s => s.ready), error = useGame(s => s.error)
  const s = { mode, ready, error, time:game.get().time }
  const [panel,setPanel] = useState(() => lobby.hasRecovery() ? 'multiplayer' : null)
  const [showFullscreenNotice,setShowFullscreenNotice]=useState(true)
  const [reducedMotion,setReducedMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [pageVisible,setPageVisible]=useState(()=>!document.hidden)
  useEffect(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReducedMotion(motion.matches),visibility=()=>setPageVisible(!document.hidden)
    motion.addEventListener('change',change);document.addEventListener('visibilitychange',visibility)
    return ()=>{motion.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility)}
  },[])
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
  return <main className={mode==='menu' && !online ? 'main-menu-screen' : undefined}>
    <RoomScoreboard/>
    <Suspense fallback={<div className="engine-loading" role="status">LOADING COMBAT SYSTEMS…</div>}><World online={online} arenaEpoch={arenaEpoch} menuAnimated={!showFullscreenNotice && !reducedMotion && pageVisible && !panel && !recovery}/></Suspense>
    {online ? <OnlineOverlay onSettings={() => setPanel('settings')} onLeave={() => { void lobby.leave(); setPanel(null) }} /> : <>
    {s.mode !== 'menu' && <Hud />}
    {s.mode === 'menu' ? <MainMenu onPanel={setPanel} onTraining={enter} accountLoading={accountLoading} multiplayerButton={multiplayerButton}/> : s.mode !== 'playing' && s.mode !== 'loadout' && <div className="overlay"><section className="dialog"><div className="eyebrow">PROJECT DUEL / SECTOR 01</div><h2>{s.mode === 'dead' ? 'SYSTEM OFFLINE' : s.time > 0 ? 'SIMULATION PAUSED' : 'READY TO DEPLOY'}</h2><p>{s.mode === 'dead' ? 'Your health is depleted. Restart to deploy again.' : 'Capture your mouse to enter the facility. Press Escape to pause.'}</p>{s.error && <p role="alert" className="error">{s.error}</p>}{s.mode !== 'dead' && <button className="primary" disabled={!s.ready} onClick={resume}>{s.ready ? 'RESUME / ENTER ARENA →' : 'INITIALIZING PHYSICS…'}</button>}<button onClick={restart}>RESTART TRAINING</button><button onClick={() => setPanel('settings')}>SETTINGS</button><button onClick={menu}>RETURN TO MAIN MENU</button><p className="muted">{'Four courses surround the central hub. G controls the current course. B opens the field armory. Aim for robot heads for bonus damage.'}</p></section></div>}
    </>}
    {panel==='training-loadout' ? <TrainingArmory onClose={closeArmory}/> : recovery || ['profile','loadout','leaderboard'].includes(panel) ? <AccountPanel key={panel || 'recovery'} initial={panel || 'profile'} onShowProfile={() => setPanel('profile')} onClose={() => setPanel(null)} /> : panel === 'multiplayer' ? <Lobby returnFocusRef={multiplayerButton} onClose={() => setPanel(null)} /> : panel==='settings' ? <Settings onClose={() => setPanel(null)}/> : null}
    {showFullscreenNotice && <FullscreenNotice onDismiss={()=>setShowFullscreenNotice(false)}/>}
  </main>
}

