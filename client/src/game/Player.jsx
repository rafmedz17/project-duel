import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { Euler } from 'three'
import { movementMultiplier,WEAPONS } from '../../../shared/weapons.js'
import { ONLINE } from '../../../shared/arena.js'
import { CROUCH,eyeHeight,updateStance } from '../../../shared/stance.js'
import { PLAYER, ABILITIES } from './config.js'
import { TRAINING_SPAWN } from './training/config.js'
import { ultimateModifiers } from '../../../shared/characters.js'
import { game } from './store.js'
import { runtime } from './runtime.js'
import WeaponView from './weapons/WeaponView.jsx'
import { useCombatInput } from './weapons/useCombatInput.js'
import { useAbilityInput } from './abilities/useAbilityInput.js'
import TacticalEffects from './abilities/TacticalEffects.jsx'
import { canonicalCode } from '../settings/preferences.js'
import { lookMultiplier } from '../settings/sensitivity.js'

export default function Player() {
  const body = useRef(), collider = useRef(), seenShot=useRef(0),fireInput=useRef(false)
  const keys = useRef(new Set()), look = useRef({ yaw: 0, pitch: 0 }), motion = useRef({ x: 0, z: 0, y: 0, jump: false, crouched:false,dashUses:0, dashRemaining:0 })
  const { camera, gl, scene } = useThree()
  const { world,rapier } = useRapier()
  const controller = useRef()
  const accumulated = useRef(0), frames = useRef({ count: 0, time: 0 })
  useCombatInput(camera,gl.domElement,scene,look,fireInput)
  useAbilityInput(body,keys,look,gl.domElement)

  useEffect(() => {
    const character = world.createCharacterController(0.02)
    character.setSlideEnabled(true)
    character.enableSnapToGround(0.15)
    character.setMaxSlopeClimbAngle(Math.PI/4)
    controller.current = character
    runtime.peakHeight = TRAINING_SPAWN[1]
    runtime.position=[...TRAINING_SPAWN]
    runtime.velocity=[0,0,0]
    runtime.crouched=false
    Object.assign(motion.current,{world,standingShape:new rapier.Capsule(ONLINE.capsuleHalfHeight,ONLINE.capsuleRadius)})
    game.set({ ready: true })
    return () => { world.removeCharacterController(character); controller.current = null; game.set({ ready: false }) }
  }, [world,rapier])

  useEffect(() => {
    const down = event => {
      if (game.get().mode !== 'playing' || document.pointerLockElement!==gl.domElement) return
      const code=canonicalCode(event,game.get().settings)
      if (['Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyR'].includes(code)) event.preventDefault()
      keys.current.add(code)
      if (code === 'Space' && !event.repeat) motion.current.jump = true
      if (code === 'KeyG' && !event.repeat) { event.preventDefault();game.toggleCourse() }
    }
    const up = event => keys.current.delete(canonicalCode(event,game.get().settings))
    const move = event => {
      if (game.get().mode !== 'playing' || document.pointerLockElement !== gl.domElement) return
      const s=game.get(),sensitivity=PLAYER.sensitivity*lookMultiplier(s.settings,s,game.now(),{aiming:s.aiming,firing:fireInput.current})
      look.current.yaw -= event.movementX * sensitivity
      look.current.pitch = Math.max(-1.48, Math.min(1.48, look.current.pitch - event.movementY * sensitivity))
    }
    const lock = () => {
      keys.current.clear(); motion.current.jump = false
      if (document.pointerLockElement === gl.domElement) game.set({ mode: 'playing', error: '' })
      else if (game.get().mode === 'playing') game.set({ mode: 'paused' })
    }
    const blur = () => { keys.current.clear(); if (game.get().mode === 'playing') { game.set({ mode: 'paused' }); document.exitPointerLock() } }
    const visibility = () => { if (document.hidden) blur() }
    const error = () => game.set({ error: 'Mouse capture was blocked. Click Resume to try again.', mode: 'paused' })
    document.addEventListener('mousedown',down);document.addEventListener('mouseup',up)
    document.addEventListener('keydown', down); document.addEventListener('keyup', up)
    document.addEventListener('mousemove', move)
    document.addEventListener('pointerlockchange', lock); document.addEventListener('pointerlockerror', error)
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility)
    return () => {
      document.removeEventListener('mousedown',down);document.removeEventListener('mouseup',up)
      document.removeEventListener('keydown', down); document.removeEventListener('keyup', up)
      document.removeEventListener('mousemove', move)
      document.removeEventListener('pointerlockchange', lock); document.removeEventListener('pointerlockerror', error)
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility)
    }
  }, [camera, gl, scene])

  useBeforePhysicsStep(() => {
    if (!body.current || !collider.current || !controller.current || game.get().mode !== 'playing') return
    const dt = 1/60, m = motion.current, pressed = keys.current, c = controller.current
    Object.assign(m,{body:body.current,collider:collider.current})
    updateStance(m,pressed.has('ControlLeft') || pressed.has('ControlRight'))
    runtime.crouched=m.crouched
    let x = Number(pressed.has('KeyD')) - Number(pressed.has('KeyA'))
    let z = Number(pressed.has('KeyS')) - Number(pressed.has('KeyW'))
    if (game.now()<game.get().rootedUntil) { x=0; z=0; m.x=0; m.z=0; m.jump=false; m.dashRemaining=0 }
    const length = Math.hypot(x,z) || 1
    x /= length; z /= length
    const speed = (m.crouched ? PLAYER.speed*CROUCH.speed : pressed.has('ShiftLeft') || pressed.has('ShiftRight') ? PLAYER.sprint : PLAYER.speed)*movementMultiplier(game.get().weapon)*ultimateModifiers(game.get(),game.now()).movement
    const yaw = look.current.yaw, smooth = 1-Math.exp(-14*dt)
    m.x += ((x*Math.cos(yaw)+z*Math.sin(yaw))*speed-m.x)*smooth
    m.z += ((z*Math.cos(yaw)-x*Math.sin(yaw))*speed-m.z)*smooth
    const dash = game.get().abilities.dash
    if (dash.uses !== m.dashUses) {
      m.dashRemaining=dash.uses>m.dashUses ? ABILITIES.dash.duration : 0
      m.dashUses=dash.uses
    }
    // Consume dash time in fixed physics steps, including a fractional final
    // step, so slow render frames cannot shorten or lengthen its distance.
    const dashDt = Math.min(dt,m.dashRemaining)
    m.dashRemaining -= dashDt
    const dx = m.x*(dt-dashDt)+dash.direction[0]*ABILITIES.dash.speed*dashDt
    const dz = m.z*(dt-dashDt)+dash.direction[1]*ABILITIES.dash.speed*dashDt
    if (c.computedGrounded() && m.y <= 0) m.y = -0.5
    if (m.jump && c.computedGrounded()) m.y = PLAYER.jump
    m.jump = false; m.y -= PLAYER.gravity*dt
    c.computeColliderMovement(collider.current, { x:dx,y:m.y*dt,z:dz })
    const delta = c.computedMovement(), p = body.current.translation()
    runtime.position = [p.x,p.y,p.z]
    runtime.velocity = [delta.x/dt,delta.y/dt,delta.z/dt]
    runtime.peakHeight = Math.max(runtime.peakHeight,p.y)
    runtime.grounded = c.computedGrounded()
    if (Math.abs(delta.y) < Math.abs(m.y*dt)*0.5 && m.y > 0) m.y = 0
    body.current.setNextKinematicTranslation({ x:p.x+delta.x,y:p.y+delta.y,z:p.z+delta.z })
    if (p.y < -5) { game.reset({ loadout:game.get().loadout,bank:game.get().trainingBank }); return }
  })

  useFrame((_, delta) => {
    if (!body.current) return
    const state = game.get(), p = body.current.translation()
    if(state.hp<=0 || state.reloading) fireInput.current=false
    if (state.shot>seenShot.current && state.lastShot>=0 && state.mode==='playing') {
      const weapon=WEAPONS[state.weapon],count=Math.min(3,state.shot-seenShot.current)
      look.current.pitch=Math.min(1.48,look.current.pitch+weapon.recoil*count)
      look.current.yaw+=Math.sin(state.shot*2.4)*weapon.recoil*0.3
    }
    seenShot.current=state.shot
    camera.position.set(p.x,p.y+eyeHeight(motion.current.crouched),p.z)
    camera.quaternion.setFromEuler(new Euler(look.current.pitch,look.current.yaw,0,'YXZ'))
    runtime.yaw = look.current.yaw; runtime.pitch = look.current.pitch
    if (state.mode === 'playing') {
      const dt = Math.min(delta,0.1)
      accumulated.current += dt
      const publish = accumulated.current >= 0.05
      game.tick(dt,publish)
      if (publish) accumulated.current = 0
    }
    frames.current.count++; frames.current.time += delta
    if (frames.current.time >= 0.5) { game.set({ fps: Math.round(frames.current.count/frames.current.time) }); frames.current = { count:0,time:0 } }
  },-2)

  return <>
    <RigidBody ref={body} userData={{ entity:'player' }} type="kinematicPosition" colliders={false} position={TRAINING_SPAWN} enabledRotations={[false,false,false]}><CapsuleCollider ref={collider} args={[ONLINE.capsuleHalfHeight,ONLINE.capsuleRadius]} /></RigidBody>
    <WeaponView />
    <TacticalEffects />
  </>
}

