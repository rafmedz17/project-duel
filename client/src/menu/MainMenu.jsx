import {useEffect,useRef} from 'react'
import {CINEMATIC_SHOTS,menuCinema} from './cinematic.js'
import './menu.css'

function MenuIcon({name}) {
  const paths={settings:'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8M10 2h4l.6 3 2.4 1 2.6-1.6 2 3.5-2.1 2.1v3l2.1 2.1-2 3.5L17 17l-2.4 1L14 21h-4l-.6-3L7 17l-2.6 1.6-2-3.5L4.5 13v-3L2.4 7.9l2-3.5L7 6l2.4-1Z',leaderboard:'M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 5 4M17 5h4v3a4 4 0 0 1-5 4M12 14v5M8 21h8M9 19h6',profile:'M12 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8M4 21v-3a6 6 0 0 1 6-5h4a6 6 0 0 1 6 5v3ZM3 9V3h4M17 3h4v6',arrow:'M5 12h14M13 6l6 6-6 6',play:'M8 5l11 7-11 7Z',pause:'M8 5v14M16 5v14',training:'M12 3v4M12 17v4M3 12h4M17 12h4M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10',loadout:'M3 7l9-4 9 4-9 4ZM3 12l9 4 9-4M3 17l9 4 9-4'}
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>
}

export default function MainMenu({onPanel,onTraining,accountLoading,multiplayerButton,paused,onToggleMotion}) {
  const root=useRef(),title=useRef(),subtitle=useRef(),number=useRef(),progress=useRef(),curtain=useRef(),bars=useRef([])
  useEffect(()=>{
    let frame,lastShot=-1,lastProgress=-1,lastFade=-1
    const update=()=>{
      if(lastShot!==menuCinema.shot) {
        const shot=CINEMATIC_SHOTS[menuCinema.shot]
        root.current.style.setProperty('--scene-accent',shot.accent)
        root.current.dataset.scene=shot.mapId
        title.current.textContent=shot.title;subtitle.current.textContent=shot.subtitle
        number.current.textContent=`0${menuCinema.shot+1} / 04`
        bars.current.forEach((bar,i)=>{if(bar) bar.dataset.active=String(i===menuCinema.shot)})
        lastShot=menuCinema.shot
      }
      if(lastProgress!==menuCinema.progress) {progress.current.style.width=`${menuCinema.progress*100}%`;lastProgress=menuCinema.progress}
      if(lastFade!==menuCinema.fade) {curtain.current.style.opacity=String(menuCinema.fade);lastFade=menuCinema.fade}
      frame=requestAnimationFrame(update)
    }
    update();return ()=>cancelAnimationFrame(frame)
  },[])
  return <div ref={root} className="duel-menu" data-testid="main-menu">
    <div ref={curtain} className="menu-cinematic-curtain" aria-hidden="true"/>
    <div className="menu-vignette" aria-hidden="true"/><div className="menu-film-grain" aria-hidden="true"/>
    <header className="duel-menu-header"><a href="#" className="duel-wordmark" onClick={event=>{event.preventDefault();onPanel(null)}} aria-label="Project Duel home"><span className="duel-emblem">P<span/></span><h1><small>PROJECT</small>DUEL<span className="wordmark-dot">.</span></h1></a>
      <nav className="menu-utilities" aria-label="Player menu">{[['settings','SETTINGS'],['leaderboard','LEADERBOARD'],['profile','PROFILE']].map(([id,label])=><button type="button" key={id} onClick={()=>onPanel(id)} aria-label={id==='profile' ? 'PLAYER PROFILE' : label}><span className="utility-icon"><MenuIcon name={id}/></span><span>{label}</span></button>)}</nav>
    </header>
    <div className="menu-topline"><span><i/>PRIVATE ARENAS. REAL RIVALRIES.</span><span>PROJECT DUEL / COMBAT PROGRAM</span></div>
    <section className="menu-cinematic-caption" aria-label="Cinematic map tour"><div className="cinema-eyebrow"><span>IN-ENGINE SHOWCASE</span><span ref={number}>01 / 04</span></div><h2 ref={title}>THE FACILITY</h2><p ref={subtitle}>CLEAN LANES. PURE COMPETITION.</p><div className="cinema-chapters" aria-hidden="true">{CINEMATIC_SHOTS.map((shot,i)=><span ref={node=>{bars.current[i]=node}} key={shot.mapId}><i/></span>)}</div><div className="cinema-controls"><button type="button" className="cinema-toggle" onClick={onToggleMotion} aria-label={paused ? 'Play cinematic background' : 'Pause cinematic background'} aria-pressed={paused}><MenuIcon name={paused ? 'play' : 'pause'}/>{paused ? 'PLAY CINEMATIC' : 'CINEMATIC ON'}</button><span className="menu-track"><i/><i/><i/><i/>LIMIT BREAK <small>MENU THEME</small></span></div></section>
    <nav className="menu-play-actions" aria-label="Main menu"><div className="play-actions-heading"><span>FIND YOUR NEXT FIGHT</span><span>01—03</span></div>
      <button type="button" className="menu-action menu-training" disabled={accountLoading} onClick={onTraining} aria-label="ENTER TRAINING / TRAINING GROUNDS"><MenuIcon name="training"/><span><small>SHARPEN YOUR EDGE</small><strong>TRAINING GROUNDS</strong></span><MenuIcon name="arrow"/></button>
      <button type="button" ref={multiplayerButton} className="menu-action menu-multiplayer" onClick={()=>onPanel('multiplayer')} aria-label="MULTIPLAYER / PLAY WITH FRIENDS"><span className="multiplayer-sigil" aria-hidden="true">Ⅱ</span><span><small>INVITE. READY UP. DUEL.</small><strong>PLAY MULTIPLAYER</strong><em>PRIVATE LOBBIES / BEST OF THREE + FREE PLAY</em></span><MenuIcon name="arrow"/></button>
      <button type="button" className="menu-action menu-loadout" onClick={()=>onPanel('loadout')} aria-label="CHARACTER & LOADOUT / EQUIPMENT"><MenuIcon name="loadout"/><span><small>YOUR OPERATIVE. YOUR ARSENAL.</small><strong>LOADOUTS</strong></span><MenuIcon name="arrow"/></button>
    </nav>
    <footer className="duel-menu-footer"><span>PROJECT DUEL <b>/</b> RAFAEL VINCENT D. MEDINA</span><span>DESKTOP <b>/</b> KEYBOARD + MOUSE</span><span>BUILT FOR THE CLUTCH <i/></span></footer>
    <div className="menu-reel-progress" aria-hidden="true"><i ref={progress}/></div>
  </div>
}
