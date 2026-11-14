import { memo,useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { useGame,game } from '../store.js'
import { useLobby } from '../../multiplayer/lobby.js'
import { WEAPONS } from '../../../../shared/weapons.js'
import { weaponAnimation } from './animation.js'
import ArsenalModel from './ArsenalModel.jsx'
import { activeOptic,REFLEX_AIM_POSITION } from './optics.js'
import {animateParts} from './animateParts.js'
import OperativeArms from '../characters/OperativeArms.jsx'
import {runtime} from '../runtime.js'
import {arenaView} from '../../multiplayer/poses.js'

function WeaponView({ source=game }) {
  const detail=useGame(s=>s.settings.quality!=='Low')
  const local=useGame(s=>s.weapon),online=useLobby(s=>s.room?.players.find(p=>p.id===s.sessionId)?.combat.weapon)
  const selected=source===game ? local : online || 'pistol', weapon=WEAPONS[selected]
  const localCharacter=useGame(s=>s.loadout.character),onlineCharacter=useLobby(s=>s.room?.players.find(p=>p.id===s.sessionId)?.combat.characterId)
  const character=source===game ? localCharacter : onlineCharacter
  const root=useRef(),ads=useRef(0),reticle=useRef(),projection=useRef(),grip=useRef(),support=useRef()
  const action=useRef(),rotor=useRef(),offhand=useRef(),trail=useRef(),cell=useRef(),bolt=useRef(),pump=useRef(),hinge=useRef(),core=useRef(),flash=useRef(),eject=useRef()
  const parts={action,rotor,offhand,trail,cell,bolt,pump,hinge,core,flash,eject,reticle,projection,grip,support}
  useFrame(({ camera },delta)=> {
    const s=source.get()
    if (!s || s.weapon!==selected || !root.current) return
    const time=source.now(), a=weaponAnimation(s,time,weapon),melee=weapon.fireMode==='melee',compact=weapon.slot==='2'
    const inspect=Math.sin(Math.PI*Math.max(0,Math.min(1,(time-(game.get().inspectAt ?? -10))/2)))
    const optic=activeOptic(s,time,game.get().aiming),scoped=optic==='precision'
    ads.current=MathUtils.damp(ads.current,optic==='reflex' ? 1 : 0,18,Math.min(delta,0.1))
    const blend=ads.current,steady=1-blend*0.8
    const motion=source===game ? runtime : arenaView.motion,speed=Math.min(1.4,Math.hypot(motion.velocity[0],motion.velocity[2])/5),stride=Math.sin(time*10)*speed*(1-blend)
    const group=root.current
    // The hologram deploys only during ADS. Its HUD zero stays aligned with the
    // camera's shot direction through recoil and equip transitions.
    group.visible=s.hp>0 && !scoped; group.position.copy(camera.position); group.quaternion.copy(camera.quaternion)
    group.scale.setScalar(MathUtils.lerp(.86,1,blend))
    group.translateX(melee ? .34-a.hit*.34 : MathUtils.lerp(.31-a.reloadPose*.08,REFLEX_AIM_POSITION[0],blend))
    group.translateY((melee ? -.28+a.hit*.12 : MathUtils.lerp(-.22,REFLEX_AIM_POSITION[1],blend))+a.reloadPose*.22-a.equip*.3+Math.sin(time*1.8)*.002*(1-blend))
    group.translateZ((melee ? -.78 : MathUtils.lerp(compact ? -.76 : -.84,REFLEX_AIM_POSITION[2],blend))+a.kick*(weapon.recoil*2+.035)*steady-a.reloadPose*.2+a.equip*.2)
    group.rotateX(melee ? a.windup*-0.75+a.hit*0.15 : a.kick*weapon.recoil*3*steady+a.reloadPose*0.18)
    group.rotateZ(melee ? -0.28+a.hit*(weapon.model==='fangs' && (s.swings || 0)%2 ? -1.25 : 1.25) : -a.reloadPose*0.65-inspect*0.8*(1-blend))
    group.rotateY(-a.reloadPose*0.35+inspect*0.9*(1-blend))
    group.translateY(stride*.007);group.rotateZ(stride*.008)
    if(projection.current) { projection.current.visible=optic==='reflex';projection.current.scale.y=.9+blend*.1 }
    if(reticle.current) reticle.current.visible=false
    animateParts(parts,a,weapon,s,time,delta)
  },-1)
  return <><group ref={root} name="first-person-weapon">{detail && <pointLight position={[-.35,.55,.45]} intensity={2.6} distance={2.2} color="#c5d9f3"/>}<ArsenalModel key={selected} weapon={weapon} parts={parts}/></group><OperativeArms weaponRoot={root} parts={parts} source={source} characterId={character} firstPerson/></>
}

export default memo(WeaponView)
