import { Component, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import Arena from './Arena.jsx'
import Player from './Player.jsx'
import { game, useGame } from './store.js'
import OnlinePlayers from '../multiplayer/OnlinePlayers.jsx'
import { useLobby } from '../multiplayer/lobby.js'
import BulletTrails from './effects/BulletTrails.jsx'

class RenderBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return <div className="render-error" role="alert">The 3D engine could not start. Enable hardware acceleration and WebGL, then reload.<br />{this.state.error.message}</div>
    return this.props.children
  }
}
function PreviewCamera() {
  useFrame(({ camera }) => {
    if (game.get().mode === 'menu') { camera.position.set(25,20,30); camera.lookAt(0,0,-3) }
  })
  return null
}
export default function World({ online = false, arenaEpoch = 0 }) {
  const settings = useGame(s => s.settings)
  const mode = useGame(s => s.mode)
  const generation = useGame(s => s.generation)
  const captured = useLobby(s => s.captured)
  const mapId = useLobby(s => s.room?.mapId || 'facility')
  const dpr = { Low: 1, Medium: 1.25, High: 1.75 }[settings.quality]
  return <RenderBoundary><Canvas frameloop={online ? captured ? 'always' : 'demand' : mode === 'playing' ? 'always' : 'demand'} dpr={[1,dpr]} camera={{ position:[27,22,30], fov:70, near:0.05, far:130 }} gl={{ antialias:settings.quality!=='Low', powerPreference:'high-performance' }}>
    <Suspense fallback={null}>
      {!online && <PreviewCamera />}
      <Physics timeStep={1/60} paused={online || mode !== 'playing'}>
        <Arena key={online ? mapId : 'facility'} training={!online} mapId={online ? mapId : 'facility'} />
        {online && <OnlinePlayers key={arenaEpoch} />}
        {!online && mode !== 'menu' && <Player key={generation} />}
      </Physics>
      <BulletTrails online={online} />
    </Suspense>
  </Canvas></RenderBoundary>
}

