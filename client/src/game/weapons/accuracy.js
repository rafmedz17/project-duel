import { game } from '../store.js'
import { runtime } from '../runtime.js'
import { lobby } from '../../multiplayer/lobby.js'
import { arenaView } from '../../multiplayer/poses.js'

export function trainingShotMotion() {
  return {velocity:runtime.velocity,grounded:runtime.grounded,dashing:game.now()<game.get().abilities.dash.activeUntil,crouched:runtime.crouched}
}
export function crosshairMotion() {
  const online=lobby.get()
  return online.room?.arenaActive ? arenaView.motion : trainingShotMotion()
}
