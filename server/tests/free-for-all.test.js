import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {Client} from '@colyseus/sdk'
import {LobbyState,LobbyPlayer} from '../src/rooms/LobbyState.js'
import {ArenaSimulation} from '../src/arena/ArenaSimulation.js'
import {FreeForAllMatch} from '../src/arena/FreeForAllMatch.js'
import {createLobbyServer} from '../src/createServer.js'
import {DuelLobbyRoom} from '../src/rooms/DuelLobbyRoom.js'
import {MAPS} from '../../shared/maps.js'
import {canPlayArena} from '../../shared/match.js'

function setup(t,map='facility',count=5,dead=false) {
  const s=new LobbyState();Object.assign(s,{format:'ffa',phase:'arena',arenaActive:true,arenaEpoch:1})
  for(let i=0;i<count;i++) {const p=new LobbyPlayer();Object.assign(p,{slot:i,name:`Pilot ${i}`,hp:dead ? 0 : 100});s.players.set(String(i),p)}
  let seed=.17
  const sim=new ArenaSimulation(s.players,map,{randomSpawns:true,random:dead ? ()=>0 : ()=>{seed=(seed+.137)%1;return seed}})
  const match=new FreeForAllMatch(s,sim)
  t.after(()=>sim.free())
  const advance=n=>{for(let i=0;i<Math.ceil(n*60);i++) match.step()}
  return {s,sim,match,advance,a:s.players.get('0'),b:s.players.get('1')}
}

for(const map of Object.keys(MAPS)) test(`five FFA players spawn clear of collision and each other on ${map}`,t=>{
  const {s,sim,advance}=setup(t,map)
  assert.ok(sim.spawnPoints.length>=8)
  const players=[...s.players.values()]
  for(let i=0;i<5;i++) for(let j=i+1;j<5;j++) assert.ok(Math.hypot(players[i].x-players[j].x,players[i].z-players[j].z)>=6)
  advance(.5)
  for(const p of players) {assert.equal(p.grounded,true);assert.ok(p.y>.8 && p.y<1.1)}
})

test('a rematch reserves separate spawn positions for everyone who died in the previous game',t=>{
  const {s}=setup(t,'facility',5,true),players=[...s.players.values()]
  for(let i=0;i<5;i++) for(let j=i+1;j<5;j++) assert.ok(Math.hypot(players[i].x-players[j].x,players[i].z-players[j].z)>=6)
  assert.ok(players.every(p=>p.hp===100))
})

test('FFA keeps the five-second respawn, changes locations and avoids living players',t=>{
  const {match,advance,a,b,s}=setup(t)
  advance(.2)
  const seen=new Set()
  for(let i=0;i<5;i++) {
    const old=[b.x,b.z];match.combat.applyDamage('0','1',100)
    assert.equal(b.hp,0);assert.equal(b.respawnAt,match.combat.time+5)
    advance(4.9);assert.equal(b.hp,0)
    advance(.12);assert.equal(b.hp,100)
    assert.ok(Math.hypot(b.x-old[0],b.z-old[1])>2)
    for(const [id,p] of s.players) if(id!=='1') assert.ok(Math.hypot(p.x-b.x,p.z-b.z)>=5.9)
    seen.add(`${Math.round(b.x)},${Math.round(b.z)}`)
  }
  assert.equal(a.kills,5);assert.ok(seen.size>1)
})

test('the fifteenth accepted kill finishes once, preserves five standings and freezes gameplay',t=>{
  const {s,sim,match,a,b,advance}=setup(t)
  for(let i=0;i<14;i++) {b.hp=100;sim.setAlive('1',true);match.combat.applyDamage('0','1',100)}
  assert.equal(s.matchPhase,'live');assert.equal(a.kills,14)
  b.hp=1;sim.setAlive('1',true)
  for(const [id,z] of [['0',3],['1',-3]]) {
    const e=sim.players.get(id),p={x:0,y:.87,z};e.body.setTranslation(p,true);e.body.setNextKinematicTranslation(p);Object.assign(e.player,p)
  }
  a.weapon='pistol'
  const packet={action:'fire',sequence:0,epoch:1,round:1,yaw:0,pitch:Math.atan2(-.65,6)}
  assert.equal(match.receiveCombat('0',packet),true)
  assert.equal(a.kills,15);assert.equal(s.matchPhase,'finished');assert.equal(s.winnerId,'0');assert.equal(s.results.length,5)
  assert.equal(a.hitDefeated,1);assert.equal(canPlayArena(s),false)
  assert.equal(match.receiveCombat('0',{...packet,sequence:1}),false)
  assert.equal(match.receiveMove('0',{round:1}),false)
  advance(10);assert.equal(b.hp,0);assert.equal(a.kills,15);assert.equal(s.results.find(p=>p.id==='0').kills,15)
})

