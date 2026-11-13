import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTIONS,DEFAULT_BINDINGS,cleanPreferences,cleanBindings,rebind,canonicalCode,validBinding } from '../src/settings/preferences.js'
import { advanceDamageFeed,emptyDamageFeed } from '../src/settings/damageFeed.js'
import { aimFov } from '../src/game/weapons/optics.js'
import { game } from '../src/game/store.js'
import { cleanWeaponSensitivity,lookMultiplier,SENSITIVITY_CATEGORIES } from '../src/settings/sensitivity.js'
import { WEAPONS } from '../../shared/weapons.js'

test('preferences migrate old settings and clamp invalid UI or account data',()=> {
  const s=cleanPreferences({ sensitivity:3.5,fov:150,volume:0,sfxVolume:-1,musicVolume:NaN,enemyColor:'red',crosshair:{ gap:-3,size:999,color:'#00aaff' },bindings:{ fire:'Escape',forward:'KeyZ' } })
  assert.equal(s.sensitivity,3);assert.equal(s.fov,110);assert.equal(s.volume,0);assert.equal(s.sfxVolume,0);assert.equal(s.musicVolume,.25)
  assert.equal(s.crosshair.gap,0);assert.equal(s.crosshair.size,24);assert.equal(s.crosshair.color,'#00aaff');assert.equal(s.enemyColor,'#ff5876')
  assert.equal(s.bindings.forward,'KeyZ');assert.equal(s.bindings.fire,'Mouse0');assert.deepEqual(cleanPreferences(null),cleanPreferences())
})

test('sensitivity migration preserves legacy aim, isolates categories and bounds malformed saved profiles',()=> {
  const legacy=cleanPreferences({sensitivity:1.7})
  for(const [weapon] of Object.entries(WEAPONS)) for(const mode of [{},{aiming:true},{firing:true}]) assert.equal(lookMultiplier(legacy,{weapon,hp:100,lastSwitch:-10},1,mode),1.7)
  const clean=cleanWeaponSensitivity({RIFLE:{look:Infinity,ads:-2,firing:99},SNIPER:{ads:.45},SMG:null,LMG:[]})
  assert.deepEqual(clean.RIFLE,{look:1,ads:.1,firing:3});assert.deepEqual(clean.SNIPER,{look:1,ads:.45,firing:1})
  assert.equal(Object.keys(clean).length,SENSITIVITY_CATEGORIES.length)
  clean.RIFLE.ads=2;assert.equal(clean.SMG.ads,1);assert.equal(cleanWeaponSensitivity().RIFLE.ads,1)
  assert.deepEqual(cleanWeaponSensitivity(null),cleanWeaponSensitivity([]))
})

test('per-category look, ADS and firing use one shared precedence and fall back during reload or equip',()=> {
  const settings=cleanPreferences({sensitivity:1.5,weaponSensitivity:{RIFLE:{look:1.2,ads:.6,firing:.25},SNIPER:{look:.8,ads:.3,firing:.4},PISTOL:{look:.9,firing:1.6}}})
  const rifle={weapon:'astral',hp:100,lastSwitch:-10}
  assert.ok(Math.abs(lookMultiplier(settings,rifle,1)-1.8)<1e-9)
  assert.ok(Math.abs(lookMultiplier(settings,rifle,1,{aiming:true})-.9)<1e-9)
  assert.equal(lookMultiplier(settings,rifle,1,{aiming:true,firing:true}),.375)
  assert.ok(Math.abs(lookMultiplier(settings,{...rifle,weapon:'hyperion'},1,{aiming:true})-.45)<1e-9)
  assert.ok(Math.abs(lookMultiplier(settings,{...rifle,weapon:'pistol'},1,{firing:true})-2.4)<1e-9)
  for(const patch of [{reloading:true},{lastSwitch:.9},{hp:0}]) assert.ok(Math.abs(lookMultiplier(settings,{...rifle,...patch},1,{aiming:true,firing:true})-1.8)<1e-9)
  assert.equal(lookMultiplier(settings,{...rifle,weapon:'blade'},1,{aiming:true}),1.5)
})

