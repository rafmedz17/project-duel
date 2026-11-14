export const LOBBY = Object.freeze({
  roomType:'duel_lobby',
  maxPlayers:2,
  autoCountdownSeconds:5,
  codeLength:6,
  codeAlphabet:'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  reconnectSeconds:15,
  nameMaxLength:18,
})

export function validateName(value) {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g,' ')
  return name.length <= LOBBY.nameMaxLength && /^[\p{L}\p{N} _-]{2,18}$/u.test(name) ? name : null
}
