import { PLAYER } from './arena.js'
import { CROUCH } from './stance.js'

// Feet and head fill the player's capsule height. The camera sits inside the
// head, and training/online rendering and damage use these same proportions.
export const ROBOT_HEAD_Y = PLAYER.height/2-0.175
export const ROBOT_PARTS = [
  { id:'head',region:'head',position:[0,ROBOT_HEAD_Y,0],size:[0.35,0.35,0.38] },
  { id:'torso',region:'body',position:[0,0.075,0],size:[0.43,0.8,0.32] },
  ...[-1,1].flatMap(side => [
    { id:`arm${side}`,region:'limb',position:[side*0.3,0.02,0],size:[0.13,0.72,0.17] },
    { id:`leg${side}`,region:'limb',position:[side*0.13,-0.55,0],size:[0.17,0.56,0.2] },
    { id:`foot${side}`,region:'foot',position:[side*0.13,-0.79,-0.045],size:[0.2,0.12,0.31] },
  ]),
]

// A lowered head and torso, bent legs and planted feet. Rendering and damage
// share this pose, preserving head size instead of squashing the whole robot.
export const CROUCHED_ROBOT_PARTS=ROBOT_PARTS.map(part=>{
  if(part.id==='head') return {...part,position:[0,CROUCH.height/2-.175,-.035]}
  if(part.id==='torso') return {...part,position:[0,-.06,.015],size:[.43,.58,.32]}
  if(part.id.startsWith('arm')) return {...part,position:[part.position[0],-.05,-.03],size:[.13,.6,.17]}
  if(part.id.startsWith('leg')) return {...part,position:[part.position[0],-.34,.04],size:[.17,.42,.2],rotation:[-.85,0,0]}
  return {...part,position:[part.position[0],-CROUCH.height/2+.06,-.13]}
})
export const robotParts=crouched=>crouched ? CROUCHED_ROBOT_PARTS : ROBOT_PARTS
