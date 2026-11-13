import { Raycaster, Vector3 } from 'three'
import { OPPONENT } from '../config.js'
import { shotDirections,coverTransmission } from '../../../../shared/ballistics.js'
import { trailDistance } from '../../../../shared/bulletTrails.js'

export function createWeaponTracer() {
  const ray = new Raycaster(), direction = new Vector3()
  return (scene,camera,weapon,shot = 0,motion) => {
    const hits = [], ends=[], forward=camera.getWorldDirection(direction), yaw=Math.atan2(-forward.x,-forward.z), pitch=Math.asin(forward.y)
    const origin=camera.position.toArray(), solids=[]
    scene.traverse(object=> { if (object.userData.coverSolid) solids.push(object.userData.coverSolid) })
    ray.far = weapon.range
    for (const vector of shotDirections(yaw,pitch,weapon,shot,motion)) {
      ray.set(camera.position,direction.fromArray(vector))
      const intersections=ray.intersectObjects(scene.children,true)
      const hit = intersections.find(h => h.object.userData.blocksShot && (!weapon.penetration || h.object.userData.targetId!==undefined || !h.object.userData.coverSolid))
      const id = hit?.object.userData.targetId
      const distance=trailDistance(origin,vector,Math.min(weapon.range,hit?.distance ?? weapon.range),solids,weapon)
      ends.push(origin.map((n,i)=>n+vector[i]*distance))
      if (Number.isInteger(id) || id === OPPONENT.id) {
        const transmission=coverTransmission(origin,vector,hit.distance,solids,weapon)
        if (transmission) hits.push({ targetId:id,distance:hit.distance,region:hit.object.userData.hitRegion || 'body',transmission })
      }
    }
    return { hits,trail:{ origin,ends } }
  }
}
