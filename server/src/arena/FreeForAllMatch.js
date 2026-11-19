import {FREE_FOR_ALL} from '../../../shared/match.js'
import {ONLINE} from '../../../shared/arena.js'
import {ArenaCombat} from './ArenaCombat.js'
import {MatchResultPlayer} from '../rooms/LobbyState.js'

export class FreeForAllMatch {
  constructor(state,simulation) {
    this.state=state;this.simulation=simulation;this.departed=new Map()
    this.combat=new ArenaCombat(state.players,simulation,state.arenaEpoch,{round:1})
    Object.assign(state,{matchPhase:'live',roundId:1,roundNumber:0,phaseRemaining:0,roundRemaining:0,winnerId:'',matchReason:'',saveStatus:'skipped',resultRanked:false})
    state.results.clear();state.roundResults.clear()
    for(const player of state.players.values()) {player.roundWins=0;player.ready=false;player.teamId=''}
    this.combat.onKill=id=>{if(state.players.get(id).kills>=FREE_FOR_ALL.killsToWin) this.finish(id)}
  }
  receiveMove(id,payload) {
    return this.state.matchPhase==='live' && payload?.round===this.state.roundId && this.simulation.receive(id,payload)
  }
  receiveCombat(id,payload) {return this.state.matchPhase==='live' && this.combat.receive(id,payload)}
  finish(winnerId) {
    if(this.state.matchPhase!=='live') return false
    this.combat.ended=true;this.combat.allowRespawn=false;this.simulation.stopAll()
    for(const id of this.state.players.keys()) {this.combat.cancelEffects(id);this.state.players.get(id).reloading=false}
    Object.assign(this.state,{matchPhase:'finished',winnerId,matchReason:'kill-limit'})
    const rows=new Map([...this.departed,...this.state.players])
    this.state.results.clear()
    for(const [id,p] of rows) {const row=new MatchResultPlayer();Object.assign(row,{id,name:p.name,slot:p.slot,kills:p.kills,deaths:p.deaths,roundWins:0});this.state.results.push(row)}
    return true
  }
  removePlayer(id) {
    const player=this.state.players.get(id)
    if(!player) return
    this.departed.set(id,{name:player.name,slot:player.slot,kills:player.kills,deaths:player.deaths})
    this.combat.cancelEffects(id);this.simulation.removePlayer(id)
  }
  step() {
    if(this.state.matchPhase!=='live') {this.combat.time+=1/ONLINE.tickRate;return}
    this.combat.step()
    if(this.state.matchPhase==='live') this.simulation.step()
  }
}
