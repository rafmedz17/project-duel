import { test } from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { ArenaSimulation } from '../src/arena/ArenaSimulation.js'
import { Prediction } from '../../client/src/multiplayer/Prediction.js'
import { ONLINE } from '../../shared/arena.js'
import { ultimateModifiers } from '../../shared/characters.js'

const command = (sequence,patch = {}) => ({ sequence,x:0,z:0,yaw:0,pitch:0,sprint:false,jump:false,active:true,...patch })
const pose = p => ({ ...p })
function setup(t,mapId = 'facility') {
  const players = new Map([['self',{ slot:0,connected:true,hp:100 }]])
  const server = new ArenaSimulation(players,mapId), prediction = new Prediction(RAPIER,mapId)
  t.after(() => { server.free(); prediction.free() })
  for (let tick=0;tick<30;tick++) server.step(tick*1000/ONLINE.tickRate)
  prediction.reset(pose(players.get('self')))
  return { server,prediction,player:players.get('self') }
}

test('prediction matches real server capsule movement, jumps, sprint, cover and walls on all maps',t => {
  for (const mapId of ['facility','neon','orbital']) {
    const { server,prediction,player } = setup(t,mapId)
    for (let tick=0;tick<420;tick++) {
      const input = command(tick,{ x:tick<95 ? 1 : 0,z:tick>=95 ? -1 : 0,sprint:tick>120,jump:tick===90 })
      prediction.command(input); server.receive('self',input,tick*1000/60)
      prediction.step(); server.step(tick*1000/60)
      const predicted = prediction.position()
      assert.ok(Math.hypot(predicted.x-player.x,predicted.y-player.y,predicted.z-player.z)<0.0001,`${mapId} tick ${tick}`)
    }
  }
})

test('delayed snapshots replay unacknowledged input; release converges and correction removes a false position',t => {
  const { server,prediction,player } = setup(t)
  const commands = [], snapshots = []
  for (let tick=0;tick<240;tick++) {
    if (tick%3===0) {
      const input = command(tick,{ x:tick<90 ? 1 : 0,jump:tick===45,active:tick<150 })
      prediction.command(input)
      commands.push({ at:tick+6,input })
    }
    for (const packet of commands.filter(packet => packet.at===tick)) server.receive('self',packet.input,tick*1000/60)
    server.step(tick*1000/60)
    if (tick%3===0) snapshots.push({ at:tick+6,pose:pose(player) })
    for (const packet of snapshots.filter(packet => packet.at===tick)) prediction.reconcile(packet.pose)
    prediction.step()
    if (tick===75) assert.ok(prediction.position().x>player.x+0.3,'local movement leads the delayed server')
    if (tick===180) prediction.entry.body.setTranslation({ x:100,y:10,z:100 },true)
  }
  const predicted = prediction.position()
  assert.ok(Math.hypot(predicted.x-player.x,predicted.y-player.y,predicted.z-player.z)<0.001)
  assert.ok(prediction.frames.length<=120)
})

test('input acknowledgement advances on simulation, not packet receipt',t => {
  const { server,player } = setup(t)
  server.receive('self',command(20,{ x:1 }),0)
  assert.equal(player.inputSequence,-1)
  server.step(0)
  assert.equal(player.inputSequence,20)
  assert.equal(player.inputSteps,1)
  server.step(16)
  assert.equal(player.inputSteps,2)
})

test('predicted crouch, release and jumping match the server, including replayed stance changes',t=>{
  const {server,prediction,player}=setup(t),snapshots=[]
  for(let tick=0;tick<180;tick++) {
    const input=command(tick,{x:tick<100 ? 1 : 0,crouch:tick>=15 && tick<90,sprint:true,jump:tick===45})
    prediction.command(input);server.receive('self',input,tick*1000/60)
    prediction.step();server.step(tick*1000/60)
    const p=prediction.position()
    assert.ok(Math.hypot(p.x-player.x,p.y-player.y,p.z-player.z)<.0001,`tick ${tick}`)
    assert.equal(prediction.entry.crouched,player.crouched)
    if(tick%3===0) snapshots.push({at:tick+6,pose:pose(player)})
    for(const packet of snapshots.filter(packet=>packet.at===tick)) prediction.reconcile(packet.pose)
  }
  prediction.reset(pose(player))
  assert.equal(prediction.motion.crouched,false)
})

test('prediction replays movement speed changes across VEX ultimate expiry without changing historical frames',t=> {
  const { server,prediction,player }=setup(t)
  player.characterId='vex';player.abilities=new Map([['ultimate',{ activeUntil:1.5 }]])
  let time=0;server.combatTime=()=>time
  const snapshots=[]
  for(let tick=0;tick<180;tick++) {
    time=tick/60
    prediction.entry.movement=ultimateModifiers(player,time).movement
    const input=command(tick,{ z:-1,active:tick<150 })
    prediction.command(input);server.receive('self',input,tick*1000/60)
    server.step(tick*1000/60)
    if(tick%3===0) snapshots.push({ at:tick+6,pose:pose(player) })
    for(const packet of snapshots.filter(packet=>packet.at===tick)) prediction.reconcile(packet.pose)
    prediction.step()
    if(tick===80) assert.ok(prediction.frames.some(frame=>frame.movement===1.5))
    if(tick===100) assert.equal(prediction.entry.movement,1)
  }
  const p=prediction.position()
  assert.ok(Math.hypot(p.x-player.x,p.y-player.y,p.z-player.z)<0.001)
})
