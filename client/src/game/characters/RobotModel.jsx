import { ROBOT_PARTS } from '../../../../shared/robot.js'
import { PLAYER } from '../../../../shared/arena.js'

export default function RobotModel({ targetId, color = '#58dcff', flash = false, down = false, headRef }) {
  return <group>
    {ROBOT_PARTS.map(part => <group key={part.id} position={part.position} ref={part.id==='head' ? headRef : undefined}>
      <mesh name={`robot-${part.id}`} userData={{ blocksShot:true,targetId,hitRegion:part.region }}>
        <boxGeometry args={part.size} />
        <meshStandardMaterial color={down ? '#243044' : flash ? '#ffffff' : part.id==='head' ? '#607590' : '#354d68'} metalness={0.7} roughness={0.4} />
      </mesh>
      {(part.id==='head' || part.id==='torso') && <mesh position={[0,0,-part.size[2]/2-0.001]}>
        <planeGeometry args={[0.3,part.id==='head' ? 0.12 : 0.08]} /><meshBasicMaterial color={down ? '#485868' : color} />
      </mesh>}
    </group>)}
    <mesh position={[0,-PLAYER.height/2+0.025,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.37,0.4,24]} /><meshBasicMaterial color={color} transparent opacity={down ? 0.2 : 0.7} /></mesh>
  </group>
}
