import test from 'node:test'
import assert from 'node:assert/strict'
import { game } from '../src/game/store.js'
import { runtime } from '../src/game/runtime.js'
import { COURSES,TRAINING_TARGETS,TRAINING_SOLIDS,TRAINING_SPAWN,courseAt,targetPosition } from '../src/game/training/config.js'
import { freshTraining,freshTarget,toggleCourse,stepCourses } from '../src/game/training/rules.js'
import { blocked } from '../../shared/tactical.js'
import { makeLoadoutBank } from '../../shared/loadoutBank.js'
import { validateLoadout } from '../../shared/loadout.js'

function fresh() { game.reset();return game.get() }
const pose=[-23,0.87,-9]
function running() { const s=fresh();return { ...s,...toggleCourse(s,0,pose) } }

test('four connected ground-level wings contain ten stationary, six moving and five armed robots plus the reflex lab',()=> {
  assert.equal(TRAINING_TARGETS.filter(t=>t.course==='static').length,10)
  assert.equal(TRAINING_TARGETS.filter(t=>t.course==='combat').length,5)
  assert.equal(TRAINING_TARGETS.filter(t=>t.course==='moving').length,6)
  assert.equal(TRAINING_TARGETS.filter(t=>t.kind==='orb').length,1)
  for(const [id,p] of Object.entries({ hub:TRAINING_SPAWN,static:[0,1,-22],aim:[25,1,0],moving:[0,1,22],combat:[-22,1,0] })) assert.equal(courseAt(p),id)
  for(const destination of [[0,1,-23],[25,1,0],[0,1,24],[-22,1,0]]) assert.equal(blocked([0,1,0],destination,TRAINING_SOLIDS),false)
  assert.equal(blocked([0,1,-25],[30,1,0],TRAINING_SOLIDS),true)
  assert.equal(Object.keys(COURSES).length,5)
})

test('combat robots are disarmed until started, telegraph before firing, respect cover and stop outside the course',()=> {
  const idle=fresh()
  assert.equal(stepCourses(idle,10,1,pose).shots.length,0)
  const active=running(),first=stepCourses(active,0.1,0.1,pose)
  assert.equal(first.shots.length,0);assert.equal(first.targets[16].tracking,true)
  const fire=stepCourses({ ...active,...first },1.1,1,pose)
  assert.ok(fire.shots.some(s=>s.index===16 && s.damage===8))
  const cover=stepCourses(active,2,0.1,[-23,0.87,9])
  assert.equal(cover.targets[16].tracking,false)
  const hub=stepCourses({ ...active,...fire },3,0.1,TRAINING_SPAWN)
  assert.equal(hub.shots.length,0);assert.equal(hub.training.combat.active,false)
  const blinded=running();blinded.targets[16].flashUntil=10
  assert.equal(stepCourses(blinded,1,0.1,pose).targets[16].tracking,false)
  const smoked=running();smoked.abilities.smoke={ ...smoked.abilities.smoke,activeUntil:10,origin:[-24.5,0.2,-9] }
  assert.equal(stepCourses(smoked,1,0.1,pose).targets[16].tracking,false)
  const stopped=toggleCourse(active,2,pose),restart=toggleCourse({ ...active,...stopped },3,pose)
  assert.equal(stopped.training.combat.run,1);assert.equal(restart.training.combat.run,2)
})

test('a combat clear keeps five robots defeated until restart; other robot courses respawn',()=> {
  const s=running()
  s.targets=s.targets.map((t,i)=>TRAINING_TARGETS[i].course==='combat' ? { ...t,hp:0,resetAt:1 } : t)
  const clear=stepCourses(s,5,0.1,pose)
  assert.equal(clear.training.combat.status,'cleared');assert.equal(clear.training.combat.active,false)
  assert.ok(clear.targets.slice(16,21).every(t=>t.hp===0))
  const restart=toggleCourse({ ...s,...clear },6,pose)
  assert.ok(restart.targets.slice(16,21).every(t=>t.hp===100))
  s.targets[0]={ ...s.targets[0],hp:0,resetAt:1 }
  assert.equal(stepCourses(s,5,0.1,pose).targets[0].hp,100)
})

