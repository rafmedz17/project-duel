import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {AdditiveBlending,Color,Object3D} from 'three'
import {ABILITIES} from '../../../../shared/abilities.js'
import {useGame} from '../store.js'

const noRaycast=()=>null
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`
const fragment=`varying vec2 vUv;uniform float opacity;uniform float time;uniform vec3 tint;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){vec2 p=vUv*2.-1.;float edge=1.-smoothstep(.25,1.,length(p));float n=noise(vUv*5.+time*.07)*.6+noise(vUv*11.-time*.04)*.4;float a=edge*(.5+n*.5)*opacity;if(a<.005)discard;gl_FragColor=vec4(tint*(.65+n*.35),a);}`
const seeds=Array.from({length:36},(_,i)=>{
  const angle=i*2.399963,h=(i+.5)/36,y=1-2*h,r=Math.sqrt(1-y*y)
  return {x:Math.cos(angle)*r,y,z:Math.sin(angle)*r,phase:(i*.618)%1}
})

// Bounded instance counts keep these effects practical on the Low preset.
export default function SkillBursts({read}) {
  const low=useGame(s=>s.settings.quality==='Low'),count=low ? 12 : 30
  const smoke=useRef(),sparks=useRef(),dash=useRef(),scratch=useMemo(()=>new Object3D(),[])
  const particles=useMemo(()=>Array.from({length:count},(_,i)=>seeds[Math.floor(i*36/count)]),[count])
  const uniforms=useMemo(()=>({opacity:{value:0},time:{value:0},tint:{value:new Color('#879ca5')}}),[])
  useFrame(({camera})=>{
    const view=read()
    smoke.current.visible=sparks.current.visible=dash.current.visible=false
    if(!view || view.state.hp<=0) return
    const {state:s,time,position,local}=view,a=s.abilities.smoke,age=time-a.detonatedAt
    if(time<a.activeUntil && age>=0) {
      smoke.current.visible=true
      const growth=Math.min(1,age*2.8),radius=ABILITIES.smoke.radius*growth
      smoke.current.material.uniforms.opacity.value=(local ? .60 : .96)*Math.min(1,(a.activeUntil-time)*1.3)*Math.min(1,age*5)
      smoke.current.material.uniforms.time.value=time
      particles.forEach((p,i)=>{
        scratch.position.set(a.origin[0]+p.x*radius*.48,a.origin[1]+1+p.y*radius*.42,a.origin[2]+p.z*radius*.48)
        scratch.position.y+=Math.sin(time*.7+i)*.09
        scratch.quaternion.copy(camera.quaternion)
        scratch.scale.setScalar(radius*(.53+p.phase*.12));scratch.updateMatrix();smoke.current.setMatrixAt(i,scratch.matrix)
      })
      smoke.current.instanceMatrix.needsUpdate=true
    }
    const flash=s.abilities.flashbang,flashAge=time-flash.detonatedAt,flashing=flashAge>=0 && flashAge<.32
    const stun=flashing ? flash : s.abilities.stun,burst=time-stun.detonatedAt,lifetime=flashing ? .32 : .85
    if(burst>=0 && burst<lifetime) {
      sparks.current.visible=true;sparks.current.material.opacity=Math.max(0,1-burst/lifetime)
      sparks.current.material.color.set(flashing ? '#fffbd7' : '#dabfff')
      particles.forEach((p,i)=>{
        const t=Math.max(0,burst-p.phase*(flashing ? .03 : .20)),speed=(flashing ? 12 : 3.5)+p.phase*5
        scratch.position.set(stun.origin[0]+p.x*speed*t,stun.origin[1]+Math.abs(p.y)*speed*t+1.2*t-5*t*t,stun.origin[2]+p.z*speed*t)
        scratch.rotation.set(flashing ? -Math.asin(p.y) : t*8+i,flashing ? Math.atan2(p.x,p.z) : t*6+i,0)
        if(flashing) scratch.scale.set(.018,.018,.35+p.phase*.3)
        else scratch.scale.setScalar((.045+p.phase*.065)*(1-burst*.6))
        scratch.updateMatrix();sparks.current.setMatrixAt(i,scratch.matrix)
      })
      sparks.current.instanceMatrix.needsUpdate=true
    }
    const boost=s.abilities.dash,dashing=time<boost.activeUntil && !local
    if(dashing) {
      dash.current.visible=true
      const heading=Math.atan2(boost.direction[0],boost.direction[1])
      particles.forEach((p,i)=>{
        const tail=((time*3+p.phase)%1)*3
        scratch.position.set(position[0]-boost.direction[0]*tail+p.x*.5,position[1]+p.y*.8,position[2]-boost.direction[1]*tail+p.z*.5)
        scratch.rotation.set(0,heading,0);scratch.scale.set(.015,.015,.3+p.phase*.7);scratch.updateMatrix();dash.current.setMatrixAt(i,scratch.matrix)
      })
      dash.current.instanceMatrix.needsUpdate=true
    }
  })
  return <>
    <instancedMesh raycast={noRaycast} key={`smoke-${count}`} name="billowing-smoke" ref={smoke} args={[null,null,count]} frustumCulled={false} visible={false}><planeGeometry args={[2,2]}/><shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} transparent depthWrite={false} side={2}/></instancedMesh>
    <instancedMesh raycast={noRaycast} key={`stun-${count}`} name="stun-popcorn-sparks" ref={sparks} args={[null,null,count]} frustumCulled={false} visible={false}><octahedronGeometry args={[1]}/><meshBasicMaterial color="#dabfff" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false}/></instancedMesh>
    <instancedMesh raycast={noRaycast} key={`dash-${count}`} name="dash-air-streaks" ref={dash} args={[null,null,count]} frustumCulled={false} visible={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial color="#9cfaff" transparent opacity={.65} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/></instancedMesh>
  </>
}
