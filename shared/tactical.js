import { eyeHeight } from './stance.js'
import { rayBox } from './ballistics.js'
import { ABILITIES } from './abilities.js'

export const enemies = (a,b) => a.id!==b.id && (!a.teamId || !b.teamId || a.teamId!==b.teamId)
export function blocked(origin,target,solids) {
  const delta = target.map((value,axis) => value-origin[axis]), distance = Math.hypot(...delta)
  if (distance<0.001) return false
  const direction = delta.map(value => value/distance)
  return solids.some(solid => { const hit = rayBox(origin,direction,solid.position,solid.size); return hit!==null && hit<distance-0.05 })
}
export function launchGrenade(position,yaw = 0,pitch = 0,crouched=false,abilityId='flashbang') {
  const direction = [-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]
  return { position:position.map((value,axis) => value+(axis===1 ? eyeHeight(crouched) : 0)),velocity:direction.map((value,axis) => value*(ABILITIES[abilityId]?.throwSpeed || 12)+(axis===1 ? 3 : 0)),age:0 }
}
export function stepGrenade(grenade,dt,solids) {
  // Fixed substeps keep bounces stable even when a training frame takes longer.
  let remaining=dt
  while(remaining>1e-8) {const step=Math.min(remaining,1/120);integrateGrenade(grenade,step,solids);remaining-=step}
}
function integrateGrenade(grenade,dt,solids) {
  grenade.age += dt
  grenade.velocity[1] -= 12*dt
  const delta = grenade.velocity.map(value => value*dt), distance = Math.hypot(...delta)
  if (distance<1e-8) return
  const direction = delta.map(value => value/distance)
  let nearest = distance, obstacle = null
  for (const solid of solids) {
    const hit = rayBox(grenade.position,direction,solid.position,solid.size.map(value => value+0.24))
    if (hit!==null && hit<nearest) { nearest = hit; obstacle = solid }
  }
  grenade.position = grenade.position.map((value,axis) => value+direction[axis]*Math.max(0,nearest-(obstacle ? 0.01 : 0)))
  if (obstacle) {
    let axis = 0, minimum = Infinity
    for (let i=0;i<3;i++) {
      const edge = Math.abs(Math.abs(grenade.position[i]-obstacle.position[i])-(obstacle.size[i]/2+0.12))
      if (edge<minimum) { minimum = edge; axis = i }
    }
    grenade.velocity = grenade.velocity.map((value,index) => value*(index===axis ? -0.4 : 0.65))
  }
}
export function flashDuration(origin,target,solids) {
  const eyes = [target.x,target.y+eyeHeight(target.crouched),target.z]
  const offset = origin.map((value,axis) => value-eyes[axis]), distance = Math.hypot(...offset)
  const tuning=ABILITIES.flashbang
  if (distance>tuning.radius || blocked(origin,eyes,solids)) return 0
  const facing = [-Math.sin(target.yaw || 0)*Math.cos(target.pitch || 0),Math.sin(target.pitch || 0),-Math.cos(target.yaw || 0)*Math.cos(target.pitch || 0)]
  const dot = distance<0.01 ? 1 : offset.reduce((sum,value,axis) => sum+value/distance*facing[axis],0)
  return (dot>0.2 ? tuning.duration : 0.8)*Math.max(0.2,1-distance/(tuning.radius*1.25))
}
export function grenadeTrajectory(position,yaw,pitch,crouched,abilityId,solids) {
  const grenade=launchGrenade(position,yaw,pitch,crouched,abilityId),points=[[...grenade.position]]
  const fuse=ABILITIES[abilityId].fuse
  while(grenade.age<fuse-1e-8) {stepGrenade(grenade,Math.min(1/60,fuse-grenade.age),solids);points.push([...grenade.position])}
  return points
}
export function throughSmoke(origin,target,smokes) {
  const delta = target.map((value,axis) => value-origin[axis]), length = Math.hypot(...delta)
  if (length<0.001) return false
  const direction = delta.map(value => value/length)
  return smokes.some(smoke => {
    const offset = smoke.origin.map((value,axis) => value-origin[axis])
    const along = Math.max(0,Math.min(length,offset.reduce((sum,value,axis) => sum+value*direction[axis],0)))
    return Math.hypot(...offset.map((value,axis) => value-direction[axis]*along))<smoke.radius
  })
}
