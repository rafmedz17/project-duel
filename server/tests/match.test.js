import test from 'node:test'
import assert from 'node:assert/strict'
import { LobbyPlayer, LobbyState } from '../src/rooms/LobbyState.js'
import { DuelMatch } from '../src/arena/DuelMatch.js'
import { ArenaSimulation } from '../src/arena/ArenaSimulation.js'
import { MATCH } from '../../shared/match.js'

function setup(t) {
  const state = new LobbyState()
  state.arenaEpoch = 1; state.phase = 'arena'
  for (const [id,slot,name] of [['a',0,'Nova'],['b',1,'Echo']]) {
    const player = new LobbyPlayer()
    Object.assign(player,{ slot,name })
    state.players.set(id,player)
  }
  const sim = new ArenaSimulation(state.players), match = new DuelMatch(state,sim)
  t.after(() => sim.free())
  let sequence = 0
  const advance = seconds => { for (let i=0;i<Math.ceil(seconds*60);i++) match.step() }
  const send = (id,action,details = {}) => match.receiveCombat(id,{ action,epoch:1,round:state.roundId,sequence:sequence++,...details })
  const shoot = id => {
    const a = state.players.get(id), b = state.players.get(id==='a' ? 'b' : 'a')
    return send(id,'fire',{ yaw:Math.atan2(a.x-b.x,a.z-b.z),pitch:Math.atan2(b.y-0.03-a.y-0.65,Math.hypot(a.x-b.x,a.z-b.z)) })
  }
  const win = id => {
    for (let i=0;i<4;i++) { assert.equal(shoot(id),true); if (i<3) advance(0.24) }
  }
  const nextRound = () => advance(MATCH.resultSeconds+MATCH.countdownSeconds+0.02)
  advance(0.2)
  return { state,sim,match,advance,send,shoot,win,nextRound,a:state.players.get('a'),b:state.players.get('b') }
}

test('validated kills end a round once, lock actions and reset position/loadout/abilities after a countdown',t => {
  const { state,sim,match,a,b,advance,send,shoot,win } = setup(t)
  send('a','ability',{ ability:'scanner' })
  win('a')
  assert.equal(state.matchPhase,'roundOver'); assert.equal(state.roundWinnerId,'a')
  assert.equal(a.roundWins,1); assert.equal(b.hp,0); assert.equal(b.respawnAt,0)
  assert.equal(state.roundResults.length,1)
  assert.equal(match.finishRound('a','elimination'),false)
  assert.equal(shoot('a'),false); assert.equal(send('b','ability',{ ability:'emp' }),false)
  assert.equal(match.receiveMove('a',{ round:1,sequence:99,x:1,z:0,yaw:0,pitch:0,sprint:true,jump:false,active:true }),false)
  advance(MATCH.resultSeconds-0.02)
  assert.equal(b.hp,0)
  advance(0.03)
  assert.equal(state.matchPhase,'countdown'); assert.equal(state.roundNumber,2)
  assert.equal(b.hp,100); assert.equal(a.pistolAmmo,15); assert.equal(a.shieldCharge,0)
  assert.equal(a.abilities.get('scanner').readyAt,0)
  assert.equal(a.abilities.get('scanner').uses,0)
  assert.ok(Math.abs(a.x)<0.001 && a.z===15 && b.z===-15)
  assert.equal(sim.players.get('b').collider.isEnabled(),true)
  assert.equal(shoot('a'),false)
  advance(MATCH.countdownSeconds)
  assert.equal(state.matchPhase,'live')
  assert.equal(a.roundWins,1); assert.equal(a.kills,1); assert.equal(b.deaths,1)
  assert.equal(shoot('a'),true)
})

test('first to two wins completes a 2–0 match and permanently rejects more gameplay',t => {
  const { state,a,b,match,advance,win,nextRound,shoot } = setup(t)
  win('a'); nextRound(); win('a')
  assert.equal(state.matchPhase,'finished'); assert.equal(state.winnerId,'a')
  assert.equal(state.roundNumber,2); assert.equal(a.roundWins,2); assert.equal(b.roundWins,0)
  assert.equal(state.results.length,2)
  assert.equal(state.results[0].name,'Nova'); assert.equal(state.results[0].kills,2)
  assert.equal(match.forfeit('a'),false)
  advance(10)
  assert.equal(b.hp,0); assert.equal(shoot('b'),false); assert.equal(a.roundWins,2)
})

test('a tied score requires a deciding third round and supports either player winning',t => {
  const { state,a,b,win,nextRound } = setup(t)
  win('b'); nextRound(); win('a'); nextRound()
  assert.equal(state.roundNumber,3); assert.equal(state.matchPhase,'live')
  assert.equal(a.roundWins,1); assert.equal(b.roundWins,1)
  win('b')
  assert.equal(state.matchPhase,'finished'); assert.equal(state.winnerId,'b')
  assert.equal(a.roundWins,1); assert.equal(b.roundWins,2)
})

test('time limit uses actual health; equal health replays the round without awarding points',t => {
  const { state,a,b,advance,shoot,nextRound } = setup(t)
  advance(MATCH.roundSeconds)
  assert.equal(state.matchPhase,'roundOver'); assert.equal(state.matchReason,'draw')
  assert.equal(a.roundWins,0); assert.equal(b.roundWins,0)
  nextRound()
  assert.equal(state.roundNumber,1); assert.equal(state.roundId,2)
  assert.equal(shoot('a'),true)
  advance(MATCH.roundSeconds)
  assert.equal(state.matchReason,'time'); assert.equal(a.roundWins,1)
})

test('stale round, forged score/winner, replayed and malformed messages cannot affect the next round',t => {
  const { state,match,a,b,send,win,nextRound } = setup(t)
  win('a'); nextRound()
  const packet = { action:'fire',epoch:1,round:1,sequence:500,yaw:0,pitch:0 }
  assert.equal(match.receiveCombat('a',packet),false)
  assert.equal(match.receiveMove('a',{ round:1,sequence:500,x:1,z:0,yaw:0,pitch:0,sprint:true,jump:false,active:true }),false)
  for (const patch of [{ winnerId:'a' },{ roundWins:2 },{ hp:0 },{ round:'2' },{ round:-1 },{ round:Infinity }]) assert.equal(send('a','fire',{ yaw:0,pitch:0,...patch }),false)
  assert.equal(state.winnerId,''); assert.equal(state.matchPhase,'live')
  assert.equal(a.roundWins,1); assert.equal(b.hp,100); assert.equal(a.pistolAmmo,15)
  assert.equal(match.receiveCombat('a',{ ...packet,round:state.roundId }),true)
  assert.equal(match.receiveCombat('a',{ ...packet,round:state.roundId }),false)
})

test('forfeit decides the match once and preserves both scoreboard rows for a departing player',t => {
  const { state,match,a } = setup(t)
  assert.equal(match.forfeit('unknown'),false)
  assert.equal(match.forfeit('b'),true)
  state.players.delete('b')
  assert.equal(state.matchPhase,'finished'); assert.equal(state.winnerId,'a'); assert.equal(state.matchReason,'forfeit')
  assert.equal(state.results.find(p => p.id==='b').name,'Echo')
  assert.equal(a.roundWins,0) // Forfeit is recorded explicitly, without inventing round wins.
  assert.equal(match.forfeit('a'),false)
})
