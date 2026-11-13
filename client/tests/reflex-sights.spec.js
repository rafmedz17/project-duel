import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import { state,presetLoadout,moveUntil,equipWeapon,aimAtTarget } from './helpers.js'
import { WEAPONS } from '../../shared/weapons.js'
import { reflexProfile } from '../src/game/weapons/optics.js'

async function view(page) {
  return page.evaluate(async ()=> {
    const path=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const { _roots }=await import(path),{ scene,camera,size }=_roots.get(document.querySelector('canvas')).store.getState()
    const root=scene.getObjectByName('first-person-weapon'),zero=root.getObjectByName('iron-sight-zero'),dot=root.getObjectByName('reflex-model-reticle')
    const p=camera.position.clone()
    if(zero) zero.getWorldPosition(p).project(camera)
    return { model:root.visible,zero:Boolean(zero),glass:Boolean(root.getObjectByName('reflex-glass')),chassis:Boolean(root.getObjectByName('forged-gun-chassis')),physicalDot:dot?.visible,fov:camera.fov,zeroX:p.x*size.width/2,zeroY:p.y*size.height/2 }
  })
}
async function start(page,id) {
  await presetLoadout(page,{ primary:id });await page.goto('/')
  await page.getByRole('button',{ name:/SETTINGS/ }).click();await page.getByRole('tab',{ name:'Graphics',exact:true }).click();await page.getByLabel('Render quality').selectOption('Low')
  await page.getByRole('button',{ name:'BACK' }).click();await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
}
for(const id of ['rifle','astral','nova','striker','titan','omega']) test(`${id} has open mythic iron rails, a centered aiming zero, forged chassis and clean release`,async ({ page })=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page,id)
  expect(await view(page)).toMatchObject({ zero:true,glass:false,chassis:true })
  await page.mouse.down({ button:'right' })
  const sight=page.getByTestId('reflex-sight');await expect(sight).toBeVisible();await expect(sight).toHaveAttribute('data-weapon',id)
  await expect.poll(async ()=>Math.abs((await view(page)).fov-reflexProfile(WEAPONS[id]).fov)).toBeLessThan(0.2)
  await expect.poll(async ()=> { const s=await view(page);return Math.hypot(s.zeroX,s.zeroY) }).toBeLessThan(3)
  expect((await view(page)).model).toBe(true);expect((await view(page)).physicalDot).toBe(false)
  await expect(page.locator('.crosshair')).toBeHidden();await expect(page.getByLabel('Precision scope')).toHaveCount(0)
  await expect(sight.locator('.reflex-ring,.reflex-brackets,.reflex-chevron,small')).toHaveCount(0)
  const dot=await page.getByTestId('reflex-dot').boundingBox(),viewport=page.viewportSize()
  expect(Math.abs(dot.x+dot.width/2-viewport.width/2)).toBeLessThan(1);expect(Math.abs(dot.y+dot.height/2-viewport.height/2)).toBeLessThan(1)
  await page.screenshot({ path:`${id}-iron-preview.png` })
  await page.mouse.up({ button:'right' });await expect(sight).toHaveCount(0)
  await expect.poll(async ()=>(await view(page)).fov).toBeGreaterThan(69)
  expect((await view(page)).model).toBe(true);expect(errors).toEqual([])
})

test('rifle ADS fires real hits through its open sight, drops for reload, switches sights and clears on pause',async ({ page })=> {
  await start(page,'rifle');await moveUntil(page,'KeyW',2,-23,-1);await aimAtTarget(page,5)
  await page.mouse.down({ button:'right' });await expect(page.getByTestId('reflex-sight')).toBeVisible()
  await page.mouse.down();await page.mouse.up()
  await expect.poll(async ()=>(await state(page)).hits).toBeGreaterThan(0)
  await page.keyboard.press('KeyR');await expect(page.getByTestId('reflex-sight')).toHaveCount(0)
  await expect(page.getByRole('progressbar',{ name:'Reload progress' })).toBeVisible()
  await page.mouse.up({ button:'right' });await expect.poll(async ()=>(await state(page)).reloading).toBe(false)
  await page.mouse.down({ button:'right' });await expect(page.getByTestId('reflex-sight')).toBeVisible()
  await equipWeapon(page,'pistol');await expect(page.getByTestId('reflex-sight')).toHaveCount(0)
  await page.mouse.up({ button:'right' });await page.mouse.down({ button:'right' })
  await expect(page.getByTestId('reflex-sight')).toHaveCount(0);await expect.poll(async ()=>(await view(page)).fov).toBeGreaterThan(69)
  await page.mouse.up({ button:'right' });await equipWeapon(page,'rifle')
  await page.mouse.down({ button:'right' });await expect(page.getByTestId('reflex-sight')).toBeVisible()
  await page.evaluate(()=>document.exitPointerLock());await expect(page.getByTestId('reflex-sight')).toHaveCount(0)
  await page.mouse.up({ button:'right' })
})

for(const id of ['astral','omega']) test(`${id} multiplayer ADS preserves its firing behavior and remains centered`,async ({ page })=> {
  test.setTimeout(60000);let peer
  try {
    await presetLoadout(page,{ primary:id });await page.goto('/');await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
    await page.getByLabel('YOUR CALLSIGN').fill('Reflex Pilot');await page.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
    peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{ name:'Sight Target' });peer.onMessage('shot-trail',()=>{})
    await page.getByLabel('Match format').selectOption('freeplay');peer.send('ready',{ ready:true })
    await page.getByRole('button',{ name:'READY UP',exact:true }).click();await page.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click();await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{ movementY:-200 })))
    await page.mouse.down({ button:'right' });await expect(page.getByTestId('reflex-sight')).toBeVisible()
    await expect.poll(async ()=>Math.abs((await view(page)).fov-reflexProfile(WEAPONS[id]).fov)).toBeLessThan(0.2)
    await page.mouse.down()
    if(id==='astral') { await page.mouse.up();await expect(page.getByTestId('online-ammo')).toHaveText('24 / 27') }
    else { await expect(page.getByText('ROTARY SYSTEM SPINNING UP')).toBeVisible();await expect.poll(()=>peer.state.players.get([...peer.state.players.keys()].find(key=>key!==peer.sessionId)).arsenal.omegaAmmo).toBeLessThan(100);await page.mouse.up() }
    await expect(page.getByTestId('reflex-sight')).toBeVisible();expect((await view(page)).model).toBe(true)
    await page.mouse.up({ button:'right' });await expect(page.getByTestId('reflex-sight')).toHaveCount(0)
  } finally { await peer?.leave() }
})
