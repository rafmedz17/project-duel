import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { ABILITIES } from '../../../shared/abilities.js'
import { lobby, useLobby } from './lobby.js'
import { arenaView, latestPose, samplePose } from './poses.js'

function PlayerEffects({ player, local }) {
  const shield = useRef(), trail = useRef(), scan = useRef(), emp = useRef()
  useFrame(() => {
    const { room } = lobby.get(), s = player.combat
    if (!room?.arenaActive) return
    const time = room.time
    const pose = local ? latestPose(player.id) : samplePose(player.id)
    if (!pose) return
    shield.current.visible = !local && s.hp>0 && s.shieldCharge>0 && time<s.abilities.shield.activeUntil
    shield.current.position.set(pose.x,pose.y,pose.z)
    shield.current.material.opacity = time-s.shieldHit<0.2 ? 0.55 : 0.16
    const dash = s.abilities.dash
    trail.current.visible = !local && s.hp>0 && time<dash.activeUntil
    trail.current.position.set(pose.x-dash.direction[0]*0.7,pose.y,pose.z-dash.direction[1]*0.7)
    trail.current.rotation.y = Math.atan2(dash.direction[0],dash.direction[1])
    for (const [ref,id,radius] of [[scan,'scanner',ABILITIES.scanner.range],[emp,'emp',ABILITIES.emp.radius]]) {
      const ability = s.abilities[id], progress = (time-ability.startedAt)/0.8
      ref.current.visible = s.hp>0 && time>=s.disabledUntil && progress>=0 && progress<1
      if (ref.current.visible) {
        ref.current.position.set(ability.origin[0],0.09,ability.origin[2])
        ref.current.scale.setScalar(Math.max(0.01,progress*radius))
        ref.current.material.opacity = (1-progress)*0.7
      }
    }
  })
  return <>
    <mesh ref={shield} name={`online-shield-${player.id}`} scale={[0.65,1,0.65]}><sphereGeometry args={[1,16,12]} /><meshBasicMaterial color="#60deff" wireframe transparent depthWrite={false} /></mesh>
    <mesh ref={trail} scale={[0.5,1.4,1.5]}><sphereGeometry args={[0.5,8,6]} /><meshBasicMaterial color="#58eeff" transparent opacity={0.2} depthWrite={false} /></mesh>
    <mesh ref={scan} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.98,1,64]} /><meshBasicMaterial color="#39e9ff" transparent depthWrite={false} /></mesh>
    <mesh ref={emp} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.93,1,48]} /><meshBasicMaterial color="#b48aff" transparent depthWrite={false} /></mesh>
  </>
}

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
      marker = { visible:distance<=ABILITIES.scanner.range && Math.abs(point.current.x)<1 && Math.abs(point.current.y)<1 && Math.abs(point.current.z)<1,x:(point.current.x*0.5+0.5)*size.width,y:(-point.current.y*0.5+0.5)*size.height,distance:Math.round(distance) }
    }
    arenaView.scanMarker = marker
    const dashing = time<s.abilities.dash.activeUntil && time>=s.disabledUntil && s.hp>0
    const fov = MathUtils.damp(camera.fov,dashing ? 77 : 70,12,Math.min(delta,0.1))
    if (Math.abs(camera.fov-fov)>0.001) { camera.fov = fov; camera.updateProjectionMatrix() }
  },-0.5)
  return players.map(player => <PlayerEffects key={player.id} player={player} local={id===player.id} />)
}
