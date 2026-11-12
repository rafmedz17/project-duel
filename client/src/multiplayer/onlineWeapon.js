import { lobby } from './lobby.js'

// Rendering reads server snapshots; it never changes the local training store.
export const onlineWeapon = {
  get: () => lobby.self(),
  now: () => lobby.get().room?.time || 0,
}
