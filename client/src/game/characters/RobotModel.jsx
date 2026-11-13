import { ROBOT_PARTS } from '../../../../shared/robot.js'
import { PLAYER } from '../../../../shared/arena.js'
import { getCharacter } from '../../../../shared/characters.js'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide } from 'three'
import { useGame } from '../store.js'

export default function RobotModel({ targetId, characterId = 'vex', color, flash = false, down = false, headRef, revealed = false, reveal,enemy=false }) {
  const settings=useGame(s=>s.settings),aura=enemy && settings.enemyAura && !down
  const character = getCharacter(characterId), accent = color || character.color
  const root = useRef()
  useFrame(() => {
    if (!reveal || !root.current) return
    const visible = !down && reveal()
    root.current.traverse(mesh => {
      if (!mesh.userData.characterArmor) return
      mesh.renderOrder = visible ? 100 : 0
      mesh.material.depthTest = !visible
      mesh.material.depthWrite = !visible
      if (mesh.material.transparent!==visible) { mesh.material.transparent=visible; mesh.material.needsUpdate=true }
      mesh.material.emissive.set(visible ? accent : aura ? settings.enemyColor : '#000000')
      mesh.material.emissiveIntensity = visible ? 1.5 : aura ? .42 : 0
    })
  })
  return <group ref={root}>
    {ROBOT_PARTS.map(part => <group key={part.id} position={part.position} ref={part.id==='head' ? headRef : undefined}>
      <mesh name={`robot-${part.id}`} renderOrder={revealed ? 100 : 0} userData={{ blocksShot:!down,targetId,hitRegion:part.region,characterArmor:true }}>
        <boxGeometry args={part.size} />
        <meshStandardMaterial depthTest={!revealed} color={down ? '#243044' : flash ? '#ffffff' : revealed ? accent : part.id==='head' ? character.secondary : character.armor} emissive={revealed ? accent : aura ? settings.enemyColor : '#000000'} emissiveIntensity={revealed ? 0.8 : aura ? .42 : 0} metalness={0.65} roughness={0.4} />
      </mesh>
      {aura && <mesh name="enemy-aura" scale={[1.055,1.055,1.055]} raycast={()=>null}><boxGeometry args={part.size}/><meshBasicMaterial color={settings.enemyColor} side={BackSide} transparent opacity={.36} depthWrite={false}/></mesh>}
      {(part.id==='head' || part.id==='torso') && <group position={[0,0,-part.size[2]/2-0.002]} rotation={[0,Math.PI,0]}>
        {character.motif==='engine' ? <mesh><ringGeometry args={[part.id==='head' ? 0.07 : 0.09,part.id==='head' ? 0.095 : 0.13,24]} /><meshBasicMaterial color={down ? '#485868' : accent} /></mesh> : character.motif==='hunter' ? [-1,0,1].map(index => <mesh key={index} position={[index*0.085,0,0]} rotation={[0,0,-0.45]}><planeGeometry args={[0.022,part.id==='head' ? 0.14 : 0.22]} /><meshBasicMaterial color={down ? '#485868' : accent}/></mesh>) : <>
          <mesh rotation={[0,0,character.motif==='runner' ? 0.12 : 0]}><planeGeometry args={[0.29,part.id==='head' ? 0.05 : 0.055]} /><meshBasicMaterial color={down ? '#485868' : accent}/></mesh>
          {character.motif==='warden' && <mesh><planeGeometry args={[0.045,part.id==='head' ? 0.25 : 0.3]}/><meshBasicMaterial color={down ? '#485868' : accent}/></mesh>}
        </>}
      </group>}
    </group>)}
    <mesh position={[0,-PLAYER.height/2+0.025,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.37,0.4,24]} /><meshBasicMaterial color={accent} transparent opacity={down ? 0.2 : 0.7} /></mesh>
  </group>
}
