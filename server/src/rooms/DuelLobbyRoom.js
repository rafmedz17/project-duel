import { randomInt, randomUUID } from 'node:crypto'
import { Room, ServerError } from '@colyseus/core'
import { LOBBY, validateName } from '../config.js'
import { LobbyPlayer, LobbyState } from './LobbyState.js'
import { ArenaCombat } from '../arena/ArenaCombat.js'
import { ArenaSimulation } from '../arena/ArenaSimulation.js'
import { ONLINE } from '../../../shared/arena.js'
import { FORMATS } from '../../../shared/match.js'
import { DuelMatch } from '../arena/DuelMatch.js'
import { MAPS } from '../../../shared/maps.js'
import { DEFAULT_LOADOUT, validateLoadout } from '../../../shared/loadout.js'

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
  identities = new Map()
  accounts = null

  async onCreate() {
    this.roomId = reserveCode()
    this.state.code = this.roomId
    await this.setPrivate(true)
    this.patchRate = ONLINE.patchRate
    this.onMessage('map',(client,payload) => {
      if (client.sessionId!==this.state.hostId || this.state.arenaActive || this.state.phase==='countdown') return
      if (!payload || Object.keys(payload).length!==1 || typeof payload.mapId!=='string' || !Object.hasOwn(MAPS,payload.mapId)) return
      if (payload.mapId===this.state.mapId) return
      this.state.mapId = payload.mapId
      this.resetReady()
    })
    this.onMessage('ranked',(client,payload) => {
      if (client.sessionId!==this.state.hostId || this.state.arenaActive || this.state.phase==='countdown') return
      if (!payload || Object.keys(payload).length!==1 || typeof payload.ranked!=='boolean') return
      if (payload.ranked && !this.canRank()) { this.state.note = 'Ranked requires Best of Three and two different signed-in players.'; return }
      this.state.ranked = payload.ranked
      this.resetReady()
    })
    this.onMessage('format',(client,payload) => {
      if (client.sessionId!==this.state.hostId || this.state.arenaActive || this.state.phase==='countdown') return
      if (!payload || Object.keys(payload).length!==1 || typeof payload.format!=='string' || !Object.hasOwn(FORMATS,payload.format)) return
      if (payload.format===this.state.format) return
      this.state.format = payload.format
      if (payload.format!=='duel') this.state.ranked = false
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
      if (this.state.ranked && !this.canRank()) return
      this.state.note = ''
      this.state.countdown = ONLINE.countdownSeconds
      this.state.phase = 'countdown'
      const advance = () => {
        this.state.countdown--
        if (this.state.countdown > 0) this.countdownTimer = this.clock.setTimeout(advance,1000)
        else {
          this.countdownTimer = null
          this.simulation = new ArenaSimulation(this.state.players,this.state.mapId)
          this.matchId = randomUUID()
          this.startedAt = new Date().toISOString()
          this.matchIdentities = new Map(this.identities)
          this.state.saveStatus = ''; this.state.resultRanked = false
          this.state.arenaActive = true
          this.state.arenaEpoch++
          if (this.state.format==='duel') {
            this.match = new DuelMatch(this.state,this.simulation,() => { void this.saveMatch() })
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

  async onAuth(client, options) {
    if (this.state.arenaActive) throw new ServerError(4401,'This arena is in progress. Wait for the players to return to the lobby.')
    if (options && Object.hasOwn(options,'accessToken')) {
      try {
        if (!this.accounts) throw new Error('Accounts are not enabled on this game server yet. Sign out to play as a guest.')
        const identity = await this.accounts.verify(options.accessToken)
        if ([...this.identities.values()].some(other => other.userId===identity.userId)) throw new Error('This account is already in the room. Use a different account for your opponent.')
        return identity
      } catch (error) { throw new ServerError(4402,error.message) }
    }
    const name = validateName(options?.name)
    if (!name) throw new ServerError(4400,'Use 2–18 letters, numbers, spaces, hyphens or underscores for your callsign.')
    const loadout = options?.loadout ? validateLoadout(options.loadout) : DEFAULT_LOADOUT
    if (!loadout) throw new ServerError(4400,'Invalid loadout. Choose a character, one available primary and one unique skill.')
    return { name,loadout,userId:null }
  }

  onJoin(client) {
    if (client.auth.userId && [...this.identities.values()].some(other => other.userId===client.auth.userId)) throw new ServerError(4402,'This account is already in the room.')
    const occupied = new Set([...this.state.players.values()].map(player => player.slot))
    const player = new LobbyPlayer()
    player.name = client.auth.name
    player.authenticated = Boolean(client.auth.userId)
    player.startingWeapon = client.auth.loadout.startingWeapon
    player.characterId = client.auth.loadout.character
    player.uniqueSkill = client.auth.loadout.unique
    player.allowedWeapons = [...client.auth.loadout.weapons]
    player.allowedAbilities = [...client.auth.loadout.abilities]
    this.identities.set(client.sessionId,client.auth)
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
    this.identities.delete(client.sessionId)
    if (!this.state.arenaActive && !this.canRank()) this.state.ranked = false
    if (this.state.hostId === client.sessionId) this.state.hostId = this.state.players.keys().next().value || ''
    this.resetReady()
  }

  resetReady() {
    this.cancelCountdown()
    this.state.players.forEach(player => { player.ready = false })
    this.refreshPhase()
  }

  canRank() {
    const ids = [...this.identities.values()].map(identity => identity.userId)
    return Boolean(this.accounts?.configured && this.state.format==='duel' && ids.length===2 && ids.every(Boolean) && ids[0]!==ids[1])
  }

  async saveMatch() {
    const matchId = this.matchId
    const s = this.state
    const players = [...s.results].sort((a,b) => a.slot-b.slot)
    const winner = players.find(p => p.id===s.winnerId)
    if (players.length!==2 || !winner) { s.saveStatus = 'skipped'; return }
    const [one,two] = players
    const result = {
      id:matchId,player_one:this.matchIdentities.get(one.id)?.userId || null,player_two:this.matchIdentities.get(two.id)?.userId || null,
      name_one:one.name,name_two:two.name,score_one:one.roundWins,score_two:two.roundWins,kills_one:one.kills,kills_two:two.kills,deaths_one:one.deaths,deaths_two:two.deaths,
      winner_slot:winner.slot,map_id:s.mapId,reason:s.matchReason,started_at:this.startedAt,ended_at:new Date().toISOString(),ranked:s.ranked,
      rounds:[...s.roundResults].map(round => ({ number:round.number,winner_slot:players.find(p => p.id===round.winnerId)?.slot ?? null,reason:round.reason })),
    }
    s.saveStatus = 'saving'
    try {
      const saved = this.accounts ? await this.accounts.save(result) : { status:'skipped',ranked:false }
      if (this.matchId===matchId) { s.saveStatus = saved.status; s.resultRanked = saved.ranked }
    } catch {
      if (this.matchId===matchId) s.saveStatus = 'failed'
      console.error('Could not persist a finished match to the local result queue.')
    }
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
    if (!this.canRank()) this.state.ranked = false
    this.matchId = null
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
