// Use the physics world, so the same walls/cover that stop the player also
// stop the drone's sight rays and fast-moving energy pulses.
export function castTrainingPulse(world,rapier,origin,direction,distance,excludeBody) {
  return world.castRay(new rapier.Ray(origin,direction),distance,true,undefined,undefined,undefined,excludeBody)
}

export function isPlayerHit(hit) {
  return hit?.collider.parent()?.userData?.entity === 'player'
}
