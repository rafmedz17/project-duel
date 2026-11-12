import { MATCH } from '../../../shared/match.js'
import { ONLINE } from '../../../shared/arena.js'
import { ArenaCombat } from './ArenaCombat.js'
import { RoundResult, MatchResultPlayer } from '../rooms/LobbyState.js'

export class DuelMatch {
  constructor(state,simulation) {
    this.state = state; this.simulation = simulation
    this.combat = new ArenaCombat(state.players,simulation,state.arenaEpoch,{ respawn:false,round:1 })
    this.roundTicks = MATCH.roundSeconds*ONLINE.tickRate
    this.phaseTicks = 0
    Object.assign(state,{ matchPhase:'live',roundNumber:1,roundId:1,roundRemaining:MATCH.roundSeconds,phaseRemaining:0,roundWinnerId:'',winnerId:'',matchReason:'' })
    state.roundResults.clear(); state.results.clear()
    for (const player of state.players.values()) { player.roundWins = 0; player.ready = false }
  }
  receiveMove(id,payload) {
    if (this.state.matchPhase!=='live' || payload?.round!==this.state.roundId) return false
    return this.simulation.receive(id,payload)
  }
  receiveCombat(id,payload) {
    if (this.state.matchPhase!=='live') return false
    const accepted = this.combat.receive(id,payload)
    if (accepted) this.checkElimination()
    return accepted
  }
  checkElimination() {
    if (this.state.matchPhase!=='live') return
    const living = [...this.state.players.entries()].filter(([,player]) => player.hp>0)
    if (living.length<2) this.finishRound(living[0]?.[0] || '','elimination')
  }
  stopRound() {
    this.simulation.stopAll()
    for (const id of this.state.players.keys()) {
      this.combat.cancelEffects(id)
      this.state.players.get(id).reloading = false
    }
  }
  finishRound(winnerId,reason) {
    const s = this.state
    if (s.matchPhase!=='live') return false
    this.stopRound()
    s.roundWinnerId = winnerId
    if (winnerId) s.players.get(winnerId).roundWins++
    const result = new RoundResult()
    Object.assign(result,{ number:s.roundNumber,winnerId,reason })
    s.roundResults.push(result)
    if (s.roundResults.length>10) s.roundResults.shift()
    if (winnerId && s.players.get(winnerId).roundWins>=MATCH.winsToTakeMatch) this.finishMatch(winnerId,reason)
    else {
      s.matchPhase = 'roundOver'
      s.matchReason = reason
      this.phaseTicks = MATCH.resultSeconds*ONLINE.tickRate
      s.phaseRemaining = MATCH.resultSeconds
    }
    return true
  }
  finishMatch(winnerId,reason) {
    const s = this.state
    if (s.matchPhase==='finished') return false
    this.stopRound()
    Object.assign(s,{ matchPhase:'finished',winnerId,matchReason:reason,phaseRemaining:0 })
    s.results.clear()
    for (const [id,player] of s.players) {
      const result = new MatchResultPlayer()
      Object.assign(result,{ id,name:player.name,slot:player.slot,roundWins:player.roundWins,kills:player.kills,deaths:player.deaths })
      s.results.push(result)
      player.ready = false
    }
    return true
  }
  forfeit(id) {
    if (!this.state.players.has(id) || this.state.matchPhase==='finished') return false
    const winner = [...this.state.players.keys()].find(other => other!==id)
    return this.finishMatch(winner || '',winner ? 'forfeit' : 'abandoned')
  }
  step() {
    const s = this.state
    if (s.matchPhase==='live') {
      this.combat.step(); this.simulation.step()
      this.checkElimination()
      if (s.matchPhase!=='live') return
      this.roundTicks--
      s.roundRemaining = Math.max(0,this.roundTicks/ONLINE.tickRate)
      if (this.roundTicks<=0) {
        const players = [...s.players.entries()].sort((a,b) => b[1].hp-a[1].hp)
        const winner = players[0][1].hp>players[1][1].hp ? players[0][0] : ''
        this.finishRound(winner,winner ? 'time' : 'draw')
      }
      return
    }
    // Feedback still fades during breaks; no weapons, abilities or respawns run.
    this.combat.time += 1/ONLINE.tickRate
    if (s.matchPhase==='finished') return
    this.phaseTicks--
    s.phaseRemaining = Math.max(0,this.phaseTicks/ONLINE.tickRate)
    if (this.phaseTicks>0) return
    if (s.matchPhase==='roundOver') {
      if (s.roundWinnerId) s.roundNumber++
      s.roundId++
      this.combat.resetRound(s.roundId)
      s.matchPhase = 'countdown'
      this.phaseTicks = MATCH.countdownSeconds*ONLINE.tickRate
      s.phaseRemaining = MATCH.countdownSeconds
    } else if (s.matchPhase==='countdown') {
      s.matchPhase = 'live'; s.phaseRemaining = 0
      this.roundTicks = MATCH.roundSeconds*ONLINE.tickRate
      s.roundRemaining = MATCH.roundSeconds
    }
  }
}
