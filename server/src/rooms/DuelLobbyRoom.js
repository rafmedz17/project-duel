import { randomInt } from 'node:crypto'
import { Room, ServerError } from '@colyseus/core'
import { LOBBY, validateName } from '../config.js'
import { LobbyPlayer, LobbyState } from './LobbyState.js'
import { ArenaCombat } from '../arena/ArenaCombat.js'
import { ArenaSimulation } from '../arena/ArenaSimulation.js'
import { ONLINE } from '../../../shared/arena.js'
import { FORMATS } from '../../../shared/match.js'
import { DuelMatch } from '../arena/DuelMatch.js'

// Synchronous allocation prevents code collisions within this single Node process.
const activeCodes = new Set()
function reserveCode() {
  let code
  do { code = Array.from({ length:LOBBY.codeLength },() => LOBBY.codeAlphabet[randomInt(LOBBY.codeAlphabet.length)]).join('') }
  while (activeCodes.has(code))
  activeCodes.add(code)
  return code
}

export class DuelLobbyRoom extends Room {
  maxClients = LOBBY.maxPlayers
  maxMessagesPerSecond = 60
  state = new LobbyState()
  combat = null
  match = null
  simulation = null
  countdownTimer = null

  async onCreate() {
    this.roomId = reserveCode()
    this.state.code = this.roomId
    await this.setPrivate(true)
    this.patchRate = ONLINE.patchRate
    this.onMessage('format',(client,payload) => {
      if (client.sessionId!==this.state.hostId || this.state.arenaActive || this.state.phase==='countdown') return
      if (!payload || Object.keys(payload).length!==1 || typeof payload.format!=='string' || !Object.hasOwn(FORMATS,payload.format)) return
      if (payload.format===this.state.format) return
      this.state.format = payload.format
      this.resetReady()
    })
    this.onMessage('ready',(client,payload) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || this.state.arenaActive || typeof payload?.ready !== 'boolean') return
      if (this.state.players.size !== LOBBY.maxPlayers || [...this.state.players.values()].some(p => !p.connected)) return
      player.ready = payload.ready
      if (!payload.ready) this.cancelCountdown()
      this.refreshPhase()
    })
    this.onMessage('start',client => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== 'ready') return
      this.state.note = ''
      this.state.countdown = ONLINE.countdownSeconds
      this.state.phase = 'countdown'
      const advance = () => {
        this.state.countdown--
        if (this.state.countdown > 0) this.countdownTimer = this.clock.setTimeout(advance,1000)
        else {
          this.countdownTimer = null
          this.simulation = new ArenaSimulation(this.state.players)
          this.state.arenaActive = true
          this.state.arenaEpoch++
          if (this.state.format==='duel') {
            this.match = new DuelMatch(this.state,this.simulation)
            this.combat = this.match.combat
          } else {
            this.combat = new ArenaCombat(this.state.players,this.simulation,this.state.arenaEpoch)
            this.state.matchPhase = 'freeplay'
          }
          this.state.tick = 0
          this.refreshPhase()
          this.setFixedTimestep(() => {
            if (this.state.phase !== 'arena') return
            if (this.match) this.match.step()
            else { this.combat.step(); this.simulation.step() }
            this.state.tick++
          },ONLINE.tickRate)
        }
      }
      this.countdownTimer = this.clock.setTimeout(advance,1000)
    })
    this.onMessage('move',(client,payload) => {
      if (this.state.phase!=='arena' || !this.state.players.get(client.sessionId)?.connected) return
      if (this.match) this.match.receiveMove(client.sessionId,payload)
      else this.simulation.receive(client.sessionId,payload)
    })
    this.onMessage('combat',(client,payload) => {
      if (this.state.phase!=='arena') return
      if (this.match) this.match.receiveCombat(client.sessionId,payload)
      else this.combat.receive(client.sessionId,payload)
    })
    this.onMessage('forfeit',client => {
      if (this.state.arenaActive && this.match) this.match.forfeit(client.sessionId)
    })
    this.onMessage('backToLobby',client => {
      if (this.state.arenaActive && this.state.players.has(client.sessionId)) {
        if (this.match && this.state.matchPhase!=='finished') { this.match.forfeit(client.sessionId); return }
        this.endArena(`${this.state.players.get(client.sessionId).name} returned to the lobby.`)
        this.resetReady()
      }
    })
  }

  onAuth(client, options) {
    if (this.state.arenaActive) throw new ServerError(4401,'This arena is in progress. Wait for the players to return to the lobby.')
    const name = validateName(options?.name)
    if (!name) throw new ServerError(4400,'Use 2–18 letters, numbers, spaces, hyphens or underscores for your callsign.')
    return { name }
  }

  onJoin(client) {
    const occupied = new Set([...this.state.players.values()].map(player => player.slot))
    const player = new LobbyPlayer()
    player.name = client.auth.name
    player.slot = occupied.has(0) ? 1 : 0
    this.state.players.set(client.sessionId,player)
    if (!this.state.hostId) this.state.hostId = client.sessionId
    this.resetReady()
  }

  async onDrop(client) {
    const player = this.state.players.get(client.sessionId)
    if (player) player.connected = false
    this.simulation?.stopAll()
    this.resetReady()
    try { await this.allowReconnection(client,LOBBY.reconnectSeconds) }
    catch { /* Colyseus calls onLeave when the reservation expires. */ }
  }

  onReconnect(client) {
    const player = this.state.players.get(client.sessionId)
    if (player) player.connected = true
    this.resetReady()
  }

  onLeave(client) {
    if (this.state.arenaActive) {
      if (this.match) this.match.forfeit(client.sessionId)
      else this.endArena('Your opponent left the arena. Invite a challenger to start again.')
    }
    this.state.players.delete(client.sessionId)
    if (this.state.hostId === client.sessionId) this.state.hostId = this.state.players.keys().next().value || ''
    this.resetReady()
  }

  resetReady() {
    this.cancelCountdown()
    this.state.players.forEach(player => { player.ready = false })
    this.refreshPhase()
  }

  refreshPhase() {
    const players = [...this.state.players.values()]
    if (this.state.arenaActive) {
      const required = this.state.matchPhase==='finished' ? players.length>0 : players.length===LOBBY.maxPlayers
      this.state.phase = required && players.every(player => player.connected) ? 'arena' : 'interrupted'
      return
    }
    if (this.state.countdown > 0) return
    this.state.phase = players.some(player => !player.connected) ? 'reconnecting'
      : players.length < LOBBY.maxPlayers ? 'waiting'
      : players.every(player => player.ready) ? 'ready' : 'forming'
  }

  cancelCountdown() {
    this.countdownTimer?.clear()
    this.countdownTimer = null
    this.state.countdown = 0
  }

  endArena(note) {
    // Keep the room clock ticking for later countdowns and seat reservations.
    this.setTimestep(() => {},ONLINE.patchRate)
    this.simulation?.free()
    this.simulation = null
    this.combat = null
    this.match = null
    this.state.arenaActive = false
    Object.assign(this.state,{ matchPhase:'idle',roundNumber:0,roundId:0,roundRemaining:0,phaseRemaining:0,roundWinnerId:'',winnerId:'',matchReason:'' })
    this.state.roundResults.clear(); this.state.results.clear()
    this.state.players.forEach(player => { player.roundWins = 0 })
    this.state.note = note
  }

  onDispose() {
    this.cancelCountdown()
    this.simulation?.free()
    activeCodes.delete(this.roomId)
  }
}
