import test from 'node:test'
import assert from 'node:assert/strict'
import {ABILITIES} from '../../shared/abilities.js'
import {launchGrenade,stepGrenade,grenadeTrajectory,flashDuration,throughSmoke} from '../../shared/tactical.js'
import {DEFAULT_LOADOUT,previousWeapon} from '../../shared/loadout.js'

test('throw guide and authoritative fixed steps land at the same point, including a wall bounce',()=>{
  const solids=[{position:[0,-.5,0],size:[80,1,80]},{position:[0,3,-6],size:[12,6,.3]}]
  for(const id of ['flashbang','smoke','stun']) for(const pitch of [-.4,0,.5]) {
    const points=grenadeTrajectory([0,.87,0],0,pitch,false,id,solids)
    const actual=launchGrenade([0,.87,0],0,pitch,false,id)
    for(let i=0;i<54;i++) stepGrenade(actual,1/60,solids)
    assert.ok(Math.hypot(...actual.position.map((v,k)=>v-points.at(-1)[k]))<1e-8)
    assert.ok(points.every(p=>p[2]>-5.74),'thin cover must stop the swept projectile')
    assert.ok(points.every(p=>p[1]>.10),'ground bounce stays above the floor')
  }
})

test('fixed grenade substeps agree across frame sizes and the longer throws stay bounded',()=>{
  for(const id of ['flashbang','smoke','stun']) {
    const a=launchGrenade([0,.87,0],0,.1,false,id),b=structuredClone(a)
    for(let i=0;i<9;i++) stepGrenade(a,.1,[])
    for(let i=0;i<54;i++) stepGrenade(b,1/60,[])
    assert.ok(Math.hypot(...a.position.map((v,k)=>v-b.position[k]))<1e-8)
    assert.ok(Math.abs(a.position[2])<=17)
  }
  assert.ok(Math.abs(grenadeTrajectory([0,.87,0],0,0,false,'flashbang',[]).at(-1)[2])>15)
})

test('flash range honors facing and cover, and smoke obscures the expanded six-meter radius',()=>{
  const target={x:0,y:.87,z:0,yaw:0,pitch:0},origin=[0,1.52,-12]
  const forward=flashDuration(origin,target,[]),away=flashDuration(origin,{...target,yaw:Math.PI},[])
  assert.ok(forward>away && away>0)
  assert.equal(flashDuration([0,1.52,-15],target,[]),0)
  assert.equal(flashDuration(origin,target,[{position:[0,2,-6],size:[8,4,.2]}]),0)
  assert.equal(throughSmoke([5,1,8],[5,1,-8],[{origin:[0,1,0],radius:ABILITIES.smoke.radius}]),true)
  assert.equal(throughSmoke([7,1,8],[7,1,-8],[{origin:[0,1,0],radius:ABILITIES.smoke.radius}]),false)
})

test('quick swap prefers valid history and has a safe fallback before the first weapon change',()=>{
  assert.equal(previousWeapon(DEFAULT_LOADOUT,'rifle','blade'),'blade')
  assert.equal(previousWeapon(DEFAULT_LOADOUT,'blade','pistol'),'pistol')
  assert.equal(previousWeapon(DEFAULT_LOADOUT,'rifle',''),'pistol')
  assert.equal(previousWeapon(DEFAULT_LOADOUT,'pistol','invalid'),'rifle')
})
