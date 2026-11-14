import {useEffect,useMemo} from 'react'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'

export function Plate({p=[0,0,0],s=[.1,.1,.1],r=[0,0,0],color='#34465d',glow=false}) {
  const key=s.join(',')
  const geometry=useMemo(()=>{const dimensions=key.split(',').map(Number);return new RoundedBoxGeometry(...dimensions,1,Math.min(.005,...dimensions.map(v=>v*.15)))},[key])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh position={p} rotation={r} geometry={geometry}>{glow ? <meshBasicMaterial color={color} toneMapped={false}/> : <meshStandardMaterial color={color} metalness={.65} roughness={.34}/>}</mesh>
}
export function Tube({p=[0,0,0],radius=.03,length=.2,color='#263347',glow=false,open=false}) {
  return <mesh position={p} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[radius,radius,length,12,1,open]}/>{glow ? <meshBasicMaterial color={color} toneMapped={false}/> : <meshStandardMaterial color={color} metalness={.78} roughness={.3}/>}</mesh>
}
export function Ring({p=[0,0,0],radius=.05,tube=.004,color='#9baab8',glow=false}) {
  return <mesh position={p}><torusGeometry args={[radius,tube,6,24]}/>{glow ? <meshBasicMaterial color={color} toneMapped={false}/> : <meshStandardMaterial color={color} metalness={.8} roughness={.3}/>}</mesh>
}
