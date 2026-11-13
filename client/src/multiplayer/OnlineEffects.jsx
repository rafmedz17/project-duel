import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { aimFov } from '../game/weapons/optics.js'
import { game } from '../game/store.js'
import TacticalVisual from '../game/abilities/TacticalVisual.jsx'
import { lobby, useLobby } from './lobby.js'
import { arenaView, latestPose, samplePose } from './poses.js'

export default function OnlineEffects() {
  const players = useLobby(s => s.room?.players), id = useLobby(s => s.sessionId)
  const point = useRef(new Vector3())
  useFrame(({ camera,size },delta) => {
    const s = lobby.self(), state = lobby.get()
    if (!s || !state.room?.arenaActive) { arenaView.scanMarker = { visible:false }; return }
    const time = state.room.time
    const other = state.room.players.find(player => player.id!==id), pose = other && samplePose(other.id), selfPose = latestPose(id)
    let marker = { visible:false }
    if (pose && selfPose && s.hp>0 && other.combat.hp>0 && state.status==='connected' && state.room.phase==='arena' && time>=s.disabledUntil && time<s.abilities.scanner.activeUntil) {
      const distance = Math.hypot(pose.x-selfPose.x,pose.y-selfPose.y,pose.z-selfPose.z)
      camera.updateMatrixWorld()
      point.current.set(pose.x,pose.y+0.95,pose.z).project(camera)
      marker = { visible:Math.abs(point.current.x)<1 && Math.abs(point.current.y)<1 && Math.abs(point.current.z)<1,x:(point.current.x*0.5+0.5)*size.width,y:(-point.current.y*0.5+0.5)*size.height,distance:Math.round(distance) }
    }
    arenaView.scanMarker = marker
    const dashing = time<s.abilities.dash.activeUntil && time>=s.disabledUntil && s.hp>0
    const fov = MathUtils.damp(camera.fov,aimFov(s,time,game.get().aiming,dashing),12,Math.min(delta,0.1))
    if (Math.abs(camera.fov-fov)>0.001) { camera.fov = fov; camera.updateProjectionMatrix() }
  },-0.5)
  return players.map(player => <TacticalVisual key={player.id} read={() => {
    const pose = player.id===id ? latestPose(id) : samplePose(player.id)
    return pose ? { state:player.combat,time:lobby.get().room.time,position:[pose.x,pose.y,pose.z],local:player.id===id } : null
  }} />)
}
