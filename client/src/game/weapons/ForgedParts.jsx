import { useEffect,useMemo } from 'react'
import { Shape,ExtrudeGeometry,CubicBezierCurve3,Vector3,DoubleSide } from 'three'
import { useGame } from '../store.js'

export function Armor({ points,thickness=.1,position=[0,0,0],rotation=[0,0,0],color='#303b49',bevel=.006,metalness=.5,roughness=.4 }) {
  const low=useGame(s=>s.settings.quality==='Low')
  const key=JSON.stringify(points)
  const geometry=useMemo(()=> {
    const shape=new Shape(),vertices=JSON.parse(key)
    vertices.forEach(([z,y],i)=>i ? shape.lineTo(z,y) : shape.moveTo(z,y));shape.closePath()
    const result=new ExtrudeGeometry(shape,{ depth:thickness,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel*.75,bevelSegments:2,steps:1,curveSegments:1 })
    result.translate(0,0,-thickness/2);result.rotateY(-Math.PI/2)
    return result
  },[key,thickness,bevel])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} position={position} rotation={rotation}>{low ? <meshLambertMaterial color={color} emissive={color} emissiveIntensity={.13}/> : <meshStandardMaterial color={color} metalness={metalness} roughness={roughness}/>}</mesh>
}
export function Filament({ points,color,radius=.002,glow=true }) {
  const low=useGame(s=>s.settings.quality==='Low')
  const key=JSON.stringify(points)
  const curve=useMemo(()=>new CubicBezierCurve3(...JSON.parse(key).map(p=>new Vector3(...p))),[key])
  return <group>
    {glow && !low && <mesh><tubeGeometry args={[curve,16,radius*3.5,6,false]}/><meshBasicMaterial color={color} transparent opacity={.13} depthWrite={false} toneMapped={false}/></mesh>}
    <mesh><tubeGeometry args={[curve,16,radius,6,false]}/><meshBasicMaterial color={color} toneMapped={false}/></mesh>
  </group>
}
export function Fastener({ position,side=1 }) {
  return <group position={position} rotation={[0,0,side*Math.PI/2]}>
    <mesh><cylinderGeometry args={[.009,.009,.004,8]}/><meshStandardMaterial color="#8995a1" metalness={.9} roughness={.35}/></mesh>
    <mesh position={[0,.0025,0]}><boxGeometry args={[.011,.001,.0025]}/><meshBasicMaterial color="#1b2029"/></mesh>
  </group>
}
export function Muzzle({ position,radius=.045,color='#8a95a0',accent }) {
  const low=useGame(s=>s.settings.quality==='Low')
  return <group name="machined-muzzle" position={position}>
    <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[radius*1.2,radius*1.1,.08,16,1,true]}/><meshStandardMaterial color={color} metalness={.92} roughness={.28} side={DoubleSide}/></mesh>
    <mesh position={[0,0,-.041]}><ringGeometry args={[radius*.64,radius*1.2,24]}/><meshStandardMaterial color="#647384" metalness={.9} roughness={.32} side={DoubleSide}/></mesh>
    <mesh position={[0,0,-.008]}><circleGeometry args={[radius*.65,20]}/><meshBasicMaterial color="#05080e" side={DoubleSide}/></mesh>
    {!low && [0,1,2,3].map(i=><mesh key={i} position={[Math.sin(i*Math.PI/2)*radius*1.16,Math.cos(i*Math.PI/2)*radius*1.16,0]} rotation={[0,0,-i*Math.PI/2]}><boxGeometry args={[.012,.006,.04]}/><meshBasicMaterial color={accent} toneMapped={false}/></mesh>)}
  </group>
}
