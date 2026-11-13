import { Component, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import Arena from './Arena.jsx'
import Player from './Player.jsx'
import { useGame } from './store.js'
import OnlinePlayers from '../multiplayer/OnlinePlayers.jsx'
import { useLobby } from '../multiplayer/lobby.js'
import BulletTrails from './effects/BulletTrails.jsx'
import MenuCinematic from '../menu/MenuCinematic.jsx'

class RenderBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return <div className="render-error" role="alert">The 3D engine could not start. Enable hardware acceleration and WebGL, then reload.<br />{this.state.error.message}</div>
    return this.props.children
  }
}
export default function World({ online = false, arenaEpoch = 0,menuAnimated=false }) {
  const settings = useGame(s => s.settings)
  const mode = useGame(s => s.mode)
  const generation = useGame(s => s.generation)
  const mapId = useLobby(s => s.room?.mapId || 'facility')
  const dpr = { Low: 1, Medium: 1.25, High: 1.75 }[settings.quality]
  const menu=!online && mode==='menu'
  return <RenderBoundary><Canvas frameloop={online || mode==='playing' || (menu && menuAnimated) ? 'always' : 'demand'} dpr={[1,dpr]} camera={{ position:[10,4.8,14], fov:70, near:0.05, far:130 }} gl={{ antialias:settings.quality!=='Low', powerPreference:'high-performance' }}>
    <Suspense fallback={null}>
      {menu ? <MenuCinematic running={menuAnimated} quality={settings.quality}/> : <Physics timeStep={1/60} paused={online || mode !== 'playing'}>
        <Arena key={online ? mapId : 'facility'} training={!online} mapId={online ? mapId : 'facility'} />
        {online && <OnlinePlayers key={arenaEpoch} />}
        {!online && mode !== 'menu' && <Player key={generation} />}
      </Physics>}
      {!menu && <BulletTrails online={online} />}
    </Suspense>
  </Canvas></RenderBoundary>
}

