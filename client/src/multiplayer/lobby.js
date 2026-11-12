import { useSyncExternalStore } from 'react'
import { canPlayArena } from '../../../shared/match.js'
import { ONLINE } from '../../../shared/arena.js'
import { clearPoses, recordPoses, latestPose } from './poses.js'

const empty = { status:'idle',room:null,sessionId:'',error:'',notice:'',captured:false,captureError:'' }
let snapshot = empty
let activeRoom = null
let attempt = 0
let timeoutId
let sequence = 0
let combatSequence = 0
const listeners = new Set()
function update(patch) { snapshot = { ...snapshot,...patch }; listeners.forEach(listener => listener()) }
function endpoint() {
  if (import.meta.env.VITE_MULTIPLAYER_URL) return import.meta.env.VITE_MULTIPLAYER_URL
  const url = new URL(location.origin)
  url.port = '2567'
  return url.origin
}
function connectionError(error) {
  if (error.code === 4400 || error.code === 4401) return error.message
  if (/locked|full|maximum/i.test(error.message || '')) return 'This room is full or holding a seat for a reconnecting player.'
  if (/not found|not defined|invalid room|expired/i.test(error.message || '')) return 'Room not found. Check the invite code, or ask your friend to create a new room.'
  return 'Could not connect to the lobby server. Try again in a moment.'
}
function sync(room) {
  if (activeRoom !== room || !room.state?.players) return
  const state = room.state
  recordPoses(state)
  const next = { format:state.format,matchPhase:state.matchPhase,roundNumber:state.roundNumber,roundId:state.roundId,roundRemaining:state.roundRemaining,phaseRemaining:state.phaseRemaining,roundWinnerId:state.roundWinnerId,winnerId:state.winnerId,matchReason:state.matchReason,roundResults:[...state.roundResults].map(r => ({ number:r.number,winnerId:r.winnerId,reason:r.reason })),results:[...state.results].map(r => ({ id:r.id,name:r.name,slot:r.slot,roundWins:r.roundWins,kills:r.kills,deaths:r.deaths })),code:state.code,hostId:state.hostId,phase:state.phase,arenaActive:state.arenaActive,arenaEpoch:state.arenaEpoch,countdown:state.countdown,note:state.note,time:state.tick/ONLINE.tickRate,
    players:[...state.players.entries()].map(([id,player]) => ({ id,name:player.name,slot:player.slot,roundWins:player.roundWins,ready:player.ready,connected:player.connected,combat:{ abilities:Object.fromEntries([...player.abilities.entries()].map(([id,a]) => [id,{ readyAt:a.readyAt,activeUntil:a.activeUntil,startedAt:a.startedAt,uses:a.uses,result:a.result,origin:[a.originX,a.originY,a.originZ],direction:[a.directionX,a.directionZ] }])),disabledUntil:player.disabledUntil,shieldCharge:player.shieldCharge,shieldHit:player.shieldHit,hitShieldDamage:player.hitShieldDamage,hp:player.hp,weapon:player.weapon,magazines:{ pistol:player.pistolAmmo,rifle:player.rifleAmmo,shotgun:player.shotgunAmmo },reloading:player.reloading,reloadWeapon:player.reloading ? player.weapon : null,reloadStart:player.reloadStart,reloadEnd:player.reloadEnd,reloadReason:player.reloadReason,attackReadyAt:player.attackReadyAt,lastSwitch:player.lastSwitch,lastShot:player.lastShot,lastSwing:player.lastSwing,shot:player.shot,hit:player.hit,hitId:player.hitId,hitDamage:player.hitDamage,hitDefeated:player.hitDefeated,hitHeadshot:player.hitHeadshot,hurt:player.hurt,kills:player.kills,deaths:player.deaths,respawnAt:player.respawnAt } })).sort((a,b) => a.slot-b.slot),
  }
  // Positions stay outside React; combat HUD receives authoritative 20 Hz snapshots.
  if (JSON.stringify(next) !== JSON.stringify(snapshot.room)) update({ room:next })
}

