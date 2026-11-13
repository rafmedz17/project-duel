import { ARENA_SOLIDS, COVER, ONLINE } from './arena.js'

const box = (position,size,color) => ({ position,size,color })
// Preserve the facility's boundary, but give each map its own collision layout.
const boundary = ARENA_SOLIDS.filter(s => s.position[1]<0 || s.size[1]===6)
const thinPanels=ARENA_SOLIDS.filter(s=>s.size[2]===0.18)
const coverSolids = (cover,color) => cover.flatMap(([x,y,z,w,h,d]) => [box([x,y,z],[w,h,d],color),box([x,y+h/2+0.06,z],[w+0.1,0.12,d+0.1],'#50617a')])
const neonCover = [[-7,1.4,-8,4,2.8,3],[7,1.4,8,4,2.8,3],[-8,1.4,5,3,2.8,4],[8,1.4,-5,3,2.8,4],[-3,0.65,0,3,1.3,2],[3,0.65,0,3,1.3,2]]
const orbitalCover = [[-7,1,-6,4,2,2],[7,1,6,4,2,2],[-7,1,6,4,2,2],[7,1,-6,4,2,2],[-3,1.1,0,2,2.2,5],[3,1.1,0,2,2.2,5]]
export const MAPS = {
  facility:{ name:'TRAINING FACILITY',description:'Familiar lanes and low central cover.',solids:ARENA_SOLIDS,cover:COVER,spawns:ONLINE.spawns,accent:'#00d9ff',background:'#080e1c' },
  neon:{ name:'NEON DISTRICT',description:'Street corners, tall kiosks and vivid neon lanes.',solids:[...boundary,...thinPanels,...coverSolids(neonCover,'#352640'),...[-12,12].flatMap(x => [-9,9].map(z => box([x,1.7,z],[2,3.4,2],'#452d52')))],cover:neonCover,spawns:ONLINE.spawns,accent:'#ff59cb',background:'#160d21' },
  orbital:{ name:'ORBITAL STATION',description:'Reactor cover, cargo lanes and blue-lit bulkheads.',solids:[...boundary,...coverSolids(orbitalCover,'#384858'),...[-13,13].flatMap(x => [-10,0,10].map(z => box([x,1.2,z],[2,2.4,3],'#425f6b')))],cover:orbitalCover,spawns:ONLINE.spawns,accent:'#8dffbc',background:'#071923' },
}
export function getMap(id = 'facility') { return Object.hasOwn(MAPS,id) ? MAPS[id] : MAPS.facility }
