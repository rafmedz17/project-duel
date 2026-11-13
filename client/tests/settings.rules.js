import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTIONS,DEFAULT_BINDINGS,cleanPreferences,cleanBindings,rebind,canonicalCode,validBinding } from '../src/settings/preferences.js'
import { advanceDamageFeed,emptyDamageFeed } from '../src/settings/damageFeed.js'
import { aimFov } from '../src/game/weapons/optics.js'
import { game } from '../src/game/store.js'

test('preferences migrate old settings and clamp invalid UI or account data',()=> {
  const s=cleanPreferences({ sensitivity:3.5,fov:150,volume:0,sfxVolume:-1,musicVolume:NaN,enemyColor:'red',crosshair:{ gap:-3,size:999,color:'#00aaff' },bindings:{ fire:'Escape',forward:'KeyZ' } })
  assert.equal(s.sensitivity,3);assert.equal(s.fov,110);assert.equal(s.volume,0);assert.equal(s.sfxVolume,0);assert.equal(s.musicVolume,.25)
  assert.equal(s.crosshair.gap,0);assert.equal(s.crosshair.size,24);assert.equal(s.crosshair.color,'#00aaff');assert.equal(s.enemyColor,'#ff5876')
  assert.equal(s.bindings.forward,'KeyZ');assert.equal(s.bindings.fire,'Mouse0');assert.deepEqual(cleanPreferences(null),cleanPreferences())
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
  game.loadPreferences('pilot-one',{ fov:95,bindings:rebind(DEFAULT_BINDINGS,'reload','KeyL') })
  game.reset();assert.equal(game.get().settings.fov,95);assert.equal(game.get().settings.bindings.reload,'KeyL')
  game.loadPreferences('pilot-two');assert.equal(game.get().settings.fov,70)
  game.loadPreferences('pilot-one');assert.equal(game.get().settings.fov,95)
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
test('custom FOV restores after ADS and caps the dash boost without changing precision optics',()=> {
  const s={ weapon:'rifle',hp:100,lastSwitch:-10 }
  assert.equal(aimFov(s,1,false,false,100),100);assert.equal(aimFov(s,1,false,true,110),117)
  assert.equal(aimFov(s,1,true,false,100),50);assert.equal(aimFov({ ...s,weapon:'hyperion' },1,true,false,100),32)
})
