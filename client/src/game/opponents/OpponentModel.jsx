import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { OPPONENT } from '../config.js'
import { game } from '../store.js'

const hitData = { targetId:OPPONENT.id,blocksShot:true }
export default function OpponentModel() {
  const root = useRef(), core = useRef(), eye = useRef(), health = useRef(), ring = useRef()
  useFrame((_,delta) => {
    const enemy = game.get().opponent, time = game.now(), alive = enemy.hp>0
    const dt = game.get().mode === 'playing' ? Math.min(delta,0.1) : 0
    const color = time-enemy.hit<0.12 ? '#ffffff' : enemy.phase === 'jammed' ? '#b48aff' : enemy.phase === 'windup' ? '#ff6e81' : '#00d9ff'
    core.current.material.emissive.set(color)
    eye.current.material.color.set(color)
    health.current.scale.x = Math.max(0.001,enemy.hp/OPPONENT.health)
    health.current.position.x = -(1-enemy.hp/OPPONENT.health)*0.5
    root.current.scale.setScalar(MathUtils.damp(root.current.scale.x,alive ? 1 : 0,10,dt))
    root.current.rotation.z = MathUtils.damp(root.current.rotation.z,alive ? 0 : 1.5,8,dt)
    root.current.position.y = alive ? Math.sin(time*2.5)*0.035 : 0
    ring.current.rotation.z = time*0.7
  })
  return <group ref={root}>
    <mesh ref={core} userData={hitData}><icosahedronGeometry args={[0.5,1]} /><meshStandardMaterial color="#30445e" emissive="#00d9ff" emissiveIntensity={0.25} metalness={0.7} roughness={0.35} /></mesh>
    <mesh ref={ring} userData={hitData} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.52,0.028,6,24]} /><meshBasicMaterial color="#8298b2" /></mesh>
    <mesh ref={eye} userData={hitData} position={[0,0.07,0.48]}><sphereGeometry args={[0.17,12,8]} /><meshBasicMaterial color="#00d9ff" /></mesh>
    {[-0.47,0.47].map(x => <mesh key={x} userData={hitData} position={[x,-0.12,0]}><boxGeometry args={[0.15,0.32,0.42]} /><meshStandardMaterial color="#566b84" metalness={0.7} roughness={0.4} /></mesh>)}
    <mesh position={[0,-0.58,0]} userData={hitData}><coneGeometry args={[0.14,0.28,6]} /><meshBasicMaterial color="#7ceaff" /></mesh>
    <mesh position={[0,0.81,0]}><boxGeometry args={[1,0.06,0.05]} /><meshBasicMaterial color="#23334a" /></mesh>
    <mesh ref={health} position={[0,0.81,0.035]}><boxGeometry args={[1,0.05,0.025]} /><meshBasicMaterial color="#68edff" /></mesh>
  </group>
}
