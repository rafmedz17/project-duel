import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ArenaSimulation } from '../src/arena/ArenaSimulation.js'
import { PLAYER, ONLINE } from '../../shared/arena.js'

function create(t, slots = [0]) {
  const players = new Map(slots.map(slot => [String(slot),{ slot,connected:true }]))
  const sim = new ArenaSimulation(players)
  t.after(() => sim.free())
  return { sim,players }
}
const input = (sequence,patch = {}) => ({ sequence,x:0,z:0,yaw:0,pitch:0,sprint:false,jump:false,active:true,...patch })
function advance(sim, ticks, command, start = 0, id = '0') {
  for (let i=0;i<ticks;i++) {
    const tick = start+i, now = tick*1000/ONLINE.tickRate
    if (i%3 === 0) sim.receive(id,input(tick,command),now)
    sim.step(now)
  }
}

test('server owns time, rejects position/time/identity spoofing, malformed values and replayed sequences',t => {
  const { sim,players } = create(t)
  const p = players.get('0'), start = [p.x,p.y,p.z]
  assert.equal(sim.receive('missing',input(0),0),false)
  for (const patch of [{ position:[100,100,100] },{ dt:1000 },{ sessionId:'1' },{ x:100 },{ yaw:Infinity },{ pitch:NaN },{ active:'yes' },{ sequence:-1 }]) assert.equal(sim.receive('0',input(0,patch),0),false)
  for (let i=0;i<100;i++) sim.receive('0',input(i,{ x:1 }),0)
  assert.deepEqual([p.x,p.y,p.z],start) // More packets never simulate more time.
  assert.equal(sim.receive('0',input(98,{ x:-1 }),0),false)
  sim.step(0)
  assert.ok(p.x>0 && p.x<PLAYER.speed/ONLINE.tickRate)
})

test('walk/sprint speeds are bounded and diagonal movement is normalized',t => {
  const a = create(t), b = create(t), c = create(t)
  advance(a.sim,60,{ x:1 }); advance(b.sim,60,{ x:1,z:-1 }); advance(c.sim,60,{ x:1,sprint:true })
  const straight = a.players.get('0').x, diagonal = b.players.get('0')
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z-15)-straight)<0.01)
  assert.ok(straight>4 && straight<=PLAYER.speed)
  assert.ok(c.players.get('0').x>straight && c.players.get('0').x<=PLAYER.sprint)
})

test('actual Rapier walls, pillars and cover stop movement without tunnelling',t => {
  const wall = create(t)
  advance(wall.sim,480,{ z:-1,sprint:true })
  assert.ok(wall.players.get('0').z > -18.5 && wall.players.get('0').z < -18.3)
  const cover = create(t)
  advance(cover.sim,100,{ x:1 }) // x approximately 8, facing the south-east cover.
  advance(cover.sim,180,{ z:-1,sprint:true },100)
  const p = cover.players.get('0')
  assert.ok(p.x>7.5 && p.x<8.5)
  assert.ok(p.z>7.3 && p.z<7.5)
  assert.ok(p.y>0.85 && p.y<0.9)
})

test('jumping needs ground contact and holding jump cannot create flight or automatic bounces',t => {
  const { sim,players } = create(t)
  advance(sim,30,{})
  const floor = players.get('0').y
  let peak = floor
  for (let i=30;i<210;i++) {
    const now = i*1000/ONLINE.tickRate
    if (i%3===0) sim.receive('0',input(i,{ jump:true }),now)
    sim.step(now)
    peak = Math.max(peak,players.get('0').y)
  }
  assert.ok(peak>floor+0.9 && peak<floor+1.3)
  assert.ok(Math.abs(players.get('0').y-floor)<0.02)
  assert.equal(players.get('0').grounded,true)
})

test('stale inputs and explicit inactive input stop the player and clear queued jumps',t => {
  const { sim,players } = create(t)
  advance(sim,30,{ x:1 })
  for (let i=30;i<90;i++) sim.step(i*1000/ONLINE.tickRate)
  const stopped = players.get('0').x
  for (let i=90;i<120;i++) sim.step(i*1000/ONLINE.tickRate)
  assert.ok(Math.abs(players.get('0').x-stopped)<0.0001)
  assert.equal(players.get('0').active,false)
  sim.receive('0',input(200,{ x:1,jump:true,active:false }),2000)
  sim.step(2000)
  assert.ok(Math.abs(players.get('0').x-stopped)<0.0001)
  assert.ok(players.get('0').y<0.9)
})

test('the two server-owned capsules cannot pass through each other',t => {
  const { sim,players } = create(t,[0,1])
  let minimumSeparation = Infinity
  for (let i=0;i<300;i++) {
    const now = i*1000/ONLINE.tickRate
    if (i%3===0) {
      sim.receive('0',input(i,{ z:-1 }),now)
      sim.receive('1',input(i,{ z:-1,yaw:Math.PI }),now)
    }
    sim.step(now)
    const a = players.get('0'), b = players.get('1')
    minimumSeparation = Math.min(minimumSeparation,Math.hypot(a.x-b.x,a.z-b.z))
  }
  assert.ok(minimumSeparation>=ONLINE.capsuleRadius*2-0.01,`Closest capsule separation: ${minimumSeparation}`)
})
