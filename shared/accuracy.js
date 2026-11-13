import { PLAYER } from './arena.js'
import { CROUCH } from './stance.js'

export const stanceSpread=motion=>motion?.crouched && motion.grounded===true && !motion.dashing ? CROUCH.spread : 1

// Extra cone half-angles in radians. Base weapon accuracy is preserved at rest.
const PROFILES=Object.freeze({
  RIFLE:{walk:.045,sprint:.105,air:.14,dash:.16},
  SNIPER:{walk:.07,sprint:.145,air:.18,dash:.2},
  SMG:{walk:.025,sprint:.07,air:.12,dash:.14},
  LMG:{walk:.06,sprint:.12,air:.16,dash:.18},
  SHOTGUN:{walk:.018,sprint:.045,air:.08,dash:.1},
  PISTOL:{walk:.035,sprint:.085,air:.12,dash:.14},
})
export const ACCURACY_STOP_SPEED=.7
export function movementSpread(weapon,motion) {
  const profile=PROFILES[weapon.category]
  if(!profile || !motion) return 0
  const velocity=motion.velocity || [0,0,0]
  const speed=Math.hypot(velocity[0] || 0,velocity[2] || 0)
  const walking=Math.min(1,Math.max(0,(speed-ACCURACY_STOP_SPEED)/(PLAYER.speed-ACCURACY_STOP_SPEED)))
  const sprinting=Math.min(1,Math.max(0,(speed-PLAYER.speed)/(PLAYER.sprint-PLAYER.speed)))
  const moving=profile.walk*walking+(profile.sprint-profile.walk)*sprinting
  return Math.max(moving,motion.grounded===false ? profile.air : 0,motion.dashing ? profile.dash : 0)*stanceSpread(motion)
}
