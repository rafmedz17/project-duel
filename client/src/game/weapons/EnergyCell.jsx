export default function EnergyCell({ cellRef, color, position, size }) {
  return <group position={position}>
    <group ref={cellRef} name="reload-energy-cell">
      <mesh><boxGeometry args={size} /><meshStandardMaterial color="#26344e" metalness={0.65} roughness={0.3} /></mesh>
      <mesh position={[0,0,size[2]/2+0.002]}><boxGeometry args={[size[0]*0.65,size[1]*0.6,0.008]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh position={[size[0]/2+0.002,0,0]}><boxGeometry args={[0.008,size[1]*0.6,size[2]*0.65]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  </group>
}
