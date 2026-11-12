import { getMap } from '../../../shared/maps.js'
import { createMovementWorld, createCharacter, stepCharacter } from '../../../shared/movement.js'

export class Prediction {
  constructor(RAPIER,mapId) {
    this.world = createMovementWorld(RAPIER,getMap(mapId))
    this.entry = createCharacter(RAPIER,this.world,[0,1,15])
    this.other = createCharacter(RAPIER,this.world,[0,1,-15])
    this.world.step()
    this.frames = []
    this.commands = new Map()
    this.index = 0
    this.input = null
    this.pendingJump = false
    this.pose = null
  }
  command(input) {
    if (!input) return
    this.input = input
    this.pendingJump ||= input.jump && input.active
    this.commands.set(input.sequence,this.index)
    if (this.commands.size>120) this.commands.delete(this.commands.keys().next().value)
    if (!input.active) { this.entry.vx = 0; this.entry.vz = 0; this.entry.dash = null; this.pendingJump = false }
  }
  reset(pose) {
    this.frames = []
    this.commands.clear()
    this.input = null
    this.pendingJump = false
    this.restore(pose)
    this.pose = pose
  }
  restore(pose) {
    const entry = this.entry
    entry.body.setTranslation({ x:pose.x,y:pose.y,z:pose.z },true)
    entry.body.setNextKinematicTranslation({ x:pose.x,y:pose.y,z:pose.z })
    Object.assign(entry,{ vx:pose.vx || 0,vy:pose.vy || 0,vz:pose.vz || 0,grounded:pose.grounded,dash:pose.dashRemaining>0 ? { remaining:pose.dashRemaining,direction:[pose.dashX,pose.dashZ] } : null })
    this.world.propagateModifiedBodyPositionsToColliders()
  }
  reconcile(pose,other) {
    if (pose===this.pose) return [0,0,0]
    const before = this.entry.body.translation()
    if (other) {
      this.other.collider.setEnabled(other.hp!==0)
      this.other.body.setTranslation({ x:other.x,y:other.y,z:other.z },true)
      this.other.body.setNextKinematicTranslation({ x:other.x,y:other.y,z:other.z })
    }
    this.restore(pose)
    const start = this.commands.get(pose.inputSequence)
    // Acknowledgements describe simulated ticks, never merely received packets.
    const replay = start===undefined
      ? pose.inputSequence<(this.commands.keys().next().value ?? -1) ? this.frames : []
      : this.frames.filter(frame => frame.index>=start+pose.inputSteps)
    this.frames = replay.slice(-60)
    for (const frame of this.frames) this.simulate(frame.input,frame.jump)
    this.pose = pose
    const after = this.entry.body.translation()
    return [before.x-after.x,before.y-after.y,before.z-after.z]
  }
  simulate(input,jump) {
    if (!input?.active) { this.entry.vx = 0; this.entry.vz = 0; this.entry.dash = null }
    stepCharacter(this.entry,input,jump)
    this.world.step()
  }
  step() {
    const frame = { index:this.index++,input:this.input,jump:this.pendingJump }
    this.pendingJump = false
    this.frames.push(frame)
    if (this.frames.length>120) this.frames.shift()
    this.simulate(frame.input,frame.jump)
  }
  position() { return this.entry.body.translation() }
  free() { this.world.free() }
}
