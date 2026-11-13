import test from 'node:test'
import assert from 'node:assert/strict'
import { game } from '../src/game/store.js'
import { WEAPONS,WEAPON_IDS,freshMagazines,equipTime } from '../../shared/weapons.js'
import { validateLoadout } from '../../shared/loadout.js'
import { PISTOL,PLAYER,TARGET } from '../src/game/config.js'
import { BoxGeometry,Mesh,MeshBasicMaterial,PerspectiveCamera,Scene,Group } from 'three'
import { ROBOT_PARTS,ROBOT_HEAD_Y } from '../../shared/robot.js'
import { rayRobot,rayBox } from '../../shared/ballistics.js'
import { ONLINE } from '../../shared/arena.js'
import { createWeaponTracer } from '../src/game/weapons/traceWeapon.js'
import { TRAINING_SOLIDS,TRAINING_TARGETS } from '../src/game/training/config.js'
import { weaponAnimation } from '../src/game/weapons/animation.js'

function start(id='pistol',character='vex',unique='flashbang') {
  const w=WEAPONS[id]
  game.reset({ loadout:validateLoadout({ character,primary:w.slot==='1' ? id : 'rifle',secondary:w.slot==='2' ? id : 'pistol',melee:w.slot==='3' ? id : 'blade',unique,startingWeapon:id }) })
  game.set({ mode:'playing' })
}
function advance(seconds) { for(let i=0;i<Math.ceil(seconds*600);i++) game.tick(1/600) }

