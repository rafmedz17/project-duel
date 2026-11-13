import test from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { ArenaCombat } from '../src/arena/ArenaCombat.js'
import { ArenaSimulation } from '../src/arena/ArenaSimulation.js'
import { WEAPONS,WEAPON_IDS,pelletDamage } from '../../shared/weapons.js'
import { validateLoadout,weaponSlots } from '../../shared/loadout.js'
import { coverTransmission } from '../../shared/ballistics.js'
import { PLAYER } from '../../shared/arena.js'

const specifications=[
  ['rifle',24,600,30,2,82],['astral',18,900,27,2.2,91],['hyperion',90,45,5,2.8,98],['railbreaker',110,30,3,3.2,95],
  ['nova',15,900,36,1.7,70],['striker',12,1100,40,2.1,62],['titan',22,550,60,3.4,73],['omega',13,1000,100,4.5,58],
  ['shotgun',12,70,6,2.5,68],['executor',16,100,2,2.6,60],['ravager',8,180,8,3,55],
  ['pistol',28,300,15,1.3,88],['magnus',48,180,8,1.8,78],['volt',14,900,24,1.6,75],
  ['blade',50,75,undefined,undefined,undefined],['gravity',85,40,undefined,undefined,undefined],['fangs',28,130,undefined,undefined,undefined],
]
function setup(t,id='rifle',character='vex') {
  const weapon=WEAPONS[id],loadout=validateLoadout({ character,primary:weapon.slot==='1' ? id : 'rifle',secondary:weapon.slot==='2' ? id : 'pistol',melee:weapon.slot==='3' ? id : 'blade',unique:'flashbang',startingWeapon:id })
  const players=new Map(['a','b'].map((key,slot)=>[key,{ slot,connected:true,startingWeapon:id,characterId:character,allowedWeapons:loadout.weapons,allowedAbilities:loadout.abilities }]))
  const sim=new ArenaSimulation(players),combat=new ArenaCombat(players,sim,1)
  t.after(()=>sim.free())
  for(const [key,p] of players) {
    const position={ x:0,y:0.87,z:key==='a' ? 2 : 0 },entry=sim.players.get(key)
    entry.body.setTranslation(position,true);entry.body.setNextKinematicTranslation(position);Object.assign(p,position)
  }
  sim.world.step()
  let sequence=0
  const send=(action,extra={})=>combat.receive('a',{ action,sequence:sequence++,epoch:1,...extra })
  const shoot=(action='fire',miss=false)=>send(action,{ yaw:miss ? Math.PI/2 : 0,pitch:Math.atan2(-0.575,2) })
  const advance=(seconds,physics=false)=>{ for(let i=0;i<Math.ceil(seconds*60);i++) { combat.step();if(physics)sim.step() } }
  return { a:players.get('a'),b:players.get('b'),sim,combat,send,shoot,advance }
}
for(const [id,damage,rpm,magazine,reload,accuracy] of specifications) test(`${WEAPONS[id].name} preserves the supplied arsenal specification and slot`,()=> {
  const w=WEAPONS[id]
  assert.deepEqual([w.damage,w.rpm,w.magazine,w.reload,w.accuracy],[damage,rpm,magazine,reload,accuracy])
  if(!w.burst) assert.equal(w.cooldown,60/rpm)
  if(w.magazine) assert.ok(w.reload>0)
})

