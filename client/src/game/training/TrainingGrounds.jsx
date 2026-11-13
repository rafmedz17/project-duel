import { memo,useEffect,useMemo,useRef } from 'react'
import { CanvasTexture,Quaternion,Euler,MathUtils } from 'three'
import { RigidBody,CuboidCollider,useBeforePhysicsStep } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import Box from '../WorldBox.jsx'
import RobotModel from '../characters/RobotModel.jsx'
import ArsenalModel from '../weapons/ArsenalModel.jsx'
import { game,useGame } from '../store.js'
import { runtime } from '../runtime.js'
import { ROBOT_PARTS } from '../../../../shared/robot.js'
import { CHARACTER_IDS } from '../../../../shared/characters.js'
import { WEAPONS } from '../../../../shared/weapons.js'
import { throughSmoke,blocked } from '../../../../shared/tactical.js'
import { COURSES,TRAINING_SOLIDS,TRAINING_COVER,TRAINING_TARGETS,targetPosition,targetYaw } from './config.js'
import { targetEnabled } from './rules.js'

function Sign({ title,subtitle,color,position,rotation=[0,0,0],width=8 }) {
  const texture=useMemo(()=> {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#0b1725';ctx.fillRect(0,0,1024,192)
    ctx.fillStyle=color;ctx.fillRect(0,0,1024,7)
    ctx.font='bold 55px monospace';ctx.textAlign='center';ctx.fillText(title,512,89)
    ctx.font='22px monospace';ctx.fillStyle='#afc7d8';ctx.fillText(subtitle,512,143)
    return new CanvasTexture(canvas)
  },[title,subtitle,color])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <mesh position={position} rotation={rotation}><planeGeometry args={[width,width*192/1024]}/><meshBasicMaterial map={texture}/></mesh>
}
const Structure=memo(function Structure({ quality }) {
  return <>
    <color attach="background" args={['#050d18']}/><fog attach="fog" args={['#050d18',48,115]}/>
    <ambientLight intensity={0.7}/><hemisphereLight args={['#b4ddff','#142333',2.1]}/><directionalLight position={[8,30,10]} color="#bedaff" intensity={2.5}/>
    {TRAINING_SOLIDS.map((solid,index)=><Box key={index} {...solid} solid/>)}
    {Object.entries(COURSES).map(([id,c])=> {
      const [x0,x1,z0,z1]=c.bounds,x=(x0+x1)/2,z=(z0+z1)/2,w=x1-x0,d=z1-z0
      return <group key={id}>
        <gridHelper position={[x,0.012,z]} args={[Math.min(w,d),Math.round(Math.min(w,d)/2),c.color,'#1e3648']}/>
        {[-1,1].map(side=><group key={side}>
          <Box position={[x+side*(w/2-0.65),0.08,z]} size={[0.055,0.04,d-1.3]} color={c.color} glow/>
          <Box position={[x,0.08,z+side*(d/2-0.65)]} size={[w-1.3,0.04,0.055]} color={c.color} glow/>
          <Box position={[x+side*(w/2-0.8),5.8,z]} size={[0.12,0.12,d]} color="#375265"/>
          <Box position={[x,5.8,z+side*(d/2-0.8)]} size={[w,0.12,0.12]} color="#375265"/>
        </group>)}
        <Box position={[x,5.65,z]} size={[Math.max(2,w*0.45),0.08,0.35]} glow color={c.color}/>
        {quality==='High' && <pointLight position={[x,4,z]} color={c.color} intensity={35} distance={24}/>}
      </group>
    })}
    <Sign title="01 / PRECISION RANGE" subtitle="10 ROBOTS / ALWAYS AVAILABLE" color={COURSES.static.color} position={[0,4.3,-14.3]}/>
    <Sign title="02 / REFLEX LAB" subtitle="G : START A 45 SECOND RUN" color={COURSES.aim.color} position={[18.3,4.3,0]} rotation={[0,-Math.PI/2,0]}/>
    <Sign title="03 / TRACKING BAY" subtitle="6 MOVING ROBOTS / G : PAUSE" color={COURSES.moving.color} position={[0,4.3,14.3]} rotation={[0,Math.PI,0]}/>
    <Sign title="04 / LIVE FIRE" subtitle="5 ARMED ROBOTS / G : START" color={COURSES.combat.color} position={[-18.3,4.3,0]} rotation={[0,Math.PI/2,0]}/>
    <Sign title="TRAINING NEXUS" subtitle="B : FIELD ARMORY / FOUR COURSES" color="#a9eaff" position={[0,5,-3]}/>
    <Sign title="PRECISION / 10 SYSTEMS" subtitle="HEAD / BODY / LIMBS / FEET" color={COURSES.static.color} position={[0,3.8,-41.7]} width={13}/>
    <Sign title="REFLEX LAB" subtitle="BREAK TARGETS / KEEP YOUR CROSSHAIR MOVING" color={COURSES.aim.color} position={[47.7,5,0]} rotation={[0,-Math.PI/2,0]} width={12}/>
    <Sign title="TRACK / STRAFE / REPEAT" subtitle="MATCH MOVEMENT WITH PRECISE AIM" color={COURSES.moving.color} position={[0,4,41.7]} rotation={[0,Math.PI,0]} width={12}/>
    <Sign title="LIVE FIRE / USE COVER" subtitle="G : ARM OR DISARM THE FIVE ROBOTS" color={COURSES.combat.color} position={[-47.7,4,0]} rotation={[0,Math.PI/2,0]} width={12}/>
    {TRAINING_COVER.map(({ position:[x,y,z],size:[w,,d] },i)=><group key={i}>
      <Box position={[x,y+0.4,z+d/2+0.015]} size={[w*0.75,0.06,0.03]} color={COURSES.combat.color} glow/>
      <Box position={[x,y+0.4,z-d/2-0.015]} size={[w*0.75,0.06,0.03]} color={COURSES.combat.color} glow/>
    </group>)}
    {[-1,1].map(side=><group key={side}>
      <Box position={[0,0.035,side*10]} size={[2.3,0.025,7]} color={side<0 ? '#153f50' : '#1c4135'}/>
      <Box position={[side*13,0.035,0]} size={[9,0.025,2.3]} color={side<0 ? '#4b2f24' : '#31284d'}/>
    </group>)}
  </>
})