for(const id of WEAPON_IDS) test(`${WEAPONS[id].name} equips in its proper slot, respects regional damage, recovery and reset`,()=> {
  start(id)
  const w=WEAPONS[id],oldAmmo=game.get().magazines[id]
  assert.equal(game.get().weapon,id)
  assert.equal(game.attack([{ targetId:0,distance:1,region:'body' }]),true)
  assert.equal(game.get().hitDamage,Math.min(100,w.damage))
  assert.equal(game.attack(),false)
  assert.equal(game.get().magazines[id],w.magazine ? oldAmmo-1 : undefined)
  game.reset();assert.equal(game.get().score,0);assert.deepEqual(game.get().magazines,freshMagazines())
})
for(const id of WEAPON_IDS.filter(id=>WEAPONS[id].magazine)) test(`${WEAPONS[id].name} auto reloads an empty magazine and freezes its reload on pause`,()=> {
  start(id)
  const w=WEAPONS[id]
  game.set({ magazines:{ ...game.get().magazines,[id]:1 } })
  game.attack();assert.equal(game.get().magazines[id],0)
  assert.equal(game.get().reloading,true);assert.equal(game.get().reloadReason,'auto')
  assert.equal(game.canAttack(),false)
  game.set({ mode:'paused' });game.tick(10);assert.equal(game.now(),0)
  game.set({ mode:'playing' });game.tick(w.reload-0.01);assert.equal(game.get().magazines[id],0)
  game.tick(0.02);assert.equal(game.get().magazines[id],w.magazine);assert.equal(game.get().reloading,false)
})
test('head, body, limbs and feet report actual removed health and never award duplicate defeats',()=> {
  for(const [region,damage] of [['head',56],['body',28],['limb',21],['foot',14]]) {
    start();game.attack([{ targetId:0,distance:5,region }]);assert.equal(game.get().hitDamage,damage);assert.equal(game.get().hitHeadshot,region==='head')
  }
  start();game.set({ targets:game.get().targets.map((t,i)=>i===0 ? { ...t,hp:10 } : t) })
  game.attack([{ targetId:0,distance:5,region:'head' }]);assert.equal(game.get().hitDamage,10);assert.equal(game.get().score,100)
  game.tick(0.21);game.attack(0);assert.equal(game.get().score,100)
  game.tick(TARGET.reset);assert.equal(game.get().targets[0].hp,100)
})
test('switching preserves magazines, cancels reload and enforces selected equipment and handling time',()=> {
  start('railbreaker');game.attack();game.reload();game.tick(0.2)
  assert.equal(game.switchWeapon('omega'),false)
  assert.equal(game.switchWeapon('pistol'),true)
  assert.equal(game.get().reloading,false);assert.equal(game.get().magazines.railbreaker,2)
  assert.equal(game.canAttack(),false);game.tick(equipTime('pistol')+0.001);assert.equal(game.canAttack(),false)
  game.tick(2);assert.equal(game.canAttack(),true)
  game.tick(1);game.switchWeapon('railbreaker');game.tick(0.26);assert.equal(game.canAttack(),false)
  game.tick(0.25);assert.equal(game.canAttack(),true)
})
for(const id of ['astral','volt']) test(`${id} queues three real training shots and cancels them on interruption`,()=> {
  start(id);game.trigger(()=>[{ targetId:0,distance:2 }])
  assert.equal(game.get().shot,1);advance(0.15)
  assert.equal(game.get().shot,3);assert.equal(game.get().targets[0].hp,100-WEAPONS[id].damage*3)
  assert.equal(game.trigger(()=>[]),false)
  advance(1);game.trigger(()=>[]);game.cancelAttack();advance(0.2);assert.equal(game.get().shot,4)
})
for(const id of ['rifle','striker','omega','ravager']) test(`${id} held training fire follows RPM and stops without replaying shots`,()=> {
  start(id);game.trigger(()=>[],true);advance(1)
  const expected=Math.floor((1-(WEAPONS[id].spinUp || 0))/WEAPONS[id].cooldown+1e-7)+1
  assert.equal(game.get().shot,expected)
  game.releaseTrigger();const shots=game.get().shot;advance(1);assert.equal(game.get().shot,shots)
})
test('heavy melee waits for impact and moves surviving robot targets; daggers keep an independent fast recovery',()=> {
  start('gravity');game.trigger(()=>[{ targetId:1,distance:1 }]);advance(0.4);assert.equal(game.get().targets[1].hp,100)
  advance(0.06);assert.equal(game.get().targets[1].hp,15);assert.equal(game.get().swings,1)
  assert.ok(Math.abs(game.get().targets[1].offsetZ)>0.1)
  start('fangs');game.trigger(()=>[{ targetId:0,distance:1 }]);assert.equal(game.get().targets[0].hp,72)
  advance(0.4);assert.equal(game.canAttack(),false);advance(0.07);assert.equal(game.canAttack(),true)
})
test('shotgun pellets apply falloff and all three shotgun profiles resolve one shell and one defeat',()=> {
  for(const id of ['shotgun','executor','ravager']) {
    start(id);const w=WEAPONS[id]
    game.attack(Array.from({ length:100 },()=>({ targetId:0,distance:1 })))
    assert.equal(game.get().hitDamage,Math.min(100,w.damage*w.pellets))
    assert.equal(game.get().hits,1);assert.equal(game.get().shots,1)
    assert.equal(game.get().magazines[id],w.magazine-1)
    start(id);game.attack([{ targetId:0,distance:w.range+1 }]);assert.equal(game.get().targets[0].hp,100)
  }
})
test('ION refills every selected magazine, cancels reload and expires after ten seconds',()=> {
  start('volt','ion');game.attack();game.reload();assert.equal(game.get().reloading,true)
  game.activateAbility('ultimate');assert.equal(game.get().reloading,false);assert.equal(game.get().magazines.volt,24)
  game.tick(0.5);game.trigger(()=>[]);advance(0.15);assert.equal(game.get().magazines.volt,24)
  game.tick(10);game.trigger(()=>[]);advance(0.15);assert.equal(game.get().magazines.volt,21)
})
test('RAZE boosts damage and cadence, AEGIS shields expire without healing, and universal abilities remain equipped',()=> {
  start('pistol','raze');game.activateAbility('ultimate');game.attack(0)
  assert.equal(game.get().hitDamage,42);assert.ok(Math.abs(game.get().attackReadyAt-0.2/1.5)<1e-8)
  start('pistol','aegis');game.activateAbility('shield');game.activateAbility('ultimate');game.damage(220)
  assert.equal(game.get().hp,100);assert.equal(game.get().ultimateShield,0);assert.equal(game.get().shieldCharge,30)
  game.tick(5);game.damage(10);assert.equal(game.get().hp,90)
  assert.deepEqual(game.get().loadout.abilities,['dash','shield','flashbang','ultimate'])
  assert.equal(game.activateAbility('scanner'),false)
})
test('authored animation phases cycle the bolt, pump, barrel hinge, magazines and heavy impact at the intended times',()=> {
  for(const id of WEAPON_IDS) {
    const w=WEAPONS[id],s={ weapon:id,hp:100,lastShot:0,lastSwing:0,lastSwitch:-10,windupEnd:0,reloading:false }
    const fired=weaponAnimation(s,0.01,w),ready=weaponAnimation(s,10,w)
    assert.ok(fired.kick>ready.kick)
    if(w.magazine) {
      const reload=weaponAnimation({ ...s,reloading:true,reloadStart:0,reloadEnd:w.reload },w.reload*0.45,w)
      assert.ok(reload.drop>0.9)
      assert.equal(weaponAnimation({ ...s,reloading:true,reloadStart:0,reloadEnd:w.reload },w.reload,w).drop,0)
    }
  }
  assert.ok(weaponAnimation({ weapon:'shotgun',hp:100,lastShot:0,lastSwing:-10,lastSwitch:-10 },0.4,WEAPONS.shotgun).pump>0.8)
})

