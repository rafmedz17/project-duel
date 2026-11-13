import { PLAYER } from './arena.js'

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
