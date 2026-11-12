import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, MathUtils } from 'three'
import { ABILITIES, TARGETS } from '../config.js'
import { game } from '../store.js'
import { runtime } from '../runtime.js'

export default function TacticalEffects() {
  const scan = useRef(), emp = useRef(), point = useRef(new Vector3())
  useFrame(({ camera,size },delta) => {
    const s = game.get(), time = game.now(), scanner = s.abilities.scanner, blast = s.abilities.emp
    camera.updateMatrixWorld()
    for (const [id,ref,ability,radius] of [['scanner',scan,scanner,ABILITIES.scanner.range],['emp',emp,blast,ABILITIES.emp.radius]]) {
      const progress = (time-ability.startedAt)/0.8
      ref.current.visible = progress >= 0 && progress < 1
      if (ref.current.visible) {
        ref.current.position.set(ability.origin[0],0.09,ability.origin[2])
        ref.current.scale.setScalar(Math.max(0.01,progress*radius))
        ref.current.material.opacity = (1-progress)*(id === 'emp' ? 0.8 : 0.5)
      }
    }
    const entities = [...TARGETS,runtime.opponent.position]
    entities.forEach(([x,y,z],index) => {
      const marker = runtime.scanMarkers[index]
      const distance = Math.hypot(x-camera.position.x,y-camera.position.y,z-camera.position.z)
      point.current.set(x,y+1.35,z).project(camera)
      const alive = index<TARGETS.length ? s.targets[index].hp>0 : s.opponent.enabled && s.opponent.hp>0
      marker.visible = time<scanner.activeUntil && alive && distance<=ABILITIES.scanner.range && Math.abs(point.current.x)<1 && Math.abs(point.current.y)<1 && Math.abs(point.current.z)<1
      marker.x = (point.current.x*0.5+0.5)*size.width
      marker.y = (-point.current.y*0.5+0.5)*size.height
      marker.distance = Math.round(distance)
    })
    const dashing = time<s.abilities.dash.activeUntil
    const fov = MathUtils.damp(camera.fov,dashing ? 77 : 70,12,Math.min(delta,0.1))
    if (Math.abs(camera.fov-fov)>0.001) { camera.fov = fov; camera.updateProjectionMatrix() }
  },-0.5)
  return <>
    <mesh ref={scan} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.98,1,64]} /><meshBasicMaterial color="#39e9ff" transparent opacity={0.5} depthWrite={false} /></mesh>
    <mesh ref={emp} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.93,1,48]} /><meshBasicMaterial color="#b48aff" transparent opacity={0.8} depthWrite={false} /></mesh>
  </>
}