test('rendered robot boxes and authoritative hit volumes agree, including rotated and tilted heads', t => {
  const geometry = [], material = new MeshBasicMaterial(), trace = createWeaponTracer()
  t.after(() => { geometry.forEach(g => g.dispose()); material.dispose() })
  for (const yaw of [0,Math.PI,0.4]) for (const pitch of [0,0.6]) {
    const scene = new Scene(), root = new Group()
    root.position.set(0,0.87,-8); root.rotation.y = yaw
    for (const part of ROBOT_PARTS) {
      const shape = new BoxGeometry(...part.size), mesh = new Mesh(shape,material)
      geometry.push(shape); mesh.position.set(...part.position)
      if (part.id==='head') mesh.rotation.x = pitch
      mesh.userData = { blocksShot:true,targetId:0,hitRegion:part.region }
      root.add(mesh)
    }
    scene.add(root); scene.updateMatrixWorld(true)
    for (const [x,y] of [[0,0.87+ROBOT_HEAD_Y],[0,0.84],[0.3,0.77],[0.13,0.08],[0,0.2]]) {
      const camera = new PerspectiveCamera(70,16/9,0.05,100)
      camera.position.set(x,y,0); camera.updateMatrixWorld(true)
      const visual = trace(scene,camera,PISTOL).hits[0]
      const server = rayRobot([x,y,0],[0,0,-1],{ x:0,y:0.87,z:-8,yaw,pitch })
      assert.equal(visual?.region,server?.region)
      if (visual) assert.ok(Math.abs(visual.distance-server.distance)<1e-6)
    }
  }
})

test('robots match player capsule height and stationary range hit regions are exposed from its floor',() => {
  const bottom = Math.min(...ROBOT_PARTS.map(part => part.position[1]-part.size[1]/2))
  const top = Math.max(...ROBOT_PARTS.map(part => part.position[1]+part.size[1]/2))
  assert.ok(Math.abs(top-bottom-PLAYER.height)<1e-9)
  assert.ok(Math.abs(2*(ONLINE.capsuleHalfHeight+ONLINE.capsuleRadius)-PLAYER.height)<1e-9)
  const head = ROBOT_PARTS.find(part => part.id==='head')
  assert.ok(Math.abs(PLAYER.eye-head.position[1])<head.size[1]/2)
  const origin = [0,PLAYER.height/2+0.02+PLAYER.eye,-21]
  for (const { position:[x,y,z] } of TRAINING_TARGETS.filter(target=>target.course==='static')) {
    assert.ok(Math.abs(y+bottom)<1e-9,'target feet rest on the floor')
    for (const id of ['head','torso','leg1','foot1']) {
      const part = ROBOT_PARTS.find(part => part.id===id)
      const target = [x-part.position[0],y+part.position[1],z-part.position[2]]
      const offset = target.map((value,axis) => value-origin[axis]), distance = Math.hypot(...offset)
      const direction = offset.map(value => value/distance)
      const hit = rayRobot(origin,direction,{ x,y,z,yaw:Math.PI,pitch:0 })
      assert.equal(hit?.region,part.region,`${x}: ${id}`)
      for (const solid of TRAINING_SOLIDS) {
        const blocked = rayBox(origin,direction,solid.position,solid.size)
        assert.ok(blocked===null || blocked>hit.distance,`${x}: cover blocks ${id}`)
      }
    }
  }
})