test('scoreboard defaults to Tab, preserves existing Tab bindings and supports rebinding without conflicts',()=> {
  assert.equal(cleanPreferences().bindings.scoreboard,'Tab')
  const migrated=cleanPreferences({ bindings:{ reload:'Tab' } })
  assert.equal(migrated.bindings.reload,'Tab');assert.equal(migrated.bindings.scoreboard,'KeyR')
  const rebound=rebind(DEFAULT_BINDINGS,'scoreboard','KeyP')
  assert.equal(canonicalCode({ type:'keydown',code:'KeyP' },{ bindings:rebound }),'Tab')
  assert.equal(canonicalCode({ type:'keyup',code:'Tab' },{ bindings:rebound }),null)
})

test('crouch migrates into saved controls and supports both Ctrl keys or a custom keyboard/mouse binding',()=>{
  const settings=cleanPreferences({bindings:{reload:'ControlLeft'}})
  assert.equal(settings.bindings.reload,'ControlLeft');assert.equal(settings.bindings.crouch,'KeyR')
  assert.equal(canonicalCode({type:'keydown',code:'ControlLeft'},cleanPreferences()),'ControlLeft')
  assert.equal(canonicalCode({type:'keydown',code:'ControlRight'},cleanPreferences()),'ControlRight')
  for(const binding of ['KeyV','Mouse4']) {
    const saved=cleanPreferences({bindings:rebind(DEFAULT_BINDINGS,'crouch',binding)})
    const event=binding==='Mouse4' ? {type:'mousedown',button:4} : {type:'keydown',code:binding}
    assert.equal(canonicalCode(event,saved),'ControlLeft')
    assert.equal(canonicalCode({type:'keydown',code:'ControlLeft'},saved),null)
  }
})
test('rebinding swaps collisions, round-trips all actions and translates physical input for both game modes',()=> {
  let bindings=rebind(DEFAULT_BINDINGS,'forward','KeyS');bindings=rebind(bindings,'fire','KeyP');bindings=rebind(bindings,'dash','Mouse4')
  assert.equal(bindings.backward,'KeyW');assert.equal(new Set(Object.values(bindings)).size,ACTIONS.length)
  assert.deepEqual(cleanBindings(bindings),bindings)
  const settings={ bindings }
  assert.equal(canonicalCode({ type:'keydown',code:'KeyS' },settings),'KeyW')
  assert.equal(canonicalCode({ type:'keydown',code:'KeyW' },settings),'KeyS')
  assert.equal(canonicalCode({ type:'keydown',code:'KeyP' },settings),'Mouse0')
  assert.equal(canonicalCode({ type:'mousedown',button:4 },settings),'KeyE')
  assert.equal(canonicalCode({ type:'keydown',code:'ShiftRight' },settings),'ShiftRight')
  assert.equal(canonicalCode({ type:'keydown',code:'KeyZ' },settings),null)
  for(const code of ['Escape','MetaLeft','AltLeft','Mouse9','KeyPP','__proto__']) assert.equal(validBinding(code),false)
})
test('device and account preferences stay isolated across resets, account switches and sign-out',()=> {
  const saved=game.get().settings,storage=new Map()
  globalThis.localStorage={ getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value) }
  game.loadPreferences(null);game.settings({ sensitivity:1.6 })
  game.loadPreferences('pilot-one',{ fov:95,weaponSensitivity:{SNIPER:{ads:.45}},bindings:rebind(DEFAULT_BINDINGS,'reload','KeyL') })
  game.reset();assert.equal(game.get().settings.fov,95);assert.equal(game.get().settings.bindings.reload,'KeyL')
  game.loadPreferences('pilot-two');assert.equal(game.get().settings.fov,70);assert.equal(game.get().settings.weaponSensitivity.SNIPER.ads,1)
  game.loadPreferences('pilot-one');assert.equal(game.get().settings.fov,95);assert.equal(game.get().settings.weaponSensitivity.SNIPER.ads,.45)
  game.settings({ fov:101 });game.loadPreferences(null)
  game.loadPreferences('pilot-one',{ fov:95 });assert.equal(game.get().settings.fov,101)
  game.preferencesSaved('pilot-one');game.loadPreferences('pilot-one',{ fov:96 });assert.equal(game.get().settings.fov,96)
  game.loadPreferences(null);assert.equal(game.get().settings.sensitivity,1.6);assert.equal(game.get().settings.bindings.reload,'KeyR')
  game.settings(saved);delete globalThis.localStorage
})
test('damage feeds accept confirmed hits once, stack only within the window and reset across sessions',()=> {
  const hit={ generation:1,time:1,hit:1,hitId:1,hitDamage:24 },first=advanceDamageFeed(emptyDamageFeed(),hit)
  assert.equal(first.total,24);assert.equal(advanceDamageFeed(first,{ ...hit,time:1.1 }),first)
  const second=advanceDamageFeed(first,{ ...hit,time:1.2,hit:1.2,hitId:2,hitDamage:48 })
  assert.equal(second.total,72);assert.deepEqual(second.entries.map(h=>h.amount),[24,48])
  const third=advanceDamageFeed(second,{ ...hit,time:3,hit:3,hitId:3,hitDamage:0,hitShieldDamage:15 })
  assert.equal(third.total,15);assert.equal(third.entries.length,1)
  assert.equal(advanceDamageFeed(third,{ generation:2,time:0,hit:-10,hitId:0 }).entries.length,0)
})

