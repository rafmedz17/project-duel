import {PLAYER} from '../../../shared/arena.js'
import {blocked} from '../../../shared/tactical.js'

// All points sit on the shared collision floor and clear a standing capsule.
export function spawnCandidates(map) {
  const points=[...map.spawns.map(s=>s.position)]
  for(const x of [-16,-12,-8,-4,0,4,8,12,16]) for(const z of [-16,-12,-8,-4,0,4,8,12,16]) points.push([x,1,z])
  return points.filter(([x,y,z],index)=>points.findIndex(p=>p[0]===x && p[2]===z)===index && !map.solids.some(s=>
    Math.abs(x-s.position[0])<s.size[0]/2+PLAYER.radius+.15 && Math.abs(z-s.position[2])<s.size[2]/2+PLAYER.radius+.15 && Math.abs(y-s.position[1])<s.size[1]/2+PLAYER.height/2+.03))
}

export function chooseSpawn(points,opponents,previous,solids,random) {
  const living=opponents.filter(p=>p.hp>0 && p.connected!==false)
  const ranked=points.map(position=>({position,
    distance:Math.min(50,...living.map(p=>Math.hypot(p.x-position[0],p.z-position[2]))),
    hidden:living.every(p=>blocked(position.map((v,i)=>v+(i===1 ? PLAYER.eye : 0)),[p.x,p.y+PLAYER.eye,p.z],solids)),
  })).filter(p=>!previous || Math.hypot(p.position[0]-previous[0],p.position[2]-previous[2])>2)
  const clear=ranked.filter(p=>p.distance>=6),pool=clear.length ? clear : ranked.sort((a,b)=>b.distance-a.distance).slice(0,3)
  const concealed=pool.filter(p=>p.hidden),safe=concealed.length ? concealed : pool
  const chosen=safe[Math.min(safe.length-1,Math.floor(random()*safe.length))]
  if(!chosen) throw new Error('Map has no safe Free for All spawn points.')
  const [x,,z]=chosen.position
  return {position:[...chosen.position],yaw:Math.atan2(x,z)}
}
