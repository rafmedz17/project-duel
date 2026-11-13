import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import { PLAYER } from '../../shared/arena.js'
import { state,presetLoadout,equipWeapon } from './helpers.js'

async function configure(page) {
  await presetLoadout(page,{primary:'astral',startingWeapon:'astral'})
  await page.goto('/')
  await page.getByRole('button',{name:/SETTINGS/}).click()
  await page.getByRole('tab',{name:'Graphics',exact:true}).click()
  await page.getByLabel('Render quality').selectOption('Low')
  await page.getByRole('tab',{name:'Sensitivity',exact:true}).click()
  for(const [label,value] of [['Mouse sensitivity','1.5'],['Rifle look sensitivity','1.2'],['Rifle ADS sensitivity','0.5'],['Rifle firing sensitivity','0.25'],['Pistol look sensitivity','0.8']]) await page.getByLabel(label,{exact:true}).fill(value)
  await page.getByRole('tab',{name:'Controls',exact:true}).click()
  await page.getByRole('button',{name:'Rebind Fire / melee',exact:true}).click()
  await page.keyboard.press('KeyP')
  await page.getByRole('button',{name:'BACK →',exact:true}).click()
}

// Exercise the actual captured mouse handler and read its rendered view after
// two frames. Recoil settles before the baseline; no camera state is injected.
async function assertLook(page,multiplier,online=false) {
  const delta=await page.evaluate(async online=> {
    const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
    const view=online ? (await import(url('/src/multiplayer/poses.js'))).arenaView : (await import(url('/src/game/runtime.js'))).runtime
    const frames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
    await frames();const before={yaw:view.yaw,pitch:view.pitch}
    document.dispatchEvent(new MouseEvent('mousemove',{movementX:60,movementY:20}))
    await frames()
    return {yaw:Math.atan2(Math.sin(view.yaw-before.yaw),Math.cos(view.yaw-before.yaw)),pitch:view.pitch-before.pitch}
  },online)
  expect(delta.yaw).toBeCloseTo(-60*PLAYER.sensitivity*multiplier,3)
  expect(delta.pitch).toBeCloseTo(-20*PLAYER.sensitivity*multiplier,3)
}

test('training applies look, ADS and remapped firing sensitivity, restores aim after release and clears on reload',async ({page})=> {
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await configure(page)
  await page.getByRole('button',{name:/ENTER TRAINING/}).click()
  await page.getByRole('button',{name:'RESUME / ENTER ARENA'}).click()
  await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
  await assertLook(page,1.5*1.2)
  await page.mouse.down({button:'right'})
  await expect(page.getByTestId('reflex-sight')).toBeVisible()
  await assertLook(page,1.5*.5)
  await page.keyboard.down('KeyP')
  await expect.poll(async ()=>(await state(page)).shot).toBe(3)
  await assertLook(page,1.5*.25)
  await page.keyboard.up('KeyP')
  await assertLook(page,1.5*.5)
  await page.mouse.up({button:'right'})
  await assertLook(page,1.5*1.2)
  await expect.poll(async ()=>{const s=await state(page);return s.time>=s.attackReadyAt}).toBe(true)
  await page.keyboard.down('KeyP')
  await expect.poll(async ()=>(await state(page)).shot).toBe(6)
  await page.keyboard.press('KeyR')
  await expect.poll(async ()=>(await state(page)).reloading).toBe(true)
  await expect.poll(async ()=>(await state(page)).reloading).toBe(false)
  await assertLook(page,1.5*1.2)
  await page.keyboard.up('KeyP')
  await equipWeapon(page,'pistol')
  await assertLook(page,1.5*.8)
  await page.evaluate(()=>document.exitPointerLock())
  await page.getByRole('button',{name:'SETTINGS',exact:true}).click()
  await page.getByRole('tab',{name:'Sensitivity',exact:true}).click()
  await page.getByRole('button',{name:'RESET SENSITIVITY'}).click()
  await expect(page.getByLabel('Mouse sensitivity',{exact:true})).toHaveValue('1')
  await expect(page.getByLabel('Rifle ADS sensitivity',{exact:true})).toHaveValue('1')
  await page.setViewportSize({width:640,height:720})
  await page.getByRole('tab',{name:'Sensitivity',exact:true}).click()
  await page.getByRole('dialog',{name:'SETTINGS',exact:true}).screenshot({path:'settings-sensitivity-narrow-preview.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  expect(errors).toEqual([])
})

test('multiplayer uses the same look, ADS and firing profiles and clears held firing sensitivity after focus loss',async ({page})=> {
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let peer
  try {
    await configure(page)
    await page.getByRole('button',{name:/^MULTIPLAYER/}).click()
    await page.getByLabel('YOUR CALLSIGN').fill('Sensitivity Pilot')
    await page.getByRole('button',{name:'CREATE PRIVATE ROOM'}).click()
    peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{name:'Sensitivity Peer'})
    peer.onMessage('shot-trail',()=>{})
    await page.getByLabel('Match format').selectOption('freeplay')
    peer.send('ready',{ready:true})
    await page.getByRole('button',{name:'READY UP',exact:true}).click()
    await page.getByRole('button',{name:'START SHARED ARENA'}).click()
    await page.getByRole('button',{name:'ENTER ARENA',exact:true}).click()
    await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true)
    await assertLook(page,1.5*1.2,true)
    await page.mouse.down({button:'right'})
    await expect(page.getByTestId('reflex-sight')).toBeVisible()
    await assertLook(page,1.5*.5,true)
    await page.keyboard.down('KeyP')
    const self=()=>[...peer.state.players.values()].find(p=>p.name==='Sensitivity Pilot')
    await expect.poll(()=>self()?.shot).toBe(3)
    await assertLook(page,1.5*.25,true)
    await page.keyboard.up('KeyP')
    await assertLook(page,1.5*.5,true)
    await page.mouse.up({button:'right'})
    await assertLook(page,1.5*1.2,true)
    await page.keyboard.down('KeyP')
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
    await page.keyboard.up('KeyP')
    await page.getByRole('button',{name:/MATCH LIVE/}).click()
    await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true)
    await assertLook(page,1.5*1.2,true)
    expect(errors).toEqual([])
  } finally {await peer?.leave().catch(()=>{})}
})
