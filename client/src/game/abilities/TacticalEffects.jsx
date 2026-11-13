import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, MathUtils } from 'three'
import TacticalVisual from './TacticalVisual.jsx'
import { WEAPONS } from '../../../../shared/weapons.js'
import { targetPosition } from '../training/config.js'
import { targetEnabled } from '../training/rules.js'
import { game } from '../store.js'
import { runtime } from '../runtime.js'

export default function TacticalEffects() {
  const point = useRef(new Vector3())
  useFrame(({ camera,size },delta) => {
    const s = game.get(), time = game.now(), scanner = s.abilities.scanner
    camera.updateMatrixWorld()
    const entities = [...s.targets.map((target,index)=>targetPosition(index,target)),runtime.opponent.position]
    entities.forEach(([x,y,z],index) => {
      const marker = runtime.scanMarkers[index]
      const distance = Math.hypot(x-camera.position.x,y-camera.position.y,z-camera.position.z)
      point.current.set(x,y+1.35,z).project(camera)
      const alive = index<s.targets.length ? s.targets[index].hp>0 && targetEnabled(index,s.training) : s.opponent.enabled && s.opponent.hp>0
      marker.visible = time<scanner.activeUntil && alive && Math.abs(point.current.x)<1 && Math.abs(point.current.y)<1 && Math.abs(point.current.z)<1
      marker.x = (point.current.x*0.5+0.5)*size.width
      marker.y = (-point.current.y*0.5+0.5)*size.height
      marker.distance = Math.round(distance)
    })
    const dashing = time<s.abilities.dash.activeUntil
    const fov = MathUtils.damp(camera.fov,game.get().aiming && WEAPONS[s.weapon].scope ? 32 : dashing ? 77 : 70,12,Math.min(delta,0.1))
    if (Math.abs(camera.fov-fov)>0.001) { camera.fov = fov; camera.updateProjectionMatrix() }
  },-0.5)
  return <TacticalVisual read={() => ({ state:game.get(),time:game.now(),position:runtime.position,local:true })} />
}
