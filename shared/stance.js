import { PLAYER } from './arena.js'

export const CROUCH=Object.freeze({height:1.15,eye:.4,speed:.55,spread:.8})
export const eyeHeight=crouched=>crouched ? CROUCH.eye : PLAYER.eye
export const capsuleHalfHeight=crouched=>(crouched ? CROUCH.height : PLAYER.height)/2-PLAYER.radius

// Snapshot positions already contain the correct capsule center.
export function restoreStance(entry,crouched=false) {
  entry.crouched=Boolean(crouched)
  entry.collider.setHalfHeight(capsuleHalfHeight(entry.crouched))
}

// Resize around the feet, retaining world/player collisions when standing up.
export function updateStance(entry,wantsCrouch) {
  const crouched=Boolean(wantsCrouch)
  if(crouched===entry.crouched) return
  const p=entry.body.translation()
  const next={x:p.x,y:p.y+capsuleHalfHeight(crouched)-capsuleHalfHeight(entry.crouched),z:p.z}
  if(!crouched && entry.world.intersectionWithShape(next,{x:0,y:0,z:0,w:1},entry.standingShape,undefined,undefined,entry.collider,entry.body)) return
  restoreStance(entry,crouched)
  entry.body.setTranslation(next,true)
  entry.body.setNextKinematicTranslation(next)
  entry.world.propagateModifiedBodyPositionsToColliders()
}
