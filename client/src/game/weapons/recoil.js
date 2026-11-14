import { ONLINE } from '../../../../shared/arena.js'

// Mouse aim stays independent from this temporary camera/shot-direction offset.
// Caps are radians: sustained fire climbs to a ceiling, never indefinitely.
export function recoilLimits(weapon) {
  const pitch=weapon.fireMode==='melee' ? 0 : weapon.category==='SNIPER' ? .075 : weapon.category==='SHOTGUN' ? .095 : Math.max(.055,Math.min(.14,weapon.recoil*18))
  return { pitch,yaw:pitch*.18 }
}

export const createRecoil=()=>({ weapon:null,pitch:0,yaw:0,targetPitch:0,targetYaw:0,age:1,spray:0 })
export function resetRecoil(state) { Object.assign(state,createRecoil()) }

export function stepRecoil(state,weapon,delta,shots=0) {
  if(state.weapon!==weapon) { resetRecoil(state);state.weapon=weapon }
  const dt=Math.max(0,delta),limit=recoilLimits(weapon)
  if(shots>0 && weapon.recoil>0) {
    if(state.age>.5 && state.pitch===0) state.spray=0
    for(let i=0;i<shots;i++) {
      state.spray++
      state.targetPitch=Math.min(limit.pitch,state.targetPitch+weapon.recoil)
      state.targetYaw=(Math.sin(state.spray*1.7)*.7+Math.sin(state.spray*.6)*.3)*Math.min(limit.yaw,state.targetPitch*.18)
    }
    state.age=0
  }
  // Leave room for automatic/burst shot intervals before recovering. Recovery
  // also happens if a held trigger cannot fire (reload, empty gun, focus loss).
  const recovery=Math.max(0,state.age+dt-.16)-Math.max(0,state.age-.16)
  state.age+=dt
  if(recovery>0) {
    const decay=Math.exp(-12*recovery)
    state.targetPitch*=decay;state.targetYaw*=decay
  }
  const follow=1-Math.exp(-40*dt)
  state.pitch+=(state.targetPitch-state.pitch)*follow
  state.yaw+=(state.targetYaw-state.yaw)*follow
  if(state.age>.16 && Math.abs(state.pitch)<.00001 && Math.abs(state.yaw)<.00001) {
    state.pitch=0;state.yaw=0;state.targetPitch=0;state.targetYaw=0
  }
}

export function recoilAim(aim,state) {
  const yaw=aim.yaw+state.yaw
  return { yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),pitch:Math.max(-ONLINE.maxPitch,Math.min(ONLINE.maxPitch,aim.pitch+state.pitch)) }
}
