import test from 'node:test'
import assert from 'node:assert/strict'
import { ArenaCombat, validateCombat } from '../src/arena/ArenaCombat.js'
import { ArenaSimulation } from '../src/arena/ArenaSimulation.js'
import { WEAPONS, pelletDamage } from '../../shared/weapons.js'
import { rayRobot } from '../../shared/ballistics.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

function setup(t) {
  const players = new Map([['a',{ slot:0,connected:true }],['b',{ slot:1,connected:true }]])
  const simulation = new ArenaSimulation(players)
  t.after(() => simulation.free())
  const combat = new ArenaCombat(players,simulation,1)
  // These regional-damage scenarios deliberately equip the pistol.
  for (const player of players.values()) Object.assign(player,{ startingWeapon:'pistol',weapon:'pistol' })
  // This weapon lifecycle fixture exercises both primaries independently of lobby selection.
  players.get('a').allowedWeapons.push('shotgun')
  const a = players.get('a'), b = players.get('b')
  Object.assign(a,{ x:0,y:0.87,z:8,yaw:0,pitch:0 })
  Object.assign(b,{ x:0,y:0.87,z:-8,yaw:Math.PI,pitch:0 })
  let sequence = 0
  const send = (action,details = {},id = 'a') => combat.receive(id,{ action,epoch:1,sequence:sequence++,...details })
  const advance = seconds => { for (let i=0;i<Math.ceil(seconds*60);i++) combat.step() }
  const fire = (height = b.y-0.03,x = b.x) => send('fire',{ yaw:Math.atan2(a.x-x,a.z-b.z),pitch:Math.atan2(height-(a.y+0.65),Math.hypot(a.x-x,a.z-b.z)) })
  return { players,simulation,combat,a,b,send,advance,fire }
}

test('authoritative robot hits distinguish head, torso, arms and feet with actual removed health',t => {
  const { a,b,fire,advance } = setup(t)
  for (const [height,x,damage,headshot] of [[b.y+ROBOT_HEAD_Y,0,56,true],[0.84,0,28,false],[0.77,0.3,21,false],[0.08,0.13,14,false]]) {
    b.hp = 100
    assert.equal(fire(height,x),true)
    assert.equal(b.hp,100-damage)
    assert.equal(a.hitDamage,damage)
    assert.equal(a.hitHeadshot,headshot)
    advance(0.24)
  }
  assert.equal(a.pistolAmmo,11)
  assert.equal(a.hitId,4)
})

test('forged hit claims, origins, damage, malformed aims and replayed or old-arena intents are rejected',t => {
  const { combat,a,b } = setup(t)
  const packet = { action:'fire',epoch:1,sequence:0,yaw:0,pitch:0.5 }
  for (const patch of [{ targetId:'b' },{ damage:999 },{ origin:[0,1,-8] },{ sessionId:'b' },{ yaw:NaN },{ pitch:Infinity },{ pitch:2 },{ epoch:0 },{ sequence:-1 },{ sequence:1.5 },{ action:'switch',weapon:'fake' }]) assert.equal(combat.receive('a',{ ...packet,...patch }),false)
  assert.equal(validateCombat(null),null)
  assert.equal(validateCombat([]),null)
  assert.equal(combat.receive('a',packet),true)
  assert.equal(combat.receive('a',packet),false)
  assert.equal(a.pistolAmmo,14)
  assert.equal(b.hp,100)
  assert.equal(combat.receive('unknown',{ ...packet,sequence:2 }),false)
})

test('cover, range, gaps between legs and missing rays cannot damage a player',t => {
  const { a,b,fire,send,advance } = setup(t)
  Object.assign(a,{ x:8,z:10 }); Object.assign(b,{ x:8,z:2 })
  assert.equal(fire(b.y+ROBOT_HEAD_Y),true)
  assert.equal(b.hp,100)
  Object.assign(a,{ x:0,z:17 }); Object.assign(b,{ x:0,z:-17 })
  advance(0.3); send('switch',{ weapon:'shotgun' }); advance(0.3)
  fire(); assert.equal(b.hp,100)
  advance(0.9); send('switch',{ weapon:'blade' }); advance(0.3)
  fire(); assert.equal(b.hp,100)
  assert.equal(rayRobot([0,0.2,8],[0,0,-1],b),null)
})

