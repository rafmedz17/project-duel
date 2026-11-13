import test from 'node:test'
import assert from 'node:assert/strict'
import { game } from '../src/game/store.js'
import { BLADE, PISTOL, RIFLE, SHOTGUN, ABILITIES, WEAPON_SWITCH, WEAPONS, TARGET, TARGETS, OPPONENT, PLAYER } from '../src/game/config.js'
import { pelletDamage } from '../src/game/combatRules.js'
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Group } from 'three'
import { ROBOT_PARTS, ROBOT_HEAD_Y } from '../../shared/robot.js'
import { rayRobot, rayBox } from '../../shared/ballistics.js'
import { ARENA_SOLIDS, ONLINE } from '../../shared/arena.js'
import { createWeaponTracer } from '../src/game/weapons/traceWeapon.js'
import { freshBrain, stepBrain } from '../src/game/opponents/opponentRules.js'
import { castTrainingPulse, isPlayerHit } from '../src/game/opponents/physics.js'
import RAPIER from '@dimforge/rapier3d-compat'

function start() { game.reset(); game.set({ mode:'playing' }) }
function equip(weapon) { assert.equal(game.switchWeapon(weapon),true); game.tick(WEAPON_SWITCH+0.001) }

test('training weapons apply head, torso, limb and foot damage and report headshots only on actual hits', () => {
  start()
  for (const [region,amount] of [['head',40],['body',20],['limb',15],['foot',10]]) {
    game.attack([{ targetId:0,distance:5,region }])
    assert.equal(game.get().hitDamage,amount)
    assert.equal(game.get().hitHeadshot,region==='head')
    game.tick(PISTOL.cooldown+0.001)
  }
  assert.equal(game.get().targets[0].hp,15)
  game.attack([{ targetId:0,distance:5,region:'invalid' }])
  assert.equal(game.get().targets[0].hp,15)
  assert.equal(game.get().hitId,4)
  game.tick(PISTOL.cooldown+0.001)
  game.attack([{ targetId:0,distance:5,region:'head' }])
  assert.equal(game.get().hitDamage,15)
  assert.equal(game.get().hitDefeated,1)
  assert.equal(game.get().hitHeadshot,true)
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
      const visual = trace(scene,camera,PISTOL)[0]
      const server = rayRobot([x,y,0],[0,0,-1],{ x:0,y:0.87,z:-8,yaw,pitch })
      assert.equal(visual?.region,server?.region)
      if (visual) assert.ok(Math.abs(visual.distance-server.distance)<1e-6)
    }
  }
})

test('robots match player capsule height and every practice hit region is exposed from the spawn floor',() => {
  const bottom = Math.min(...ROBOT_PARTS.map(part => part.position[1]-part.size[1]/2))
  const top = Math.max(...ROBOT_PARTS.map(part => part.position[1]+part.size[1]/2))
  assert.ok(Math.abs(top-bottom-PLAYER.height)<1e-9)
  assert.ok(Math.abs(2*(ONLINE.capsuleHalfHeight+ONLINE.capsuleRadius)-PLAYER.height)<1e-9)
  const head = ROBOT_PARTS.find(part => part.id==='head')
  assert.ok(Math.abs(PLAYER.eye-head.position[1])<head.size[1]/2)
  const origin = [PLAYER.spawn[0],PLAYER.height/2+0.02+PLAYER.eye,PLAYER.spawn[2]]
  for (const [x,y,z] of TARGETS) {
    assert.ok(Math.abs(y+bottom)<1e-9,'target feet rest on the floor')
    for (const id of ['head','torso','leg1','foot1']) {
      const part = ROBOT_PARTS.find(part => part.id===id)
      const target = [x-part.position[0],y+part.position[1],z-part.position[2]]
      const offset = target.map((value,axis) => value-origin[axis]), distance = Math.hypot(...offset)
      const direction = offset.map(value => value/distance)
      const hit = rayRobot(origin,direction,{ x,y,z,yaw:Math.PI,pitch:0 })
      assert.equal(hit?.region,part.region,`${x}: ${id}`)
      for (const solid of ARENA_SOLIDS) {
        const blocked = rayBox(origin,direction,solid.position,solid.size)
        assert.ok(blocked===null || blocked>hit.distance,`${x}: cover blocks ${id}`)
      }
    }
  }
})

