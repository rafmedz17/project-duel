import {forwardRef,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {Quaternion,Vector3} from 'three'
import {getCharacter} from '../../../../shared/characters.js'
import {WEAPONS} from '../../../../shared/weapons.js'
import {weaponAnimation} from '../weapons/animation.js'

function Plate({position=[0,0,0],size,color,glow=false}) {
  return <mesh position={position} raycast={()=>null}><boxGeometry args={size}/>{glow ? <meshBasicMaterial color={color} toneMapped={false}/> : <meshStandardMaterial color={color} metalness={.55} roughness={.48}/>}</mesh>
}

const Glove=forwardRef(function Glove({side,character,motion,name},ref) {
  const fingers=useRef([]),tips=useRef([]),thumb=useRef()
  useFrame(()=>{
    const {trigger,open}=motion.current
    for(let i=0;i<4;i++) {
      const curl=(i===0 ? .56+trigger*.45 : 1.05)-open*.65
      fingers.current[i].rotation.x=-curl
      tips.current[i].rotation.x=-.9+open*.55
    }
    thumb.current.rotation.x=-.55+open*.35
  },-.25)
  return <group ref={ref} name={name}>
    <Plate size={[.103,.115,.088]} color={character.armor}/>
    <Plate position={[0,0,.049]} size={[.083,.083,.017]} color={character.secondary}/>
    <Plate position={[0,-.038,.06]} size={[.064,.012,.008]} color={character.color} glow/>
    <mesh position={[0,-.087,.015]} raycast={()=>null}><cylinderGeometry args={[.052,.059,.065,8]}/><meshStandardMaterial color="#152432" roughness={.7}/></mesh>
    <Plate position={[0,-.089,.064]} size={[.065,.025,.012]} color={character.color}/>
    {[0,1,2,3].map(i=><group key={i} ref={node=>{fingers.current[i]=node}} position={[side*(.034-i*.023),.052,-.017]} name={`${name}-finger-${i}`}>
      <Plate position={[0,.022,0]} size={[.019,.044,.025]} color={i===0 ? '#78919d' : '#4a626f'}/>
      <group ref={node=>{tips.current[i]=node}} position={[0,.041,0]}>
        <Plate position={[0,.018,0]} size={[.018,.036,.023]} color={character.armor}/>
        <Plate position={[0,.034,.004]} size={[.015,.013,.025]} color="#21313c"/>
      </group>
    </group>)}
    <group ref={thumb} position={[-side*.065,-.01,0]} rotation={[0,0,side*.55]}><Plate position={[0,.02,0]} size={[.031,.05,.033]} color="#5c7380"/><Plate position={[0,.049,-.01]} size={[.029,.03,.035]} color={character.armor}/></group>
  </group>
})

const Sleeve=forwardRef(function Sleeve({character,forearm,name},ref) {
  return <group ref={ref} name={name}>
    <mesh raycast={()=>null}><cylinderGeometry args={[forearm ? .052 : .074,forearm ? .073 : .082,1,8]}/><meshStandardMaterial color={character.armor} roughness={.65} metalness={.35}/></mesh>
    <Plate position={[0,.03,.061]} size={[forearm ? .1 : .12,.64,.034]} color={character.secondary}/>
    <Plate position={[0,.04,.082]} size={[.018,.42,.009]} color={character.color} glow/>
    {[-.26,.27].map(y=><Plate key={y} position={[0,y,.056]} size={[.112,.035,.032]} color="#69828b"/>)}
  </group>
})

function Arm({side,space,grip,source,firstPerson,character,stance}) {
  const upper=useRef(),lower=useRef(),elbowJoint=useRef(),hand=useRef()
  const motion=useRef({trigger:0,open:0})
  const transforms=useRef({hand:new Vector3(),wrist:new Vector3(),shoulder:new Vector3(),elbow:new Vector3(),direction:new Vector3(),axis:new Vector3(0,1,0),rotation:new Quaternion(),inverse:new Quaternion()})
  const prefix=firstPerson ? 'view' : 'remote',label=side===1 ? 'right' : 'left'
  useFrame(()=>{
    const m=transforms.current
    const root=space.current,s=source.get()
    if(!root || !s || !root.visible) return
    const weapon=WEAPONS[s.weapon],time=source.now(),a=weaponAnimation(s,time,weapon),anchor=grip.current
    root.updateWorldMatrix(true,false)
    if(anchor) {
      anchor.updateWorldMatrix(true,false)
      anchor.getWorldPosition(m.hand);root.worldToLocal(m.hand)
      anchor.getWorldQuaternion(m.rotation);root.getWorldQuaternion(m.inverse).invert()
      hand.current.quaternion.copy(m.inverse.multiply(m.rotation))
    } else {
      m.hand.set(firstPerson ? -.3 : -.24,firstPerson ? -.38 : -.16,firstPerson ? -.48 : -.27)
      hand.current.rotation.set(.12,-.2,.2)
    }
    hand.current.position.copy(m.hand)
    // The wrist is the end of the sleeve, rather than the center of the palm.
    m.wrist.set(0,-.095,.015).applyQuaternion(hand.current.quaternion).add(m.hand)
    const crouched=Boolean(stance?.())
    if(firstPerson) {
      m.shoulder.set(side*.38,-.27,-.04)
      m.elbow.copy(m.shoulder).lerp(m.wrist,.46)
      m.elbow.x+=side*.14;m.elbow.y-=.16;m.elbow.z+=.06
    } else {
      // Existing robot upper-arm armor and authoritative limb hit volumes stay
      // in place. Articulated forearms hinge from the armored elbows.
      m.shoulder.set(side*.3,crouched ? .2 : .34,0)
      m.elbow.set(side*.3,crouched ? -.24 : -.27,crouched ? -.03 : 0)
    }
    function link(node,from,to) {
      m.direction.copy(to).sub(from)
      const length=m.direction.length()
      node.position.copy(from).lerp(to,.5)
      node.quaternion.setFromUnitVectors(m.axis,m.direction.normalize())
      node.scale.set(1,Math.max(.001,length),1)
    }
    if(upper.current) link(upper.current,m.shoulder,m.elbow)
    link(lower.current,m.elbow,m.wrist);elbowJoint.current.position.copy(m.elbow)
    motion.current.trigger=weapon.fireMode==='melee' ? a.hit : a.kick
    motion.current.open=anchor ? side===-1 ? a.drop*.25 : 0 : .75
  },-.5)
  return <>
    {firstPerson && <Sleeve ref={upper} character={character} name={`${prefix}-upper-arm-${label}`}/>}
    <Sleeve ref={lower} character={character} forearm name={`${prefix}-forearm-${label}`}/>
    <mesh ref={elbowJoint} raycast={()=>null} name={`${prefix}-elbow-${label}`}><sphereGeometry args={[.077,8,6]}/><meshStandardMaterial color="#26343e" metalness={.6} roughness={.5}/></mesh>
    <Glove ref={hand} side={side} character={character} motion={motion} name={`${prefix}-hand-${label}`}/>
  </>
}

export default function OperativeArms({weaponRoot,parts,source,characterId,firstPerson=false,stance}) {
  const root=useRef(),character=getCharacter(characterId)
  useFrame(({camera})=>{
    if(!root.current) return
    root.current.visible=Boolean(weaponRoot.current?.visible && source.get()?.hp>0)
    if(firstPerson) {root.current.position.copy(camera.position);root.current.quaternion.copy(camera.quaternion)}
  },-.75)
  return <group ref={root} name={firstPerson ? 'view-arms' : 'remote-arms'}>
    <Arm side={1} space={root} grip={parts.grip} source={source} firstPerson={firstPerson} character={character} stance={stance}/>
    <Arm side={-1} space={root} grip={parts.support} source={source} firstPerson={firstPerson} character={character} stance={stance}/>
  </group>
}
