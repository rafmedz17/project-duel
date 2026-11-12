import test from 'node:test'
import assert from 'node:assert/strict'
import { combatCues,matchCues,Footsteps } from '../src/audio/cues.js'
import { audioSettings } from '../src/audio/settings.js'
import { game } from '../src/game/store.js'

const copy=() => structuredClone(game.get())
function start() { game.reset(); game.set({ mode:'playing' }); return copy() }
test('audio follows accepted attacks, does not replay rejected inputs or multiply delayed shot counters',() => {
  const previous=start()
  game.attack([])
  assert.deepEqual(combatCues(previous,game.get()),['pistol'])
  const fired=copy()
  assert.equal(game.attack([]),false)
  assert.deepEqual(combatCues(fired,game.get()),[])
  assert.deepEqual(combatCues(fired,{ ...fired,shot:fired.shot+8 }),['pistol'])
  assert.deepEqual(combatCues(null,fired),[])
})
test('confirmed headshots, eliminations and shield hits have separate cues; remote hits stay private to their shooter',() => {
  const previous=start()
  game.attack([{ targetId:0,distance:5,region:'head' }])
  assert.deepEqual(combatCues(previous,game.get()),['pistol','headshot'])
  const hit=copy()
  assert.deepEqual(combatCues(hit,{ ...hit,hitId:hit.hitId+1,hitHeadshot:true,hitDefeated:1 }),['elimination'])
  assert.deepEqual(combatCues(hit,{ ...hit,hitId:hit.hitId+1,hitHeadshot:false,hitShieldDamage:20,hitDamage:0 }),['shield-hit'])
  assert.deepEqual(combatCues(previous,game.get(),false),['pistol'])
})
test('reload completion sounds require a real refill and switching cancels the reload cue',() => {
  start(); game.attack([]); game.tick(0.3)
  const before=copy(); game.reload()
  assert.deepEqual(combatCues(before,game.get()),['reload-start'])
  const reloading=copy(); game.tick(1.6)
  assert.deepEqual(combatCues(reloading,game.get()),['reload-end'])
  game.attack([]); game.tick(0.3); game.reload()
  const cancelled=copy(); game.switchWeapon('rifle')
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
test('footsteps require grounded movement, suppress spawn teleports, and clear between sessions',() => {
  const steps=new Footsteps()
  assert.equal(steps.step('self',[0,1,0],true,0),false)
  assert.equal(steps.step('self',[0,1,1.9],true,0.4),true)
  assert.equal(steps.step('self',[0,1,1.9],true,1),false)
  assert.equal(steps.step('self',[0,2,3.9],false,1.4),false)
  assert.equal(steps.step('self',[0,1,15],true,1.8),false)
  steps.clear()
  assert.equal(steps.step('self',[0,1,-15],true,2),false)
})
test('sound settings clamp unsafe values, preserve silence at zero and survive training reset',() => {
  assert.deepEqual(audioSettings({ volume:NaN,muted:'yes' }),{ volume:0.55,muted:false })
  assert.equal(audioSettings({ volume:20 }).volume,1)
  assert.equal(audioSettings({ volume:-1 }).volume,0)
  assert.equal(audioSettings({ volume:0 }).volume,0)
  game.settings({ volume:0.3,muted:true }); game.reset()
  assert.equal(game.get().settings.volume,0.3); assert.equal(game.get().settings.muted,true)
  game.settings({ volume:0.55,muted:false })
})
