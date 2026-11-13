import test from 'node:test'
import assert from 'node:assert/strict'
import { WEAPONS,WEAPON_IDS } from '../../shared/weapons.js'
import { activeOptic,aimFov,reflexProfile } from '../src/game/weapons/optics.js'

test('every assault rifle, SMG and LMG has a reflex profile with light category zoom',()=> {
  const ids=WEAPON_IDS.filter(id=>reflexProfile(WEAPONS[id]))
  assert.deepEqual(ids,['rifle','astral','nova','striker','titan','omega'])
  for(const weapon of ids) {
    const state={ weapon,hp:100,reloading:false,lastSwitch:-10 }
    assert.equal(activeOptic(state,1,true),'reflex')
    assert.ok(aimFov(state,1,true)>=50 && aimFov(state,1,true)<=56)
    assert.equal(aimFov(state,1,false),70)
  }
})
test('snipers retain precision optics; shotguns, pistols and melee keep their existing sights',()=> {
  for(const weapon of WEAPON_IDS) {
    const state={ weapon,hp:100,lastSwitch:-10 }
    if(WEAPONS[weapon].scope) { assert.equal(activeOptic(state,1,true),'precision');assert.equal(aimFov(state,1,true),32) }
    else if(!reflexProfile(WEAPONS[weapon])) assert.equal(activeOptic(state,1,true),null)
  }
})
test('death, reload, equip recovery and releasing aim remove optics and restore normal or dash FOV',()=> {
  const s={ weapon:'omega',hp:100,reloading:false,lastSwitch:1 }
  assert.equal(activeOptic(s,1.2,true),null)
  assert.equal(activeOptic(s,2,true),'reflex')
  for(const patch of [{ hp:0 },{ reloading:true }]) assert.equal(activeOptic({ ...s,...patch },2,true),null)
  assert.equal(activeOptic(s,2,false),null)
  assert.equal(aimFov(s,2,false,true),77)
})
