import { ONLINE } from '../../../shared/arena.js'

const history = new Map()
const listeners = new Set()
export function subscribePoses(listener) { listeners.add(listener); return () => listeners.delete(listener) }
let epoch = -1, tick = -1, round = -1
export const arenaView = { position:[0,1,15],yaw:0,pitch:0,remotes:{},motion:{velocity:[0,0,0],grounded:true,dashing:false,crouched:false} }
export function clearPoses() { history.clear(); epoch = -1; tick = -1; round = -1; arenaView.remotes = {} }
export function recordPoses(state, now = performance.now()) {
  if (!state.arenaActive) { clearPoses(); return }
  if (epoch !== state.arenaEpoch || round !== state.roundId) { clearPoses(); epoch = state.arenaEpoch; round = state.roundId }
  if (tick === state.tick) return
  tick = state.tick
  for (const [id,player] of state.players) {
    const samples = history.get(id) || []
    samples.push({ time:now,tick:state.tick,x:player.x,y:player.y,z:player.z,yaw:player.yaw,pitch:player.pitch,crouched:player.arsenal.crouched,grounded:player.grounded,inputSequence:player.inputSequence,inputSteps:player.inputSteps,vx:player.vx,vy:player.vy,vz:player.vz,dashRemaining:player.dashRemaining,dashX:player.dashX,dashZ:player.dashZ,rooted:player.rooted,knockX:player.arsenal.knockX,knockZ:player.arsenal.knockZ })
    if (samples.length > 12) samples.shift()
    history.set(id,samples)
  }
  for (const id of history.keys()) if (!state.players.has(id)) history.delete(id)
  listeners.forEach(listener => listener())
}
export function latestPose(id) { return history.get(id)?.at(-1) || null }
export function samplePose(id, now = performance.now()) {
  const samples = history.get(id)
  if (!samples?.length) return null
  const target = now-ONLINE.interpolationMs
  let before = samples[0], after = samples.at(-1)
  for (const sample of samples) {
    if (sample.time <= target) before = sample
    if (sample.time >= target) { after = sample; break }
  }
  const t = after.time === before.time ? 1 : Math.max(0,Math.min(1,(target-before.time)/(after.time-before.time)))
  const angle = Math.atan2(Math.sin(after.yaw-before.yaw),Math.cos(after.yaw-before.yaw))
  return { x:before.x+(after.x-before.x)*t,y:before.y+(after.y-before.y)*t,z:before.z+(after.z-before.z)*t,yaw:before.yaw+angle*t,pitch:before.pitch+(after.pitch-before.pitch)*t,crouched:(t<.5 ? before : after).crouched }
}