test('damage feedback settles when a multiplayer hit timestamp is ahead of the snapshot clock',()=> {
  for(const offset of [Number.EPSILON*10,1e-12,1/60]) {
    const hit={ generation:4,time:10,hit:10+offset,hitId:7,hitDamage:24 }
    const feed=advanceDamageFeed(emptyDamageFeed(),hit)
    assert.equal(feed.total,24)
    // CombatFeedback requests another render when the feed object changes.
    // The same snapshot must settle instead of repeatedly resetting its feed.
    for(let render=0;render<30;render++) assert.equal(advanceDamageFeed(feed,hit),feed)
    const next=advanceDamageFeed(feed,{ ...hit,time:10.2,hit:10.2+offset,hitId:8,hitDamage:48 })
    assert.equal(next.total,72)
    assert.equal(advanceDamageFeed(next,{ ...hit,time:10.2,hit:10.2+offset,hitId:8,hitDamage:48 }),next)
  }
})

test('shield feedback also settles with an ahead-of-clock hit and still resets on a clock rewind',()=> {
  const hit={ generation:4,time:10,hit:10+1e-12,hitId:9,hitDamage:0,hitShieldDamage:15 }
  const feed=advanceDamageFeed(emptyDamageFeed(),hit)
  assert.equal(feed.total,15)
  assert.equal(advanceDamageFeed(feed,hit),feed)
  const restarted={ ...hit,time:0,hit:-10,hitId:0 }
  const reset=advanceDamageFeed(feed,restarted)
  assert.equal(reset.entries.length,0)
  assert.equal(reset.total,0)
  assert.equal(advanceDamageFeed(reset,restarted),reset)
})
test('custom FOV restores after ADS and caps the dash boost without changing precision optics',()=> {
  const s={ weapon:'rifle',hp:100,lastSwitch:-10 }
  assert.equal(aimFov(s,1,false,false,100),100);assert.equal(aimFov(s,1,false,true,110),117)
  assert.equal(aimFov(s,1,true,false,100),50);assert.equal(aimFov({ ...s,weapon:'hyperion' },1,true,false,100),32)
})