for (const id of ['pistol','rifle','shotgun']) {
  test(`${id} automatically reloads on its final shot, blocks attacks and refills only after the full duration`, () => {
    start()
    if (id !== 'pistol') equip(id)
    const tuning = WEAPONS[id]
    for (let i=0;i<tuning.magazine;i++) {
      assert.equal(game.attack(),true)
      if (i<tuning.magazine-1) game.tick(tuning.cooldown+0.001)
    }
    assert.equal(game.get().magazines[id],0)
    assert.equal(game.get().reloading,true)
    assert.equal(game.get().reloadReason,'auto')
    assert.equal(game.get().reloadWeapon,id)
    assert.equal(game.get().reloadEnd,game.now()+tuning.reload)
    const end = game.get().reloadEnd
    game.reload()
    assert.equal(game.get().reloadEnd,end)
    assert.equal(game.attack(0),false)
    game.tick(tuning.reload-0.001)
    assert.equal(game.get().magazines[id],0)
    assert.equal(game.attack(0),false)
    game.tick(0.002)
    assert.equal(game.get().magazines[id],tuning.magazine)
    assert.equal(game.get().shots,tuning.magazine)
    assert.equal(game.get().reloading,false)
    assert.equal(game.get().reloadReason,null)
    for (const other of ['pistol','rifle','shotgun'].filter(weapon => weapon !== id)) assert.equal(game.get().magazines[other],WEAPONS[other].magazine)
  })
}

test('cancelled empty-magazine reloads resume after re-equipping, freeze on pause and clear on reset', () => {
  start()
  for (let i=0;i<PISTOL.magazine;i++) { game.attack(); game.tick(PISTOL.cooldown+0.001) }
  equip('blade'); game.tick(5)
  assert.equal(game.get().reloading,false)
  assert.equal(game.get().magazines.pistol,0)
  assert.equal(game.attack(),true)
  game.tick(BLADE.cooldown+0.001)
  assert.equal(game.switchWeapon('pistol'),true)
  game.tick(WEAPON_SWITCH-0.001)
  assert.equal(game.get().reloading,false)
  game.tick(0.002)
  assert.equal(game.get().reloadReason,'auto')
  game.tick(0.4); game.set({ mode:'paused' })
  const paused = game.get(), time = game.now()
  game.tick(100)
  assert.equal(game.get(),paused)
  assert.equal(game.now(),time)
  game.set({ mode:'playing' }); game.tick(PISTOL.reload-0.4+0.001)
  assert.equal(game.get().magazines.pistol,PISTOL.magazine)
  game.attack(); game.reload()
  assert.equal(game.get().reloadReason,'manual')
  game.reset()
  assert.equal(game.get().reloading,false)
  assert.equal(game.get().reloadStart,0)
  assert.equal(game.get().reloadReason,null)
})

test('hit feedback distinguishes actual damage and defeats, restarts on hits and ignores misses', () => {
  start()
  game.attack(0)
  assert.equal(game.get().hitId,1)
  assert.equal(game.get().hitDamage,20)
  assert.equal(game.get().hitDefeated,0)
  for (let i=0;i<4;i++) { game.tick(PISTOL.cooldown+0.001); game.attack(0) }
  assert.equal(game.get().hitId,5)
  assert.equal(game.get().hitDamage,20)
  assert.equal(game.get().hitDefeated,1)
  game.tick(PISTOL.cooldown+0.001); game.attack(0)
  assert.equal(game.get().hitId,5)
  game.tick(PISTOL.cooldown+0.001); game.attack(1)
  assert.equal(game.get().hitId,6)
  assert.equal(game.get().hitDefeated,0)
  game.activateAbility('emp',{ position:[-4,1.6,-16] })
  assert.equal(game.get().hitId,7)
  assert.equal(game.get().hitDamage,80)
  game.reset()
  assert.equal(game.get().hitId,0)
})

