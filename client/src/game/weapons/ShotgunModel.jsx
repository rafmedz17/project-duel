import EnergyCell from './EnergyCell.jsx'

export default function ShotgunModel({ flash, cell, pump }) {
  return <>
    <mesh position={[0,0,0.02]}><boxGeometry args={[0.26,0.22,0.5]} /><meshStandardMaterial color="#3b5167" metalness={0.8} roughness={0.32} /></mesh>
    <mesh position={[0,-0.14,0.13]} rotation={[0.22,0,0]}><boxGeometry args={[0.13,0.26,0.16]} /><meshStandardMaterial color="#18283b" /></mesh>
    <mesh position={[0,-0.07,0.38]}><boxGeometry args={[0.18,0.16,0.22]} /><meshStandardMaterial color="#24384e" /></mesh>
    {[-0.07,0.07].map(x => <group key={x} position={[x,0,-0.37]}>
      <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.065,0.065,0.28,8]} /><meshStandardMaterial color="#667b90" metalness={0.85} roughness={0.3} /></mesh>
      <mesh position={[0,0,-0.15]}><torusGeometry args={[0.042,0.012,5,12]} /><meshBasicMaterial color="#ffc477" /></mesh>
    </group>)}
    <mesh position={[0,0.13,-0.04]}><boxGeometry args={[0.14,0.035,0.3]} /><meshBasicMaterial color="#ffbc5e" /></mesh>
    <group ref={pump}><mesh position={[0,-0.15,-0.15]}><boxGeometry args={[0.23,0.09,0.24]} /><meshStandardMaterial color="#203148" /></mesh></group>
    <EnergyCell cellRef={cell} position={[0,-0.25,0.08]} size={[0.16,0.13,0.16]} color="#ffc477" />
    <mesh ref={flash} position={[0,0,-0.6]} scale={[1.7,0.9,1.5]}><octahedronGeometry args={[0.13]} /><meshBasicMaterial color="#ffcf8c" toneMapped={false} /></mesh>
  </>
}