export const lobby = {
  get: () => snapshot,
  async connect(kind, name, code = '') {
    if (['connecting','connected','reconnecting'].includes(snapshot.status)) return
    const callsign = name.trim().replace(/\s+/g,' ')
    const invite = code.trim().toUpperCase()
    if (!/^[\p{L}\p{N} _-]{2,18}$/u.test(callsign) || callsign.length > 18) {
      update({ error:'Use 2–18 letters, numbers, spaces, hyphens or underscores for your callsign.' }); return
    }
    if (kind === 'join' && !/^[A-HJ-NP-Z2-9]{6}$/.test(invite)) {
      update({ error:'Enter the six-character invite code.' }); return
    }
    const operationId = ++attempt
    let timer
    update({ ...empty,status:'connecting' })
    try {
      const { Client } = await import('@colyseus/sdk')
      if (operationId !== attempt) return
      const client = new Client(endpoint())
      const request = kind === 'create' ? client.create('duel_lobby',{ name:callsign }) : client.joinById(invite,{ name:callsign })
      // A cancelled or timed-out request may finish later; never leave a ghost seat.
      request.then(room => { if (operationId !== attempt) room.leave().catch(() => {}) }).catch(() => {})
      const room = await Promise.race([request,new Promise((_,reject) => {
        timer = setTimeout(() => reject(new Error('Connection timed out')),10000)
        timeoutId = timer
      })])
      clearTimeout(timer)
      if (operationId !== attempt) return
      activeRoom = room
      sequence = 0
      combatSequence = 0
      Object.assign(room.reconnection,{ minUptime:0,maxRetries:10,minDelay:250,maxDelay:2000,maxEnqueuedMessages:0 })
      room.onStateChange(() => sync(room))
      room.onDrop(() => { if (activeRoom === room) update({ status:'reconnecting',notice:'Connection interrupted. Reconnecting…' }) })
      room.onReconnect(() => { if (activeRoom === room) { update({ status:'connected',notice:'Connection restored. Ready up again when both players are here.' }); sync(room) } })
      room.onError(() => { if (activeRoom === room) update({ notice:'The connection encountered a problem. If it drops, we’ll try to reconnect.' }) })
      room.onLeave(() => {
        if (activeRoom !== room) return
        activeRoom = null
        clearPoses()
        document.exitPointerLock?.()
        update({ ...empty,status:'error',error:'You were disconnected from the room. Create or join a room to try again.' })
      })
      update({ status:'connected',sessionId:room.sessionId,error:'',notice:'' })
      sync(room)
      try { localStorage.setItem('duel-callsign',callsign) } catch { /* Storage may be disabled. */ }
    } catch (error) {
      clearTimeout(timer)
      if (operationId !== attempt) return
      attempt++
      update({ ...empty,status:'error',error:connectionError(error) })
    }
  },
  ready(value) {
    if (activeRoom && snapshot.status === 'connected') activeRoom.send('ready',{ ready:value })
  },
  format(format) { if (activeRoom && snapshot.status==='connected') activeRoom.send('format',{ format }) },
  forfeit() { if (activeRoom && snapshot.status==='connected') activeRoom.send('forfeit') },
  start() { if (activeRoom && snapshot.status === 'connected') activeRoom.send('start') },
  backToLobby() { if (activeRoom && snapshot.status === 'connected') activeRoom.send('backToLobby') },
  move(input) {
    if (!activeRoom || snapshot.status !== 'connected' || !canPlayArena(snapshot.room)) return
    sequence = Math.max(sequence,(latestPose(snapshot.sessionId)?.inputSequence ?? -1)+1)
    activeRoom.send('move',{ ...input,round:snapshot.room.roundId,sequence:sequence++ })
  },
  combat(action,details = {}) {
    if (!activeRoom || snapshot.status!=='connected' || !canPlayArena(snapshot.room)) return
    activeRoom.send('combat',{ action,...details,epoch:snapshot.room.arenaEpoch,round:snapshot.room.roundId,sequence:combatSequence++ })
  },
  self() { return snapshot.room?.players.find(player => player.id===snapshot.sessionId)?.combat },
  setCaptured(captured) { update({ captured,captureError:'' }) },
  async capture() {
    try {
      const canvas = document.querySelector('canvas')
      if (!canvas?.requestPointerLock) throw new Error('Unavailable')
      await canvas.requestPointerLock()
    } catch { update({ captured:false,captureError:'Mouse capture was blocked. Click Enter Arena to try again.' }) }
  },
  leave() {
    attempt++
    clearTimeout(timeoutId)
    const room = activeRoom
    activeRoom = null
    clearPoses()
    if (snapshot.room?.arenaActive) document.exitPointerLock?.()
    update(empty)
    if (room) return room.leave().catch(() => {})
    return Promise.resolve()
  },
}

const identity = value => value
export function useLobby(selector = identity) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) },() => selector(lobby.get()))
}