test('switching preserves ammunition and cancels incomplete pistol reloads', () => {
  start()
  game.attack()
  game.tick(PISTOL.cooldown+0.001)
  game.reload()
  assert.equal(game.get().reloading,true)
  game.tick(0.4)
  equip('blade')
  assert.equal(game.get().reloading,false)
  game.tick(PISTOL.reload+0.001)
  game.reload()
  assert.equal(game.get().magazines.pistol,11)
  assert.equal(game.get().reloading,false)
  equip('pistol')
  game.reload()
  game.tick(PISTOL.reload+0.001)
  assert.equal(game.get().magazines.pistol,12)
})

test('equip delay and shared recovery prevent attack and switch spamming', () => {
  start()
  assert.equal(game.switchWeapon('invalid'),false)
  assert.equal(game.switchWeapon('blade'),true)
  assert.equal(game.attack(0),false)
  game.tick(WEAPON_SWITCH+0.001)
  assert.equal(game.attack(0),true)
  assert.equal(game.get().targets[0].hp,40)
  assert.equal(game.attack(0),false)
  assert.equal(game.switchWeapon('pistol'),false)
  game.tick(BLADE.swing+0.001)
  assert.equal(game.switchWeapon('pistol'),true)
  game.tick(WEAPON_SWITCH+0.001)
  assert.equal(game.attack(0),false)
  game.tick(0.1)
  assert.equal(game.attack(0),true)
  assert.equal(game.get().targets[0].hp,20)
  assert.equal(game.get().shots,1)
  assert.equal(game.get().swings,1)
})

test('pause freezes attacks, weapon changes, recovery and reload timers', () => {
  start()
  game.attack()
  game.tick(PISTOL.cooldown+0.001)
  game.reload()
  game.set({ mode:'paused' })
  const paused = game.get()
  assert.equal(game.attack(0),false)
  assert.equal(game.switchWeapon('blade'),false)
  game.reload(); game.tick(10)
  assert.equal(game.get(),paused)
  game.set({ mode:'playing' }); game.tick(PISTOL.reload+0.001)
  assert.equal(game.get().magazines.pistol,12)
})

test('blade defeats award one score, show actual damage and reset completely', () => {
  start(); equip('blade')
  game.attack(0)
  assert.equal(game.get().hitDamage,60)
  game.tick(BLADE.cooldown+0.001)
  game.attack(0)
  assert.equal(game.get().hitDamage,40)
  assert.equal(game.get().targets[0].hp,0)
  assert.equal(game.get().score,100)
  game.tick(BLADE.cooldown+0.001); game.attack(0)
  assert.equal(game.get().score,100)
  assert.equal(game.get().meleeHits,2)
  assert.equal(game.get().shots,0)
  assert.equal(game.get().hits,0)
  game.tick(TARGET.reset+0.001)
  assert.equal(game.get().targets[0].hp,100)
  game.reset()
  const s = game.get()
  assert.equal(s.weapon,'pistol'); assert.equal(s.magazines.pistol,12)
  assert.equal(s.swings,0); assert.equal(s.meleeHits,0)
  assert.equal(s.attackReadyAt,0); assert.equal(s.score,0)
})

test('blade remains usable with an empty pistol, and misses still need recovery', () => {
  start(); game.set({ magazines:{ pistol:0,rifle:30,shotgun:6 } })
  assert.equal(game.attack(),false)
  equip('blade')
  assert.equal(game.attack(),true)
  assert.equal(game.attack(),false)
  assert.equal(game.get().magazines.pistol,0)
  assert.equal(game.get().swings,1)
  assert.equal(game.get().meleeHits,0)
})

