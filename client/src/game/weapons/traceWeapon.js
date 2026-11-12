import { Raycaster, Vector2 } from 'three'
import { OPPONENT } from '../config.js'

export function createWeaponTracer() {
  const ray = new Raycaster(), offset = new Vector2()
  return (scene,camera,weapon) => {
    const hits = [], count = weapon.pellets || 1
    const cone = Math.tan(weapon.spread || 0)/Math.tan(camera.fov*Math.PI/360)
    ray.far = weapon.range
    for (let i=0;i<count;i++) {
      // One center pellet plus a fixed ring gives a repeatable, balanced cone.
      const angle = (i-1)*Math.PI*2/(count-1)
      offset.set(i === 0 ? 0 : Math.cos(angle)*cone/camera.aspect,i === 0 ? 0 : Math.sin(angle)*cone)
      ray.setFromCamera(offset,camera)
      const hit = ray.intersectObjects(scene.children,true).find(h => h.object.userData.blocksShot)
      const id = hit?.object.userData.targetId
      if (Number.isInteger(id) || id === OPPONENT.id) hits.push({ targetId:id,distance:hit.distance,region:hit.object.userData.hitRegion || 'body' })
    }
    return hits
  }
}