test('moving robots have real changing hit positions, freeze while rooted and pause through their control',()=> {
  const s=fresh(),position=[0,0.87,20],before=targetPosition(10,s.targets[10])
  let next=stepCourses(s,1,1,position)
  assert.notDeepEqual(targetPosition(10,next.targets[10]),before)
  next.targets[10].rootedUntil=10
  const rooted=stepCourses({ ...s,...next },2,1,position)
  assert.equal(rooted.targets[10].motionTime,next.targets[10].motionTime)
  const paused=toggleCourse(s,0,position),frozen=stepCourses({ ...s,...paused },3,1,position)
  assert.equal(frozen.targets[10].motionTime,0)
})

test('reflex targets score actual hits and misses, never farm kill badges, relocate and finish after 45 seconds',()=> {
  game.reset();runtime.position=[25,0.87,0];game.set({ mode:'playing' })
  game.attack([{ targetId:21,distance:18 }]);assert.equal(game.get().targets[21].hp,1)
  game.tick(0.2);game.toggleCourse()
  game.attack([{ targetId:21,distance:18 }]);assert.equal(game.get().training.aim.hits,1)
  assert.equal(game.get().killCombo,0);assert.equal(game.get().training.aim.shots,1)
  const old=targetPosition(21,game.get().targets[21]);game.tick(0.2)
  assert.equal(game.get().targets[21].hp,1);assert.notDeepEqual(targetPosition(21,game.get().targets[21]),old)
  game.attack([]);assert.equal(game.get().training.aim.shots,2)
  game.tick(45);assert.equal(game.get().training.aim.status,'complete')
})

test('field armory freezes the simulation and applies every equipment slot without healing, teleporting or resetting progress',()=> {
  game.reset();runtime.position=[0,0.87,-22];game.set({ mode:'playing' });game.attack(0);game.tick(0.5)
  game.set({ hp:73,mode:'loadout' });const before=game.get(),time=game.now(),position=[...runtime.position]
  game.tick(20);assert.equal(game.now(),time)
  const loadout=validateLoadout({ character:'ion',primary:'hyperion',secondary:'volt',melee:'gravity',unique:'smoke' })
  assert.equal(game.applyTrainingBank(makeLoadoutBank(loadout,3)),true)
  const after=game.get()
  assert.equal(after.weapon,'hyperion');assert.equal(after.trainingBank.activeSlot,3);assert.deepEqual(after.loadout,loadout)
  assert.equal(after.hp,73);assert.equal(after.generation,before.generation);assert.equal(after.shots,before.shots)
  assert.deepEqual(after.targets,before.targets);assert.deepEqual(after.training,before.training);assert.deepEqual(runtime.position,position)
  assert.equal(game.applyTrainingBank({ slots:[] }),false)
  game.set({ mode:'playing' });assert.equal(game.applyTrainingBank(makeLoadoutBank()),false)
})

test('target and course factories do not share mutable state',()=> {
  const a=freshTraining(),b=freshTraining();a.combat.active=true;assert.equal(b.combat.active,false)
  const first=freshTarget(0),second=freshTarget(0);first.hp=0;assert.equal(second.hp,100)
})

test('training unlimited ammo cancels reloads, covers every firearm and restores normal reload rules when disabled',()=> {
  game.reset();game.set({ mode:'playing' });game.attack([]);game.tick(0.2);game.reload()
  assert.equal(game.get().reloading,true)
  game.setTrainingOptions({ noReload:true })
  try {
    assert.equal(game.get().reloading,false)
    for(const weapon of Object.keys(game.get().magazines)) {
      const current=game.get();game.set({ weapon,attackReadyAt:0,magazines:{ ...current.magazines,[weapon]:1 } })
      assert.equal(game.attack([]),true)
      assert.equal(game.get().magazines[weapon],1);assert.equal(game.get().reloading,false)
      game.reload();assert.equal(game.get().reloading,false)
    }
    game.reset();assert.equal(game.get().trainingOptions.noReload,true)
    game.setTrainingOptions({ noReload:false });game.set({ mode:'playing',attackReadyAt:0,magazines:{ ...game.get().magazines,rifle:1 } })
    game.attack([]);assert.equal(game.get().magazines.rifle,0);assert.equal(game.get().reloading,true)
  } finally { game.setTrainingOptions({ noReload:false }) }
})