test('rifle and pistol keep independent magazines, reloads and accuracy totals', () => {
  start(); game.attack(); game.tick(PISTOL.cooldown+0.001)
  equip('rifle')
  for (let i=0;i<5;i++) { assert.equal(game.attack(0),true); game.tick(RIFLE.cooldown+0.001) }
  assert.deepEqual(game.get().magazines,{ pistol:11,rifle:25,shotgun:6 })
  assert.deepEqual(game.get().weaponStats,{ pistol:{ shots:1,hits:0 },rifle:{ shots:5,hits:5 },shotgun:{ shots:0,hits:0 } })
  assert.equal(game.get().shots,6); assert.equal(game.get().hits,5)
  equip('blade'); equip('rifle')
  assert.equal(game.get().magazines.rifle,25)
  game.reload()
  assert.equal(game.get().reloadWeapon,'rifle')
  game.tick(RIFLE.reload-0.01)
  assert.equal(game.get().magazines.rifle,25)
  game.tick(0.02)
  assert.deepEqual(game.get().magazines,{ pistol:11,rifle:30,shotgun:6 })
  equip('pistol')
  assert.equal(game.get().magazines.pistol,11)
})

test('rifle cadence, target defeat and empty-magazine guards are enforced', () => {
  start(); equip('rifle')
  assert.equal(game.attack(0),true)
  game.tick(RIFLE.cooldown-0.001)
  assert.equal(game.attack(0),false)
  game.tick(0.002)
  for (let i=1;i<8;i++) { assert.equal(game.attack(0),true); game.tick(RIFLE.cooldown+0.001) }
  assert.equal(game.get().targets[0].hp,0)
  assert.equal(game.get().hitDamage,2)
  assert.equal(game.get().score,100)
  assert.deepEqual(game.get().weaponStats.rifle,{ shots:8,hits:8 })
  for (let i=8;i<RIFLE.magazine;i++) { assert.equal(game.attack(),true); game.tick(RIFLE.cooldown+0.001) }
  assert.equal(game.get().magazines.rifle,0)
  assert.equal(game.attack(1),false)
  assert.equal(game.get().shots,30)
  assert.equal(game.get().magazines.pistol,12)
})

test('switching cancels rifle reload and never refills a different magazine', () => {
  start(); equip('rifle'); game.attack(); game.reload()
  assert.equal(game.get().reloading,true)
  game.tick(0.4)
  equip('pistol')
  assert.equal(game.get().reloadWeapon,null)
  game.attack(); game.tick(PISTOL.cooldown+0.001)
  game.reload(); game.tick(PISTOL.reload+0.001)
  game.tick(RIFLE.reload)
  assert.deepEqual(game.get().magazines,{ pistol:12,rifle:29,shotgun:6 })
})

test('rifle reload freezes during pause and reset restores both magazines and statistics', () => {
  start(); equip('rifle'); game.attack(0); game.reload()
  game.tick(0.5); game.set({ mode:'paused' })
  const paused = game.get()
  game.tick(20)
  assert.equal(game.attack(0),false)
  assert.equal(game.get(),paused)
  game.set({ mode:'playing' }); game.tick(RIFLE.reload-0.5+0.001)
  assert.equal(game.get().magazines.rifle,30)
  game.reset()
  assert.deepEqual(game.get().magazines,{ pistol:12,rifle:30,shotgun:6 })
  assert.deepEqual(game.get().weaponStats,{ pistol:{ shots:0,hits:0 },rifle:{ shots:0,hits:0 },shotgun:{ shots:0,hits:0 } })
  assert.equal(game.get().weapon,'pistol')
  assert.equal(game.get().reloadWeapon,null)
})

test('rifle recovery uses the frame clock without publishing React state every frame', () => {
  start(); equip('rifle'); game.attack()
  const snapshot = game.get(), before = game.now()
  game.tick(RIFLE.cooldown/2,false)
  assert.equal(game.get(),snapshot)
  assert.equal(game.canAttack(),false)
  game.tick(RIFLE.cooldown/2+0.001,false)
  assert.equal(game.get(),snapshot)
  assert.equal(game.canAttack(),true)
  assert.ok(game.now()>before)
  game.set({ mode:'paused' })
  const frozen = game.now()
  game.tick(10,false)
  assert.equal(game.now(),frozen)
})

