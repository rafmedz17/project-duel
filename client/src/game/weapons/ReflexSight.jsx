import { useEffect,useMemo } from 'react'
import { Shape,Path,ExtrudeGeometry,DoubleSide } from 'three'
import { REFLEX_LENS_POSITION,reflexProfile } from './optics.js'

function Housing({ width,height,thickness }) {
  const geometry=useMemo(()=> {
    const polygon=(path,w,h,c)=> { path.moveTo(-w+c,-h);path.lineTo(w-c,-h);path.lineTo(w,-h+c);path.lineTo(w,h-c);path.lineTo(w-c,h);path.lineTo(-w+c,h);path.lineTo(-w,h-c);path.lineTo(-w,-h+c);path.closePath() }
    const shape=new Shape();polygon(shape,width,height,0.025)
    const aperture=new Path();polygon(aperture,width-thickness,height-thickness,0.018);shape.holes.push(aperture)
    const mesh=new ExtrudeGeometry(shape,{ depth:0.055,bevelEnabled:true,bevelSize:0.003,bevelThickness:0.003,bevelSegments:1,steps:1 })
    mesh.translate(0,0,-0.0275);return mesh
  },[width,height,thickness])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry}><meshStandardMaterial color="#34485f" metalness={0.85} roughness={0.3}/></mesh>
}
function Detail({ position,size,color='#7d95ab',glow=false }) {
  return <mesh position={position}><boxGeometry args={size}/>{glow ? <meshBasicMaterial color={color} toneMapped={false}/> : <meshStandardMaterial color={color} metalness={0.8} roughness={0.3}/>}</mesh>
}
export default function ReflexSight({ weapon,reticleRef }) {
  const profile=reflexProfile(weapon),compact=profile.variant==='compact',heavy=profile.variant==='reinforced'
  const width=heavy ? 0.125 : compact ? 0.095 : 0.11,height=heavy ? 0.105 : compact ? 0.08 : 0.095
  return <group name="mounted-reflex-sight" position={REFLEX_LENS_POSITION}>
    <Detail position={[0,-0.135,0]} size={[heavy ? 0.18 : 0.12,0.06,0.15]} color="#1b2a3c"/>
    <Detail position={[0,-0.10,0]} size={[0.075,0.05,0.07]}/>
    {compact ? <>
      {[-1,1].map(side=><Detail key={side} position={[side*(width-0.008),-0.007,0]} size={[0.016,height*2,0.045]} color="#445b72"/>)}
      <Detail position={[0,-height,0]} size={[width*2,0.016,0.045]}/>
      {[-1,1].map(side=><Detail key={side} position={[side*(width-0.02),height-0.015,0]} size={[0.04,0.015,0.045]} color={weapon.color} glow/>)}
    </> : <Housing width={width} height={height} thickness={heavy ? 0.024 : 0.018}/>}
    {[-1,1].map(side=><group key={side}>
      <Detail position={[side*(width+0.008),-0.025,0]} size={[heavy ? 0.04 : 0.02,0.07,0.055]} color="#152437"/>
      <Detail position={[side*(width+0.01),-0.025,0.031]} size={[0.008,0.035,0.004]} color={weapon.color} glow/>
    </group>)}
    <mesh name="reflex-glass" position={[0,0,0.026]}><planeGeometry args={[(width-0.02)*2,(height-0.02)*2]}/><meshBasicMaterial color="#80e5ef" transparent opacity={0.045} side={DoubleSide} depthWrite={false}/></mesh>
    <group ref={reticleRef} name="reflex-model-reticle" position={[0,0,0.03]}>
      <mesh><circleGeometry args={[0.0022,12]}/><meshBasicMaterial color="#ff3d58" toneMapped={false}/></mesh>
      {(compact || heavy) && <mesh><ringGeometry args={[0.013,0.014,32]}/><meshBasicMaterial color="#ff5265" toneMapped={false} transparent opacity={0.7}/></mesh>}
    </group>
    <Detail position={[0,-height+0.014,0.03]} size={[0.018,0.008,0.012]} color="#ff465e" glow/>
  </group>
}
