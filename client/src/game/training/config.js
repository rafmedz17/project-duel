import { PLAYER } from '../../../../shared/arena.js'

export const TRAINING_SPAWN=[0,1,6]
export const COURSES={
  hub:{ name:'TRAINING NEXUS',number:'00',color:'#60eaff',description:'Choose a course. B opens your field armory.',bounds:[-18,18,-14,14] },
  static:{ name:'PRECISION RANGE',number:'01',color:'#60eaff',description:'10 robots. Aim for heads; feet take less damage.',bounds:[-18,18,-42,-14] },
  aim:{ name:'REFLEX LAB',number:'02',color:'#c495ff',description:'45-second challenge. One target; a new position after every hit.',bounds:[18,48,-14,14] },
  moving:{ name:'TRACKING BAY',number:'03',color:'#8bffb0',description:'6 strafing robots. Practice tracking and leading your aim.',bounds:[-18,18,14,42] },
  combat:{ name:'LIVE FIRE',number:'04',color:'#ff9c65',description:'5 armed robots. Use cover to break their line of sight.',bounds:[-48,-18,-14,14] },
}
export const AIM_SECONDS=45
const box=(position,size,color='#243a4d')=>({ position,size,color })
const perimeter=[[-18,-42],[18,-42],[18,-14],[48,-14],[48,14],[18,14],[18,42],[-18,42],[-18,14],[-48,14],[-48,-14],[-18,-14]]
export const TRAINING_COVER=[
  box([-25,1.1,0],[2.4,2.2,7]),box([-32,0.75,-7],[4,1.5,2.4]),
  box([-33,1.3,5],[3,2.6,4]),box([-40,0.85,0],[2.6,1.7,5]),
  box([-43,1.3,8],[3,2.6,2]),
]
export const TRAINING_SOLIDS=[
  box([0,-0.3,0],[36,0.6,84],'#101e2c'),box([0,-0.3,0],[96,0.6,28],'#101e2c'),
  ...perimeter.map(([x,z],i)=> { const [nx,nz]=perimeter[(i+1)%perimeter.length];return box([(x+nx)/2,3,(z+nz)/2],[Math.abs(nx-x)+0.5,6,Math.abs(nz-z)+0.5]) }),
  ...[-1,1].flatMap(side=>[-1,1].flatMap(half=>[
    box([half*11.5,3,side*14],[13,6,0.5]),box([side*18,3,half*9.5],[0.5,6,9]),
  ])),
  ...TRAINING_COVER,
]
const robot=(course,position,yaw=Math.PI)=>({ course,kind:'robot',position:[position[0],PLAYER.height/2,position[1]],yaw })
export const TRAINING_TARGETS=[
  ...Array.from({ length:10 },(_,i)=>robot('static',[-13.5+i*3,-35])),
  ...Array.from({ length:6 },(_,i)=>robot('moving',[-10+(i%3)*10,27+Math.floor(i/3)*10],0)),
  ...[[-26,-9],[-28,9],[-37,-10],[-38,10],[-45,-3]].map(p=>robot('combat',p,-Math.PI/2)),
  { course:'aim',kind:'orb',position:[43,2,0],yaw:-Math.PI/2 },
]
export const TARGET_POSITIONS=TRAINING_TARGETS.map(target=>target.position)
export function courseAt([x,,z]) {
  for(const id of ['static','aim','moving','combat']) { const [x0,x1,z0,z1]=COURSES[id].bounds;if(x>x0 && x<x1 && z>z0 && z<z1) return id }
  return 'hub'
}
export function targetPosition(index,target) {
  const def=TRAINING_TARGETS[index],p=[...def.position]
  if(def.course==='moving') { p[0]+=Math.sin((target.motionTime || 0)*1.7+index)*2.2;p[2]+=Math.sin((target.motionTime || 0)*0.7+index)*0.65 }
  if(def.kind==='orb') { const n=target.relocations || 0;p[1]=1.25+((index*7+n*3)%9)*0.3;p[2]=n===0 ? 0 : Math.sin(n*2.4+index)*9.8 }
  p[0]+=target.offsetX || 0;p[2]+=target.offsetZ || 0
  return p
}
export function targetYaw(index,target,training,position) {
  const def=TRAINING_TARGETS[index],p=targetPosition(index,target)
  return def.course==='combat' && training.combat.active ? Math.atan2(p[0]-position[0],p[2]-position[2]) : def.yaw
}