test('shotgun batches pellets into one shell, one hit statistic and one defeat score', () => {
  start(); equip('shotgun')
  const pellets = Array.from({ length:SHOTGUN.pellets },() => ({ targetId:0,distance:3 }))
  assert.equal(game.attack(pellets),true)
  assert.equal(game.get().targets[0].hp,0)
  assert.equal(game.get().score,100)
  assert.equal(game.get().hitDamage,100)
  assert.equal(game.get().magazines.shotgun,5)
  assert.deepEqual(game.get().weaponStats.shotgun,{ shots:1,hits:1 })
  assert.equal(game.attack(pellets),false)
  game.tick(SHOTGUN.cooldown+0.001)
  game.attack(pellets)
  assert.equal(game.get().score,100)
  assert.deepEqual(game.get().weaponStats.shotgun,{ shots:2,hits:1 })
})

test('shotgun falloff, pellet bounds and independent reloads are enforced', () => {
  assert.equal(pelletDamage(SHOTGUN,3),14)
  assert.ok(pelletDamage(SHOTGUN,20)<14)
  assert.equal(pelletDamage(SHOTGUN,25),0)
  assert.equal(pelletDamage(SHOTGUN,-1),0)
  start(); equip('shotgun')
  game.attack([{ targetId:0,distance:25 }])
  assert.equal(game.get().targets[0].hp,100)
  game.reload(); game.tick(SHOTGUN.reload+0.001)
  assert.deepEqual(game.get().magazines,{ pistol:12,rifle:30,shotgun:6 })
  // Records beyond eight pellets cannot multiply damage without bound.
  game.attack(Array.from({ length:30 },() => ({ targetId:1,distance:24 })))
  assert.equal(game.get().targets[1].hp,60)
})

test('all four abilities reject spam, pause/death input and invalid positions, then reset', () => {
  start()
  for (const id of Object.keys(ABILITIES)) {
    assert.equal(game.activateAbility(id),true)
    assert.equal(game.activateAbility(id),false)
    assert.equal(game.get().abilities[id].uses,1)
  }
  assert.equal(game.activateAbility('invalid'),false)
  game.set({ mode:'paused' }); const frozen = game.now()
  game.tick(100)
  assert.equal(game.now(),frozen)
  game.set({ mode:'dead' })
  assert.equal(game.activateAbility('shield'),false)
  game.reset(); game.set({ mode:'playing' })
  assert.equal(game.activateAbility('dash',{ position:[NaN,0,0] }),false)
  for (const id of Object.keys(ABILITIES)) assert.equal(game.get().abilities[id].uses,0)
  assert.equal(game.get().shieldCharge,0)
})

test('dash direction is normalized and its duration and cooldown use the paused frame clock', () => {
  start(); game.activateAbility('dash',{ direction:[3,-4] })
  assert.deepEqual(game.get().abilities.dash.direction,[0.6,-0.8])
  const dash = game.get().abilities.dash
  assert.equal(dash.activeUntil,ABILITIES.dash.duration)
  game.tick(ABILITIES.dash.duration+0.001)
  assert.equal(game.activateAbility('dash'),false)
  game.tick(ABILITIES.dash.cooldown)
  assert.equal(game.activateAbility('dash'),true)
})

test('shield absorbs damage, spills excess into health and stops protecting when expired', () => {
  start(); game.activateAbility('shield')
  game.damage(30)
  assert.equal(game.get().hp,100); assert.equal(game.get().shieldCharge,20)
  game.damage(25)
  assert.equal(game.get().hp,95); assert.equal(game.get().shieldCharge,0)
  assert.equal(game.activateAbility('shield'),false)
  game.tick(ABILITIES.shield.cooldown+0.001)
  game.activateAbility('shield')
  game.tick(ABILITIES.shield.duration+0.001)
  game.damage(10)
  assert.equal(game.get().hp,85)
})

