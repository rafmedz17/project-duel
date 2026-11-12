import { ROBOT_PARTS } from './robot.js'

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
export function shotDirections(yaw,pitch,weapon) {
  const forward = [-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]
  const right = [Math.cos(yaw),0,-Math.sin(yaw)]
  const up = [Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)]
  return Array.from({ length:weapon.pellets || 1 },(_,i) => {
    const angle = (i-1)*Math.PI*2/((weapon.pellets || 2)-1)
    const x = i ? Math.cos(angle)*Math.tan(weapon.spread || 0) : 0
    const y = i ? Math.sin(angle)*Math.tan(weapon.spread || 0) : 0
    const vector = forward.map((n,axis) => n+right[axis]*x+up[axis]*y)
    const length = Math.hypot(...vector)
    return vector.map(n => n/length)
  })
}