test('only validated eliminations advance combos; respawn, expiry and new rounds clear the appropriate state',t=> {
  const { a,b,sim,combat,shoot,advance,send }=setup(t,'railbreaker'),events=[]
  combat.onShot=event=>events.push(event)
  b.killCombo=4;b.killAt=0
  assert.equal(shoot(),true);assert.equal(a.killCombo,1);assert.equal(a.killBadgeId,1)
  assert.equal(b.killCombo,0);assert.equal(b.killAt,-10)
  assert.equal(shoot(),false);assert.equal(events.length,1)
  assert.equal(send('fire',{ yaw:0,pitch:0,killCombo:99 }),false)
  assert.equal(a.killCombo,1)
  const resetTarget=()=> {
    const position={ x:0,y:0.87,z:0 },entry=sim.players.get('b')
    entry.body.setTranslation(position,true);entry.body.setNextKinematicTranslation(position);Object.assign(b,position)
  }
  advance(5.2);resetTarget();assert.equal(shoot(),true)
  assert.equal(a.killCombo,2);assert.equal(a.killBadgeId,2)
  advance(6.1);resetTarget();assert.equal(shoot(),true)
  assert.equal(a.killCombo,1);assert.equal(a.killBadgeId,3)
  assert.deepEqual(events[0].origin,[0,0.87+PLAYER.eye,2]);assert.equal(events[0].weapon,'railbreaker')
  assert.equal(events[0].shot,1);assert.equal(events[0].epoch,1);assert.equal(events[0].round,0)
  combat.resetRound(2);assert.equal(a.killCombo,0);assert.equal(a.killBadgeId,0)
})