test('EMP affects nearby electronics, delays defeated target reset and leaves distant hazards active', () => {
  start()
  game.activateAbility('emp',{ position:[0,1,-12] })
  assert.deepEqual(game.get().targets.map(t => t.hp),[100,60,60,100])
  assert.equal(game.get().empHits,2)
  assert.equal(game.get().shots,0)
  assert.equal(game.get().score,0)
  assert.deepEqual(game.get().hazards.map(h => h.disabledUntil),[0,0])
  game.attack(1); game.tick(PISTOL.cooldown+0.001)
  game.attack(1); game.tick(PISTOL.cooldown+0.001); game.attack(1)
  assert.equal(game.get().targets[1].hp,0)
  game.tick(TARGET.reset+0.001)
  assert.equal(game.get().targets[1].hp,0)
  game.tick(1)
  assert.equal(game.get().targets[1].hp,100)
  game.reset(); game.set({ mode:'playing' })
  game.activateAbility('emp',{ position:[15,1,3] })
  assert.equal(game.get().hazards[0].disabledUntil,0)
  assert.equal(game.get().hazards[1].disabledUntil,ABILITIES.emp.duration)
  assert.equal(game.get().abilities.emp.result,1)
})

test('actual shotgun rays spread with distance and every pellet respects cover', t => {
  const scene = new Scene(), camera = new PerspectiveCamera(70,16/9,0.05,100), trace = createWeaponTracer()
  const geometry = new BoxGeometry(1.2,1.8,0.28), material = new MeshBasicMaterial()
  const target = new Mesh(geometry,material)
  target.position.set(0,0,-3); target.userData = { blocksShot:true,targetId:0 }
  scene.add(target); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
  assert.equal(trace(scene,camera,SHOTGUN).length,8)
  target.position.z = -18; scene.updateMatrixWorld(true)
  assert.ok(trace(scene,camera,SHOTGUN).length<8)
  const wallGeometry = new BoxGeometry(5,5,0.4), wall = new Mesh(wallGeometry,material)
  wall.position.z = -1.5; wall.userData.blocksShot = true
  scene.add(wall); scene.updateMatrixWorld(true)
  assert.equal(trace(scene,camera,SHOTGUN).length,0)
  t.after(() => { geometry.dispose(); wallGeometry.dispose(); material.dispose() })
})

test('opponent warns before firing, locks its aim, and cannot fire again during recovery', () => {
  const context = { time:OPPONENT.grace,distance:10,visible:true,alive:true,disabledUntil:0,playerPosition:[0,1.5,5] }
  let brain = stepBrain(freshBrain(),context)
  assert.equal(brain.phase,'windup'); assert.equal(brain.fireAt,null)
  brain = stepBrain(brain,{ ...context,time:OPPONENT.grace+OPPONENT.windup-0.01,playerPosition:[4,1.5,5] })
  assert.equal(brain.fireAt,null)
  brain = stepBrain(brain,{ ...context,time:OPPONENT.grace+OPPONENT.windup+0.01,playerPosition:[4,1.5,5] })
  assert.deepEqual(brain.fireAt,[0,1.5,5])
  brain = stepBrain(brain,{ ...context,time:OPPONENT.grace+OPPONENT.windup+0.02 })
  assert.equal(brain.fireAt,null); assert.equal(brain.phase,'recovering')
})

test('opponent respects range and sight; EMP cancels windup and grants a recovery window', () => {
  const context = { time:2,distance:10,visible:true,alive:true,disabledUntil:0,playerPosition:[0,1.5,5] }
  assert.equal(stepBrain(freshBrain(),{ ...context,distance:OPPONENT.range+1 }).phase,'patrol')
  assert.equal(stepBrain(freshBrain(),{ ...context,visible:false }).phase,'patrol')
  const warning = stepBrain(freshBrain(),context)
  assert.equal(stepBrain(warning,{ ...context,visible:false,time:3 }).fireAt,null)
  const jammed = stepBrain(warning,{ ...context,disabledUntil:6,time:3 })
  assert.equal(jammed.phase,'jammed'); assert.equal(jammed.aim,null)
  assert.equal(stepBrain(jammed,{ ...context,time:6.01 }).phase,'recovering')
  assert.equal(stepBrain(jammed,{ ...context,time:6+OPPONENT.grace+0.01 }).phase,'windup')
  assert.equal(stepBrain(warning,{ ...context,alive:false,time:3 }).fireAt,null)
})

