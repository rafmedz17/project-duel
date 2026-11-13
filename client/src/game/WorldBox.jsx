import { RigidBody,CuboidCollider } from '@react-three/rapier'

export default function WorldBox({ position,size,color='#263849',glow=false,solid=false }) {
  const mesh=<mesh position={position} userData={{ blocksShot:solid,coverSolid:solid ? { position,size } : undefined }}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={0.65} metalness={0.45} emissive={glow ? color : '#000000'} emissiveIntensity={glow ? 1.6 : 0}/></mesh>
  return solid ? <RigidBody type="fixed" colliders={false}><CuboidCollider args={size.map(n=>n/2)} position={position}/>{mesh}</RigidBody> : mesh
}
