import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import { state,presetLoadout } from './helpers.js'

const optics=page=>page.evaluate(async ()=> {
  const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
  const { _roots }=await import(url),view=_roots.get(document.querySelector('canvas')).store.getState()
  return { modelVisible:view.scene.getObjectByName('first-person-weapon').visible,fov:view.camera.fov }
})
for(const id of ['hyperion','railbreaker']) test(`${id} scope has a clear sight picture, zooms and restores the model after ADS`,async ({ page })=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await presetLoadout(page,{ primary:id,startingWeapon:id });await page.goto('/')
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click();await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
  await expect.poll(async ()=>(await optics(page)).modelVisible).toBe(true)
  await page.mouse.down({ button:'right' });await expect(page.getByLabel('Precision scope')).toBeVisible()
  await expect.poll(async ()=>(await optics(page)).modelVisible).toBe(false)
  await expect.poll(async ()=>(await optics(page)).fov).toBeLessThan(33)
  await expect(page.locator('.crosshair')).toBeHidden()
  await page.screenshot({ path:`${id}-clear-scope-preview.png` })
  await page.mouse.up({ button:'right' });await expect(page.getByLabel('Precision scope')).toHaveCount(0)
  await expect.poll(async ()=>(await optics(page)).modelVisible).toBe(true)
  await expect.poll(async ()=>(await optics(page)).fov).toBeGreaterThan(69)
  expect(errors).toEqual([])
})
test('multiplayer sniper scope stays clear while firing and returns to hip view on release',async ({ page })=> {
  let peer
  try {
    await presetLoadout(page,{ primary:'railbreaker',startingWeapon:'railbreaker' });await page.goto('/')
    await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click();await page.getByLabel('YOUR CALLSIGN').fill('Scope Pilot')
    await page.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
    const code=await page.getByTestId('invite-code').textContent()
    peer=await new Client('http://127.0.0.1:2567').joinById(code,{ name:'Scope Target' })
    await page.getByLabel('Match format').selectOption('freeplay');peer.send('ready',{ ready:true })
    await page.getByRole('button',{ name:'READY UP',exact:true }).click();await page.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    await page.mouse.down({ button:'right' });await expect(page.getByLabel('Precision scope')).toBeVisible()
    await expect.poll(async ()=>(await optics(page)).modelVisible).toBe(false)
    await page.mouse.down();await page.mouse.up();await expect(page.getByTestId('online-ammo')).toHaveText('02 / 3')
    await expect.poll(async ()=>(await optics(page)).modelVisible).toBe(false)
    await page.mouse.up({ button:'right' });await expect.poll(async ()=>(await optics(page)).modelVisible).toBe(true)
  } finally { await peer?.leave() }
})
