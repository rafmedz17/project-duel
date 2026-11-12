import { useRef } from 'react'
import { MathUtils, Quaternion } from 'three'
import { RigidBody, CuboidCollider, useBeforePhysicsStep } from '@react-three/rapier'
import { TARGETS, HAZARD } from './config.js'
import { useGame } from './store.js'
import RobotModel from './characters/RobotModel.jsx'
import { ROBOT_PARTS } from '../../../shared/robot.js'
import { getMap } from '../../../shared/maps.js'

function Box({ position, size, color = '#263849', glow = false, solid = false }) {
  const mesh = <mesh position={position} userData={{ blocksShot: solid }}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.65} metalness={0.45} emissive={glow ? color : '#000000'} emissiveIntensity={glow ? 2 : 0} /></mesh>
  return solid ? <RigidBody type="fixed" colliders={false}><CuboidCollider args={size.map(n => n / 2)} position={position} />{mesh}</RigidBody> : mesh
}
function TargetBody({ down, height, children }) {
  const body = useRef(), angle = useRef(0), rotation = useRef(new Quaternion())
  useBeforePhysicsStep(() => {
    if (!body.current) return
    const p = body.current.translation()
    angle.current = MathUtils.damp(angle.current, down ? -1.25 : 0, 12, 1/60)
    rotation.current.set(Math.sin(angle.current/2),0,0,Math.cos(angle.current/2))
    body.current.setNextKinematicRotation(rotation.current)
    body.current.setNextKinematicTranslation({ x:p.x,y:MathUtils.damp(p.y,down ? 0.5 : height,12,1/60),z:p.z })
  })
  return <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0,height,0]}>{ROBOT_PARTS.map(part => <CuboidCollider key={part.id} args={part.size.map(n => n/2)} position={[-part.position[0],part.position[1],-part.position[2]]} />)}{children}</RigidBody>
}
export default function Arena({ training = true,mapId = 'facility' }) {
  const { targets, time, settings, hazards, generation } = useGame()
  const map = getMap(mapId)
  return <>
    <color attach="background" args={[map.background]} />
    <fog attach="fog" args={[map.background, 25, 80]} />
    <ambientLight intensity={0.65} /><hemisphereLight args={['#a8dfff', '#111827', 1.8]} />
    <directionalLight position={[8, 18, 10]} intensity={2.8} color="#b6d9ff" />
    {settings.quality !== 'Low' && <pointLight position={[0, 5, -10]} color="#7c3aed" intensity={65} distance={28} />}
    {map.solids.map((solid,index) => <Box key={index} {...solid} solid />)}
    <gridHelper args={[40, 20, map.accent, '#243c4e']} position={[0, 0.012, 0]} />
    {[-20, 20].map(v => <group key={v}>
      <Box position={[v * 0.972, 0.25, 0]} size={[0.07, 0.1, 39]} color={map.accent} glow />
      <Box position={[0, 0.25, v * 0.972]} size={[39, 0.1, 0.07]} color={map.accent} glow />
      {[-16, -8, 0, 8, 16].map(x => <group key={x}>
        <Box position={[x, 3.6, v * 0.935]} size={[0.12, 2.5, 0.05]} color={v < 0 ? '#7c3aed' : '#00d9ff'} glow />
      </group>)}
    </group>)}
    {map.cover.map(([x,y,z,w,,d], i) => <group key={i}>
      <Box position={[x,y+0.2,z+d/2+0.015]} size={[w*0.8,0.06,0.025]} glow color={map.accent} />
      <Box position={[x,y+0.2,z-d/2-0.015]} size={[w*0.8,0.06,0.025]} glow color={map.accent} />
    </group>)}
    {mapId==='neon' && [-12,12].flatMap(x => [-9,9].map(z => <group key={`${x}-${z}`}><Box position={[x,3.6,z]} size={[2.1,0.18,2.1]} color={map.accent} glow /><Box position={[x,2.3,z+1.02]} size={[1.3,0.8,0.03]} color="#4dceff" glow /></group>))}
    {mapId==='orbital' && <group><Box position={[0,5.2,0]} size={[3,0.2,3]} color={map.accent} glow />{[-13,13].flatMap(x => [-10,0,10].map(z => <Box key={`${x}-${z}`} position={[x,2.47,z]} size={[1.8,0.08,2.7]} color={map.accent} glow />))}</group>}
    {[-12, 12].map(x => <Box key={x} position={[x,5.22,0]} size={[0.15,0.04,37]} color="#88e5ff" glow />)}
    {!training && <Box position={[0,0.025,-15]} size={[5,0.03,4]} color="#49351c" />}
    <Box position={[0,0.025,15]} size={[5,0.03,4]} color="#17404d" />
    {[-2.5,2.5].map(x => <Box key={x} position={[x,0.05,15]} size={[0.06,0.03,4]} color="#00d9ff" glow />)}
    {/* Marked hazard pads deal damage only while standing on the visible amber field. */}
    {training && HAZARD.centers.map((x,index) => {
      const disabled = time<hazards[index].disabledUntil
      return <group key={`${index}-${disabled}`}><Box position={[x,0.035,HAZARD.z]} size={[HAZARD.halfSize*2,0.04,HAZARD.halfSize*2]} color={disabled ? '#123d49' : '#8b4d12'} /><gridHelper position={[x,0.065,HAZARD.z]} args={[HAZARD.halfSize*2,6,disabled ? '#55dbe1' : '#ffb52b',disabled ? '#55dbe1' : '#ffb52b']} /></group>
    })}
    {training && TARGETS.map(([x,y,z], id) => {
      const target = targets[id]
      const down = target.hp === 0
      const flash = time - target.hit < 0.13
      const disabled = time<target.disabledUntil
      return <group key={`${generation}-${id}`} position={[x,0,z]}>
        <Box position={[0,0.375,0]} size={[1.2,0.75,1]} color="#36475b" solid />
        <TargetBody down={down} height={y}>
          <group rotation={[0,Math.PI,0]}><RobotModel targetId={id} down={down} flash={flash} color={disabled ? '#af8dff' : '#58dcff'} /></group>
          <Box position={[0,1.06,0]} size={[1.2,0.08,0.1]} color="#283748" />
          {target.hp > 0 && <Box position={[-0.6+(target.hp/100)*0.6,1.06,0.06]} size={[1.2*target.hp/100,0.06,0.04]} color="#00d9ff" glow />}
        </TargetBody>
      </group>
    })}
  </>
}

