import { useEffect,useMemo } from 'react'
import { AdditiveBlending,BufferGeometry,DoubleSide,EdgesGeometry,ExtrudeGeometry,Float32BufferAttribute,Shape } from 'three'

// A thin projected volume, luminous outline and clipped scan lines share the
// original fin silhouette. None of these surfaces writes an opaque depth mask.
export default function HologramPanel({ points,position=[0,0,0],rotation=[0,0,0],color,thickness=.004 }) {
  const key=JSON.stringify(points)
  const geometry=useMemo(()=> {
    const vertices=JSON.parse(key),shape=new Shape()
    vertices.forEach(([z,y],i)=>i ? shape.lineTo(z,y) : shape.moveTo(z,y));shape.closePath()
    const body=new ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1,curveSegments:1})
    body.translate(0,0,-thickness/2);body.rotateY(-Math.PI/2)
    const outline=new EdgesGeometry(body,25),lines=[]
    const min=Math.min(...vertices.map(p=>p[1])),max=Math.max(...vertices.map(p=>p[1]))
    for(let y=min+.009;y<max;y+=.012) {
      const crossings=[]
      vertices.forEach(([z0,y0],i)=> {
        const [z1,y1]=vertices[(i+1)%vertices.length]
        if(y>=Math.min(y0,y1) && y<Math.max(y0,y1)) crossings.push(z0+(z1-z0)*(y-y0)/(y1-y0))
      })
      crossings.sort((a,b)=>a-b)
      for(let i=0;i+1<crossings.length;i+=2) lines.push(0,y,crossings[i],0,y,crossings[i+1])
    }
    const scan=new BufferGeometry();scan.setAttribute('position',new Float32BufferAttribute(lines,3))
    return {body,outline,scan}
  },[key,thickness])
  useEffect(()=>()=>Object.values(geometry).forEach(g=>g.dispose()),[geometry])
  return <group position={position} rotation={rotation} name="holographic-fin">
    <mesh geometry={geometry.body}><meshBasicMaterial color={color} transparent opacity={.12} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} toneMapped={false}/></mesh>
    <lineSegments geometry={geometry.outline}><lineBasicMaterial color={color} transparent opacity={.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></lineSegments>
    <lineSegments geometry={geometry.scan}><lineBasicMaterial color={color} transparent opacity={.24} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></lineSegments>
  </group>
}
