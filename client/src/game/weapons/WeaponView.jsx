import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BLADE, WEAPON_SWITCH } from '../config.js'
import { game } from '../store.js'
import ShotgunModel from './ShotgunModel.jsx'
import EnergyCell from './EnergyCell.jsx'

function easeBetween(start, end, value) {
  const t = Math.max(0,Math.min(1,(value-start)/(end-start)))
  return t*t*(3-2*t)
}

export default function WeaponView({ source = game }) {
  const root = useRef(), pistol = useRef(), blade = useRef(), rifle = useRef(), flash = useRef(), rifleFlash = useRef(), trail = useRef()
  const shotgun = useRef(), shotgunFlash = useRef()
  const pistolCell = useRef(), rifleCell = useRef(), shotgunCell = useRef(), shotgunPump = useRef()
  useFrame(({ camera }) => {
    const s = source.get()
    if (!s) return
    const melee = s.weapon === 'blade', automatic = s.weapon === 'rifle'
    const scatter = s.weapon === 'shotgun'
    const time = source.now()
    const progress = Math.min(1,Math.max(0,(time-s.lastSwing)/BLADE.swing))
    const swing = Math.sin(progress*Math.PI)
    const equip = Math.max(0,1-(time-s.lastSwitch)/WEAPON_SWITCH)
    const recoil = Math.max(0,1-(time-s.lastShot)/(scatter ? 0.28 : automatic ? 0.1 : 0.18))
    const reloadProgress = s.reloading ? Math.max(0,Math.min(1,(time-s.reloadStart)/(s.reloadEnd-s.reloadStart))) : 0
    const reloadPose = easeBetween(0,0.2,reloadProgress)*(1-easeBetween(0.78,1,reloadProgress))
    const cellDrop = easeBetween(0.18,0.4,reloadProgress)*(1-easeBetween(0.55,0.8,reloadProgress))
    root.current.visible = s.hp>0
    root.current.position.copy(camera.position)
    root.current.quaternion.copy(camera.quaternion)
    root.current.translateX(melee ? 0.35-swing*0.52 : 0.32-reloadPose*0.08)
    root.current.translateY((melee ? -0.4+swing*0.12 : -0.28+reloadPose*0.24)-equip*0.18)
    root.current.translateZ(melee ? -0.6 : (scatter ? -0.76 : automatic ? -0.72 : -0.55)+recoil*(scatter ? 0.1 : automatic ? 0.045 : 0.055)-reloadPose*0.28)
    if (!melee) {
      root.current.rotateZ(-reloadPose*0.55)
      root.current.rotateX(reloadPose*0.18)
      root.current.rotateY(-reloadPose*0.3)
    }
    for (const cell of [pistolCell,rifleCell,shotgunCell]) {
      cell.current.position.set(-cellDrop*0.08,-cellDrop*0.18,0)
      cell.current.rotation.z = -cellDrop*0.25
    }
    shotgunPump.current.position.z = 0.12*Math.sin(Math.PI*easeBetween(0.78,1,reloadProgress))
    pistol.current.visible = s.weapon === 'pistol'
    blade.current.visible = melee
    rifle.current.visible = automatic
    shotgun.current.visible = scatter
    shotgun.current.rotation.x = recoil*0.07
    rifle.current.rotation.x = recoil*0.035
    blade.current.rotation.set(0.12,-0.2+swing*0.35,-0.35+swing*1.5)
    flash.current.visible = s.weapon === 'pistol' && time-s.lastShot < 0.09
    rifleFlash.current.visible = automatic && time-s.lastShot < 0.065
    rifleFlash.current.rotation.z = s.shot*1.7
    shotgunFlash.current.visible = scatter && time-s.lastShot<0.1
    trail.current.visible = melee && swing > 0.2
    trail.current.material.opacity = swing*0.45
  },-1)
  return <group ref={root} name="first-person-weapon">
    <group ref={shotgun}><ShotgunModel flash={shotgunFlash} cell={shotgunCell} pump={shotgunPump} /></group>
    <group ref={pistol}>
      <mesh position={[0,-0.1,0.1]} rotation={[0.2,0,0]}><boxGeometry args={[0.13,0.27,0.15]} /><meshStandardMaterial color="#1b2435" /></mesh>
      <EnergyCell cellRef={pistolCell} position={[0,-0.24,0.075]} size={[0.11,0.09,0.12]} color="#7aefff" />
      <mesh><boxGeometry args={[0.19,0.16,0.48]} /><meshStandardMaterial color="#566d86" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0,0.09,-0.04]}><boxGeometry args={[0.09,0.03,0.37]} /><meshBasicMaterial color="#00d9ff" /></mesh>
      <mesh position={[0,0.035,-0.27]}><boxGeometry args={[0.09,0.09,0.08]} /><meshBasicMaterial color="#b1f6ff" /></mesh>
      <mesh ref={flash} position={[0,0.035,-0.36]} scale={[0.7,0.7,1.6]}><octahedronGeometry args={[0.11]} /><meshBasicMaterial color="#65eeff" toneMapped={false} /></mesh>
    </group>
    <group ref={rifle}>
      <mesh position={[0,0,0.03]}><boxGeometry args={[0.19,0.19,0.52]} /><meshStandardMaterial color="#42566f" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0,-0.065,0.37]}><boxGeometry args={[0.14,0.18,0.26]} /><meshStandardMaterial color="#1d2b40" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0,0,-0.36]}><boxGeometry args={[0.12,0.13,0.28]} /><meshStandardMaterial color="#34445b" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0,-0.18,0.08]} rotation={[0.18,0,0]}><boxGeometry args={[0.1,0.25,0.15]} /><meshStandardMaterial color="#1b2435" /></mesh>
      <EnergyCell cellRef={rifleCell} position={[0,-0.18,-0.16]} size={[0.12,0.22,0.15]} color="#c0a4ff" />
      <mesh position={[0,0.12,0]}><boxGeometry args={[0.07,0.035,0.34]} /><meshBasicMaterial color="#af8dff" /></mesh>
      <mesh position={[0,0.16,0.12]}><boxGeometry args={[0.07,0.065,0.07]} /><meshStandardMaterial color="#6a7d99" metalness={0.8} roughness={0.3} /></mesh>
      {[-0.09,0.09].map(x => <mesh key={x} position={[x,0,-0.18]}><boxGeometry args={[0.012,0.045,0.24]} /><meshBasicMaterial color="#00d9ff" /></mesh>)}
      <mesh position={[0,0,-0.515]}><boxGeometry args={[0.075,0.075,0.025]} /><meshBasicMaterial color="#c6adff" /></mesh>
      <mesh ref={rifleFlash} position={[0,0,-0.61]} scale={[0.8,0.8,1.8]}><octahedronGeometry args={[0.1]} /><meshBasicMaterial color="#c5a8ff" toneMapped={false} /></mesh>
    </group>
    <group ref={blade}>
      <mesh position={[0,-0.08,0]}><cylinderGeometry args={[0.045,0.055,0.26,8]} /><meshStandardMaterial color="#26384f" metalness={0.8} roughness={0.35} /></mesh>
      <mesh position={[0,0.07,0]}><boxGeometry args={[0.27,0.055,0.1]} /><meshStandardMaterial color="#8395b1" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0,0.47,0]}><cylinderGeometry args={[0.025,0.065,0.75,4]} /><meshStandardMaterial color="#7cf3ff" emissive="#00d9ff" emissiveIntensity={2} metalness={0.2} roughness={0.2} /></mesh>
      <mesh position={[0,0.91,0]}><coneGeometry args={[0.025,0.14,4]} /><meshBasicMaterial color="#d9fcff" /></mesh>
      <mesh position={[0,0.47,0.037]}><boxGeometry args={[0.012,0.72,0.012]} /><meshBasicMaterial color="#e5ffff" /></mesh>
      <mesh position={[0,0.08,0.06]}><boxGeometry args={[0.15,0.02,0.012]} /><meshBasicMaterial color="#ac7dff" /></mesh>
      <mesh ref={trail} position={[0,0.3,-0.06]} rotation={[0,0,-0.3]}><torusGeometry args={[0.58,0.025,5,24,Math.PI*0.8]} /><meshBasicMaterial color="#58e9ff" transparent opacity={0.4} depthWrite={false} /></mesh>
    </group>
  </group>
}
