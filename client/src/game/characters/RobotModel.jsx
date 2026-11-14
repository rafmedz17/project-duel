import { ROBOT_PARTS,robotParts } from '../../../../shared/robot.js'
import { getCharacter } from '../../../../shared/characters.js'
import { useEffect,useMemo,useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide,MeshBasicMaterial,MeshStandardMaterial } from 'three'
import { useGame } from '../store.js'
import { armorGeometry } from './armorGeometry.js'

const noRaycast=()=>null

export default function RobotModel({ targetId,characterId='vex',color,flash=false,down=false,headRef,revealed=false,reveal,enemy=false,stance,equipped=false }) {
  const settings=useGame(s=>s.settings),aura=enemy && settings.enemyAura && !down
  const character=getCharacter(characterId),accent=color || character.color
  const root=useRef(),parts=useRef({}),lastStance=useRef(false)
  const geometry=useMemo(()=>ROBOT_PARTS.map(part=>armorGeometry(part,character,equipped)),[character,equipped])
  const materials=useMemo(()=>({
    armor:new MeshStandardMaterial({vertexColors:true,metalness:.32,roughness:.42}),
    light:new MeshBasicMaterial({color:accent,toneMapped:false}),
    outline:new MeshBasicMaterial({color:settings.enemyColor,side:BackSide,transparent:true,opacity:.28,depthWrite:false}),
  }),[accent,settings.enemyColor])
  useEffect(()=>()=>Object.values(materials).forEach(material=>material.dispose()),[materials])
  useFrame(({clock})=> {
    const crouched=Boolean(stance?.())
    if(crouched!==lastStance.current) {
      robotParts(crouched).forEach((part,index)=>{
        const group=parts.current[part.id],base=ROBOT_PARTS[index]
        group.position.set(...part.position)
        group.scale.set(...part.size.map((value,axis)=>value/base.size[axis]))
        if(part.id!=='head') group.rotation.set(...(part.rotation || [0,0,0]))
      })
      lastStance.current=crouched
    }
    const visible=!down && (revealed || Boolean(reveal?.()))
    const armor=parts.current.head.getObjectByName('armor-head').material
    const light=parts.current.head.getObjectByName('armor-lights-head').material
    for(const material of [armor,light]) if(material.transparent!==visible) {
      material.transparent=visible;material.needsUpdate=true
    }
    armor.depthTest=!visible;armor.depthWrite=!visible
    light.depthTest=!visible;light.depthWrite=!visible
    armor.color.set(down ? '#4a5360' : color || '#ffffff')
    armor.emissive.set(flash ? '#ffffff' : visible ? accent : aura ? settings.enemyColor : '#000000')
    armor.emissiveIntensity=flash ? .8 : visible ? 1.25 : aura ? .09 : 0
    light.color.set(down ? '#34404c' : flash ? '#ffffff' : accent)
    // Subtle reactor breathing; no flashing skills or extra combat effects.
    light.color.multiplyScalar(down ? 1 : .9+Math.sin(clock.elapsedTime*1.7+Number(character.number))*.1)
    root.current.traverse(mesh=>{if(mesh.userData.characterArmor) mesh.renderOrder=visible ? 100 : 0})
  })
  return <group ref={root} name={`operative-${character.name.toLowerCase()}`}>
    {ROBOT_PARTS.map((part,index)=><group key={part.id} position={part.position} ref={node=>{parts.current[part.id]=node;if(part.id==='head' && headRef) headRef.current=node}}>
      <mesh name={`robot-${part.id}`} userData={{blocksShot:!down,targetId,hitRegion:part.region}}>
        <boxGeometry args={part.size}/><meshBasicMaterial visible={false}/>
      </mesh>
      <mesh name={`armor-${part.id}`} geometry={geometry[index].armor} material={materials.armor} dispose={null} raycast={noRaycast} userData={{characterArmor:true}}/>
      {geometry[index].lights.attributes.position && <mesh name={`armor-lights-${part.id}`} geometry={geometry[index].lights} material={materials.light} dispose={null} raycast={noRaycast} userData={{characterArmor:true}}/>}
      {aura && <mesh name="enemy-aura" scale={[1.035,1.035,1.035]} geometry={geometry[index].armor} material={materials.outline} dispose={null} raycast={noRaycast}/>}
    </group>)}
  </group>
}
