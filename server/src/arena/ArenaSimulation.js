import RAPIER from '@dimforge/rapier3d-compat'
import { getMap } from '../../../shared/maps.js'
import { PLAYER, ONLINE } from '../../../shared/arena.js'
import { ABILITIES } from '../../../shared/abilities.js'

await RAPIER.init()
const fields = new Set(['sequence','round','x','z','yaw','pitch','sprint','jump','active'])
export function validateInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.has(key))) return null
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 0 || value.sequence > 2147483647) return null
  if (Object.hasOwn(value,'round') && (!Number.isSafeInteger(value.round) || value.round<0)) return null
  if (!['x','z','yaw','pitch'].every(key => Number.isFinite(value[key]))) return null
  if (Math.abs(value.x)>1 || Math.abs(value.z)>1 || Math.abs(value.yaw)>1e6) return null
  if (!['sprint','jump','active'].every(key => typeof value[key] === 'boolean')) return null
  return { ...value,yaw:Math.atan2(Math.sin(value.yaw),Math.cos(value.yaw)),pitch:Math.max(-ONLINE.maxPitch,Math.min(ONLINE.maxPitch,value.pitch)) }
}

export class ArenaSimulation {
  constructor(players,mapId = 'facility') {
    this.map = getMap(mapId)
    this.world = new RAPIER.World({ x:0,y:-PLAYER.gravity,z:0 })
    this.world.timestep = 1/ONLINE.tickRate
    this.players = new Map()
    for (const { position:[x,y,z],size:[w,h,d] } of this.map.solids) this.world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z))
    for (const [id,player] of players) {
      const spawn = this.map.spawns[player.slot]
      const [x,y,z] = spawn.position
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,y,z))
      const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(ONLINE.capsuleHalfHeight,ONLINE.capsuleRadius),body)
      const controller = this.world.createCharacterController(0.02)
      controller.setSlideEnabled(true)
      controller.enableSnapToGround(0.15)
      controller.setMaxSlopeClimbAngle(Math.PI/4)
      this.players.set(id,{ player,body,collider,controller,vx:0,vz:0,vy:0,input:null,lastSequence:-1,jumpHeld:false,jumpPending:false,dash:null })
      Object.assign(player,{ x,y,z,yaw:spawn.yaw,pitch:0,grounded:false,active:false,inputSequence:-1 })
    }
    this.world.step()
  }

  receive(id, payload, now = performance.now()) {
    const entry = this.players.get(id), input = validateInput(payload)
    if (!entry || entry.player.hp===0 || !input || input.sequence <= entry.lastSequence) return false
    entry.lastSequence = input.sequence
    entry.player.inputSequence = input.sequence
    entry.jumpPending ||= input.active && input.jump && !entry.jumpHeld
    entry.jumpHeld = input.jump
    entry.input = { ...input,receivedAt:now }
    if (!input.active) this.stop(id)
    return true
  }

  stop(id) {
    const entry = this.players.get(id)
    if (!entry) return
    entry.input = null; entry.vx = 0; entry.vz = 0; entry.jumpPending = false; entry.jumpHeld = false
    entry.player.active = false
    this.cancelDash(id)
  }

  startDash(id, now = performance.now()) {
    const entry = this.players.get(id)
    if (!entry || entry.player.hp===0) return null
    const input = entry.input?.active && now-entry.input.receivedAt<=ONLINE.inputTimeoutMs ? entry.input : null
    const yaw = input?.yaw ?? entry.player.yaw
    let x = input?.x || 0, z = input?.z || 0
    if (!x && !z) z = -1
    const length = Math.hypot(x,z)
    const direction = [(x*Math.cos(yaw)+z*Math.sin(yaw))/length,(z*Math.cos(yaw)-x*Math.sin(yaw))/length]
    entry.dash = { direction,remaining:ABILITIES.dash.duration }
    return direction
  }

  cancelDash(id) {
    const entry = this.players.get(id)
    if (!entry?.dash) return
    entry.dash = null; entry.vx = 0; entry.vz = 0
    const ability = entry.player.abilities?.get('dash')
    if (ability) ability.activeUntil = 0
  }

  stopAll() { for (const id of this.players.keys()) this.stop(id) }

  setAlive(id,alive) {
    const entry = this.players.get(id)
    if (!entry) return
    this.stop(id)
    entry.vy = 0
    entry.collider.setEnabled(alive)
  }

  respawn(id) {
    const entry = this.players.get(id)
    if (!entry) return
    const spawn = this.map.spawns[entry.player.slot], [x,y,z] = spawn.position
    this.setAlive(id,true)
    entry.body.setTranslation({ x,y,z },true)
    entry.body.setNextKinematicTranslation({ x,y,z })
    Object.assign(entry.player,{ x,y,z,yaw:spawn.yaw,pitch:0,grounded:false })
  }

  step(now = performance.now()) {
    const dt = 1/ONLINE.tickRate
    const proposals = []
    for (const [id,entry] of this.players) {
      const { player,body,collider,controller } = entry
      if (player.hp===0) continue
      let input = entry.input
      if (input && now-input.receivedAt > ONLINE.inputTimeoutMs) { this.stop(id); input = null }
      const active = Boolean(input?.active && player.connected)
      let x = active ? input.x : 0, z = active ? input.z : 0
      const length = Math.max(1,Math.hypot(x,z))
      x /= length; z /= length
      const speed = input?.sprint ? PLAYER.sprint : PLAYER.speed
      const yaw = input?.yaw ?? player.yaw
      const smooth = 1-Math.exp(-14*dt)
      entry.vx += ((x*Math.cos(yaw)+z*Math.sin(yaw))*speed-entry.vx)*smooth
      entry.vz += ((z*Math.cos(yaw)-x*Math.sin(yaw))*speed-entry.vz)*smooth
      if (controller.computedGrounded() && entry.vy <= 0) entry.vy = -0.5
      if (active && entry.jumpPending && controller.computedGrounded()) entry.vy = PLAYER.jump
      entry.jumpPending = false
      entry.vy -= PLAYER.gravity*dt
      const dash = entry.dash, dashTime = dash ? Math.min(dt,dash.remaining) : 0
      controller.computeColliderMovement(collider,{
        x:dash ? dash.direction[0]*ABILITIES.dash.speed*dashTime : entry.vx*dt,
        y:entry.vy*dt,
        z:dash ? dash.direction[1]*ABILITIES.dash.speed*dashTime : entry.vz*dt,
      })
      if (dash) {
        dash.remaining -= dashTime
        entry.vx = 0; entry.vz = 0
        if (dash.remaining<1e-8) entry.dash = null
      }
      const delta = controller.computedMovement(), position = body.translation()
      if (Math.abs(delta.y)<Math.abs(entry.vy*dt)*0.5 && entry.vy>0) entry.vy = 0
      const next = { x:position.x+delta.x,y:position.y+delta.y,z:position.z+delta.z }
      proposals.push({ body,position,next })
      body.setNextKinematicTranslation(next)
      player.yaw = yaw; player.pitch = input?.pitch ?? player.pitch; player.active = active
      player.grounded = controller.computedGrounded()
    }
    // Character sweeps see the other capsule's previous pose. Reject overlapping
    // simultaneous endpoints rather than pushing a player into adjacent cover.
    for (let i=0;i<proposals.length;i++) for (let j=i+1;j<proposals.length;j++) {
      const a = proposals[i], b = proposals[j]
      const verticalGap = Math.max(0,Math.abs(a.next.y-b.next.y)-ONLINE.capsuleHalfHeight*2)
      if (Math.hypot(a.next.x-b.next.x,a.next.z-b.next.z,verticalGap)<ONLINE.capsuleRadius*2+0.02) {
        a.body.setNextKinematicTranslation(a.position)
        b.body.setNextKinematicTranslation(b.position)
      }
    }
    this.world.step()
    for (const { player,body } of this.players.values()) {
      const p = body.translation()
      player.x = p.x; player.y = p.y; player.z = p.z
    }
  }

  free() { this.world.free(); this.players.clear() }
}
