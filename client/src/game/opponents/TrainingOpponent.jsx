import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, useRapier, useBeforePhysicsStep } from '@react-three/rapier'
import { Quaternion, Vector3 } from 'three'
import { OPPONENT } from '../config.js'
import { eyeHeight } from '../../../../shared/stance.js'
import { game, useGame } from '../store.js'
import { runtime } from '../runtime.js'
import { freshBrain, stepBrain } from './opponentRules.js'
import { castTrainingPulse, isPlayerHit } from './physics.js'
import OpponentModel from './OpponentModel.jsx'

export default function TrainingOpponent() {
  const body = useRef(), collider = useRef(), controller = useRef(), line = useRef(), warning = useRef(), meshes = useRef([])
  const brain = useRef(freshBrain(game.now())), waypoint = useRef(1), respawns = useRef(0), blocked = useRef(0)
  const bolts = useRef(Array.from({ length:OPPONENT.maxProjectiles },() => ({ active:false,position:new Vector3(),direction:new Vector3(),age:0 })))
  const direction = useRef(new Vector3()), rotation = useRef(new Quaternion())
  const { world,rapier } = useRapier()
  const enemy = useGame(s => s.opponent)
  useEffect(() => {
    controller.current = world.createCharacterController(0.02)
    controller.current.setSlideEnabled(true)
    return () => {
      world.removeCharacterController(controller.current)
      runtime.opponent = { position:[...OPPONENT.spawn],phase:'offline',projectiles:[] }
    }
  },[world])

  useBeforePhysicsStep(() => {
    if (!body.current || !controller.current || game.get().mode !== 'playing') return
    const s = game.get(), bot = s.opponent, time = game.now(), dt = 1/60
    const clearBolts = () => { bolts.current.forEach(b => { b.active = false }); runtime.opponent.projectiles = [] }
    if (bot.respawns !== respawns.current) {
      respawns.current = bot.respawns; waypoint.current = 1; blocked.current = 0
      body.current.setTranslation({ x:OPPONENT.spawn[0],y:OPPONENT.spawn[1],z:OPPONENT.spawn[2] },true)
      body.current.setNextKinematicTranslation({ x:OPPONENT.spawn[0],y:OPPONENT.spawn[1],z:OPPONENT.spawn[2] })
      brain.current = freshBrain(time); clearBolts()
    }
    const p = body.current.translation(), alive = bot.enabled && bot.hp>0
    collider.current.setEnabled(alive)
    game.reportOpponentPosition([p.x,p.y,p.z])
    runtime.opponent.position = [p.x,p.y,p.z]
    const player = [runtime.position[0],runtime.position[1]+eyeHeight(runtime.crouched),runtime.position[2]]
    direction.current.set(player[0]-p.x,player[1]-p.y,player[2]-p.z)
    const distance = direction.current.length()
    direction.current.normalize()
    const visible = alive && time>=bot.disabledUntil && distance<=OPPONENT.range && isPlayerHit(castTrainingPulse(world,rapier,p,direction.current,distance,body.current))
    brain.current = stepBrain(brain.current,{ time,distance,visible,alive,disabledUntil:bot.disabledUntil,playerPosition:player })
    runtime.opponent.phase = brain.current.phase
    game.opponentPhase(brain.current.phase)
    if (!alive || time<bot.disabledUntil) { clearBolts(); body.current.setNextKinematicTranslation(p); return }

    if (brain.current.fireAt && game.opponentShot()) {
      const pulse = bolts.current.find(b => !b.active)
      if (pulse) {
        pulse.direction.set(brain.current.fireAt[0]-p.x,brain.current.fireAt[1]-p.y,brain.current.fireAt[2]-p.z).normalize()
        pulse.position.set(p.x,p.y,p.z)
        pulse.age = 0; pulse.active = true
      }
    }
    if (brain.current.phase !== 'windup') {
      const target = OPPONENT.patrol[waypoint.current]
      const dx = target[0]-p.x, dz = target[1]-p.z, length = Math.hypot(dx,dz)
      if (length<0.25) waypoint.current = (waypoint.current+1)%OPPONENT.patrol.length
      else {
        const step = Math.min(length,OPPONENT.speed*dt)
        controller.current.computeColliderMovement(collider.current,{ x:dx/length*step,y:0,z:dz/length*step })
        const movement = controller.current.computedMovement()
        body.current.setNextKinematicTranslation({ x:p.x+movement.x,y:p.y,z:p.z+movement.z })
        blocked.current = Math.hypot(movement.x,movement.z)<step*0.2 ? blocked.current+dt : 0
        if (blocked.current>0.75) { waypoint.current = (waypoint.current+1)%OPPONENT.patrol.length; blocked.current = 0 }
        const yaw = Math.atan2(dx,dz)
        rotation.current.set(0,Math.sin(yaw/2),0,Math.cos(yaw/2)); body.current.setNextKinematicRotation(rotation.current)
      }
    } else {
      body.current.setNextKinematicTranslation(p)
      const yaw = Math.atan2(brain.current.aim[0]-p.x,brain.current.aim[2]-p.z)
      rotation.current.set(0,Math.sin(yaw/2),0,Math.cos(yaw/2)); body.current.setNextKinematicRotation(rotation.current)
    }
    for (const pulse of bolts.current) {
      if (!pulse.active) continue
      const travel = OPPONENT.projectileSpeed*dt
      const hit = castTrainingPulse(world,rapier,pulse.position,pulse.direction,travel,body.current)
      if (hit) { pulse.active = false; if (isPlayerHit(hit)) game.opponentHit() }
      else { pulse.position.addScaledVector(pulse.direction,travel); pulse.age += dt; if (pulse.age>=OPPONENT.projectileLifetime) pulse.active = false }
    }
    runtime.opponent.projectiles = bolts.current.filter(b => b.active).map(b => [b.position.x,b.position.y,b.position.z])
  })

  useFrame(() => {
    const time = game.now(), bot = game.get().opponent
    const warn = bot.hp>0 && brain.current.phase === 'windup'
    line.current.visible = warn; warning.current.visible = warn
    if (warn) {
      const p = runtime.opponent.position, aim = brain.current.aim, attr = line.current.geometry.attributes.position
      attr.setXYZ(0,p[0],p[1],p[2]); attr.setXYZ(1,...aim); attr.needsUpdate = true
      line.current.geometry.computeBoundingSphere()
      warning.current.position.set(aim[0],0.06,aim[2])
      warning.current.scale.setScalar(0.6+Math.sin(time*12)*0.04)
    }
    bolts.current.forEach((pulse,index) => { const mesh = meshes.current[index]; if (mesh) { mesh.visible = pulse.active; mesh.position.copy(pulse.position) } })
  })
  return <>
    <RigidBody ref={body} userData={{ entity:OPPONENT.id }} type="kinematicPosition" colliders={false} position={OPPONENT.spawn}>
      <CapsuleCollider ref={collider} args={[0.3,0.55]} enabled={enemy.hp>0} />
      <OpponentModel />
    </RigidBody>
    <line ref={line}><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(6),3]} /></bufferGeometry><lineBasicMaterial color="#ff7186" transparent opacity={0.65} /></line>
    <mesh ref={warning} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.85,1,24]} /><meshBasicMaterial color="#ff5973" transparent opacity={0.8} depthWrite={false} /></mesh>
    {Array.from({ length:OPPONENT.maxProjectiles },(_,index) => <mesh key={index} ref={mesh => { meshes.current[index] = mesh }}><icosahedronGeometry args={[0.13,0]} /><meshBasicMaterial color="#ff7896" /></mesh>)}
  </>
}
