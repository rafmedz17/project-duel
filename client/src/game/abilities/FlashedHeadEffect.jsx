import {useRef} from 'react'
import {useFrame} from '@react-three/fiber'

const noRaycast=()=>null
export default function FlashedHeadEffect({read}) {
  const root=useRef()
  useFrame(()=>{
    const state=read?.(),group=root.current
    group.visible=Boolean(state?.active)
    if(!group.visible) return
    group.rotation.y=state.time*3
    group.children.forEach((spark,i)=>{
      if(i===3) return
      const phase=state.time*4+i*Math.PI*2/3
      spark.position.set(Math.cos(i*Math.PI*2/3)*.31,.26+Math.sin(phase)*.035,Math.sin(i*Math.PI*2/3)*.31)
      spark.rotation.set(phase,phase*.7,0)
      spark.scale.setScalar(.85+Math.sin(phase)*.15)
    })
  })
  return <group ref={root} name="flashed-head-effect" visible={false}>
    {[0,1,2].map(i=><group key={i}>
      <mesh raycast={noRaycast}><octahedronGeometry args={[.055]}/><meshBasicMaterial color="#fff4b5" toneMapped={false}/></mesh>
      <mesh raycast={noRaycast} scale={[2.3,.3,.3]}><octahedronGeometry args={[.07]}/><meshBasicMaterial color="#fffce9" toneMapped={false}/></mesh>
    </group>)}
    <mesh raycast={noRaycast} position={[0,.25,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.30,.308,24,1,0,Math.PI*1.3]}/><meshBasicMaterial color="#ffe5a0" transparent opacity={.45} depthWrite={false} side={2}/></mesh>
  </group>
}
