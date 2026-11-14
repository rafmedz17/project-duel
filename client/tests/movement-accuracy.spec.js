import {openGame,openMultiplayer} from './helpers.js'
import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'

const spread=page=>page.locator('.custom-crosshair[data-movement-spread]').evaluate(element=>Number(element.dataset.movementSpread))
async function exercise(page) {
  await expect.poll(()=>spread(page)).toBe(0)
  await page.evaluate(()=>{
    window.__movementPeak=0
    const sample=()=>{
      const value=Number(document.querySelector('.custom-crosshair[data-movement-spread]')?.dataset.movementSpread || 0)
      window.__movementPeak=Math.max(window.__movementPeak,value)
      requestAnimationFrame(sample)
    }
    sample()
  })
  await page.keyboard.down('KeyW')
  await expect.poll(()=>page.evaluate(()=>window.__movementPeak)).toBeGreaterThan(.03)
  await page.evaluate(()=>{window.__movementPeak=0})
  await page.keyboard.down('ShiftLeft')
  await expect.poll(()=>page.evaluate(()=>window.__movementPeak)).toBeGreaterThan(.08)
  await expect(page.locator('.movement-spread-hint')).toHaveCount(0)
  await page.screenshot({path:'movement-accuracy-preview.png'})
  await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW')
  await expect.poll(()=>spread(page)).toBe(0)
  await expect(page.locator('.movement-spread-hint')).toHaveCount(0)
  await page.evaluate(()=>{window.__movementPeak=0})
  await page.keyboard.press('Space')
  await expect.poll(()=>page.evaluate(()=>window.__movementPeak)).toBeGreaterThanOrEqual(.14)
  await expect.poll(()=>spread(page)).toBe(0)
  await page.evaluate(()=>{window.__movementPeak=0})
  await page.keyboard.press('KeyE')
  await expect.poll(()=>page.evaluate(()=>window.__movementPeak)).toBeGreaterThanOrEqual(.15)
  await expect.poll(()=>spread(page)).toBe(0)
  await page.keyboard.press('Digit3')
  await expect(page.locator('.movement-spread-hint')).toHaveCount(0)
}

test('training crosshair shows walk, sprint, jump and dash inaccuracy and settles after stopping',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page,'/')
  await page.getByRole('button',{name:/ENTER TRAINING/}).click()
  await page.getByRole('button',{name:'RESUME / ENTER ARENA'}).click()
  await exercise(page)
  expect(errors).toEqual([])
})

test('online crosshair follows movement and settles after stopping without breaking multiplayer feedback',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page,'/')
  await openMultiplayer(page,'casual','Accuracy Pilot')
  const peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{name:'Accuracy Peer'})
  peer.onMessage('loadout-bank',()=>{});peer.onMessage('shot-trail',()=>{})
  try {
    await page.getByLabel('Match format').selectOption('freeplay')
    peer.send('ready',{ready:true})
    await page.getByRole('button',{name:'READY UP',exact:true}).click()
    await page.getByRole('button',{name:'ENTER ARENA',exact:true}).click()
    await exercise(page)
    await page.waitForTimeout(350)
    await page.keyboard.press('Digit1')
    await expect(page.getByTestId('online-ammo')).toContainText('30')
    await page.waitForTimeout(300)
    await page.mouse.down();await page.mouse.up()
    await expect.poll(()=>peer.state.players.get(peer.state.hostId).shot).toBe(1)
    expect(errors).toEqual([])
  } finally {await peer.leave()}
})
