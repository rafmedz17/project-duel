import {useEffect,useMemo,useRef,useState} from 'react'
import {useFrame} from '@react-three/fiber'
import {AdditiveBlending,MathUtils,Vector3} from 'three'
import {getMap} from '../../../shared/maps.js'
import {WEAPONS} from '../../../shared/weapons.js'
import {TRAINING_SOLIDS,TRAINING_TARGETS,COURSES} from '../game/training/config.js'
import RobotModel from '../game/characters/RobotModel.jsx'
import ArsenalModel from '../game/weapons/ArsenalModel.jsx'
import Box from '../game/WorldBox.jsx'
import {CINEMATIC_SHOTS,menuCinema,shotAt} from './cinematic.js'

function Duelist({side,quality}) {
  const root=useRef(),weapon=useRef(),flash=useRef(),trail=useRef()
  const start=side===0 ? [-1.8,.85,3] : [2,.85,-3],yaw=side===0 ? -.5 : Math.PI-.5
  useFrame(()=>{
    const t=menuCinema.time,phase=(t+side*.53)%2.1,firing=phase>.9 && phase<1.32
    root.current.position.set(start[0]+Math.sin(t*.7+side)*.55,start[1]+Math.sin(t*2.4)*.018,start[2])
    weapon.current.position.z=-.3+(firing ? Math.sin(phase*85)*.015 : 0)
    flash.current.visible=firing && Math.sin(phase*85)>.1
    trail.current.visible=firing && Math.sin(phase*85)>.65
    trail.current.position.z=-2.4-(phase%0.1)*15
  })
  return <group ref={root} position={start} rotation={[0,yaw,0]} name={`cinematic-operative-${side}`}>
    <RobotModel characterId={side===0 ? 'vex' : 'raze'}/>
    <group ref={weapon} position={[.26,.12,-.3]} scale={.74}>
      {quality==='Low' ? <><Box size={[.22,.18,.65]} color="#344c62"/><Box position={[0,.025,-.42]} size={[.085,.085,.4]} color="#86efff" glow/></> : <ArsenalModel weapon={side===0 ? WEAPONS.rifle : WEAPONS.astral} preview/>}
      <mesh ref={flash} position={[0,0,-1]}><octahedronGeometry args={[.12,0]}/><meshBasicMaterial color="#d8ffff" toneMapped={false}/></mesh>
      <mesh ref={trail} rotation={[Math.PI/2,0,0]} position={[0,0,-2.4]}><cylinderGeometry args={[.009,.009,1.6,4]}/><meshBasicMaterial color={side===0 ? '#91ffff' : '#ff97c9'} transparent opacity={.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
    </group>
  </group>
}

function Scenery({id,quality}) {
  const map=getMap(id),training=id==='training',solids=training ? TRAINING_SOLIDS : map.solids
  const accent=training ? '#60eaff' : map.accent
  const dust=useRef(),reactor=useRef()
  const particles=useMemo(()=>Float32Array.from({length:(quality==='Low' ? 25 : 85)*3},(_,i)=>i%3===1 ? .4+(Math.sin(i*13.13)+1)*3 : Math.sin(i*31.71)*18),[quality])
  useFrame(()=>{
    if(dust.current) dust.current.rotation.y=Math.sin(menuCinema.time*.06)*.1
    if(reactor.current) reactor.current.rotation.z=menuCinema.time*.22
  })
  return <>
    <color attach="background" args={[training ? '#050f1c' : map.background]}/>
    <fog attach="fog" args={[training ? '#050f1c' : map.background,14,65]}/>
    <group name={`cinematic-map-${id}`}>
    <ambientLight intensity={.8}/><hemisphereLight args={['#a6dbff','#111e32',2.2]}/>
    <directionalLight position={[8,15,6]} intensity={3.8} color="#c2dcff"/>
    <pointLight position={[-4,4,3]} intensity={50} distance={22} color={accent}/>
    {quality!=='Low' && <pointLight position={[5,2,-4]} intensity={35} distance={17} color={id==='neon' ? '#ff6aa9' : '#c6b2ff'}/>}
    {solids.map((solid,i)=><Box key={i} {...solid}/>)}
    {training ? Object.values(COURSES).map((course,i)=>{
      const [x0,x1,z0,z1]=course.bounds,x=(x0+x1)/2,z=(z0+z1)/2
      return <group key={i}><gridHelper position={[x,.015,z]} args={[Math.min(x1-x0,z1-z0),14,course.color,'#1c3445']}/><Box position={[x,5.6,z]} size={[(x1-x0)*.65,.055,.25]} color={course.color} glow/></group>
    }) : <><gridHelper args={[40,20,accent,'#20364a']} position={[0,.015,0]}/>{[-19,19].map(edge=><group key={edge}><Box position={[edge,.14,0]} size={[.06,.05,38]} color={accent} glow/><Box position={[0,.14,edge]} size={[38,.05,.06]} color={accent} glow/></group>)}</>}
    {[-16,-8,0,8,16].map(x=><group key={x}><Box position={[x,3.8,training ? -41.6 : -19.35]} size={[.09,2.8,.08]} color={accent} glow/>{!training && <Box position={[19.35,3.8,x]} size={[.08,2.8,.09]} color={accent} glow/>}</group>)}
    {!training && map.cover.map(([x,y,z,w,,d],i)=><group key={i}><Box position={[x,y+.2,z+d/2+.02]} size={[w*.8,.055,.03]} color={accent} glow/><Box position={[x,y+.2,z-d/2-.02]} size={[w*.8,.055,.03]} color={accent} glow/></group>)}
    {id==='neon' && [-12,12].flatMap(x=>[-9,9].map(z=><group key={`${x}-${z}`}><Box position={[x,3.6,z]} size={[2.1,.18,2.1]} color="#f471e9" glow/><Box position={[x,2.3,z+1.02]} size={[1.3,.8,.03]} color="#659bff" glow/></group>))}
    {id==='orbital' && <group position={[0,4.7,0]}><mesh ref={reactor} rotation={[Math.PI/2,0,0]}><torusGeometry args={[2.1,.045,6,48]}/><meshBasicMaterial color={accent} toneMapped={false}/></mesh><Box size={[2.7,.14,2.7]} color="#5c927f" glow/></group>}
    <points ref={dust}><bufferGeometry><bufferAttribute attach="attributes-position" args={[particles,3]}/></bufferGeometry><pointsMaterial color={accent} size={.035} transparent opacity={.4} depthWrite={false}/></points>
    {training ? TRAINING_TARGETS.slice(0,10).map((target,i)=><group key={i} position={target.position} rotation={[0,target.yaw,0]}><RobotModel characterId={['vex','aegis','ion','raze'][i%4]}/></group>) : <><Duelist side={0} quality={quality}/><Duelist side={1} quality={quality}/></>}
    </group>
  </>
}

export default function MenuCinematic({running,quality}) {
  const [shot,setShot]=useState(0),time=useRef(1),look=useRef(new Vector3())
  useEffect(()=>()=>{menuCinema.running=false;menuCinema.fade=0},[])
  useFrame(({camera},delta)=>{
    if(running) time.current+=Math.min(delta,.1)
    const frame=shotAt(time.current),config=CINEMATIC_SHOTS[frame.shot],t=frame.progress
    if(frame.shot!==shot) setShot(frame.shot)
    const ease=t*t*(3-2*t)
    camera.position.set(...config.from.map((v,i)=>MathUtils.lerp(v,config.to[i],ease)))
    look.current.set(...config.look.map((v,i)=>MathUtils.lerp(v,config.endLook[i],ease)))
    camera.lookAt(look.current)
    const fov=48+Math.sin(t*Math.PI)*3
    if(Math.abs(camera.fov-fov)>.001) {camera.fov=fov;camera.updateProjectionMatrix()}
    Object.assign(menuCinema,{...frame,time:time.current,running,fade:running ? frame.fade : 0})
  },-1)
  return <Scenery key={CINEMATIC_SHOTS[shot].mapId} id={CINEMATIC_SHOTS[shot].mapId} quality={quality}/>
}
