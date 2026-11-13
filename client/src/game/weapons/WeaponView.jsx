import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGame,game } from '../store.js'
import { useLobby } from '../../multiplayer/lobby.js'
import { WEAPONS } from '../../../../shared/weapons.js'
import { weaponAnimation } from './animation.js'
import ArsenalModel from './ArsenalModel.jsx'

export default function WeaponView({ source=game }) {
  const local=useGame(s=>s.weapon),online=useLobby(s=>s.room?.players.find(p=>p.id===s.sessionId)?.combat.weapon)
  const selected=source===game ? local : online || 'pistol', weapon=WEAPONS[selected]
  const root=useRef(),rotation=useRef(0)
  const action=useRef(),rotor=useRef(),offhand=useRef(),trail=useRef(),cell=useRef(),bolt=useRef(),pump=useRef(),hinge=useRef(),core=useRef(),flash=useRef(),eject=useRef()
  const parts={action,rotor,offhand,trail,cell,bolt,pump,hinge,core,flash,eject}
  useFrame(({ camera },delta)=> {
    const s=source.get()
    if (!s || s.weapon!==selected || !root.current) return
    const time=source.now(), a=weaponAnimation(s,time,weapon),melee=weapon.fireMode==='melee',compact=weapon.slot==='2'
    const inspect=Math.sin(Math.PI*Math.max(0,Math.min(1,(time-(game.get().inspectAt ?? -10))/2)))
    const scoped=game.get().aiming && weapon.scope
    const group=root.current
    // The screen-space optic supplies the ADS sight; the physical lens must not
    // sit between the camera and targets during magnification.
    group.visible=s.hp>0 && !scoped; group.position.copy(camera.position); group.quaternion.copy(camera.quaternion)
    group.translateX(melee ? 0.36-a.hit*0.38 : scoped ? 0 : 0.31-a.reloadPose*0.08)
    group.translateY((melee ? -0.43+a.hit*0.12 : scoped ? -0.19 : -0.3)+a.reloadPose*0.22-a.equip*0.3+Math.sin(time*1.8)*0.002)
    group.translateZ((melee ? -0.63 : compact ? -0.52 : -0.63)+a.kick*(weapon.recoil*2+0.035)-a.reloadPose*0.2+a.equip*0.2)
    group.rotateX(melee ? a.windup*-0.75+a.hit*0.15 : a.kick*weapon.recoil*3+a.reloadPose*0.18)
    group.rotateZ(melee ? -0.28+a.hit*(weapon.model==='fangs' && (s.swings || 0)%2 ? -1.25 : 1.25) : -a.reloadPose*0.65-inspect*0.8)
    group.rotateY(-a.reloadPose*0.35+inspect*0.9)
    if (action.current) action.current.rotation.x=melee ? -a.windup*0.5+a.hit*0.2 : a.kick*0.04
    if (cell.current) { cell.current.position.set(-a.drop*0.13,-a.drop*0.32,a.drop*0.09); cell.current.rotation.z=-a.drop*0.35 }
    if (bolt.current) bolt.current.position.z=-0.02+a.bolt*(weapon.scope ? 0.17 : 0.055)
    if (pump.current) pump.current.position.z=-0.35+a.pump*0.14
    if (hinge.current) hinge.current.rotation.x=a.hinge
    if (rotor.current) { rotation.current+=Math.min(delta,0.1)*a.spin*28; rotor.current.rotation.z=rotation.current }
    if (core.current) { core.current.rotation.x=time; core.current.rotation.y=time*1.4 }
    if (flash.current) { flash.current.visible=a.flash; flash.current.rotation.z=(s.shot || 0)*2.4 }
    if (trail.current) { trail.current.visible=a.hit>0.12; trail.current.material.opacity=a.hit*0.5; trail.current.rotation.z=-0.3+a.hit }
    if (eject.current) {
      const age=time-s.lastShot; eject.current.visible=age>=0 && age<0.24
      eject.current.position.set(0.14+age*0.8,0.04+age*0.7-age*age*3,0.08+age*0.4)
      eject.current.rotation.set(age*20,age*13,age*17)
    }
    if (offhand.current) {
      if (weapon.model==='fangs') { offhand.current.position.set(-0.64+a.hit*0.4,0.04+a.hit*0.15,-a.hit*0.15); offhand.current.rotation.z=0.3-a.hit*1.2 }
      else { offhand.current.position.set(-0.04-a.drop*0.1,-0.2+a.drop*0.02,(compact ? 0.13 : -0.33)+a.drop*0.18); offhand.current.rotation.z=-a.drop*0.35 }
    }
  },-1)
  return <group ref={root} name="first-person-weapon"><ArsenalModel key={selected} weapon={weapon} parts={parts}/></group>
}