test('departures remove collision bodies while remaining players can keep playing solo',t=>{
  const {s,sim,match}=setup(t)
  for(const id of ['1','2','3','4']) {match.removePlayer(id);s.players.delete(id)}
  assert.equal(sim.players.size,1);assert.equal(s.players.size,1);assert.equal(s.matchPhase,'live')
  match.step();assert.equal(canPlayArena(s),true)
  match.finish('0');assert.equal(s.results.length,5)
})

test('a late reserved seat cannot join after launch or exceed a newly reduced format limit',()=>{
  const state=new LobbyState();state.arenaActive=true
  const context={state,latency:{drop:()=>{}}},client={sessionId:'late'}
  assert.throws(()=>DuelLobbyRoom.prototype.onJoin.call(context,client),/already in progress/)
  state.arenaActive=false;state.format='duel'
  state.players.set('a',new LobbyPlayer());state.players.set('b',new LobbyPlayer())
  assert.throws(()=>DuelLobbyRoom.prototype.onJoin.call(context,client),/full/)
  state.arenaActive=true
  assert.doesNotThrow(()=>DuelLobbyRoom.prototype.onLeave.call(context,client))
  assert.equal(state.arenaActive,true);assert.equal(state.players.size,2)
})

const {server,httpServer}=createLobbyServer()
let client
before(async()=>{await server.listen(0,'127.0.0.1');client=new Client(`http://127.0.0.1:${httpServer.address().port}`)})
after(async()=>{await server.gracefullyShutdown(false)})
async function until(check,timeout=10000) {const end=Date.now()+timeout;while(!check()){if(Date.now()>end) throw Error('Room state timed out');await delay(20)}}
async function room(t,name) {const r=await client.create('duel_lobby',{name});r.onMessage('shot-trail',()=>{});t.after(()=>r.leave().catch(()=>{}));await until(()=>r.state?.players?.size===1);return r}

test('FFA expands an already-full duel room to five, rejects a sixth and prevents shrinking an occupied room',async t=>{
  const host=await room(t,'Host'),guests=[]
  const join=async name=>{const r=await client.joinById(host.roomId,{name});r.onMessage('shot-trail',()=>{});guests.push(r);t.after(()=>r.leave().catch(()=>{}));return r}
  await join('Guest One');await until(()=>host.state.players.size===2)
  host.send('format',{format:'ffa'});await until(()=>host.state.format==='ffa')
  for(const name of ['Guest Two','Guest Three','Guest Four']) await join(name)
  await until(()=>host.state.players.size===5)
  assert.deepEqual([...host.state.players.values()].map(p=>p.slot).sort(),[0,1,2,3,4])
  await assert.rejects(client.joinById(host.roomId,{name:'Sixth'}))
  host.send('format',{format:'duel'});await delay(100);assert.equal(host.state.format,'ffa')
  guests[0].send('format',{format:'freeplay'});await delay(100);assert.equal(host.state.format,'ffa')
  for(const r of [host,...guests]) r.send('ready',{ready:true})
  await until(()=>host.state.phase==='ready');host.send('start')
  await until(()=>host.state.arenaActive)
  assert.equal(host.state.matchPhase,'live');assert.equal(host.state.players.size,5)
  assert.equal(host.state.ranked,false)
  const dropped=guests[0],token=dropped.reconnectionToken
  dropped.reconnection.enabled=false;dropped.connection.close(1000)
  await until(()=>host.state.players.get(dropped.sessionId)?.connected===false)
  const tick=host.state.tick;await delay(150)
  assert.equal(host.state.phase,'arena');assert.ok(host.state.tick>tick)
  const restored=await client.reconnect(token);restored.onMessage('shot-trail',()=>{});t.after(()=>restored.leave().catch(()=>{}))
  guests[0]=restored
  await until(()=>host.state.players.get(restored.sessionId)?.connected)
  await guests[0].leave();await until(()=>host.state.players.size===4)
  assert.equal(host.state.phase,'arena');assert.equal(host.state.matchPhase,'live')
  for(const r of guests.slice(1)) await r.leave()
  await until(()=>host.state.players.size===1);assert.equal(host.state.phase,'arena')
  host.send('backToLobby');await until(()=>!host.state.arenaActive)
})

test('a solo FFA player can ready and launch, while solo duel readiness remains blocked',async t=>{
  const host=await room(t,'Solo')
  host.send('ready',{ready:true});await delay(100);assert.equal(host.state.players.get(host.sessionId).ready,false)
  host.send('format',{format:'ffa'});await until(()=>host.state.format==='ffa')
  host.send('ready',{ready:true});await until(()=>host.state.phase==='ready')
  host.send('start');await until(()=>host.state.arenaActive)
  assert.equal(canPlayArena(host.state),true);assert.equal(host.state.players.size,1)
})
