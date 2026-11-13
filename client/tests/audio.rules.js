import test from 'node:test'
import assert from 'node:assert/strict'
import { combatCues,matchCues,Footsteps } from '../src/audio/cues.js'
import { audioSettings } from '../src/audio/settings.js'
import { game } from '../src/game/store.js'
import { WEAPON_IDS } from '../../shared/weapons.js'
import { FIREARM_VOICES,soundLayers } from '../src/audio/profiles.js'

const copy=() => structuredClone(game.get())
function start() { game.reset(); game.set({ mode:'playing' }); return copy() }
test('audio follows accepted attacks, does not replay rejected inputs or multiply delayed shot counters',() => {
  const previous=start()
  game.attack([])
  assert.deepEqual(combatCues(previous,game.get()),['rifle'])
  const fired=copy()
  assert.equal(game.attack([]),false)
  assert.deepEqual(combatCues(fired,game.get()),[])
  assert.deepEqual(combatCues(fired,{ ...fired,shot:fired.shot+8 }),['rifle'])
  assert.deepEqual(combatCues(null,fired),[])
})
test('confirmed headshots, eliminations and shield hits have separate cues; remote hits stay private to their shooter',() => {
  const previous=start()
  game.attack([{ targetId:0,distance:5,region:'head' }])
  assert.deepEqual(combatCues(previous,game.get()),['rifle','headshot'])
  const hit=copy()
  assert.deepEqual(combatCues(hit,{ ...hit,hitId:hit.hitId+1,hitHeadshot:true,hitDefeated:1 }),['elimination'])
  assert.deepEqual(combatCues(hit,{ ...hit,hitId:hit.hitId+1,hitHeadshot:false,hitShieldDamage:20,hitDamage:0 }),['shield-hit'])
  assert.deepEqual(combatCues(previous,game.get(),false),['rifle'])
})
test('reload completion sounds require a real refill and switching cancels the reload cue',() => {
  start(); game.attack([]); game.tick(0.3)
  const before=copy(); game.reload()
  assert.deepEqual(combatCues(before,game.get()),['reload-start'])
  const reloading=copy(); game.tick(2.1)
  assert.deepEqual(combatCues(reloading,game.get()),['reload-end'])
  game.attack([]); game.tick(0.3); game.reload()
  const cancelled=copy(); game.switchWeapon('pistol')
  assert.deepEqual(combatCues(cancelled,game.get()),['equip'])
})
test('ability uses, actual damage, shield absorption and death are detected once',() => {
  const previous=start(); game.activateAbility('shield')
  assert.deepEqual(combatCues(previous,game.get()),['shield'])
  const shield=copy(); game.damage(20)
  assert.deepEqual(combatCues(shield,game.get()),['shield-impact'])
  const now=copy()
  assert.deepEqual(combatCues(now,{ ...now,hp:80 }),['hurt'])
  assert.deepEqual(combatCues(now,{ ...now,hp:0 }),['death'])
})
test('round cues use authoritative outcomes, skip repeated snapshots and ignore a different arena',() => {
  const room={ arenaEpoch:1,matchPhase:'live',phaseRemaining:0 }
  const won={ ...room,matchPhase:'roundOver',roundWinnerId:'self' }
  assert.deepEqual(matchCues(room,won,'self'),['round-win'])
  assert.deepEqual(matchCues(won,won,'self'),[])
  assert.deepEqual(matchCues(won,{ ...won,matchPhase:'finished',winnerId:'self' },'self'),['victory'])
  assert.deepEqual(matchCues(room,{ ...won,arenaEpoch:2 },'self'),[])
  assert.deepEqual(matchCues({ ...room,matchPhase:'countdown',phaseRemaining:2.1 },{ ...room,matchPhase:'countdown',phaseRemaining:1.9 },'self'),['countdown'])
})
test('footsteps follow grounded travel, alternate boots and distinguish sprinting without replaying teleports',() => {
  const steps=new Footsteps()
  assert.deepEqual(steps.update('self',[0,1,0],true,0),[])
  assert.deepEqual(steps.update('self',[0,1,1.9],true,.4,{speed:5}),[{name:'step',pace:'walk',pan:.12}])
  assert.deepEqual(steps.update('self',[0,1,4.1],true,.7,{speed:8.5}),[{name:'step',pace:'sprint',pan:-.12}])
  assert.deepEqual(steps.update('self',[0,1,4.1],true,1),[])
  assert.deepEqual(steps.update('self',[0,2,6.1],false,1.4),[])
  assert.deepEqual(steps.update('self',[0,1,15],true,1.8),[])
  steps.clear()
  assert.deepEqual(steps.update('self',[0,1,-15],true,2),[])
})

test('movement audio detects real jump/landing edges and suppresses dashes, stale frames and spawn drops',()=> {
  const steps=new Footsteps(),at=(y,grounded,time,extra={})=>steps.update('self',[0,y,0],grounded,time,extra)
  assert.deepEqual(at(1,false,0),[])
  assert.deepEqual(at(.85,true,.02),[]) // Initial capsule settling is not a landing.
  assert.deepEqual(at(1,false,.04,{verticalSpeed:6}),[{name:'jump'}])
  at(1.9,false,.2);at(1.3,false,.4)
  const landed=at(.85,true,.5)
  assert.equal(landed[0].name,'land');assert.ok(landed[0].impact>1)
  assert.deepEqual(at(.85,true,.52),[])
  assert.deepEqual(at(1.2,false,.6,{enabled:false,verticalSpeed:6}),[])
  assert.deepEqual(at(.85,true,.8),[])
  assert.deepEqual(at(1.6,false,2,{verticalSpeed:6}),[])
})

test('the full arsenal has unique layered voices with bounded audio parameters and distinct reloads',()=> {
  assert.equal(Object.keys(FIREARM_VOICES).length,14)
  const signatures=new Set()
  for(const id of WEAPON_IDS) {
    const layers=soundLayers(id)
    assert.ok(layers.length>=3,id)
    signatures.add(JSON.stringify(layers))
    for(const part of layers) {
      assert.ok(Number.isFinite(part.frequency) && part.frequency>0 && part.frequency<20000,id)
      assert.ok(part.duration>0 && part.duration<1 && part.gain>0 && part.gain<.5,id)
      assert.ok(part.delay>=0 && part.delay<1,id)
    }
  }
  assert.equal(signatures.size,17)
  assert.notDeepEqual(soundLayers('reload-end',{weapon:'pistol'}),soundLayers('reload-end',{weapon:'omega'}))
  assert.notDeepEqual(soundLayers('step',{pace:'walk'}),soundLayers('step',{pace:'sprint'}))
  assert.notDeepEqual(soundLayers('step',{surface:'metal'}),soundLayers('step',{surface:'concrete'}))
  assert.equal(soundLayers('missing-cue'),null)
})
test('sound settings clamp unsafe values, preserve silence at zero and survive training reset',() => {
  assert.deepEqual(audioSettings({ volume:NaN,muted:'yes' }),{ volume:0.55,muted:false,sfxVolume:1,musicVolume:.25 })
  assert.equal(audioSettings({ volume:20 }).volume,1)
  assert.equal(audioSettings({ volume:-1 }).volume,0)
  assert.equal(audioSettings({ volume:0 }).volume,0)
  game.settings({ volume:0.3,muted:true }); game.reset()
  assert.equal(game.get().settings.volume,0.3); assert.equal(game.get().settings.muted,true)
  game.settings({ volume:0.55,muted:false })
})
