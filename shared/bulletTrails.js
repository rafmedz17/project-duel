import { rayBox } from './ballistics.js'

// Cosmetic endpoints share the collision layout and penetration budget. Merge
// overlapping boxes so decorative pieces do not spend that budget twice.
export function trailDistance(origin,direction,limit,solids,weapon) {
  const intervals=[]
  for (const solid of solids) {
    const near=rayBox(origin,direction,solid.position,solid.size)
    if (near===null || near>=limit) continue
    let far=Infinity
    for(let axis=0;axis<3;axis++) if(Math.abs(direction[axis])>1e-9) {
      const edge=solid.position[axis]+Math.sign(direction[axis])*solid.size[axis]/2
      far=Math.min(far,(edge-origin[axis])/direction[axis])
    }
    intervals.push([near,far])
  }
  intervals.sort((a,b)=>a[0]-b[0])
  const merged=[]
  for(const [near,far] of intervals) {
    const previous=merged.at(-1)
    if(previous && near<=previous[1]) previous[1]=Math.max(previous[1],far)
    else merged.push([near,far])
  }
  let spent=0
  for(const [near,far] of merged) {
    spent+=far-near
    if(spent>(weapon.penetration || 0)+1e-6) return near
  }
  return limit
}