test('every weapon damages the opponent, with one defeat score even for many shotgun pellets', () => {
  for (const [id,weapon] of Object.entries(WEAPONS)) {
    game.reset({ opponentEnabled:true }); game.set({ mode:'playing' })
    if (id !== 'pistol') equip(id)
    const records = Array.from({ length:weapon.pellets || 1 },() => ({ targetId:OPPONENT.id,distance:2 }))
    while (game.get().opponent.hp>0) { assert.equal(game.attack(records),true); game.tick(weapon.cooldown+0.001) }
    assert.equal(game.get().score,OPPONENT.score)
    assert.equal(game.get().opponent.defeats,1)
    game.attack(records)
    assert.equal(game.get().score,OPPONENT.score)
    assert.equal(game.get().targets[0].hp,100)
  }
})

test('EMP uses the live opponent position, deals damage, and prevents shots and hits while jammed', () => {
  game.reset({ opponentEnabled:true }); game.set({ mode:'playing' })
  game.reportOpponentPosition([2,1.15,-2])
  assert.equal(game.opponentShot(),true)
  game.activateAbility('emp',{ position:[0,1,0] })
  assert.equal(game.get().opponent.hp,60)
  assert.equal(game.get().opponent.phase,'jammed')
  assert.equal(game.get().empHits,1)
  assert.equal(game.opponentShot(),false)
  assert.equal(game.opponentHit(),false)
  game.tick(ABILITIES.emp.duration+0.001)
  assert.equal(game.opponentShot(),true)
})

test('shield absorbs actual opponent damage before health', () => {
  game.reset({ opponentEnabled:true }); game.set({ mode:'playing' })
  game.activateAbility('shield'); assert.equal(game.opponentHit(),true)
  assert.equal(game.get().hp,100)
  assert.equal(game.get().shieldCharge,50-OPPONENT.damage)
  game.tick(ABILITIES.shield.duration+0.001)
  game.opponentHit()
  assert.equal(game.get().hp,100-OPPONENT.damage)
  assert.equal(game.get().opponent.hits,2)
})

test('opponent respawn freezes on pause, restores its spawn, and restart/toggle clears combat state', () => {
  game.reset({ opponentEnabled:true }); game.set({ mode:'playing' })
  game.reportOpponentPosition([4,1.15,-11]); equip('blade')
  game.attack([{ targetId:OPPONENT.id,distance:1 }]); game.tick(BLADE.cooldown+0.001)
  game.attack([{ targetId:OPPONENT.id,distance:1 }])
  game.set({ mode:'paused' }); game.tick(100)
  assert.equal(game.get().opponent.hp,0)
  game.set({ mode:'playing' }); game.tick(OPPONENT.respawn+0.001)
  assert.equal(game.get().opponent.hp,100)
  assert.equal(game.get().opponent.respawns,1)
  assert.equal(game.get().opponent.defeats,1)
  assert.deepEqual(game.opponentPosition(),OPPONENT.spawn)
  game.reset({ opponentEnabled:true })
  assert.equal(game.get().opponent.enabled,true)
  assert.equal(game.get().opponent.defeats,0); assert.equal(game.get().score,0)
  game.set({ mode:'paused' }); game.setOpponentEnabled(false)
  assert.equal(game.get().opponent.phase,'offline')
  assert.equal(game.opponentShot(),false)
})

test('opponent physics rays stop at cover and detect the player capsule without hitting their owner', async t => {
  await RAPIER.init()
  const world = new RAPIER.World({ x:0,y:0,z:0 })
  const drone = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,0))
  world.createCollider(RAPIER.ColliderDesc.ball(0.5),drone)
  const player = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,5))
  player.userData = { entity:'player' }
  world.createCollider(RAPIER.ColliderDesc.capsule(0.5,0.35),player)
  const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,2.5))
  world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,0.2),wall)
  world.step()
  const origin = { x:0,y:1,z:0 }, direction = { x:0,y:0,z:1 }
  assert.equal(isPlayerHit(castTrainingPulse(world,RAPIER,origin,direction,6,drone)),false)
  world.removeRigidBody(wall); world.step()
  assert.equal(isPlayerHit(castTrainingPulse(world,RAPIER,origin,direction,6,drone)),true)
  t.after(() => world.free())
})
