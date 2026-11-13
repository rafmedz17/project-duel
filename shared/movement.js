import { PLAYER, ONLINE } from './arena.js'
import { ABILITIES } from './abilities.js'
import { CROUCH,updateStance } from './stance.js'

// Both the server and local prediction use the same fixed-step capsule sweep.
export function createMovementWorld(RAPIER, map) {
  const world = new RAPIER.World({ x:0,y:-PLAYER.gravity,z:0 })
  world.timestep = 1/ONLINE.tickRate
  for (const { position:[x,y,z],size:[w,h,d] } of map.solids) world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z))
  return world
}

export function createCharacter(RAPIER, world, position) {
  const [x,y,z] = position
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,y,z))
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(ONLINE.capsuleHalfHeight,ONLINE.capsuleRadius),body)
  const controller = world.createCharacterController(0.02)
  controller.setSlideEnabled(true)
  controller.enableSnapToGround(0.15)
  controller.setMaxSlopeClimbAngle(Math.PI/4)
  return { world,body,collider,controller,standingShape:new RAPIER.Capsule(ONLINE.capsuleHalfHeight,ONLINE.capsuleRadius),crouched:false,vx:0,vy:0,vz:0,grounded:false,dash:null }
}

export function stepCharacter(entry, input, jump = false) {
  updateStance(entry,input?.active && input.crouch)
  const dt = 1/ONLINE.tickRate
  let x = input?.active ? input.x : 0, z = input?.active ? input.z : 0
  const length = Math.max(1,Math.hypot(x,z))
  x /= length; z /= length
  const speed = (entry.crouched ? PLAYER.speed*CROUCH.speed : input?.sprint ? PLAYER.sprint : PLAYER.speed)*(entry.movement || 1), yaw = input?.yaw || 0
  const smooth = 1-Math.exp(-14*dt)
  entry.vx += ((x*Math.cos(yaw)+z*Math.sin(yaw))*speed-entry.vx)*smooth
  entry.vz += ((z*Math.cos(yaw)-x*Math.sin(yaw))*speed-entry.vz)*smooth
  if (entry.grounded && entry.vy<=0) entry.vy = -0.5
  if (input?.active && jump && entry.grounded) entry.vy = PLAYER.jump
  entry.vy -= PLAYER.gravity*dt
  const dash = entry.dash, dashTime = dash ? Math.min(dt,dash.remaining) : 0
  entry.controller.computeColliderMovement(entry.collider,{
    x:(dash ? dash.direction[0]*ABILITIES.dash.speed*dashTime : entry.vx*dt)+(entry.knockX || 0)*dt,
    y:entry.vy*dt,
    z:(dash ? dash.direction[1]*ABILITIES.dash.speed*dashTime : entry.vz*dt)+(entry.knockZ || 0)*dt,
  })
  entry.knockX=(entry.knockX || 0)*Math.exp(-12*dt); entry.knockZ=(entry.knockZ || 0)*Math.exp(-12*dt)
  if (dash) {
    dash.remaining -= dashTime
    entry.vx = 0; entry.vz = 0
    if (dash.remaining<1e-8) entry.dash = null
  }
  const delta = entry.controller.computedMovement(), position = entry.body.translation()
  if (Math.abs(delta.y)<Math.abs(entry.vy*dt)*0.5 && entry.vy>0) entry.vy = 0
  const next = { x:position.x+delta.x,y:position.y+delta.y,z:position.z+delta.z }
  entry.body.setNextKinematicTranslation(next)
  entry.grounded = entry.controller.computedGrounded()
  return { body:entry.body,position,next }
}
