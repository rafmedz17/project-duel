import test from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { ArenaSimulation,validateInput } from '../src/arena/ArenaSimulation.js'
import { validateCombat } from '../src/arena/ArenaCombat.js'
import { PLAYER } from '../../shared/arena.js'
import { CROUCH,capsuleHalfHeight,eyeHeight } from '../../shared/stance.js'

function setup(t) {
  const player={slot:0,connected:true,hp:100},sim=new ArenaSimulation(new Map([['self',player]]))
  t.after(()=>sim.free())
  let tick=0
  const advance=(ticks,patch={})=>{
    for(let i=0;i<ticks;i++,tick++) {
      const now=tick*1000/60
      sim.receive('self',{sequence:tick,x:0,z:0,yaw:0,pitch:0,sprint:false,jump:false,active:true,...patch},now)
      sim.step(now)
    }
  }
  advance(30)
  return {sim,player,entry:sim.players.get('self'),advance}
}

test('crouch keeps feet planted, lowers the eye/capsule and overrides sprint with a slower walk',t=>{
  const {sim,player,entry,advance}=setup(t)
  const foot=player.y-PLAYER.height/2,standingEye=player.y+eyeHeight(false)
  advance(1,{crouch:true})
  assert.equal(player.crouched,true);assert.equal(sim.shotMotion('self').crouched,true)
  assert.ok(Math.abs(player.y-CROUCH.height/2-foot)<.001)
  assert.ok(Math.abs(entry.collider.halfHeight()-capsuleHalfHeight(true))<1e-7)
  assert.ok(standingEye-player.y-eyeHeight(true)>.5)
  advance(60,{x:1,crouch:true,sprint:true})
  assert.ok(player.x>2 && player.x<PLAYER.speed*CROUCH.speed)
  assert.ok(entry.vx<=PLAYER.speed*CROUCH.speed)
  assert.ok(Math.hypot(...sim.shotMotion('self').velocity.filter((_,i)=>i!==1))<=PLAYER.speed*CROUCH.speed+.02)
  advance(1)
  assert.equal(player.crouched,false)
  assert.ok(Math.abs(player.y-PLAYER.height/2-foot)<.001)
})

test('standing waits for headroom, then recovers without moving feet through the floor',t=>{
  const {sim,player,advance}=setup(t)
  advance(1,{crouch:true})
  const ceiling=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.9,.1,.9).setTranslation(0,1.5,15))
  advance(10,{crouch:true})
  const low=player.y
  advance(10)
  assert.equal(player.crouched,true);assert.ok(Math.abs(player.y-low)<.001)
  advance(90,{x:1})
  assert.ok(player.x>1.3);assert.equal(player.crouched,false)
  assert.ok(Math.abs(player.y-PLAYER.height/2-.02)<.005)
  sim.world.removeCollider(ceiling,true)
})

test('inactive input clears crouch and respawning restores a standing collider and accurate shot stance',t=>{
  const {sim,player,entry,advance}=setup(t)
  advance(1,{crouch:true});advance(1,{crouch:true,active:false})
  assert.equal(player.crouched,false)
  advance(1,{crouch:true});sim.respawn('self')
  assert.equal(player.crouched,false);assert.equal(entry.crouched,false)
  assert.equal(sim.shotMotion('self').crouched,false)
  assert.ok(Math.abs(entry.collider.halfHeight()-capsuleHalfHeight(false))<1e-7)
})

test('crouch is optional in old movement packets, strictly boolean in new packets and cannot override combat stance',()=>{
  const packet={sequence:0,x:0,z:0,yaw:0,pitch:0,sprint:false,jump:false,active:true}
  assert.ok(validateInput(packet));assert.ok(validateInput({...packet,crouch:true}))
  for(const patch of [{crouch:1},{crouch:'true'},{crouched:true},{height:.1}]) assert.equal(validateInput({...packet,...patch}),null)
  assert.equal(validateCombat({sequence:0,epoch:1,action:'fire',yaw:0,pitch:0,crouched:true}),null)
})
