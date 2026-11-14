import {memo,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {WEAPONS} from '../../../shared/weapons.js'
import ArsenalModel from '../game/weapons/ArsenalModel.jsx'
import OperativeArms from '../game/characters/OperativeArms.jsx'
import {weaponAnimation} from '../game/weapons/animation.js'
import {animateParts} from '../game/weapons/animateParts.js'
import {latestPose,samplePose} from './poses.js'
import {lobby} from './lobby.js'

function RemoteEquipment({player}) {
  const selected=player.combat.weapon,weapon=WEAPONS[selected]
  const pivot=useRef(),root=useRef(),grip=useRef(),support=useRef(),action=useRef(),rotor=useRef(),offhand=useRef(),trail=useRef(),cell=useRef(),bolt=useRef(),pump=useRef(),hinge=useRef(),core=useRef(),flash=useRef(),eject=useRef(),projection=useRef(),reticle=useRef()
  const parts={grip,support,action,rotor,offhand,trail,cell,bolt,pump,hinge,core,flash,eject,projection,reticle}
  const source=useMemo(()=>({
    get:()=>lobby.get().room?.players.find(p=>p.id===player.id)?.combat,
    now:()=>lobby.get().room?.time || 0,
  }),[player.id])
  useFrame((_,delta)=>{
    const s=source.get(),pose=samplePose(player.id)
    if(!s || !pose || !root.current || s.weapon!==selected) return
    const a=weaponAnimation(s,source.now(),weapon),melee=weapon.fireMode==='melee'
    const movement=latestPose(player.id),stride=Math.sin(source.now()*10)*Math.min(1.4,Math.hypot(movement?.vx || 0,movement?.vz || 0)/5)
    root.current.visible=s.hp>0
    pivot.current.position.set(0,pose.crouched ? .13 : .26,-.12)
    pivot.current.rotation.x=pose.pitch
    root.current.position.set(.2-(melee ? a.hit*.21 : 0),-.14-a.equip*.13-a.reloadPose*.035+stride*.008,-.25+a.kick*.035)
    root.current.rotation.set(a.kick*.07-a.windup*.6,melee ? a.hit*.55 : -a.reloadPose*.25,melee ? -.12+a.hit*.9 : -a.reloadPose*.4)
    animateParts(parts,a,weapon,s,source.now(),delta)
    if(projection.current) projection.current.visible=false
    if(reticle.current) reticle.current.visible=false
  },-1)
  return <>
    <group ref={pivot} name="remote-equipment"><group ref={root} name="remote-weapon" scale={.72}><ArsenalModel key={selected} weapon={weapon} parts={parts}/></group></group>
    <OperativeArms weaponRoot={root} parts={parts} source={source} characterId={player.combat.characterId} stance={()=>samplePose(player.id)?.crouched || false}/>
  </>
}

// Per-frame posing reads current snapshots through source.get(). Rebuild the
// model only for actual equipment/character changes, rather than every packet.
export default memo(RemoteEquipment,(before,after)=>before.player.id===after.player.id && before.player.combat.weapon===after.player.combat.weapon && before.player.combat.characterId===after.player.combat.characterId)
