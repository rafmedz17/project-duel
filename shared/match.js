export const MATCH = Object.freeze({ winsToTakeMatch:2,roundSeconds:90,resultSeconds:4,loadoutSeconds:5,countdownSeconds:3 })
export const FORMATS = Object.freeze({ duel:'BEST OF THREE',freeplay:'FREE PLAY' })
export function canPlayArena(room) {
  return room?.phase==='arena' && (room.format!=='duel' || room.matchPhase==='live')
}
