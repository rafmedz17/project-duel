import RAPIER from '@dimforge/rapier3d-compat'
import { getMap } from '../../../shared/maps.js'
import { ONLINE } from '../../../shared/arena.js'
import { movementMultiplier } from '../../../shared/weapons.js'
import { ABILITIES } from '../../../shared/abilities.js'
import { ultimateModifiers } from '../../../shared/characters.js'
import { createMovementWorld, createCharacter, stepCharacter } from '../../../shared/movement.js'
import { capsuleHalfHeight,restoreStance } from '../../../shared/stance.js'

await RAPIER.init()
const fields = new Set(['sequence','round','x','z','yaw','pitch','sprint','jump','crouch','active'])
export function validateInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.has(key))) return null
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 0 || value.sequence > 2147483647) return null
  if (Object.hasOwn(value,'round') && (!Number.isSafeInteger(value.round) || value.round<0)) return null
  if (!['x','z','yaw','pitch'].every(key => Number.isFinite(value[key]))) return null
  if (Math.abs(value.x)>1 || Math.abs(value.z)>1 || Math.abs(value.yaw)>1e6) return null
  if (!['sprint','jump','active'].every(key => typeof value[key] === 'boolean')) return null
  if (Object.hasOwn(value,'crouch') && typeof value.crouch!=='boolean') return null
  return { ...value,yaw:Math.atan2(Math.sin(value.yaw),Math.cos(value.yaw)),pitch:Math.max(-ONLINE.maxPitch,Math.min(ONLINE.maxPitch,value.pitch)) }
}

export class ArenaSimulation {
  constructor(players,mapId = 'facility') {
    this.map = getMap(mapId)
    this.world = createMovementWorld(RAPIER,this.map)
    this.players = new Map()
    for (const [id,player] of players) {
      const spawn = this.map.spawns[player.slot]
      const [x,y,z] = spawn.position
      this.players.set(id,{ ...createCharacter(RAPIER,this.world,spawn.position),player,input:null,lastSequence:-1,jumpHeld:false,jumpPending:false })
      Object.assign(player,{ x,y,z,yaw:spawn.yaw,pitch:0,crouched:false,grounded:false,active:false,inputSequence:-1,inputSteps:0,vx:0,vy:0,vz:0,dashRemaining:0,dashX:0,dashZ:0 })
    }
    this.world.step()
  }

  receive(id, payload, now = performance.now()) {
    const entry = this.players.get(id), input = validateInput(payload)
    if (!entry || entry.player.hp===0 || !input || input.sequence <= entry.lastSequence) return false
    entry.lastSequence = input.sequence
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

  knockback(id,direction,distance) {
    const entry=this.players.get(id)
    if (!entry || entry.player.hp<=0) return
    entry.knockX=direction[0]*distance*12; entry.knockZ=direction[2]*distance*12
  }

  stopAll() { for (const id of this.players.keys()) this.stop(id) }

  shotMotion(id) {
    const entry=this.players.get(id)
    return {velocity:entry?.shotVelocity || [0,0,0],grounded:entry?.shotGrounded ?? true,dashing:Boolean(entry?.dash),crouched:Boolean(entry?.crouched)}
  }

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
    restoreStance(entry,false)
    entry.body.setTranslation({ x,y,z },true)
    entry.body.setNextKinematicTranslation({ x,y,z })
    entry.knockX=0; entry.knockZ=0
    entry.grounded = false
    entry.shotVelocity=[0,0,0];entry.shotGrounded=true
    Object.assign(entry.player,{ x,y,z,yaw:spawn.yaw,pitch:0,crouched:false,grounded:false,vx:0,vy:0,vz:0,dashRemaining:0 })
  }

  step(now = performance.now()) {
    const proposals = []
    for (const [id,entry] of this.players) {
      const { player } = entry
      if (player.hp===0) continue
      let input = entry.input
      if (input && now-input.receivedAt > ONLINE.inputTimeoutMs) { this.stop(id); input = null }
      entry.movement=movementMultiplier(player.weapon)*ultimateModifiers(player,this.combatTime?.() ?? 0).movement
      const active = Boolean(input?.active && player.connected)
      const yaw = input?.yaw ?? player.yaw
      if (player.rooted) { entry.vx = 0; entry.vz = 0; entry.dash = null; entry.jumpPending = false }
      proposals.push({...stepCharacter(entry,input ? { ...input,active,x:player.rooted ? 0 : input.x,z:player.rooted ? 0 : input.z } : null,entry.jumpPending),entry})
      entry.jumpPending = false
      player.yaw = yaw; player.pitch = input?.pitch ?? player.pitch; player.active = active
      player.grounded = entry.grounded
      player.crouched = entry.crouched
      if (player.inputSequence!==entry.lastSequence) { player.inputSequence = entry.lastSequence; player.inputSteps = 0 }
      player.inputSteps++
    }
    // Character sweeps see the other capsule's previous pose. Reject overlapping
    // simultaneous endpoints rather than pushing a player into adjacent cover.
    for (let i=0;i<proposals.length;i++) for (let j=i+1;j<proposals.length;j++) {
      const a = proposals[i], b = proposals[j]
      const verticalGap = Math.max(0,Math.abs(a.next.y-b.next.y)-capsuleHalfHeight(a.entry.crouched)-capsuleHalfHeight(b.entry.crouched))
      if (Math.hypot(a.next.x-b.next.x,a.next.z-b.next.z,verticalGap)<ONLINE.capsuleRadius*2+0.02) {
        a.body.setNextKinematicTranslation(a.position)
        b.body.setNextKinematicTranslation(b.position)
      }
    }
    this.world.step()
    for(const {entry,body,position} of proposals) {
      const p=body.translation()
      entry.shotVelocity=[(p.x-position.x)*ONLINE.tickRate,(p.y-position.y)*ONLINE.tickRate,(p.z-position.z)*ONLINE.tickRate]
      entry.shotGrounded=entry.grounded
    }
    for (const { player,body,vx,vy,vz,dash,knockX,knockZ } of this.players.values()) {
      const p = body.translation()
      player.x = p.x; player.y = p.y; player.z = p.z
      Object.assign(player,{ knockX:knockX || 0,knockZ:knockZ || 0,vx,vy,vz,dashRemaining:dash?.remaining || 0,dashX:dash?.direction[0] || 0,dashZ:dash?.direction[1] || 0 })
    }
  }

  free() { this.world.free(); this.players.clear() }
}
