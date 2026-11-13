import { ROBOT_PARTS } from './robot.js'
import { accuracySpread } from './weapons.js'

export function rayBox(origin,direction,center,size) {
  let near = 0, far = Infinity
  for (let axis=0;axis<3;axis++) {
    const offset = origin[axis]-center[axis], half = size[axis]/2
    if (Math.abs(direction[axis])<1e-9) { if (Math.abs(offset)>half) return null; continue }
    const a = (-half-offset)/direction[axis], b = (half-offset)/direction[axis]
    near = Math.max(near,Math.min(a,b)); far = Math.min(far,Math.max(a,b))
    if (near>far) return null
  }
  return far>=0 ? near : null
}
const inverseYaw = ([x,y,z],yaw) => [x*Math.cos(yaw)-z*Math.sin(yaw),y,x*Math.sin(yaw)+z*Math.cos(yaw)]
const inversePitch = ([x,y,z],pitch) => [x,y*Math.cos(pitch)+z*Math.sin(pitch),-y*Math.sin(pitch)+z*Math.cos(pitch)]
export function rayRobot(origin,direction,pose) {
  const o = inverseYaw([origin[0]-pose.x,origin[1]-pose.y,origin[2]-pose.z],pose.yaw)
  const d = inverseYaw(direction,pose.yaw)
  let hit = null
  for (const part of ROBOT_PARTS) {
    let local = o.map((n,i) => n-part.position[i]), ray = d
    if (part.id==='head') { local = inversePitch(local,pose.pitch); ray = inversePitch(d,pose.pitch) }
    const distance = rayBox(local,ray,[0,0,0],part.size)
    if (distance!==null && (!hit || distance<hit.distance)) hit = { distance,region:part.region }
  }
  return hit
}
export function shotDirections(yaw,pitch,weapon,shot = 0) {
  const forward = [-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]
  const right = [Math.cos(yaw),0,-Math.sin(yaw)]
  const up = [Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)]
  return Array.from({ length:weapon.pellets || 1 },(_,i) => {
    const angle = (i-1)*Math.PI*2/((weapon.pellets || 2)-1)
    const seed = shot*2.399963229728653
    const spread = accuracySpread(weapon)*(shot ? 0.4+0.6*Math.abs(Math.sin(shot*19.19)) : 0)
    const x = (i ? Math.cos(angle)*Math.tan(weapon.spread || 0) : 0)+Math.cos(seed)*spread
    const y = (i ? Math.sin(angle)*Math.tan(weapon.spread || 0) : 0)+Math.sin(seed)*spread
    const vector = forward.map((n,axis) => n+right[axis]*x+up[axis]*y)
    const length = Math.hypot(...vector)
    return vector.map(n => n/length)
  })
}

// Count the actual ray path through each obstacle, including overlapping pieces.
// Arena boundaries and thick blocks cannot be penetrated by a thin-cover rail shot.
export function coverTransmission(origin,direction,distance,solids,weapon) {
  const intervals=[]
  for (const solid of solids) {
    const near=rayBox(origin,direction,solid.position,solid.size)
    if (near===null || near>=distance-0.001) continue
    if (!weapon.penetration) return 0
    const end=origin.map((n,i)=>n+direction[i]*distance)
    const back=rayBox(end,direction.map(n=>-n),solid.position,solid.size)
    if (back===null) return 0
    intervals.push([near,distance-back])
  }
  intervals.sort((a,b)=>a[0]-b[0])
  let thickness=0,end=-Infinity
  for (const [near,far] of intervals) { thickness+=Math.max(0,far-Math.max(near,end)); end=Math.max(end,far) }
  return thickness>(weapon.penetration || 0)+1e-6 ? 0 : intervals.length ? weapon.penetrationDamage : 1
}
