import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Object3D,Vector3,Color,AdditiveBlending,DynamicDrawUsage } from 'three'
import { WEAPONS } from '../../../../shared/weapons.js'
import { reflexProfile } from '../weapons/optics.js'
import { game } from '../store.js'
import { lobby } from '../../multiplayer/lobby.js'
import { takeShotTrails,trailScope } from './shotTrails.js'

const CAPACITY=192
export default function BulletTrails({ online=false }) {
  const cores=useRef(),halos=useRef(),work=useRef(null)
  useFrame((_,delta)=> {
    work.current ||= { scope:'',items:[],dummy:new Object3D(),up:new Vector3(0,1,0),direction:new Vector3(),color:new Color() }
    const w=work.current,local=game.get(),network=lobby.get(),scope=online ? trailScope(network.room) : `training:${local.generation}`
    const active=online ? network.status==='connected' && network.room?.phase==='arena' && network.captured : local.mode==='playing'
    if(w.scope!==scope || !active) { w.items=[];w.scope=scope }
    const incoming=takeShotTrails(scope)
    if(active) for(const event of incoming) {
      const weapon=WEAPONS[event.weapon]
      if(!weapon || weapon.fireMode==='melee') continue
      const self=online ? event.id===network.sessionId : event.id==='self',scoped=self && local.aiming && (weapon.scope || reflexProfile(weapon))
      for(const end of event.ends) {
        const start=new Vector3(...event.origin),destination=new Vector3(...end),direction=destination.clone().sub(start),distance=direction.length()
        if(distance<0.02) continue
        direction.normalize()
        const right=new Vector3(-direction.z,0,direction.x).normalize(),offset=Math.min(1,distance/1.2)
        start.addScaledVector(right,(scoped ? 0.025 : self ? 0.25 : 0.18)*offset)
        start.y-=(scoped ? 0.02 : self ? 0.21 : 0.15)*offset
        start.addScaledVector(direction,Math.min(0.4,distance*0.1))
        const length=start.distanceTo(destination)
        w.items.push({ start,direction:destination.clone().sub(start).normalize(),length,age:0,color:weapon.color,width:weapon.scope ? 0.012 : weapon.pellets ? 0.004 : 0.006,life:0.18+length/1800 })
      }
    }
    w.items=w.items.filter(p=>p.age<p.life).slice(-CAPACITY)
    if(!cores.current || !halos.current) return
    let count=0
    for(const p of w.items) {
      // Show the leading streak on its first frame, even after a slow frame.
      // Advancing age first can otherwise skip the entire visible flight.
      const travel=p.length*Math.min(1,p.age/(p.life*0.65)),head=Math.min(p.length,travel+6),tail=Math.max(0,travel-14)
      const fade=Math.min(1,(p.life-p.age)/0.07)
      w.dummy.position.copy(p.start).addScaledVector(p.direction,(head+tail)/2)
      w.dummy.quaternion.setFromUnitVectors(w.up,p.direction)
      w.color.set(p.color).multiplyScalar(Math.max(0,fade))
      for(const [mesh,width] of [[cores.current,p.width],[halos.current,p.width*4]]) {
        w.dummy.scale.set(width,Math.max(0.02,head-tail),width);w.dummy.updateMatrix()
        mesh.setMatrixAt(count,w.dummy.matrix);mesh.setColorAt(count,w.color)
      }
      count++
      p.age+=Math.min(delta,0.05)
    }
    for(const mesh of [cores.current,halos.current]) {
      mesh.count=count;mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.instanceMatrix.needsUpdate=true
      if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true
    }
  },0)
  return <group name="bullet-trails">
    <instancedMesh ref={cores} args={[null,null,CAPACITY]} frustumCulled={false} raycast={()=>null} name="bullet-trail-cores"><cylinderGeometry args={[1,1,1,4]}/><meshBasicMaterial transparent opacity={0.9} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/></instancedMesh>
    <instancedMesh ref={halos} args={[null,null,CAPACITY]} frustumCulled={false} raycast={()=>null} name="bullet-trail-halos"><cylinderGeometry args={[1,1,1,4]}/><meshBasicMaterial transparent opacity={0.16} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/></instancedMesh>
  </group>
}
