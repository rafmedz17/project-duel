import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {ABILITIES} from '../../../../shared/abilities.js'
import {grenadeTrajectory} from '../../../../shared/tactical.js'
import {throwAim} from './throwAim.js'

export default function ThrowGuide({read}) {
  const root=useRef(),line=useRef(),marker=useRef(),nextUpdate=useRef(0)
  const vertices=useMemo(()=>new Float32Array(3*64),[]),distances=useMemo(()=>new Float32Array(64),[])
  useFrame(({clock})=>{
    const view=read(),id=throwAim.id
    root.current.visible=Boolean(id && view?.active && view.state?.hp>0 && view.time>=view.state.abilities[id].readyAt)
    if(!root.current.visible) {nextUpdate.current=0;return}
    if(clock.elapsedTime<nextUpdate.current) return
    nextUpdate.current=clock.elapsedTime+.04
    const points=grenadeTrajectory(view.position,view.yaw,view.pitch,view.crouched,id,view.solids)
    let distance=0
    points.forEach((p,i)=>{
      line.current.geometry.attributes.position.array.set(p,i*3)
      if(i) distance+=Math.hypot(...p.map((v,k)=>v-points[i-1][k]))
      line.current.geometry.attributes.lineDistance.array[i]=distance
    })
    line.current.geometry.setDrawRange(0,points.length)
    line.current.geometry.attributes.position.needsUpdate=true
    line.current.geometry.attributes.lineDistance.needsUpdate=true
    line.current.material.color.set(ABILITIES[id].color)
    marker.current.position.set(...points.at(-1))
    marker.current.children.forEach(mesh=>mesh.material.color.set(ABILITIES[id].color))
    root.current.userData={ability:id,landing:points.at(-1),distance}
  })
  return <group ref={root} name="grenade-throw-guide" visible={false}>
    <line ref={line} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices,3]}/><bufferAttribute attach="attributes-lineDistance" args={[distances,1]}/></bufferGeometry>
      <lineDashedMaterial color="#fff2bb" dashSize={.3} gapSize={.15} transparent opacity={.85} depthWrite={false}/>
    </line>
    <group ref={marker}>
      <mesh><octahedronGeometry args={[.12]}/><meshBasicMaterial toneMapped={false}/></mesh>
      <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.32,.36,24]}/><meshBasicMaterial transparent opacity={.7} side={2} depthWrite={false}/></mesh>
    </group>
  </group>
}
