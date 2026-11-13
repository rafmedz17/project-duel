import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import { writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { state,presetLoadout,position,lookAt } from './helpers.js'
import { TARGETS,PLAYER } from '../src/game/config.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

async function start(page,gear) {
  await presetLoadout(page,gear);await page.goto('/')
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
}
const fire=async page=>{ await page.mouse.down();await page.mouse.up() }
async function head(page,id) {
  const p=await position(page),[x,y,z]=TARGETS[id]
  await lookAt(page,Math.atan2(p[0]-x,p[2]-z),Math.atan2(y+ROBOT_HEAD_Y-p[1]-PLAYER.eye,Math.hypot(p[0]-x,p[2]-z)))
}
const sounds=page=>page.evaluate(async ()=> {
  const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/audio/synth.js')?.name
  return (await import(url || '/src/audio/synth.js')).audio.diagnostics()
})
async function probeTrails(page) {
  await page.evaluate(async ()=> {
    const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const { _roots }=await import(url),scene=_roots.get(document.querySelector('canvas')).store.getState().scene
    window.__trails={ peak:0,count:0,finite:true,colored:false }
    const sample=()=> {
      const mesh=scene.getObjectByName('bullet-trail-cores')
      if(mesh) {
        window.__trails.count=mesh.count;window.__trails.peak=Math.max(window.__trails.peak,mesh.count)
        if(mesh.count) {
          window.__trails.finite &&= [...mesh.instanceMatrix.array.slice(0,mesh.count*16)].every(Number.isFinite)
          window.__trails.colored ||= Boolean(mesh.instanceColor)
          if(!window.__trailPreview) window.__trailPreview=document.querySelector('canvas').toDataURL('image/png')
        }
      }
      requestAnimationFrame(sample)
    }
    sample()
  })
}

test('confirmed training kills show escalating badges and all five sound tiers; pausing freezes the badge and reset clears it',async ({ page })=> {
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await start(page,{ primary:'hyperion',startingWeapon:'hyperion' });await probeTrails(page)
  for(let n=1;n<=5;n++) {
    const target=n%2 ? 1 : 2
    await expect.poll(async ()=>(await state(page)).targets[target].hp).toBe(100)
    await expect.poll(async ()=>{ const s=await state(page);return s.time>=s.attackReadyAt }).toBe(true)
    await head(page,target);await fire(page)
    await expect(page.getByTestId('kill-badge')).toHaveAttribute('data-combo',String(n))
    await expect(page.getByTestId('kill-badge')).toContainText(['ELIMINATION','DOUBLE KILL','TRIPLE KILL','OVERDRIVE','RAMPAGE'][n-1])
    await expect(page.getByTestId('kill-badge')).toContainText('HEADSHOT')
    await expect.poll(async ()=>(await sounds(page)).counts[n===1 ? 'elimination' : `kill-combo-${n}`] || 0).toBe(1)
  }
  await page.screenshot({ path:'kill-rampage-preview.png' })
  const trails=await page.evaluate(()=>window.__trails)
  expect(trails.peak).toBeGreaterThan(0);expect(trails.finite).toBe(true);expect(trails.colored).toBe(true)
  await page.evaluate(()=>document.exitPointerLock())
  await expect.poll(async ()=>(await state(page)).mode).toBe('paused')
  const paused=await state(page);await page.waitForTimeout(2700)
  expect((await state(page)).time).toBe(paused.time);await expect(page.getByTestId('kill-badge')).toBeVisible()
  await page.getByRole('button',{ name:'RESTART TRAINING',exact:true }).click()
  await expect(page.getByTestId('kill-badge')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('shotgun pellets have visible bounded trails that expire; rejected shots and melee do not emit trails',async ({ page })=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await start(page,{ primary:'shotgun',startingWeapon:'shotgun' });await probeTrails(page)
  await lookAt(page,0,0.25);await fire(page)
  await expect.poll(()=>page.evaluate(()=>window.__trails.peak)).toBeGreaterThanOrEqual(10)
  const preview=await page.evaluate(()=>window.__trailPreview)
  await writeFile('bullet-trails-preview.png',Buffer.from(preview.split(',')[1],'base64'))
  await fire(page);expect((await state(page)).shot).toBe(1)
  await expect.poll(()=>page.evaluate(()=>window.__trails.count)).toBe(0)
  await page.keyboard.press('Digit3')
  await expect.poll(async ()=>{ const s=await state(page);return s.time>=s.attackReadyAt }).toBe(true)
  await fire(page)
  await expect.poll(async ()=>(await state(page)).swings).toBe(1)
  expect((await state(page)).shot).toBe(1)
  expect(await page.evaluate(()=>window.__trails.count)).toBe(0)
  expect((await page.evaluate(()=>window.__trails)).finite).toBe(true)
  expect(errors).toEqual([])
})

async function onlineHead(page,peerId) {
  await page.evaluate(async ({ peerId,eye,head })=> {
    const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
    const { arenaView,latestPose }=await import(url('/src/multiplayer/poses.js'))
    const { game }=await import(url('/src/game/store.js'))
    const p=arenaView.position,target=latestPose(peerId),yaw=Math.atan2(p[0]-target.x,p[2]-target.z),pitch=Math.atan2(target.y+head-p[1]-eye,Math.hypot(p[0]-target.x,p[2]-target.z))
    const sensitivity=0.002*game.get().settings.sensitivity
    document.dispatchEvent(new MouseEvent('mousemove',{ movementX:(arenaView.yaw-yaw)/sensitivity,movementY:(arenaView.pitch-pitch)/sensitivity }))
  },{ peerId,eye:PLAYER.eye,head:ROBOT_HEAD_Y })
}
const onlineSelf=page=>page.evaluate(async ()=> {
  const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/multiplayer/lobby.js')?.name
  return (await import(url || '/src/multiplayer/lobby.js')).lobby.self()
})

test('multiplayer confirms combo badges and sound, renders opponent shots, and clears the local combo on death',async ({ page })=> {
  test.setTimeout(90000)
  let peer
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  try {
    await presetLoadout(page,{ primary:'hyperion',startingWeapon:'hyperion' });await page.goto('/')
    await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click();await page.getByLabel('YOUR CALLSIGN').fill('Badge Pilot')
    await page.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
    peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{ name:'Trail Pilot' })
    const events=[];peer.onMessage('shot-trail',event=>events.push(event))
    await page.getByLabel('Match format').selectOption('freeplay');peer.send('ready',{ ready:true })
    await page.getByRole('button',{ name:'READY UP',exact:true }).click();await page.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click();await probeTrails(page)
    let sequence=0
    const send=(yaw,pitch)=>peer.send('combat',{ epoch:peer.state.arenaEpoch,sequence:sequence++,action:'fire',yaw,pitch })
    send(Math.PI,1)
    await expect.poll(()=>page.evaluate(()=>window.__trails.peak)).toBeGreaterThan(0)
    expect(events[0].id).toBe(peer.sessionId)
    for(let n=1;n<=2;n++) {
      await expect.poll(()=>peer.state.players.get(peer.sessionId).hp,{ timeout:6000 }).toBe(100)
      await onlineHead(page,peer.sessionId);await fire(page)
      await expect(page.getByTestId('kill-badge')).toHaveAttribute('data-combo',String(n))
      await expect.poll(()=>peer.state.players.get(peer.sessionId).hp).toBe(0)
    }
    await expect.poll(async ()=>(await sounds(page)).counts['kill-combo-2'] || 0).toBe(1)
    await page.screenshot({ path:'online-double-kill-preview.png' })
    expect(events.filter(event=>event.weapon==='hyperion')).toHaveLength(2)
    await expect.poll(()=>peer.state.players.get(peer.sessionId).hp,{ timeout:6000 }).toBe(100)
    const shooter=peer.state.players.get(peer.sessionId),target=[...peer.state.players.entries()].find(([id])=>id!==peer.sessionId)[1]
    const yaw=Math.atan2(shooter.x-target.x,shooter.z-target.z),pitch=Math.atan2(target.y+ROBOT_HEAD_Y-shooter.y-PLAYER.eye,Math.hypot(shooter.x-target.x,shooter.z-target.z))
    for(let i=0;i<3;i++) { send(yaw,pitch);await page.waitForTimeout(250) }
    await expect.poll(async ()=>(await onlineSelf(page)).hp).toBe(0)
    await expect(page.getByTestId('kill-badge')).toHaveCount(0)
    expect((await onlineSelf(page)).killCombo).toBe(0)
    expect(errors).toEqual([])
  } finally { await peer?.leave() }
})
