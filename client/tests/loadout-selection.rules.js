import {test} from 'node:test'
import assert from 'node:assert/strict'
import {loadoutIsOpen,loadoutWindow} from '../src/multiplayer/loadoutSelection.js'

const state=()=>({status:'connected',sessionId:'a',menuOpen:false,closedLoadout:'',room:{code:'ABC234',arenaEpoch:1,arenaActive:true,phase:'arena',format:'duel',matchPhase:'loadout',roundId:1,time:10,players:[{id:'a',combat:{hp:100,respawnAt:0}}]}})

test('closing a preset picker lasts only for that round and never hides a later arena or replay',()=>{
  const s=state()
  assert.equal(loadoutIsOpen(s),true)
  s.closedLoadout=loadoutWindow(s)
  assert.equal(loadoutIsOpen(s),false)
  s.room.roundId=2;assert.equal(loadoutIsOpen(s),true)
  s.room.roundId=1;s.room.arenaEpoch=2;assert.equal(loadoutIsOpen(s),true)
  s.room.arenaEpoch=1;s.room.code='DEF567';assert.equal(loadoutIsOpen(s),true)
  s.room.matchPhase='countdown';assert.equal(loadoutWindow(s),'')
  s.room.matchPhase='live';assert.equal(loadoutIsOpen(s),false)
})

test('Free Play picker dismissal does not bypass the server respawn window, and the next death reopens it',()=>{
  const s=state();s.room.format='freeplay'
  const combat=s.room.players[0].combat
  assert.equal(loadoutIsOpen(s),false)
  Object.assign(combat,{hp:0,respawnAt:15})
  assert.equal(loadoutIsOpen(s),true)
  s.closedLoadout=loadoutWindow(s);assert.equal(loadoutIsOpen(s),false)
  s.room.time=15;assert.equal(loadoutWindow(s),'')
  s.room.time=20;combat.respawnAt=25;assert.equal(loadoutIsOpen(s),true)
  s.menuOpen=true;assert.equal(loadoutIsOpen(s),false)
  s.menuOpen=false;s.status='reconnecting';assert.equal(loadoutWindow(s),'')
  s.status='connected';s.room.phase='interrupted';assert.equal(loadoutWindow(s),'')
})
