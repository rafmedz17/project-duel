import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ArenaSimulation} from '../src/arena/ArenaSimulation.js'
import {LobbyPlayer} from '../src/rooms/LobbyState.js'
import {AETHER_SPIRE} from '../../shared/maps/aetherSpire.js'
import {rayBox} from '../../shared/ballistics.js'
import RAPIER from '@dimforge/rapier3d-compat'
import {Prediction} from '../../client/src/multiplayer/Prediction.js'
import {movementMultiplier} from '../../shared/weapons.js'

const players=()=>new Map([['a',Object.assign(new LobbyPlayer(),{slot:0})],['b',Object.assign(new LobbyPlayer(),{slot:1})]])

test('Aether Spire has mirrored cover, protected spawns and inward facing starts',()=>{
  const map=AETHER_SPIRE
  for(const solid of map.solids) {
    assert.ok(solid.position.every(Number.isFinite) && solid.size.every(n=>Number.isFinite(n) && n>0))
    assert.ok(map.solids.some(other=>other.size.every((n,i)=>n===solid.size[i]) && other.position.every((n,i)=>Math.abs(n-(i===1 ? solid.position[i] : -solid.position[i]))<1e-7)),`missing mirrored solid at ${solid.position}`)
  }
  for(const spawn of map.spawns) {
    assert.ok(-Math.sin(spawn.yaw)*-spawn.position[0]>0,'spawn faces the center')
    assert.ok(!map.solids.some(s=>s.position[1]>0 && Math.abs(spawn.position[0]-s.position[0])<s.size[0]/2+.35 && Math.abs(spawn.position[2]-s.position[2])<s.size[2]/2+.35),'spawn capsule is clear')
  }
  assert.ok(map.solids.some(s=>{
    const hit=rayBox([-17,1.55,0],[1,0,0],s.position,s.size)
    return hit!==null && hit<33
  }),'central cover interrupts the shot before it reaches the opposite spawn')
})

test('Aether Spire client prediction and server agree through the full stair ascent',t=>{
  const roster=players();roster.delete('b')
  const sim=new ArenaSimulation(roster,'spire'),prediction=new Prediction(RAPIER,'spire')
  t.after(()=>{prediction.free();sim.free()})
  prediction.other.collider.setEnabled(false)
  const body=sim.players.get('a').body
  body.setTranslation({x:0,y:.9,z:10.8},true)
  body.setNextKinematicTranslation({x:0,y:.9,z:10.8})
  sim.world.propagateModifiedBodyPositionsToColliders()
  for(let i=0;i<30;i++) sim.step(i*1000/60)
  const player=roster.get('a')
  // Schema fields are accessors, so object spread is not a movement snapshot.
  const pose=Object.fromEntries(['x','y','z','yaw','pitch','grounded','crouched','vx','vy','vz','rooted','knockX','knockZ','dashRemaining','dashX','dashZ'].map(key=>[key,player[key]]))
  prediction.reset(pose)
  prediction.entry.movement=movementMultiplier(player.weapon)
  for(let i=0;i<110;i++) {
    const input={sequence:i,x:0,z:-1,yaw:Math.PI,pitch:0,sprint:false,jump:false,active:true}
    prediction.command(input);sim.receive('a',input,(i+30)*1000/60)
    prediction.step();sim.step((i+30)*1000/60)
    const p=prediction.position()
    assert.ok(Math.hypot(p.x-player.x,p.y-player.y,p.z-player.z)<.0001,`prediction diverged on stair tick ${i}`)
  }
  assert.ok(player.y>2 && player.z>16,'both simulations reach the deck')
})

for(const side of [-1,1]) test(`Aether Spire ${side<0 ? 'north' : 'south'} overlook can be walked up without jumping`,t=>{
  const roster=players(),sim=new ArenaSimulation(roster,'spire')
  t.after(()=>sim.free())
  const entry=sim.players.get('a')
  entry.body.setTranslation({x:0,y:.9,z:side*10.8},true)
  entry.body.setNextKinematicTranslation({x:0,y:.9,z:side*10.8})
  sim.world.propagateModifiedBodyPositionsToColliders()
  for(let i=0;i<110;i++) {
    sim.receive('a',{sequence:i,x:0,z:-1,yaw:side>0 ? Math.PI : 0,pitch:0,sprint:false,jump:false,active:true})
    sim.step()
  }
  const player=roster.get('a')
  assert.ok(side*player.z>16 && side*player.z<20,`reached deck: z=${player.z}`)
  assert.ok(player.y>2 && player.y<2.15,`standing on 1.2m deck: y=${player.y}`)
  assert.ok(player.grounded)
})