test('server cooldown and equip recovery reject spam without spending ammunition',t => {
  const { a,b,fire,send,advance } = setup(t)
  fire(); for (let i=0;i<20;i++) assert.equal(fire(),false)
  assert.equal(a.pistolAmmo,14); assert.equal(b.hp,72)
  assert.equal(send('switch',{ weapon:'rifle' }),true)
  assert.equal(fire(),false)
  assert.equal(send('switch',{ weapon:'shotgun' }),false)
  advance(0.26); assert.equal(fire(),true)
  assert.equal(a.rifleAmmo,29); assert.equal(b.hp,48)
  assert.equal(fire(),false)
  advance(0.13); assert.equal(fire(),true)
})

test('all firearm magazines auto reload on empty; manual reload and cancelled reload preserve other magazines',t => {
  const { a,b,fire,send,advance } = setup(t)
  b.x = 15 // Deliberately miss while checking weapon lifecycle.
  for (const id of ['pistol','rifle','shotgun']) {
    if (id!=='pistol') { advance(1); send('switch',{ weapon:id }); advance(0.3) }
    const weapon = WEAPONS[id]
    for (let i=0;i<weapon.magazine;i++) { assert.equal(fire(5,0),true); if (i<weapon.magazine-1) advance(weapon.cooldown+0.01) }
    assert.equal(a[`${id}Ammo`],0); assert.equal(a.reloading,true); assert.equal(a.reloadReason,'auto')
    assert.equal(fire(),false)
    advance(weapon.reload-0.05); assert.equal(a[`${id}Ammo`],0)
    advance(0.06); assert.equal(a[`${id}Ammo`],weapon.magazine)
  }
  advance(1); send('switch',{ weapon:'pistol' }); advance(0.3); fire(5,0)
  assert.equal(send('reload'),true); advance(0.5)
  send('switch',{ weapon:'blade' }); advance(3)
  assert.equal(a.pistolAmmo,14); assert.equal(a.rifleAmmo,30)
  send('switch',{ weapon:'pistol' }); advance(0.3); send('reload'); advance(1.51)
  assert.equal(a.pistolAmmo,15)
})

test('blade and shotgun apply regional damage, kill once, disable dead bodies and respawn with a fresh loadout',t => {
  const { a,b,simulation,fire,send,advance } = setup(t)
  b.z = 6
  send('switch',{ weapon:'blade' }); advance(0.3)
  assert.equal(fire(b.y+ROBOT_HEAD_Y),true)
  assert.equal(b.hp,0); assert.equal(a.hitDamage,100); assert.equal(a.hitHeadshot,true)
  assert.equal(a.kills,1); assert.equal(b.deaths,1)
  assert.equal(simulation.players.get('b').collider.isEnabled(),false)
  assert.equal(send('fire',{ yaw:Math.PI,pitch:0 },'b'),false)
  advance(0.7); fire(b.y+ROBOT_HEAD_Y)
  assert.equal(a.kills,1)
  advance(4.4)
  assert.equal(b.hp,100); assert.equal(b.weapon,'pistol'); assert.equal(b.pistolAmmo,15)
  assert.equal(b.deaths,1); assert.equal(a.kills,1)
  assert.equal(b.z,-15); assert.equal(simulation.players.get('b').collider.isEnabled(),true)
  b.z = 5; b.y = 0.87
  send('switch',{ weapon:'shotgun' }); advance(0.3)
  fire()
  assert.ok(b.hp<100); assert.equal(a.shotgunAmmo,5)
  assert.equal(pelletDamage(WEAPONS.shotgun,24,'head'),2)
  assert.equal(pelletDamage(WEAPONS.pistol,4,'invalid'),0)
})
