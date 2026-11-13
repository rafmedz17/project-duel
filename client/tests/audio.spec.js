import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import { state,position,lookAt,moveUntil } from './helpers.js'
import { PLAYER,TARGETS } from '../src/game/config.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

const sound=page => page.evaluate(async () => {
  const path='/src/audio/synth.js'
  const url=performance.getEntriesByType('resource').find(e => new URL(e.name).pathname===path)?.name || path
  return (await import(url)).audio.diagnostics()
})
const fire=async (page,waitForReady = true) => {
  if (waitForReady) await expect.poll(async () => {
    const s = await state(page)
    return s.mode==='playing' && !s.reloading && s.time>=s.attackReadyAt
  }).toBe(true)
  await page.mouse.down(); await page.mouse.up()
}
async function start(page) {
  await page.goto('/')
  await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await page.getByLabel('Render quality').selectOption('Low')
  await page.getByRole('button',{ name:'BACK' }).click()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async () => (await state(page)).mode).toBe('playing')
}
async function pause(page) {
  await page.evaluate(() => document.exitPointerLock())
  await expect.poll(async () => (await state(page)).mode).toBe('paused')
  await expect.poll(async () => (await sound(page)).state).toBe('suspended')
}
test('audio waits for interaction, generates a real waveform, and saves volume and mute',async ({ page }) => {
  await page.goto('/')
  expect((await sound(page)).state).toBe('locked')
  await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await page.getByRole('button',{ name:'TEST AUDIO' }).click()
  await expect(page.getByRole('status')).toHaveText('Audio test played.')
  await expect.poll(async () => (await sound(page)).peakRms,{ intervals:[10,20,30] }).toBeGreaterThan(0.0001)
  const volume=page.getByLabel('Sound volume')
  await volume.focus(); await volume.press('Home')
  await expect(page.getByRole('button',{ name:'TEST AUDIO' })).toBeDisabled()
  await volume.press('ArrowRight'); await volume.press('ArrowRight')
  await expect(volume).toHaveValue('2')
  await page.getByLabel('Mute sound').check()
  await expect(page.getByRole('button',{ name:'TEST AUDIO' })).toBeDisabled()
  await page.reload(); await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await expect(page.getByLabel('Mute sound')).toBeChecked()
  await expect(page.getByLabel('Sound volume')).toHaveValue('2')
})
test('training plays equipped weapon, reload, hit, ability and footstep cues; pausing clears active voices',async ({ page }) => {
  test.setTimeout(90000)
  const errors=[]; page.on('pageerror',e => errors.push(e.message))
  await start(page)
  await expect.poll(async () => (await sound(page)).state).toBe('running')
  await page.keyboard.press('Digit1'); await page.waitForTimeout(350)
  await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up()
  await expect.poll(async () => (await sound(page)).counts.rifle || 0).toBeGreaterThan(2)
  expect((await sound(page)).peakRms).toBeGreaterThan(0.0001)
  await page.keyboard.press('KeyR')
  await expect.poll(async () => (await sound(page)).counts['reload-start'] || 0).toBe(1)
  await expect.poll(async () => (await sound(page)).counts['reload-end'] || 0).toBe(1)
  for (const [key,cue] of [['Digit3','blade'],['Digit2','pistol']]) {
    await page.keyboard.press(key); await page.waitForTimeout(400); await fire(page)
    await expect.poll(async () => (await sound(page)).counts[cue] || 0).toBeGreaterThan(0)
    await page.waitForTimeout(850)
  }
  const p=await position(page),[x,y,z]=TARGETS[1]
  for (let i=0;i<3;i++) {
    await lookAt(page,Math.atan2(p[0]-x,p[2]-z),Math.atan2(y+ROBOT_HEAD_Y-p[1]-PLAYER.eye,Math.hypot(p[0]-x,p[2]-z)))
    await fire(page); await page.waitForTimeout(280)
  }
  await expect.poll(async () => (await sound(page)).counts.headshot || 0).toBeGreaterThan(0)
  await expect.poll(async () => (await sound(page)).counts.elimination || 0).toBe(1)
  await lookAt(page,0,0)
  await moveUntil(page,'KeyW',2,9,-1)
  await expect.poll(async () => (await sound(page)).counts.step || 0).toBeGreaterThan(0)
  for (const [key,cue] of [['KeyE','dash'],['KeyF','shield'],['KeyC','flashbang'],['KeyX','ultimate']]) {
    await page.keyboard.press(key)
    await expect.poll(async () => (await sound(page)).counts[cue] || 0).toBe(1)
  }
  await pause(page)
  const paused=await sound(page)
  expect(paused.voices).toBe(0)
  await fire(page,false); await page.keyboard.press('KeyE'); await page.waitForTimeout(400)
  expect((await sound(page)).played).toBe(paused.played)
  expect((await sound(page)).rms).toBe(0)
  expect(errors).toEqual([])
})
test('muting silences real shots, and unmuting does not replay missed sounds',async ({ page }) => {
  await start(page); await pause(page)
  await page.getByRole('button',{ name:'SETTINGS',exact:true }).click()
  await page.getByLabel('Mute sound').check()
  await page.getByRole('button',{ name:'BACK' }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  const before=await sound(page)
  await fire(page)
  expect((await state(page)).shot).toBe(1)
  expect((await sound(page)).played).toBe(before.played)
  await pause(page)
  await page.getByRole('button',{ name:'SETTINGS',exact:true }).click()
  await page.getByLabel('Mute sound').uncheck()
  await page.getByRole('button',{ name:'BACK' }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  expect((await sound(page)).played).toBe(before.played)
  await fire(page)
  await expect.poll(async () => (await sound(page)).counts.pistol || 0).toBe(1)
})
test('browsers without Web Audio can still play and show an actionable audio notice',async ({ page }) => {
  await page.addInitScript(() => { window.AudioContext=undefined; window.webkitAudioContext=undefined })
  const errors=[]; page.on('pageerror',e => errors.push(e.message))
  await page.goto('/'); await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await page.getByRole('button',{ name:'TEST AUDIO' }).click()
  await expect(page.getByRole('status')).toContainText('unavailable or blocked')
  await page.getByRole('button',{ name:'BACK' }).click()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await fire(page)
  expect((await state(page)).shot).toBe(1)
  expect((await sound(page)).state).toBe('unavailable')
  expect(errors).toEqual([])
})
test('online opponent sounds use authoritative positions; replays, focus loss and resuming stay silent',async ({ page }) => {
  test.setTimeout(90000)
  const errors=[]; page.on('pageerror',e => errors.push(e.message))
  await page.goto('/'); await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
  await page.getByLabel('YOUR CALLSIGN').fill('Audio Pilot')
  await page.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
  await expect(page.getByTestId('invite-code')).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/)
  const code=await page.getByTestId('invite-code').textContent()
  // A real SDK peer sends ordinary intents. It never supplies hit results.
  const peer=await new Client('http://127.0.0.1:2567').joinById(code,{ name:'Audio Peer' })
  try {
    await expect.poll(() => peer.state.players?.size).toBe(2)
    await page.getByLabel('Match format').selectOption('freeplay')
    peer.send('ready',{ ready:true }); await page.getByRole('button',{ name:'READY UP',exact:true }).click()
    await page.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    await expect.poll(async () => (await sound(page)).state).toBe('running')
    const me=() => peer.state.players.get(peer.sessionId)
    const target=() => [...peer.state.players.entries()].find(([id]) => id!==peer.sessionId)[1]
    await expect.poll(() => me().grounded && target().grounded).toBe(true)
    const head={ yaw:Math.atan2(me().x-target().x,me().z-target().z),pitch:Math.atan2(target().y+ROBOT_HEAD_Y-me().y-PLAYER.eye,Math.hypot(me().x-target().x,me().z-target().z)) }
    let sequence=0
    const combat=(action,details={}) => { const payload={ action,...details,sequence:sequence++,epoch:peer.state.arenaEpoch,round:peer.state.roundId }; peer.send('combat',payload); return payload }
    const shot=combat('fire',head)
    await expect(page.getByTestId('online-health')).toContainText('44')
    await expect.poll(async () => (await sound(page)).counts.hurt || 0).toBe(1)
    const first=await sound(page)
    expect(first.counts.pistol).toBe(1); expect(first.spatial).toBeGreaterThan(0)
    expect(first.lastSpatial[2]).toBeLessThan(-14)
    peer.send('combat',shot); await page.waitForTimeout(350)
    expect((await sound(page)).counts.pistol).toBe(1)
    for (let i=0;i<11;i++) {
      peer.send('move',{ sequence:i,x:1,z:0,yaw:0,pitch:0,sprint:false,jump:false,active:true,round:peer.state.roundId })
      await new Promise(resolve => setTimeout(resolve,70))
    }
    peer.send('move',{ sequence:11,x:0,z:0,yaw:0,pitch:0,sprint:false,jump:false,active:false,round:peer.state.roundId })
    await expect.poll(() => me().x).toBeGreaterThan(2)
    combat('ability',{ ability:'flashbang' })
    await expect.poll(async () => (await sound(page)).counts.flashbang || 0).toBe(1)
    expect((await sound(page)).lastSpatial[0]).toBeGreaterThan(2)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect.poll(async () => (await sound(page)).state).toBe('suspended')
    const quiet=await sound(page)
    combat('fire',{ yaw:0,pitch:0 }); await page.waitForTimeout(300)
    expect((await sound(page)).played).toBe(quiet.played)
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    await page.waitForTimeout(200)
    expect((await sound(page)).played).toBe(quiet.played)
    combat('fire',{ yaw:0,pitch:0 })
    await expect.poll(async () => (await sound(page)).counts.pistol || 0).toBe(2)
    await page.evaluate(() => document.exitPointerLock())
    await page.getByRole('button',{ name:'RETURN TO LOBBY',exact:true }).click()
    await expect.poll(async () => (await sound(page)).active).toBe(false)
    expect((await sound(page)).voices).toBe(0)
    expect(errors).toEqual([])
  } finally { await peer.leave().catch(() => {}) }
})
