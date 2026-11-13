import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ABILITIES } from '../../../../shared/abilities.js'
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
    shield.material.color.set(ult.effect==='shield' ? '#ffcc72' : '#60deff')
    const rootRing = group.getObjectByName('tactical-root')
    rootRing.visible = time<(s.rootedUntil || 0)
    rootRing.position.set(position[0],0.12,position[2])
    rootRing.rotation.z = time*2
    const aura = group.getObjectByName('tactical-ultimate')
    aura.visible = !local && ult.active
    aura.position.set(position[0],position[1],position[2])
    aura.rotation.y = time*2
    aura.material.color.set(getCharacter(s.characterId || s.loadout.character).color)
    for (const id of grenades) {
      const ability = s.abilities[id], projectile = group.getObjectByName(`grenade-${id}`), cloud = group.getObjectByName(`blast-${id}`)
      projectile.visible = !!ability.flying
      if (ability.flying) { projectile.position.set(...ability.projectile); projectile.rotation.x = time*8; projectile.rotation.z = time*5 }
      const age = time-ability.detonatedAt
      cloud.visible = id==='smoke' ? time<ability.activeUntil : age>=0 && age<0.5
      cloud.position.set(...ability.origin)
      if (id==='smoke') {
        cloud.position.y += 1
        cloud.scale.setScalar(ABILITIES.smoke.radius*Math.min(1,Math.max(0.01,age*3)))
        cloud.material.opacity = (local ? 0.52 : 0.98)*Math.min(1,(ability.activeUntil-time)*2)
      } else {
        cloud.scale.setScalar(Math.max(0.01,age*ABILITIES[id].radius*2))
        cloud.material.opacity = Math.max(0,0.65-age*1.3)
      }
    }
  })
  return <group ref={root}>
    <mesh name="tactical-shield" scale={[0.7,1.1,0.7]}><sphereGeometry args={[1,20,16]}/><meshBasicMaterial color="#60deff" wireframe transparent opacity={0.35} depthWrite={false}/></mesh>
    <mesh name="tactical-root" rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.48,0.63,6]}/><meshBasicMaterial color="#b39aff" transparent opacity={0.9} depthWrite={false}/></mesh>
    <mesh name="tactical-ultimate" scale={[0.65,1.1,0.65]}><icosahedronGeometry args={[1,1]}/><meshBasicMaterial wireframe transparent opacity={0.3} depthWrite={false}/></mesh>
    {grenades.map(id => <group key={id}>
      <mesh name={`grenade-${id}`}><octahedronGeometry args={[0.13]}/><meshBasicMaterial color={ABILITIES[id].color}/></mesh>
      <mesh name={`blast-${id}`}><sphereGeometry args={[1,24,16]}/><meshBasicMaterial color={id==='smoke' ? '#718c99' : ABILITIES[id].color} transparent depthWrite={false} side={2}/></mesh>
    </group>)}
  </group>
}
