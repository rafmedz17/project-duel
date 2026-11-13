import test from 'node:test'
import assert from 'node:assert/strict'
import { ArenaCombat } from '../src/arena/ArenaCombat.js'
import { ArenaSimulation } from '../src/arena/ArenaSimulation.js'
import { validateLoadout,migrateLoadout,weaponForBinding } from '../../shared/loadout.js'
import { CHARACTERS,ultimateModifiers } from '../../shared/characters.js'
import { flashDuration,throughSmoke } from '../../shared/tactical.js'

function setup(t,character='vex',unique='flashbang') {
  const gear=validateLoadout({ character,primary:'rifle',unique,startingWeapon:'pistol' })
  const players=new Map(['a','b','c'].map((id,slot) => [id,{ slot:slot%2,connected:true,startingWeapon:gear.startingWeapon,characterId:character,uniqueSkill:unique,allowedWeapons:[...gear.weapons],allowedAbilities:[...gear.abilities],teamId:id==='b' ? 'enemy' : 'ally' }]))
  const sim=new ArenaSimulation(players),combat=new ArenaCombat(players,sim,1)
  t.after(() => sim.free())
  let sequence=0
  const send=(id,action,details={}) => combat.receive(id,{ action,epoch:1,sequence:sequence++,...details })
  const ability=(name,id='a') => send(id,'ability',{ ability:name,yaw:0,pitch:0 })
  const advance=seconds => { for(let i=0;i<Math.ceil(seconds*60);i++) combat.step() }
  const detonate=() => { const grenade=combat.grenades.get('a'); Object.assign(grenade,{ position:[0,1,0],velocity:[0,0,0],age:0.9-1/60 }); combat.step() }
  for(const [id,p] of players) Object.assign(p,{ x:id==='c' ? 1 : 0,y:0.87,z:id==='b' ? -2 : 2,yaw:id==='b' ? Math.PI : 0,pitch:0 })
  return { players,a:players.get('a'),b:players.get('b'),c:players.get('c'),sim,combat,send,ability,advance,detonate }
}

test('all character/unique combinations produce exactly three weapons and four abilities; invalid category labels and forged gear are rejected',() => {
  for(const character of Object.keys(CHARACTERS)) for(const unique of ['flashbang','smoke','stun','scanner']) {
    const loadout=validateLoadout({ character,primary:'shotgun',unique })
    assert.deepEqual(loadout.weapons,['pistol','blade','shotgun'])
    assert.deepEqual(loadout.abilities,['dash','shield',unique,'ultimate'])
    assert.equal(weaponForBinding(loadout,'Digit1'),'shotgun')
    assert.equal(weaponForBinding(loadout,'Digit2'),'pistol')
    assert.equal(weaponForBinding(loadout,'Digit3'),'blade')
    assert.equal(weaponForBinding(loadout,'Digit4'),null)
  }
  for(const primary of ['sniper','smg','lmg','constructor',{ toString:null }]) assert.equal(validateLoadout({ character:'vex',primary,unique:'stun' }),null)
  assert.equal(validateLoadout({ character:'vex',primary:'rifle',unique:'stun',weapons:['pistol','blade','rifle','shotgun'] }),null)
  const legacy={ startingWeapon:'shotgun',weapons:['pistol','rifle','shotgun'],abilities:['scanner','emp'] }
  assert.equal(validateLoadout(legacy),null)
  assert.deepEqual(migrateLoadout(legacy),validateLoadout({ character:'vex',primary:'shotgun',unique:'scanner',startingWeapon:'shotgun' }))
})
for(const character of Object.keys(CHARACTERS)) test(`${character} ultimate lasts ten seconds, has a server cooldown and cannot be client extended`,t => {
  const { a,ability,combat,send }=setup(t,character)
  assert.equal(send('a','ability',{ ability:'ultimate',duration:999 }),false)
  assert.equal(ability('ultimate'),true)
  assert.equal(a.abilities.get('ultimate').activeUntil-a.abilities.get('ultimate').startedAt,10)
  assert.equal(ability('ultimate'),false)
  assert.equal(ultimateModifiers(a,9.999).active,true)
  assert.equal(ultimateModifiers(a,10).active,false)
  combat.time=45; assert.equal(ability('ultimate'),true)
})
test('VEX can dash repeatedly during overdrive but stuns and normal cooldowns still limit movement',t => {
  const { a,ability,advance,combat }=setup(t)
  ability('dash'); advance(0.4)
  assert.equal(ability('dash'),false)
  ability('ultimate'); assert.equal(ability('dash'),true)
  advance(0.4); assert.equal(ability('dash'),true)
  a.rootedUntil=combat.time+2; assert.equal(ability('dash'),false)
  a.rootedUntil=0; combat.time=10.41
  assert.equal(ultimateModifiers(a,combat.time).active,false)
})

