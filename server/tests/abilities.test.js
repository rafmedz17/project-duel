import test from 'node:test'
import assert from 'node:assert/strict'
import { ArenaCombat } from '../src/arena/ArenaCombat.js'
import { ArenaSimulation } from '../src/arena/ArenaSimulation.js'

function setup(t) {
  const players = new Map([['a',{ slot:0,connected:true }],['b',{ slot:1,connected:true }]])
  const sim = new ArenaSimulation(players), combat = new ArenaCombat(players,sim,1)
  // These regional-damage scenarios deliberately equip the pistol.
  for (const player of players.values()) Object.assign(player,{ startingWeapon:'pistol',weapon:'pistol' })
  t.after(() => sim.free())
  for (const player of players.values()) player.allowedAbilities = ['dash','shield','scanner','ultimate','flashbang','stun','smoke']
  let sequence = 0, inputSequence = 0
  const send = (id,action,details = {}) => combat.receive(id,{ action,epoch:1,sequence:sequence++,...details })
  const ability = (id,name) => send(id,'ability',{ ability:name })
  const move = (id,patch = {}) => sim.receive(id,{ sequence:inputSequence++,x:0,z:0,yaw:players.get(id).yaw,pitch:0,sprint:false,jump:false,active:true,...patch })
  const advance = seconds => { for (let i=0;i<Math.ceil(seconds*60);i++) { combat.step(); sim.step() } }
  const teleport = (id,x,z) => {
    const entry = sim.players.get(id), position = { x,y:0.87,z }
    sim.stop(id); entry.body.setTranslation(position,true); entry.body.setNextKinematicTranslation(position)
    Object.assign(players.get(id),position)
    sim.world.step()
  }
  const fire = (id,target,patch = {}) => {
    const a = players.get(id), b = players.get(target)
    return send(id,'fire',{ yaw:Math.atan2(a.x-b.x,a.z-b.z),pitch:Math.atan2(b.y-0.03-a.y-0.65,Math.hypot(a.x-b.x,a.z-b.z)),...patch })
  }
  return { a:players.get('a'),b:players.get('b'),sim,combat,players,send,ability,move,advance,teleport,fire }
}

test('ability intents reject forged values, old arenas, replays, cooldown spam, disconnected and dead senders',t => {
  const { a,b,combat,send,ability } = setup(t)
  for (const patch of [{ ability:'fake' },{ ability:1 },{ ability:['shield'] },{ ability:{ toString:null } },{ ability:'shield',capacity:999 },{ ability:'dash',direction:[99,99] },{ ability:'emp',damage:999 },{ ability:'scanner',activeUntil:999 }]) assert.equal(send('a','ability',patch),false)
  assert.equal(send('a','switch',{ weapon:{ toString:0 } }),false)
  assert.equal(combat.receive('a',{ action:'ability',ability:'shield',epoch:0,sequence:100 }),false)
  const packet = { action:'ability',ability:'shield',epoch:1,sequence:100 }
  assert.equal(combat.receive('a',packet),true)
  assert.equal(combat.receive('a',packet),false)
  assert.equal(a.shieldCharge,50)
  assert.equal(combat.receive('a',{ ...packet,sequence:101 }),false)
  assert.equal(a.abilities.get('shield').uses,1)
  b.connected = false; assert.equal(ability('b','emp'),false)
  b.connected = true; b.hp = 0; assert.equal(ability('b','emp'),false)
})

