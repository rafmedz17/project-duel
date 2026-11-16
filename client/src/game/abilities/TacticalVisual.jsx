import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ABILITIES } from '../../../../shared/abilities.js'
import SkillBursts from './SkillBursts.jsx'
import { getCharacter, ultimateModifiers } from '../../../../shared/characters.js'

const grenades = ['flashbang','smoke','stun']
export default function TacticalVisual({ read }) {
  const root = useRef()
  useFrame(() => {
    const view = read(), group = root.current
    if (!group) return
    group.visible = !!view && view.state.hp>0
    if (!view) return
    const { state:s,time,position,local } = view
    const ult = ultimateModifiers(s,time)
    const shield = group.getObjectByName('tactical-shield')
    shield.visible = !local && ((s.shieldCharge>0 && time<s.abilities.shield.activeUntil) || (ult.effect==='shield' && s.ultimateShield>0))
    shield.position.set(...position)
    shield.children.forEach(panel=>panel.children.forEach(mesh=>{mesh.material.color.set(ult.effect==='shield' ? '#d5a3ff' : '#73dbff');mesh.material.opacity=(mesh.userData.frame ? .8 : .12)+(time-s.shieldHit<.16 ? .18 : 0)}))
    const rootRing = group.getObjectByName('tactical-root')
    rootRing.visible = time<(s.rootedUntil || 0)
    rootRing.position.set(position[0],0.12,position[2])
    rootRing.rotation.z = time*2
    const aura = group.getObjectByName('tactical-ultimate')
    aura.visible = !local && ult.active && ult.effect!=='shield'
    aura.position.set(position[0],position[1],position[2])
    aura.rotation.y = time*2
    aura.material.color.set(getCharacter(s.characterId || s.loadout.character).color)
    for (const id of grenades) {
      const ability = s.abilities[id], projectile = group.getObjectByName(`grenade-${id}`)
      projectile.visible = !!ability.flying
      if (ability.flying) { projectile.position.set(...ability.projectile); projectile.rotation.x = time*8; projectile.rotation.z = time*5 }
      if(id!=='stun') continue
      const cloud=group.getObjectByName('blast-stun')
      const age = time-ability.detonatedAt
      cloud.visible = age>=0 && age<0.5
      cloud.position.set(...ability.origin)
      cloud.scale.setScalar(Math.max(0.01,age*ABILITIES[id].radius*2))
      cloud.material.opacity = Math.max(0,0.65-age*1.3)
    }
  })
  return <group ref={root}><SkillBursts read={read}/>
    <group name="tactical-shield">{Array.from({length:6},(_,i)=>{
      const angle=i*Math.PI/3
      return <group key={i} position={[Math.sin(angle)*.59,0,Math.cos(angle)*.59]} rotation={[0,angle,0]} scale={[.75,1.6,1]}>
        <mesh><circleGeometry args={[.46,6]}/><meshBasicMaterial transparent opacity={.12} side={2} depthWrite={false}/></mesh>
        <mesh userData={{frame:true}}><ringGeometry args={[.43,.46,6]}/><meshBasicMaterial transparent opacity={.8} side={2} depthWrite={false} toneMapped={false}/></mesh>
      </group>
    })}</group>
    <mesh name="tactical-root" rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.48,0.63,6]}/><meshBasicMaterial color="#b39aff" transparent opacity={0.9} depthWrite={false}/></mesh>
    <mesh name="tactical-ultimate" scale={[0.65,1.1,0.65]}><icosahedronGeometry args={[1,1]}/><meshBasicMaterial wireframe transparent opacity={0.3} depthWrite={false}/></mesh>
    {grenades.map(id => <group key={id}>
      <group name={`grenade-${id}`}>
        <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.09,.09,.23,6]}/><meshStandardMaterial color="#334658" metalness={.75} roughness={.3}/></mesh>
        {[-1,1].map(side=><mesh key={side} position={[0,0,side*.085]}><torusGeometry args={[.095,.018,4,6]}/><meshBasicMaterial color={ABILITIES[id].color} toneMapped={false}/></mesh>)}
      </group>
      {id==='stun' && <mesh name="blast-stun" rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.92,1,32]}/><meshBasicMaterial color={ABILITIES[id].color} transparent depthWrite={false} side={2} toneMapped={false}/></mesh>}
    </group>)}
  </group>
}