test('VEX overdrive boosts actual walking and sprinting by 50 percent and expires on the combat clock',t=> {
  const distance=(boost,sprint)=> {
    const players=new Map([['a',{ slot:0,connected:true }]])
    const sim=new ArenaSimulation(players),combat=new ArenaCombat(players,sim,1),player=players.get('a')
    t.after(()=>sim.free())
    for(let i=0;i<30;i++) { combat.step();sim.step() }
    if(boost) assert.equal(combat.receive('a',{ action:'ability',ability:'ultimate',epoch:1,sequence:0 }),true)
    const start=player.z
    for(let i=0;i<60;i++) {
      sim.receive('a',{ sequence:i,x:0,z:-1,yaw:0,pitch:0,sprint,jump:false,active:true })
      combat.step();sim.step()
    }
    const travelled=start-player.z
    combat.time=player.abilities.get('ultimate').activeUntil;sim.step()
    assert.equal(sim.players.get('a').movement,1)
    return travelled
  }
  for(const sprint of [false,true]) assert.ok(Math.abs(distance(true,sprint)/distance(false,sprint)-1.5)<0.01)
})
test('AEGIS absorbs bonus shield before general shield, spills damage and expires without healing',t => {
  const { a,ability,combat }=setup(t,'aegis')
  ability('shield'); ability('ultimate')
  assert.equal(a.ultimateShield,200); assert.equal(a.shieldCharge,50)
  combat.applyDamage('b','a',210)
  assert.equal(a.hp,100); assert.equal(a.ultimateShield,0); assert.equal(a.shieldCharge,40)
  combat.applyDamage('b','a',60); assert.equal(a.hp,80)
  combat.time=45; ability('ultimate'); combat.time=55; combat.step()
  assert.equal(a.ultimateShield,0); assert.equal(a.hp,80)
})
test('ION refills and cancels reloads, consumes no ammunition for ten seconds and resumes normal fire afterward',t => {
  const { a,ability,send,combat }=setup(t,'ion')
  a.pistolAmmo=0; assert.equal(send('a','reload'),true)
  ability('ultimate'); assert.equal(a.reloading,false); assert.equal(a.pistolAmmo,15)
  for(let i=0;i<12;i++) { combat.time=i*0.23; assert.equal(send('a','fire',{ yaw:Math.PI/2,pitch:0 }),true) }
  assert.equal(a.pistolAmmo,15); assert.equal(send('a','reload'),false)
  combat.time=10; assert.equal(send('a','fire',{ yaw:Math.PI/2,pitch:0 }),true)
  assert.equal(a.pistolAmmo,14)
})
test('RAZE boosts server damage and attack speed by 50 percent and restores both after expiry',t => {
  const { a,b,ability,send,combat }=setup(t,'raze')
  ability('ultimate')
  const pitch=Math.atan2(b.y+0.075-a.y-0.65,4)
  send('a','fire',{ yaw:0,pitch })
  assert.equal(b.hp,58); assert.ok(Math.abs(a.attackReadyAt-0.2/1.5)<1e-9)
  combat.time=0.1; assert.equal(send('a','fire',{ yaw:0,pitch }),false)
  combat.time=0.15; assert.equal(send('a','fire',{ yaw:0,pitch }),true); assert.equal(b.hp,16)
  combat.time=10; b.hp=100; send('a','fire',{ yaw:0,pitch }); assert.equal(b.hp,72)
  assert.equal(a.attackReadyAt,10.2)
})
test('flashbang blinds self and enemies, never a teammate, and cannot accept claimed targets',t => {
  const { a,b,c,ability,detonate,send }=setup(t)
  assert.equal(send('a','ability',{ ability:'flashbang',targets:['b'] }),false)
  ability('flashbang'); assert.equal(a.abilities.get('flashbang').flying,true)
  detonate()
  assert.ok(a.flashUntil>0); assert.ok(b.flashUntil>0); assert.equal(c.flashUntil,0)
  assert.equal(a.hp,100); assert.equal(b.hp,100)
  const wall=[{ position:[0,1,0],size:[4,4,0.5] }]
  assert.equal(flashDuration([0,1,-2],{ x:0,y:0.87,z:2,yaw:0,pitch:0 },wall),0)
})
test('stun roots only enemies, blocks dash and jump but permits aiming and shooting',t => {
  const { a,b,c,ability,detonate,send,combat,sim }=setup(t,'vex','stun')
  ability('stun'); detonate()
  assert.equal(a.rooted,false); assert.equal(c.rooted,false); assert.equal(b.rooted,true)
  assert.equal(ability('dash','b'),false)
  assert.equal(send('b','fire',{ yaw:Math.PI/2,pitch:0 }),true)
  const entry=sim.players.get('b'); const p=entry.body.translation()
  sim.receive('b',{ sequence:0,x:1,z:1,yaw:1,pitch:0.3,sprint:true,jump:true,active:true }); sim.step()
  const after=entry.body.translation()
  assert.ok(Math.abs(p.x-after.x)<0.001 && Math.abs(p.z-after.z)<0.001)
  assert.ok(after.y<=p.y+0.001)
  combat.time=b.rootedUntil; combat.step(); assert.equal(b.rooted,false)
})
test('smoke stays active for eight seconds, scan has no map distance limit and death cancels temporary effects',t => {
  const { a,ability,detonate,combat }=setup(t,'aegis','smoke')
  ability('smoke'); detonate()
  const smoke=a.abilities.get('smoke')
  assert.equal(smoke.activeUntil-smoke.detonatedAt,8)
  assert.equal(throughSmoke([0,1,4],[0,1,-4],[{ origin:[0,1,0],radius:4 }]),true)
  assert.equal(throughSmoke([10,1,4],[10,1,-4],[{ origin:[0,1,0],radius:4 }]),false)
  ability('ultimate'); combat.applyDamage('b','a',400)
  assert.equal(a.hp,0); assert.equal(a.ultimateShield,0); assert.equal(smoke.activeUntil,0)
  assert.equal(ability('ultimate'),false)
})