test('dash has normalized fixed travel, ignores later steering, keeps gravity and cannot bypass cover or walls',t => {
  const { a,sim,ability,move,advance,teleport } = setup(t)
  advance(0.2)
  const start = a.z
  move('a'); assert.equal(ability('a','dash'),true)
  advance(0.19)
  assert.ok(Math.abs(start-a.z-3.6)<0.03,`Dash travelled ${start-a.z}`)
  assert.ok(a.y<0.9)
  assert.equal(ability('a','dash'),false)
  advance(3)
  teleport('a',0,15); move('a',{ x:1,z:-1 }); ability('a','dash')
  move('a',{ x:-1,z:1 })
  advance(0.19)
  assert.ok(Math.abs(Math.hypot(a.x,a.z-15)-3.6)<0.03)
  assert.ok(a.x>0 && a.z<15)
  advance(3)
  teleport('a',8,9); move('a'); ability('a','dash'); advance(0.19)
  assert.ok(a.z>7.3 && a.z<7.5)
  advance(3)
  teleport('a',4,-18); move('a'); ability('a','dash'); advance(0.19)
  assert.ok(a.z>-19.2)
  // Releasing control cancels remaining travel immediately.
  advance(3); teleport('a',0,15); move('a'); ability('a','dash'); advance(1/60)
  move('a',{ active:false }); const stopped = a.z
  advance(0.3)
  assert.ok(Math.abs(a.z-stopped)<0.001)
  assert.equal(sim.players.get('a').dash,null)
})

test('shield absorbs real weapon hits, spills excess into health and expires without healing or altering ammo',t => {
  const { a,b,ability,advance,fire } = setup(t)
  advance(0.2); ability('b','shield')
  fire('a','b')
  assert.equal(b.hp,100); assert.equal(b.shieldCharge,22)
  assert.equal(a.hitDamage,0); assert.equal(a.hitShieldDamage,28); assert.equal(a.hitId,1)
  advance(0.24); fire('a','b'); advance(0.24); fire('a','b')
  assert.equal(b.hp,66); assert.equal(b.shieldCharge,0)
  assert.equal(a.hitDamage,28); assert.equal(a.hitShieldDamage,0)
  assert.equal(a.pistolAmmo,12)
  assert.equal(ability('b','shield'),false)
  advance(9); ability('b','shield'); advance(3.51)
  assert.equal(b.shieldCharge,0); fire('a','b')
  assert.equal(b.hp,38)
})

test('stun grenades are fused, root enemies without damage and preserve their weapons and shields',t => {
  const { a,b,ability,advance,teleport,fire,combat } = setup(t)
  teleport('a',0,6); teleport('b',0,-1)
  ability('b','shield')
  assert.equal(ability('a','stun'),true)
  assert.equal(a.abilities.get('stun').flying,true)
  assert.equal(b.rooted,false)
  advance(0.91)
  assert.equal(a.abilities.get('stun').flying,false)
  assert.equal(b.rooted,true)
  assert.equal(b.hp,100); assert.equal(b.shieldCharge,50)
  assert.equal(a.rooted,false)
  assert.equal(ability('b','dash'),false)
  assert.equal(fire('b','a'),true)
  const deadline=b.rootedUntil
  advance(deadline-combat.time+0.01)
  assert.equal(b.rooted,false)
})

test('death cancels effects but preserves cooldowns through respawn; a new arena resets abilities',t => {
  const { a,b,sim,combat,players,ability,advance,fire,teleport } = setup(t)
  advance(0.2); ability('b','scanner'); ability('b','shield')
  const readyAt = b.abilities.get('scanner').readyAt
  teleport('a',0,-10); b.hp = 20
  combat.applyDamage('a','b',100) // Kills through the remaining shield.
  assert.equal(b.hp,0); assert.equal(a.kills,1)
  assert.equal(b.abilities.get('scanner').activeUntil,0)
  assert.equal(b.shieldCharge,0)
  assert.equal(ability('b','dash'),false)
  advance(5.1)
  assert.equal(b.hp,100); assert.equal(b.abilities.get('scanner').readyAt,readyAt)
  assert.equal(ability('b','scanner'),false)
  assert.equal(combat.time>3,true)
  fire('a','b')
  new ArenaCombat(players,sim,2)
  assert.equal(b.abilities.get('scanner').uses,0)
  assert.equal(b.abilities.get('scanner').readyAt,0)
  assert.equal(b.disabledUntil,0)
})
