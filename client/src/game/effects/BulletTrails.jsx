import {useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {Object3D,Vector3,Matrix4,Color,AdditiveBlending,DoubleSide,DynamicDrawUsage} from 'three'
import {WEAPONS} from '../../../../shared/weapons.js'
import {reflexProfile} from '../weapons/optics.js'
import {game} from '../store.js'
import {lobby} from '../../multiplayer/lobby.js'
import {takeShotTrails,trailScope} from './shotTrails.js'
import {tracerVertex,tracerFragment,tracerGlowFragment,tracerProfile} from './trailMaterials.js'

const CAPACITY=192,SPARK_CAPACITY=256,BUDGET=CAPACITY+SPARK_CAPACITY
const coreUniforms={halo:{value:0}},haloUniforms={halo:{value:1}}

// Face the camera with a soft ribbon instead of a thick polygonal tube.
function faceRibbon(w,camera,direction) {
  w.view.copy(camera.position).sub(w.dummy.position)
  w.side.crossVectors(direction,w.view)
  if(w.side.lengthSq()<1e-8) {
    w.side.setFromMatrixColumn(camera.matrixWorld,0)
    w.side.addScaledVector(direction,-w.side.dot(direction))
  }
  if(w.side.lengthSq()<1e-8) w.side.crossVectors(direction,w.normal.set(0,1,0))
  w.side.normalize();w.normal.crossVectors(w.side,direction).normalize()
  w.basis.makeBasis(w.side,direction,w.normal)
  w.dummy.quaternion.setFromRotationMatrix(w.basis)
}

export default function BulletTrails({online=false}) {
  const cores=useRef(),halos=useRef(),heads=useRef(),work=useRef(null)
  useFrame(({camera},delta)=>{
    work.current ||= {scope:'',items:[],sparks:[],dummy:new Object3D(),basis:new Matrix4(),view:new Vector3(),side:new Vector3(),normal:new Vector3(),color:new Color()}
    const w=work.current,local=game.get(),network=lobby.get(),scope=online ? trailScope(network.room) : `training:${local.generation}`
    // Multiplayer cosmetics finish without mouse capture, including winning shots.
    const active=online ? network.status==='connected' && network.room?.phase==='arena' : local.mode==='playing'
    if(w.scope!==scope || !active) {w.items=[];w.sparks=[];w.scope=scope}
    const incoming=takeShotTrails(scope)
    if(active) for(const event of incoming) {
      const weapon=WEAPONS[event.weapon]
      if(!weapon || weapon.fireMode==='melee') continue
      const profile=tracerProfile(weapon),self=online ? event.id===network.sessionId : event.id==='self'
      const scoped=self && local.aiming && (weapon.scope || reflexProfile(weapon))
      for(const [index,end] of event.ends.entries()) {
        const start=new Vector3(...event.origin),destination=new Vector3(...end),direction=destination.clone().sub(start),distance=direction.length()
        if(distance<0.02) continue
        direction.normalize()
        const right=new Vector3(-direction.z,0,direction.x).normalize(),offset=Math.min(1,distance/1.2)
        start.addScaledVector(right,(scoped ? 0.025 : self ? 0.25 : 0.18)*offset)
        start.y-=(scoped ? 0.02 : self ? 0.21 : 0.15)*offset
        start.addScaledVector(direction,Math.min(0.4,distance*0.1))
        const length=start.distanceTo(destination),flight=Math.max(0.065,Math.min(0.19,length/profile.speed))
        w.items.push({start,end:destination,direction:destination.clone().sub(start).normalize(),length,age:0,color:weapon.color,profile,flight,life:flight+0.09,impact:distance<weapon.range-0.25,burst:false,seed:event.shot+index*13})
      }
    }
    w.items=w.items.filter(p=>p.age<p.life).slice(-CAPACITY)
    if(!cores.current || !halos.current || !heads.current) return
    let count=0,headCount=0
    const streak=(direction,length,width,color,brightness)=>{
      faceRibbon(w,camera,direction)
      w.color.set(color).multiplyScalar(brightness)
      for(const [mesh,scale] of [[cores.current,1],[halos.current,4.5]]) {
        w.dummy.scale.set(width*scale,Math.max(0.005,length),1);w.dummy.updateMatrix()
        mesh.setMatrixAt(count,w.dummy.matrix);mesh.setColorAt(count,w.color)
      }
      count++
    }
    for(const p of w.items) {
      // Display the first flash before advancing time, including on slow frames.
      const initial=Math.min(p.length*0.35,p.profile.length*0.45)
      const travel=Math.min(1,p.age/p.flight),head=initial+(p.length-initial)*travel
      const fade=Math.max(0,1-Math.max(0,p.age-p.flight)/0.09)
      const tail=Math.max(0,head-p.profile.length*fade)
      w.dummy.position.copy(p.start).addScaledVector(p.direction,(head+tail)/2)
      streak(p.direction,head-tail,p.profile.width,p.color,fade)
      w.dummy.position.copy(p.start).addScaledVector(p.direction,head)
      w.dummy.quaternion.copy(camera.quaternion)
      w.dummy.scale.setScalar(p.profile.glow*(0.75+0.25*fade));w.dummy.updateMatrix()
      w.color.set(p.color).multiplyScalar(fade)
      heads.current.setMatrixAt(headCount,w.dummy.matrix);heads.current.setColorAt(headCount++,w.color)
      if(p.impact && !p.burst && p.age>=p.flight) {
        p.burst=true
        const amount=local.settings.quality==='Low' ? Math.min(2,p.profile.sparks) : p.profile.sparks
        for(let i=0;i<amount;i++) {
          const angle=p.seed*2.399+i*2.399,side=new Vector3(-p.direction.z,0,p.direction.x).normalize()
          const velocity=p.direction.clone().multiplyScalar(-1.3-(i%3)*0.45).addScaledVector(side,Math.cos(angle)*2.2)
          velocity.y+=Math.sin(angle)*1.3+0.7
          w.sparks.push({start:p.end,velocity,direction:velocity.clone().normalize(),color:p.color,age:0,life:0.14+(i%3)*0.025})
        }
      }
      p.age+=Math.min(delta,0.05)
    }
    w.sparks=w.sparks.filter(p=>p.age<p.life).slice(-SPARK_CAPACITY)
    for(const p of w.sparks) {
      const fade=1-p.age/p.life
      w.dummy.position.copy(p.start).addScaledVector(p.velocity,p.age)
      w.dummy.position.y-=1.8*p.age*p.age
      streak(p.direction,0.08*fade+0.01,0.012,p.color,fade*0.85)
      p.age+=Math.min(delta,0.05)
    }
    for(const [mesh,total] of [[cores.current,count],[halos.current,count],[heads.current,headCount]]) {
      mesh.count=total;mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.instanceMatrix.needsUpdate=true
      if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true
    }
  },0)
  return <group name="bullet-trails">
    <instancedMesh ref={cores} args={[null,null,BUDGET]} count={0} frustumCulled={false} raycast={()=>null} name="bullet-trail-cores"><planeGeometry/><shaderMaterial vertexShader={tracerVertex} fragmentShader={tracerFragment} uniforms={coreUniforms} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false}/></instancedMesh>
    <instancedMesh ref={halos} args={[null,null,BUDGET]} count={0} frustumCulled={false} raycast={()=>null} name="bullet-trail-halos"><planeGeometry/><shaderMaterial vertexShader={tracerVertex} fragmentShader={tracerFragment} uniforms={haloUniforms} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false}/></instancedMesh>
    <instancedMesh ref={heads} args={[null,null,CAPACITY]} count={0} frustumCulled={false} raycast={()=>null} name="bullet-trail-heads"><planeGeometry/><shaderMaterial vertexShader={tracerVertex} fragmentShader={tracerGlowFragment} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false}/></instancedMesh>
  </group>
}
