import test from 'node:test'
import assert from 'node:assert/strict'
import { awardKill,killTier } from '../../shared/killCombo.js'
import { trailDistance } from '../../shared/bulletTrails.js'
import { WEAPONS } from '../../shared/weapons.js'
import { game } from '../src/game/store.js'
import { combatCues } from '../src/audio/cues.js'
import { queueShotTrail,takeShotTrails } from '../src/game/effects/shotTrails.js'

test('kill combos count confirmed defeats within six simulation seconds, cap the tier and restart after expiry',()=> {
  let s={ killCombo:0,killAt:-10,killBadgeId:0 }
  assert.deepEqual(awardKill(s,0,0),{})
  s={ ...s,...awardKill(s,1,1,true) };assert.equal(s.killCombo,1);assert.equal(s.killHeadshot,true)
  s={ ...s,...awardKill(s,7,2) };assert.equal(s.killCombo,3);assert.equal(s.killBadgeId,2)
  s={ ...s,...awardKill(s,8,4) };assert.equal(s.killCombo,7);assert.equal(killTier(s.killCombo),5)
  s={ ...s,...awardKill(s,14.01,1) };assert.equal(s.killCombo,1);assert.equal(s.killBadgeId,4)
})
test('actual practice eliminations award once, nonlethal hits do not award, pause freezes combos and death/reset clear them',()=> {
  game.reset();game.set({ mode:'playing' })
  const kill=id=> { for(let n=0;n<5;n++) { assert.equal(game.attack([{ targetId:id,distance:2 }]),true);game.tick(0.21) } }
  kill(0);assert.equal(game.get().killCombo,1);assert.equal(game.get().killBadgeId,1)
  game.attack([{ targetId:0,distance:2 }]);game.tick(0.21)
  assert.equal(game.get().killBadgeId,1)
  kill(1);assert.equal(game.get().killCombo,2)
  const at=game.now();game.set({ mode:'paused' });game.tick(20);assert.equal(game.now(),at)
  game.set({ mode:'playing' });game.tick(7);kill(2);assert.equal(game.get().killCombo,1)
  globalThis.document ||= { exitPointerLock() {} }
  game.damage(100);assert.equal(game.get().killCombo,0);assert.equal(game.get().killAt,-10)
  game.reset();assert.equal(game.get().killBadgeId,0)
})
test('combo sounds replace the ordinary kill sting only for the shooter, never repeat a snapshot or replay missed tiers',()=> {
  const before={ shot:0,lastSwing:0,hitId:0,weapon:'pistol',hp:100,shieldHit:0 }
  for(const [count,cue] of [[1,'elimination'],[2,'kill-combo-2'],[3,'kill-combo-3'],[4,'kill-combo-4'],[8,'kill-combo-5']]) {
    const killed={ ...before,hitId:1,hitDefeated:1,killCombo:count }
    assert.deepEqual(combatCues(before,killed),[cue]);assert.deepEqual(combatCues(killed,killed),[])
    assert.deepEqual(combatCues(before,killed,false),[])
  }
})
test('trails stop at walls, pass valid thin cover, and stop at a later thick wall without spending overlap twice',()=> {
  const box=(z,depth)=>({ position:[0,0,z],size:[2,2,depth] }),origin=[0,0,0],direction=[0,0,-1]
  assert.equal(trailDistance(origin,direction,20,[],WEAPONS.rifle),20)
  assert.equal(trailDistance(origin,direction,20,[box(-5,2)],WEAPONS.rifle),4)
  assert.equal(trailDistance(origin,direction,20,[box(-5,0.18)],WEAPONS.railbreaker),20)
  assert.equal(trailDistance(origin,direction,20,[box(-5,0.18),box(-5,0.18),box(-10,2)],WEAPONS.railbreaker),9)
  assert.equal(trailDistance(origin,direction,6,[box(-10,2)],WEAPONS.rifle),6)
  assert.equal(trailDistance(origin,direction,20,[box(-5,0.2),box(-8,0.2)],WEAPONS.railbreaker),7.9)
})
test('transient trail queue rejects malformed/replayed shots, drops other rounds and bounds pending work',()=> {
  takeShotTrails('test')
  const shot={ scope:'test:1',id:'self',shot:1,weapon:'shotgun',origin:[0,1,0],ends:[[0,1,-5],[0,2,-5]] }
  assert.equal(queueShotTrail({ ...shot,origin:{} }),false)
  assert.equal(queueShotTrail({ ...shot,ends:[[NaN,0,0]] }),false)
  assert.equal(queueShotTrail(shot),true);assert.equal(queueShotTrail(shot),false)
  assert.equal(takeShotTrails('test:2').length,0)
  for(let n=2;n<50;n++) queueShotTrail({ ...shot,shot:n })
  const pending=takeShotTrails('test:1');assert.equal(pending.length,32);assert.equal(pending.at(-1).shot,49)
  assert.equal(takeShotTrails('test:1').length,0)
})

test('multiplayer trail IDs accept a respawned first shot once without replaying earlier shots',()=> {
  const shot={scope:'respawn:1',id:'peer',shot:1,trailId:1,weapon:'rifle',origin:[0,1,0],ends:[[0,1,-5]]}
  assert.equal(queueShotTrail(shot),true)
  assert.equal(takeShotTrails(shot.scope).length,1)
  const respawned={...shot,trailId:2}
  assert.equal(queueShotTrail(respawned),true)
  assert.equal(queueShotTrail(respawned),false)
  assert.equal(queueShotTrail(shot),false)
  assert.equal(takeShotTrails(shot.scope).length,1)
  assert.equal(queueShotTrail({...shot,trailId:NaN}),false)
})
