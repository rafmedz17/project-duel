import { before,after,test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { Client } from '@colyseus/sdk'
import { createLobbyServer } from '../src/createServer.js'
import { makeLoadoutBank,validateLoadoutBank,bankFromRows } from '../../shared/loadoutBank.js'
import { DEFAULT_LOADOUT,validateLoadout } from '../../shared/loadout.js'
import { MATCH } from '../../shared/match.js'
import { PLAYER } from '../../shared/arena.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

const { server,httpServer }=createLobbyServer()
let sdk
before(async ()=> { await server.listen(0,'127.0.0.1');sdk=new Client(`http://127.0.0.1:${httpServer.address().port}`) })
after(async ()=>server.gracefullyShutdown(false))
async function until(predicate,timeout=6000) {
  const end=Date.now()+timeout
  while(!predicate()) { if(Date.now()>end) throw Error('Loadout state did not synchronize');await delay(20) }
}
const gear=(primary,character='vex')=>validateLoadout({ character,primary,secondary:'magnus',melee:'fangs',unique:'scanner',startingWeapon:primary })
function presets() {
  const bank=makeLoadoutBank(gear('railbreaker'));bank.slots[1]=gear('omega','ion');bank.slots[4]=gear('shotgun','aegis');return bank
}
async function pair(t,format,guestBank) {
  const host=await sdk.create('duel_lobby',{ name:'Slot Pilot',loadoutBank:presets() }),guest=await sdk.joinById(host.roomId,{ name:'Slot Target',...(guestBank ? { loadoutBank:guestBank } : {}) })
  for(const room of [host,guest]) { room.onMessage('shot-trail',()=>{});t.after(()=>room.leave().catch(()=>{})) }
  await until(()=>host.state.players.size===2)
  host.send('format',{ format });await until(()=>host.state.format===format)
  host.send('ready',{ ready:true });guest.send('ready',{ ready:true });await until(()=>host.state.phase==='ready')
  host.send('start');await until(()=>host.state.arenaActive)
  return { host,guest }
}
const select=(room,slot,extra={})=>room.send('select-loadout',{ slot,epoch:room.state.arenaEpoch,round:room.state.roundId,...extra })

test('banks migrate one existing loadout into five independent slots and reject invalid/sparse/extra equipment',()=> {
  const bank=presets();assert.equal(bank.slots.length,5);assert.equal(validateLoadoutBank(bank).slots[1].character,'ion')
  bank.slots[2].weapons[0]='rifle';assert.equal(bank.slots[0].weapons[0],'magnus')
  for(const value of [{ ...presets(),activeSlot:5 },{ ...presets(),slots:new Array(5) },{ ...presets(),slots:presets().slots.slice(0,4) },{ ...presets(),spoof:true }]) assert.equal(validateLoadoutBank(value),null)
  const migrated=bankFromRows({ character_id:'ion',primary_weapon:'rifle',unique_skill:'smoke',starting_weapon:'rifle',weapons:['pistol','blade','rifle'],abilities:['dash','shield','smoke','ultimate'] })
  assert.equal(migrated.slots.length,5);assert.ok(migrated.slots.every(slot=>slot.character==='ion'))
  assert.equal(DEFAULT_LOADOUT.startingWeapon,'rifle')
  assert.equal(validateLoadout({ character:'vex',primary:'omega',secondary:'volt',unique:'scanner' }).startingWeapon,'omega')
  const legacy=gear('omega');legacy.startingWeapon='magnus'
  const upgraded=makeLoadoutBank(legacy)
  assert.ok(upgraded.slots.every(slot=>slot.startingWeapon==='omega'))
  upgraded.slots[1].startingWeapon='fangs'
  assert.equal(validateLoadoutBank(upgraded).slots[1].startingWeapon,'omega')
  const cloud=bankFromRows({ active_slot:1,character_id:'ion',primary_weapon:'omega',secondary_weapon:'magnus',melee_weapon:'fangs',unique_skill:'scanner',starting_weapon:'magnus',weapons:['magnus','fangs','omega'],abilities:['dash','shield','scanner','ultimate'] },[{ slot_id:0,character_id:'aegis',primary_weapon:'shotgun',unique_skill:'smoke',starting_weapon:'blade',weapons:['pistol','blade','shotgun'],abilities:['dash','shield','smoke','ultimate'] }])
  assert.equal(cloud.slots[0].startingWeapon,'shotgun');assert.equal(cloud.slots[1].startingWeapon,'omega')
  assert.equal(legacy.startingWeapon,'magnus')
})

test('duel selection is private, server-owned, rejects spoofed or late choices and opens again before the next round',async t=> {
  const { host,guest }=await pair(t,'duel'),self=()=>host.state.players.get(host.sessionId)
  let ownBank,otherBank
  host.onMessage('loadout-bank',bank=>{ ownBank=bank });guest.onMessage('loadout-bank',bank=>{ otherBank=bank })
  host.send('loadout-bank');guest.send('loadout-bank')
  await until(()=>ownBank && otherBank)
  assert.equal(ownBank.slots[1].primary,'omega');assert.equal(otherBank.slots[1].primary,'rifle')
  assert.equal(host.state.matchPhase,'loadout');assert.ok(host.state.phaseRemaining<=MATCH.loadoutSeconds)
  select(host,1,{ epoch:99 });select(host,4,{ round:99 });select(host,5);select(host,1,{ character:'forged' })
  await delay(100);assert.equal(self().arsenal.activeSlot,0)
  host.send('combat',{ epoch:1,round:1,sequence:0,action:'fire',yaw:0,pitch:0 })
  host.send('move',{ round:1,sequence:0,x:1,z:0,yaw:0,pitch:0,sprint:true,jump:false,active:true })
  await delay(100);assert.equal(self().shot,0);assert.equal(self().x,0)
  select(host,1);await until(()=>self().arsenal.activeSlot===1)
  assert.equal(self().characterId,'ion');assert.deepEqual([...self().allowedWeapons],['magnus','fangs','omega'])
  select(host,0);await until(()=>self().arsenal.activeSlot===0)
  await until(()=>host.state.matchPhase==='countdown',12000)
  select(host,4);await delay(100);assert.equal(self().arsenal.activeSlot,0)
  await until(()=>host.state.matchPhase==='live')
  select(host,1);await delay(100);assert.equal(self().arsenal.activeSlot,0)
  const target=host.state.players.get(guest.sessionId),yaw=Math.atan2(self().x-target.x,self().z-target.z)
  host.send('combat',{ epoch:1,round:1,sequence:1,action:'fire',yaw,pitch:Math.atan2(target.y+ROBOT_HEAD_Y-self().y-PLAYER.eye,Math.hypot(self().x-target.x,self().z-target.z)) })
  await until(()=>host.state.matchPhase==='roundOver')
  select(host,4);await delay(100);assert.equal(self().arsenal.activeSlot,0)
  await until(()=>host.state.matchPhase==='loadout')
  assert.equal(host.state.roundId,2)
  select(host,4,{ round:1 });await delay(100);assert.equal(self().arsenal.activeSlot,0)
  select(host,4);await until(()=>self().arsenal.activeSlot===4)
  assert.equal(self().characterId,'aegis');assert.equal(self().hp,100)
})

test('freeplay permits a preset swap only while dead during the five-second window and respawns with fresh selected gear',async t=> {
  const { host,guest }=await pair(t,'freeplay',presets()),target=()=>guest.state.players.get(guest.sessionId)
  select(guest,1);await delay(100);assert.equal(target().arsenal.activeSlot,0)
  const a=host.state.players.get(host.sessionId),b=host.state.players.get(guest.sessionId)
  host.send('combat',{ epoch:1,sequence:0,action:'fire',yaw:0,pitch:Math.atan2(b.y+ROBOT_HEAD_Y-a.y-PLAYER.eye,Math.hypot(a.x-b.x,a.z-b.z)) })
  await until(()=>target().hp===0)
  const killedAt=host.state.tick/60,deadline=target().respawnAt
  assert.ok(deadline-killedAt>4.8 && deadline-killedAt<=5.01)
  select(guest,4);await until(()=>target().arsenal.activeSlot===4)
  assert.equal(target().hp,0)
  await until(()=>target().hp===100,6500)
  assert.equal(target().weapon,'shotgun');assert.equal(target().shotgunAmmo,6);assert.equal(target().characterId,'aegis')
  assert.equal(target().deaths,1)
  select(guest,2);await delay(100);assert.equal(target().arsenal.activeSlot,4)
})
