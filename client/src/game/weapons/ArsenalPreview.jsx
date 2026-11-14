import { useRef } from 'react'
import { Canvas,useFrame } from '@react-three/fiber'
import { WEAPONS } from '../../../../shared/weapons.js'
import ArsenalModel from './ArsenalModel.jsx'
import { weaponAnimation } from './animation.js'
import {animateParts} from './animateParts.js'

function Display({ id,mode }) {
  const group=useRef(),action=useRef(),rotor=useRef(),offhand=useRef(),trail=useRef(),cell=useRef(),bolt=useRef(),pump=useRef(),hinge=useRef(),core=useRef(),flash=useRef(),eject=useRef(),weapon=WEAPONS[id]
  const parts={action,rotor,offhand,trail,cell,bolt,pump,hinge,core,flash,eject}
  useFrame(({ clock },delta)=> {
    const time=clock.elapsedTime,period=weapon.spinUp ? 4 : Math.max(1.6,weapon.cooldown+0.5),start=Math.floor(time/period)*period
    const lastShot=mode==='fire' ? weapon.fireMode==='auto' && time-start>(weapon.spinUp || 0) ? start+(weapon.spinUp || 0)+Math.floor((time-start-(weapon.spinUp || 0))/weapon.cooldown)*weapon.cooldown : start : -10
    const s={ weapon:id,hp:100,lastShot,lastSwing:mode==='fire' ? start : -10,lastSwitch:-10,shot:Math.floor(time/weapon.cooldown),reloading:mode==='reload',reloadStart:Math.floor(time/(weapon.reload || 2))*(weapon.reload || 2),reloadEnd:(Math.floor(time/(weapon.reload || 2))+1)*(weapon.reload || 2),spinning:mode==='fire',spinStarted:start,windupStart:start,windupEnd:mode==='fire' ? start+(weapon.windup || weapon.spinUp || 0) : 0 }
    const a=weaponAnimation(s,time,weapon)
    group.current.rotation.y=-0.85+Math.sin(time*0.45)*(mode==='inspect' ? 0.55 : 0.12)
    group.current.rotation.z=Math.sin(time*0.8)*0.025-a.reloadPose*0.2
    group.current.position.y=Math.sin(time*1.4)*0.018-(weapon.fireMode==='melee' ? 0.28 : 0)
    group.current.position.z=a.kick*0.035
    animateParts(parts,a,weapon,{...s,shot:mode==='fire' ? s.shot : 0},time,delta)
    if(flash.current) flash.current.visible=mode==='fire' && a.flash && (!weapon.spinUp || time-start>weapon.spinUp)
    if(eject.current) eject.current.visible=false
  })
  return <group ref={group}><ArsenalModel weapon={weapon} parts={parts} preview/></group>
}
export default function ArsenalPreview({ id,mode }) {
  return <Canvas camera={{ position:[1.4,0.8,1.7],fov:37 }} dpr={1} gl={{ antialias:true,alpha:true }} aria-label={`${WEAPONS[id].name} animated 3D preview`}>
    <ambientLight intensity={1.5}/><directionalLight position={[2,4,3]} intensity={4} color="#d0ebff"/><pointLight position={[-2,1,-2]} intensity={16} color={WEAPONS[id].color}/>
    <Display key={id} id={id} mode={mode}/>
  </Canvas>
}
