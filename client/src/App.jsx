import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { game, useGame } from './game/store.js'
import Hud from './game/hud/Hud.jsx'
import Lobby from './multiplayer/Lobby.jsx'
import { lobby, useLobby } from './multiplayer/lobby.js'
import OnlineOverlay from './multiplayer/OnlineOverlay.jsx'
import AccountPanel from './accounts/AccountPanel.jsx'
import { accounts, useAccount } from './accounts/store.js'
import { useGameAudio } from './audio/useGameAudio.js'
import { audio } from './audio/synth.js'
import './App.css'

const World = lazy(() => import('./game/World.jsx'))

const controls = [['W A S D','Move'],['MOUSE','Look around'],['LEFT CLICK','Fire / swing equipped weapon'],['HOLD LEFT CLICK','Automatic weapon fire'],['HOLD RIGHT CLICK','Sniper scope'],['T','Inspect weapon'],['1 / 2 / 3','Primary / Pistol / Melee'],['Q','Cycle weapons'],['E','Dash toward movement / aim'],['F','Energy Shield'],['C','Equipped unique skill'],['X','Character ultimate / 5 seconds'],['SPACE','Jump'],['SHIFT','Sprint'],['R','Reload equipped firearm'],['ESC','Pause / release mouse']]
function Settings() {
  const settings = useGame(s => s.settings)
  const [audioNotice,setAudioNotice] = useState('')
  return <div className="settings">
    <label>Mouse sensitivity <span>{settings.sensitivity.toFixed(1)}×</span><input type="range" min="0.2" max="3" step="0.1" value={settings.sensitivity} onChange={e => game.settings({ sensitivity:Number(e.target.value) })} /></label>
    <label>Render quality<select value={settings.quality} onChange={e => game.settings({ quality:e.target.value })}>{['Low','Medium','High'].map(q => <option key={q}>{q}</option>)}</select></label>
    <label className="check">Show FPS counter<input type="checkbox" checked={settings.fps} onChange={e => game.settings({ fps:e.target.checked })} /></label>
    <label>Sound volume <span>{Math.round(settings.volume*100)}%</span><input type="range" min="0" max="100" step="1" value={Math.round(settings.volume*100)} onChange={e => { game.settings({ volume:Number(e.target.value)/100 }); setAudioNotice('') }} /></label>
    <label className="check">Mute sound<input type="checkbox" checked={settings.muted} onChange={e => { game.settings({ muted:e.target.checked }); setAudioNotice('') }} /></label>
    <button disabled={settings.muted || settings.volume===0} onClick={async () => setAudioNotice(await audio.preview() ? 'Audio test played.' : 'Audio is unavailable or blocked by this browser.')}>TEST AUDIO</button>
    {audioNotice && <p role="status">{audioNotice}</p>}
    <p className="muted">Settings are saved on this device. Low quality reduces resolution and lighting. Use headphones for directional opponent sounds.</p>
  </div>
}
export default function App() {
  useGameAudio()
  const mode = useGame(s => s.mode), ready = useGame(s => s.ready), error = useGame(s => s.error)
  const s = { mode, ready, error, time:game.get().time }
  const [panel,setPanel] = useState(() => lobby.hasRecovery() ? 'multiplayer' : null)
  const recovery = useAccount(s => s.recovery)
  const accountLoading = useAccount(s => s.loading)
  useEffect(() => { void accounts.init() },[])
  useEffect(() => { void lobby.restore() },[])
  const multiplayerButton = useRef(null)
  const online = useLobby(s => Boolean(s.room?.arenaActive))
  const arenaEpoch = useLobby(s => s.room?.arenaEpoch || 0)
  const enter = () => { game.reset({ loadout:accounts.get().loadout }); game.set({ mode:'paused', error:'' }); setPanel(null) }
  const restart = () => enter()
  const resume = async () => {
    const canvas = document.querySelector('canvas')
    if (!canvas?.requestPointerLock) { game.set({ error:'This browser does not support mouse capture. Use desktop Chrome, Edge, or Firefox.' }); return }
    try { await canvas.requestPointerLock() } catch { game.set({ error:'Mouse capture was blocked. Click Resume to try again.' }) }
  }
  const menu = () => { document.exitPointerLock(); game.set({ mode:'menu', ready:false }); setPanel(null) }
  return <main>
    <Suspense fallback={<div className="engine-loading" role="status">LOADING COMBAT SYSTEMS…</div>}><World online={online} arenaEpoch={arenaEpoch} /></Suspense>
    {online ? <OnlineOverlay onLeave={() => { void lobby.leave(); setPanel(null) }} /> : <>
    {s.mode !== 'menu' && <Hud />}
    {s.mode === 'menu' ? <div className="menu-shell">
      <header><a className="brand" href="#" onClick={e => { e.preventDefault(); setPanel(null) }}><span className="brand-mark">D</span> DUEL<span className="brand-label">TRAINING PROGRAM</span></a><span className="build">PROTOTYPE 02 <i /> LOCAL SYSTEM ONLINE</span></header>
      <section className="menu-content"><div className="eyebrow"><span className="line" /> THE NEXT GENERATION OF COMBAT</div><h1>PROJECT<br /><span>DUEL</span><sup>™</sup></h1><p className="subtitle">FUTURE COMBAT SIMULATION</p><p className="intro">Precision is earned.<br />Enter the facility. Find your edge.</p>
        <nav aria-label="Main menu"><div className="training-modes"><button className="primary" disabled={accountLoading} onClick={() => enter()}><span>ENTER TRAINING</span><span>↗</span></button></div><div className="menu-links"><button onClick={() => setPanel('controls')}>⌘ &nbsp; CONTROLS</button><button onClick={() => setPanel('settings')}>⚙ &nbsp; SETTINGS</button></div><div className="future"><button ref={multiplayerButton} className="multiplayer-entry" onClick={() => setPanel('multiplayer')}>MULTIPLAYER<small>PRIVATE LOBBIES</small></button>{[['loadout','CHARACTER & LOADOUT'],['profile','PLAYER PROFILE'],['leaderboard','LEADERBOARD']].map(([id,label]) => <button key={id} onClick={() => setPanel(id)}>{label}<small>{id==='loadout' ? 'EQUIPMENT' : id==='profile' ? 'ACCOUNT + HISTORY' : 'RANKED STANDINGS'}</small></button>)}</div></nav>
      </section>
      <aside className="sector-card"><div className="eyebrow">01 / TRAINING ENVIRONMENT</div><h2>THE FACILITY</h2><p>Sharpen your aim in a controlled combat space.</p><div><span>SECTOR 01</span><span>40 × 40 M</span><span>4 TARGETS</span></div></aside>
      <footer><span>PROJECT DUEL © 2026</span><span>PRIVATE LOBBIES · COMBAT TRAINING</span><span>DESKTOP / KEYBOARD + MOUSE</span></footer>
    </div> : s.mode !== 'playing' && <div className="overlay"><section className="dialog"><div className="eyebrow">PROJECT DUEL / SECTOR 01</div><h2>{s.mode === 'dead' ? 'SYSTEM OFFLINE' : s.time > 0 ? 'SIMULATION PAUSED' : 'READY TO DEPLOY'}</h2><p>{s.mode === 'dead' ? 'Your health is depleted. Restart to deploy again.' : 'Capture your mouse to enter the facility. Press Escape to pause.'}</p>{s.error && <p role="alert" className="error">{s.error}</p>}{s.mode !== 'dead' && <button className="primary" disabled={!s.ready} onClick={resume}>{s.ready ? 'RESUME / ENTER ARENA →' : 'INITIALIZING PHYSICS…'}</button>}<button onClick={restart}>RESTART TRAINING</button><button onClick={() => setPanel('controls')}>CONTROLS</button><button onClick={() => setPanel('settings')}>SETTINGS</button><button onClick={menu}>RETURN TO MAIN MENU</button><p className="muted">{'Amber floor pads are training hazards. Aim for robot heads for bonus damage; feet take reduced damage.'}</p></section></div>}
    </>}
    {recovery || ['profile','loadout','leaderboard'].includes(panel) ? <AccountPanel key={panel || 'recovery'} initial={panel || 'profile'} onShowProfile={() => setPanel('profile')} onClose={() => setPanel(null)} /> : panel === 'multiplayer' ? <Lobby returnFocusRef={multiplayerButton} onClose={() => setPanel(null)} /> : panel && <div className="overlay modal"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="panel-title"><div className="eyebrow">SIMULATION CONFIGURATION</div><h2 id="panel-title">{panel.toUpperCase()}</h2>{panel === 'settings' ? <Settings /> : <dl>{controls.map(([key,label]) => <div key={key}><dt>{key}</dt><dd>{label}</dd></div>)}</dl>}<button className="primary" autoFocus onClick={() => setPanel(null)}>BACK →</button></section></div>}
  </main>
}