test('one accepted shotgun shell emits all ten finite pellet trails and awards a single kill badge; melee emits no trail',t=> {
  const { a,combat,shoot,advance,send }=setup(t,'shotgun'),events=[]
  combat.onShot=event=>events.push(event)
  shoot();assert.equal(events.length,1);assert.equal(events[0].ends.length,10)
  assert.ok(events[0].ends.every(end=>end.length===3 && end.every(Number.isFinite)))
  assert.equal(a.killCombo,1);assert.equal(a.killBadgeId,1)
  advance(1);send('switch',{ weapon:'blade' });advance(0.3);shoot()
  assert.equal(events.length,1)
})
test('all 99 primary/pistol/melee combinations are legal, with exactly one of each and no extra gear',()=> {
  assert.equal(WEAPON_IDS.length,17)
  for(const primary of WEAPON_IDS.filter(id=>WEAPONS[id].slot==='1')) for(const secondary of ['pistol','magnus','volt']) for(const melee of ['blade','gravity','fangs']) {
    const loadout=validateLoadout({ character:'ion',primary,secondary,melee,unique:'smoke',startingWeapon:secondary })
    assert.deepEqual(weaponSlots(loadout),[primary,secondary,melee])
    assert.deepEqual(loadout.weapons,[secondary,melee,primary])
  }
  for(const patch of [{ primary:'magnus' },{ secondary:'nova' },{ melee:'omega' },{ weapons:['rifle','astral','pistol','blade'] }]) assert.equal(validateLoadout({ character:'vex',primary:'rifle',unique:'stun',...patch }),null)
})
for(const id of ['astral','volt']) test(`${id} fires exactly three timed bullets from one trigger and enforces burst recovery`,t=> {
  const { a,b,shoot,advance }=setup(t,id)
  assert.equal(shoot(),true);assert.equal(b.hp,100-WEAPONS[id].damage)
  assert.equal(shoot(),false);advance(0.07)
  assert.equal(b.hp,100-WEAPONS[id].damage*2)
  advance(0.07);assert.equal(b.hp,100-WEAPONS[id].damage*3)
  assert.equal(a[id+'Ammo'],WEAPONS[id].magazine-3)
  assert.equal(shoot(),false)
  advance(0.5);assert.equal(shoot(),true)
})
test('switching, reloading and explicit release cancel queued attacks; partial bursts auto reload safely',t=> {
  const { a,b,shoot,send,advance }=setup(t,'astral')
  shoot();send('reload');advance(0.2)
  assert.equal(a.shot,1);assert.equal(b.hp,82)
  advance(3);a.astralAmmo=2;shoot();advance(0.15)
  assert.equal(a.astralAmmo,0);assert.equal(a.reloading,true);assert.equal(a.shot,3)
  advance(3);shoot();send('release');advance(0.2)
  assert.equal(a.shot,4)
})
for(const id of ['rifle','nova','striker','titan','ravager']) test(`${id} sustains its configured RPM on the server and release stops it`,t=> {
  const { a,shoot,send,advance }=setup(t,id)
  shoot('hold',true);advance(1)
  assert.equal(a.shot,Math.floor(WEAPONS[id].rpm/60)+1)
  send('release');const shots=a.shot;advance(1);assert.equal(a.shot,shots)
})
test('OMEGA requires uninterrupted spin-up, does not spend ammo while charging and stops on release',t=> {
  const { a,shoot,send,advance }=setup(t,'omega')
  shoot('hold',true);assert.equal(a.omegaAmmo,100);assert.equal(a.spinning,true)
  advance(0.2);send('release');advance(0.5)
  assert.equal(a.shot,0);assert.equal(a.spinning,false)
  shoot('hold',true);advance(0.58);assert.equal(a.shot,0)
  advance(0.04);assert.equal(a.shot,1);assert.equal(a.omegaAmmo,99)
  advance(0.3);assert.ok(a.shot>=5)
  send('reload');const shots=a.shot;advance(0.5);assert.equal(a.shot,shots)
})
test('snipers use their individual head multipliers and thin-cover penetration cannot bypass thick or stacked cover',t=> {
  assert.equal(pelletDamage(WEAPONS.hyperion,40,'head'),180)
  assert.equal(pelletDamage(WEAPONS.railbreaker,40,'head'),165)
  const origin=[0,1,3],direction=[0,0,-1],thin={ position:[0,1,0],size:[3,2,0.18] }
  assert.equal(coverTransmission(origin,direction,6,[thin],WEAPONS.rifle),0)
  assert.equal(coverTransmission(origin,direction,6,[thin],WEAPONS.railbreaker),0.7)
  assert.equal(coverTransmission(origin,direction,6,[{ ...thin,size:[3,2,1] }],WEAPONS.railbreaker),0)
  assert.equal(coverTransmission(origin,direction,6,[{ ...thin,position:[0,1,1],size:[3,2,0.2] },{ ...thin,size:[3,2,0.2] }],WEAPONS.railbreaker),0)
  const { b,sim,shoot }=setup(t,'railbreaker')
  sim.map={ ...sim.map,solids:[{ position:[0,1,1],size:[3,2,0.18] }] }
  shoot();assert.equal(b.hp,23)
})
test('GRAVITY BREAKER delays impact and its knockback cannot push an enemy through cover',t=> {
  const { a,b,sim,shoot,advance }=setup(t,'gravity')
  const start=b.z
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,0.1).setTranslation(0,1,-1))
  shoot();assert.equal(b.hp,100);advance(0.4);assert.equal(b.hp,100)
  advance(0.06);assert.equal(b.hp,15);assert.equal(a.swings,1)
  advance(0.3,true);assert.ok(b.z<start-0.1);assert.ok(b.z>-0.6)
})
test('NOVA movement is faster than rifle movement and OMEGA is slower in the actual capsule simulation',t=> {
  const { a,sim }=setup(t)
  const distance=id=> {
    const entry=sim.players.get('a'),position={ x:0,y:0.87,z:15 }
    entry.body.setTranslation(position,true);entry.body.setNextKinematicTranslation(position);entry.vx=0;entry.vz=0;a.weapon=id
    for(let i=0;i<60;i++) { sim.receive('a',{ sequence:sim.players.get('a').lastSequence+1,x:0,z:-1,yaw:0,pitch:0,sprint:false,jump:false,active:true });sim.step() }
    return 15-a.z
  }
  const base=distance('rifle'),fast=distance('nova'),slow=distance('omega')
  assert.ok(Math.abs(fast/base-1.12)<0.02);assert.ok(Math.abs(slow/base-0.72)<0.02)
})
test('ION and RAZE work with the new magazines and burst fire without granting additional equipped weapons',t=> {
  const { a,send,shoot,advance }=setup(t,'volt','ion')
  a.voltAmmo=0;send('reload');send('ability',{ ability:'ultimate' })
  assert.equal(a.voltAmmo,24);assert.equal(a.reloading,false)
  shoot();advance(0.15);assert.equal(a.shot,3);assert.equal(a.voltAmmo,24)
  advance(5);shoot();advance(0.15);assert.equal(a.voltAmmo,21)
  assert.equal(send('switch',{ weapon:'omega' }),false)
})
