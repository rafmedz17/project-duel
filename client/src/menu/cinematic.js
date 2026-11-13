export const CINEMATIC_SHOTS=Object.freeze([
  {mapId:'facility',title:'THE FACILITY',subtitle:'CLEAN LANES. PURE COMPETITION.',accent:'#65efff',from:[10,4.8,14],to:[5,2.7,9],look:[0,1,0],endLook:[0,1.2,-2]},
  {mapId:'neon',title:'NEON DISTRICT',subtitle:'OWN THE ANGLE. TAKE THE FIGHT.',accent:'#e98aff',from:[-13,5,12],to:[-8,3.4,8.5],look:[0,1,0],endLook:[1,1.2,1]},
  {mapId:'orbital',title:'ORBITAL STATION',subtitle:'NO GRAVITY FOR SECOND PLACE.',accent:'#92ffce',from:[13,5,-12],to:[8,2.8,-7],look:[0,1,0],endLook:[0,1.4,1]},
  {mapId:'training',title:'TRAINING NEXUS',subtitle:'BUILD THE AIM. BECOME THE THREAT.',accent:'#ffcf90',from:[12,4,-21],to:[5,2.7,-27],look:[0,1.2,-35],endLook:[-2,1,-35]},
])
export const SHOT_SECONDS=10
// Frame data stays outside React, like the game's camera and crosshair data.
export const menuCinema={shot:0,time:0,progress:0,fade:0,running:false}
export function shotAt(time) {
  const shot=Math.floor(time/SHOT_SECONDS)%CINEMATIC_SHOTS.length,progress=time%SHOT_SECONDS/SHOT_SECONDS
  const fade=Math.max(0,1-progress/.055,(progress-.94)/.06)
  return {shot,progress,fade:Math.min(1,fade)}
}