function Robot({ index }) {
  const s=useGame(),target=s.targets[index],body=useRef(),health=useRef(),muzzle=useRef(),rot=useRef(new Quaternion()),lean=useRef(0)
  const def=TRAINING_TARGETS[index],down=target.hp<=0,combat=def.course==='combat'
  useBeforePhysicsStep(()=> {
    if(!body.current) return
    const state=game.get(),t=state.targets[index],p=targetPosition(index,t)
    const yaw=targetYaw(index,t,state.training,runtime.position)
    lean.current=MathUtils.damp(lean.current,t.hp<=0 ? -1.3 : 0,12,1/60)
    rot.current.setFromEuler(new Euler(lean.current,yaw,0,'YXZ'))
    body.current.setNextKinematicTranslation({ x:p[0],y:t.hp<=0 ? 0.4 : p[1],z:p[2] })
    body.current.setNextKinematicRotation(rot.current)
  })
  useFrame(()=> {
    if(health.current) health.current.quaternion.copy(rot.current).invert()
    if(muzzle.current) muzzle.current.visible=game.now()-(game.get().targets[index].firedAt ?? -10)<0.08
  })
  const revealed=()=> {
    const state=game.get(),now=game.now(),origin=runtime.position.map((v,i)=>v+(i===1 ? 0.65 : 0)),p=targetPosition(index,state.targets[index]),smoke=state.abilities.smoke
    return now<state.abilities.scanner.activeUntil || (now<smoke.activeUntil && throughSmoke(origin,p,[{ origin:smoke.origin.map((v,i)=>v+(i===1 ? 1 : 0)),radius:4 }]) && !blocked(origin,p,TRAINING_SOLIDS))
  }
  return <RigidBody ref={body} name={`training-robot-${index}`} type="kinematicPosition" colliders={false} position={def.position} rotation={[0,def.yaw,0]}>
    {ROBOT_PARTS.map(part=><CuboidCollider key={part.id} args={part.size.map(n=>n/2)} position={part.position} enabled={!down}/>)}
    <RobotModel targetId={index} characterId={CHARACTER_IDS[index%4]} down={down} flash={s.time-target.hit<0.12 || s.time<(target.flashUntil || 0)} reveal={revealed}/>
    {combat && <group position={[0.25,-0.12,-0.35]} scale={0.65}><ArsenalModel weapon={WEAPONS.rifle} parts={{ flash:muzzle }} preview/></group>}
    <group ref={health} visible={!down} position={[0,1.08,0]}>
      <Box position={[0,0,0]} size={[0.95,0.07,0.04]} color="#23384b"/>
      <Box position={[-0.475+target.hp/100*0.475,0,0.03]} size={[0.95*target.hp/100,0.045,0.03]} color={target.tracking ? '#ff7660' : COURSES[def.course].color} glow/>
    </group>
    {s.time<(target.rootedUntil || 0) && <mesh position={[0,-0.7,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.45,0.6,6]}/><meshBasicMaterial color="#bd9fff"/></mesh>}
  </RigidBody>
}
function Orb({ index }) {
  const s=useGame(),target=s.targets[index],root=useRef(),enabled=targetEnabled(index,s.training) && target.hp>0
  useFrame(()=> { if(root.current) { root.current.position.set(...targetPosition(index,game.get().targets[index]));root.current.rotation.x=game.now()*0.6 } })
  return <group ref={root} name={`reflex-target-${index}`} position={targetPosition(index,target)} visible={enabled}>
    <mesh userData={{ blocksShot:enabled,targetId:enabled ? index : undefined,hitRegion:'body' }}><sphereGeometry args={[0.36,16,12]}/><meshStandardMaterial color="#f5e9ff" emissive="#b67aff" emissiveIntensity={1.6}/></mesh>
    <mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[0.47,0.025,6,24]}/><meshBasicMaterial color="#c495ff"/></mesh>
  </group>
}
export default function TrainingGrounds({ quality }) {
  const generation=useGame(s=>s.generation)
  return <><Structure quality={quality}/><group key={generation}>{TRAINING_TARGETS.map((target,index)=>target.kind==='orb' ? <Orb key={index} index={index}/> : <Robot key={index} index={index}/>)}</group></>
}
