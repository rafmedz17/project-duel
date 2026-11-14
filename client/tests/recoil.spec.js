import {test,expect} from '@playwright/test'
import {Client} from '@colyseus/sdk'
import {openGame,openMultiplayer,enterTraining,presetLoadout,lookAt} from './helpers.js'
import {WEAPONS} from '../../shared/weapons.js'
import {recoilLimits} from '../src/game/weapons/recoil.js'

test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
  await presetLoadout(page,{primary:'rifle'})
})

async function observeSpray(page,online) {
  await page.evaluate(async online=>{
    const module=async path=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path)
    const source=online ? (await module('/src/multiplayer/poses.js')).arenaView : (await module('/src/game/runtime.js')).runtime
    const store=online ? (await module('/src/multiplayer/lobby.js')).lobby : (await module('/src/game/store.js')).game
    const combat=()=>online ? store.self() : store.get()
    window.recoilProbe={base:source.pitch,yaw:source.yaw,start:combat().shot,peak:0,side:0,shots:0,pitch:source.pitch}
    const sample=()=>{
      const p=window.recoilProbe
      p.peak=Math.max(p.peak,source.pitch-p.base);p.side=Math.max(p.side,Math.abs(source.yaw-p.yaw))
      p.shots=combat().shot-p.start;p.pitch=source.pitch
      requestAnimationFrame(sample)
    }
    sample()
  },online)
}

async function sprayAndRecover(page) {
  await page.mouse.down({button:'right'})
  await page.mouse.down()
  try {
    await expect.poll(()=>page.evaluate(()=>window.recoilProbe.shots),{timeout:30000}).toBeGreaterThanOrEqual(24)
  } finally {await page.mouse.up()}
  await expect.poll(()=>page.evaluate(()=>Math.abs(window.recoilProbe.pitch-window.recoilProbe.base)),{timeout:10000}).toBeLessThan(.0001)
  const probe=await page.evaluate(()=>window.recoilProbe),limit=recoilLimits(WEAPONS.rifle)
  expect(probe.peak).toBeGreaterThan(.035)
  expect(probe.peak).toBeLessThanOrEqual(limit.pitch+.0001)
  expect(probe.side).toBeLessThanOrEqual(limit.yaw+.0001)
  await page.mouse.up({button:'right'})
  return probe
}

test('training ADS spray caps its kick and returns to the pre-spray aim',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page);await enterTraining(page)
  await lookAt(page,0,.2)
  await observeSpray(page,false)
  await sprayAndRecover(page)
  expect(errors).toEqual([])
})

test('multiplayer ADS spray recovers both the local view and the aim sent to the server',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page);await openMultiplayer(page,'casual','Recoil Pilot')
  const peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{name:'Recoil Peer'})
  peer.onMessage('loadout-bank',()=>{});peer.onMessage('shot-trail',()=>{})
  try {
    await page.getByLabel('Match format').selectOption('freeplay')
    peer.send('ready',{ready:true})
    await page.getByRole('button',{name:'READY UP',exact:true}).click()
    await page.getByRole('button',{name:'ENTER ARENA',exact:true}).click()
    await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===document.querySelector('canvas'))).toBe(true)
    await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementY:-100})))
    await observeSpray(page,true)
    const probe=await sprayAndRecover(page)
    await expect.poll(()=>Math.abs(peer.state.players.get(peer.state.hostId).pitch-probe.base)).toBeLessThan(.0002)
    expect(errors).toEqual([])
  } finally {await peer.leave().catch(()=>{})}
})
