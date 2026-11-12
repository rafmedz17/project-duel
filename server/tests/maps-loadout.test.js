import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ArenaSimulation } from '../src/arena/ArenaSimulation.js'
import { ArenaCombat } from '../src/arena/ArenaCombat.js'
import { LobbyPlayer } from '../src/rooms/LobbyState.js'
import { DEFAULT_LOADOUT,validateLoadout } from '../../shared/loadout.js'
import { MAPS } from '../../shared/maps.js'
import { rayBox } from '../../shared/ballistics.js'

test('loadout validation rejects unknown, duplicate, empty and unequipped starting weapons',() => {
  assert.deepEqual(validateLoadout(DEFAULT_LOADOUT),DEFAULT_LOADOUT)
  for (const value of [null,{},[],{ ...DEFAULT_LOADOUT,weapons:[] },{ ...DEFAULT_LOADOUT,weapons:['rifle'] },{ ...DEFAULT_LOADOUT,weapons:['pistol','pistol'] },{ ...DEFAULT_LOADOUT,abilities:['fly'] },{ ...DEFAULT_LOADOUT,abilities:['dash','dash'] },{ ...DEFAULT_LOADOUT,admin:true }]) assert.equal(validateLoadout(value),null)
  assert.deepEqual(validateLoadout({ startingWeapon:'shotgun',weapons:['shotgun'],abilities:[] }),{ startingWeapon:'shotgun',weapons:['shotgun'],abilities:[] })
})
for (const [mapId,map] of Object.entries(MAPS)) test(`${mapId} has clear spawns, walls, solid cover and matching shot occlusion`,t => {
  const players=new Map([['a',Object.assign(new LobbyPlayer(),{ slot:0 })],['b',Object.assign(new LobbyPlayer(),{ slot:1 })]])
  const sim=new ArenaSimulation(players,mapId); t.after(() => sim.free())
  for (let i=0;i<30;i++) sim.step()
  for (const player of players.values()) { assert.ok(player.grounded); assert.ok(player.y>0.8 && player.y<1); assert.ok(Math.abs(player.x)<0.001) }
  const [x,y,z,w,h,d]=map.cover[0]
  const body=sim.players.get('a').body
  body.setTranslation({ x,y:0.9,z:z+d/2+2 },true)
  // Refresh valid movement before the deadman timer expires.
  for (let i=0;i<60;i++) { sim.receive('a',{ sequence:i,x:0,z:-1,yaw:0,pitch:0,sprint:true,jump:false,active:true }); sim.step() }
  assert.ok(players.get('a').z>z+d/2)
  assert.ok(map.solids.some(s => rayBox([x,y,z+d/2+2],[0,0,-1],s.position,s.size)!==null))
  assert.ok(w>0 && h>0)
})
test('selected starting weapon and unavailable actions remain enforced through round reset',t => {
  const a=Object.assign(new LobbyPlayer(),{ slot:0,startingWeapon:'shotgun',allowedWeapons:['shotgun'],allowedAbilities:[] })
  const b=Object.assign(new LobbyPlayer(),{ slot:1 })
  const players=new Map([['a',a],['b',b]]),sim=new ArenaSimulation(players,'orbital')
  t.after(() => sim.free())
  const combat=new ArenaCombat(players,sim,1,{ round:1,respawn:false })
  assert.equal(a.weapon,'shotgun')
  assert.equal(combat.receive('a',{ action:'switch',weapon:'rifle',epoch:1,round:1,sequence:0 }),false)
  assert.equal(combat.receive('a',{ action:'ability',ability:'dash',epoch:1,round:1,sequence:1 }),false)
  a.shotgunAmmo=0; combat.resetRound(2)
  assert.equal(a.weapon,'shotgun'); assert.equal(a.shotgunAmmo,6); assert.deepEqual([...a.allowedAbilities],[])
})
