export const MATCH = Object.freeze({ winsToTakeMatch:2,roundSeconds:90,resultSeconds:4,loadoutSeconds:5,countdownSeconds:3 })
export const FREE_FOR_ALL = Object.freeze({maxPlayers:5,killsToWin:15})
export const FORMATS = Object.freeze({ duel:'BEST OF THREE',freeplay:'FREE PLAY',ffa:'FREE FOR ALL' })
export const playerLimit=format=>format==='ffa' ? FREE_FOR_ALL.maxPlayers : 2
export const minimumPlayers=format=>format==='ffa' ? 1 : 2
export function canPlayArena(room) {
  return room?.phase==='arena' && (room.format==='freeplay' || room.matchPhase==='live')
}
