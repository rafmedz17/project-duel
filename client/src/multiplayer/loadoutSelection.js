// A dismissal belongs to one server-owned selection window, never later rounds
// or another death. Derive it from snapshots rather than running a second timer.
export function loadoutWindow(state) {
  const room=state.room
  if(state.status!=='connected' || !room?.arenaActive || room.phase!=='arena' || room.matchPhase==='finished') return ''
  const prefix=`${room.code}:${room.arenaEpoch}`
  if(room.format==='duel') return room.matchPhase==='loadout' ? `${prefix}:round:${room.roundId}` : ''
  const combat=room.players.find(player=>player.id===state.sessionId)?.combat
  return combat?.hp===0 && room.time<combat.respawnAt ? `${prefix}:respawn:${combat.respawnAt}` : ''
}

export function loadoutIsOpen(state) {
  const window=loadoutWindow(state)
  return Boolean(window && !state.menuOpen && state.closedLoadout!==window)
}
