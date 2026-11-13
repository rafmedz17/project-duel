// Transient cosmetics only. Never feed trail endpoints into damage or physics.
const pending=[],seen=new Map()
export const trailScope = (room=null) => room ? `online:${room.code}:${room.arenaEpoch}:${room.roundId}` : null
export function queueShotTrail(event) {
  if(!event || typeof event.scope!=='string' || !Number.isSafeInteger(event.shot) || event.shot<1 || !Array.isArray(event.origin) || !event.origin.every(Number.isFinite) || event.origin.length!==3 || !Array.isArray(event.ends) || event.ends.length>10 || !event.ends.length || event.ends.some(end=>!Array.isArray(end) || end.length!==3 || !end.every(Number.isFinite))) return false
  const sequence=Object.hasOwn(event,'trailId') ? event.trailId : event.shot
  if(!Number.isSafeInteger(sequence) || sequence<1) return false
  const key=`${event.scope}:${event.id}`,last=seen.get(key) || 0
  if(sequence<=last) return false
  seen.set(key,sequence)
  if(seen.size>16) seen.delete(seen.keys().next().value)
  pending.push(event)
  if(pending.length>32) pending.shift()
  return true
}
export function takeShotTrails(scope) {
  return pending.splice(0).filter(event=>event.scope===scope)
}
