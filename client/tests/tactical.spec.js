import { test, expect } from '@playwright/test'
import {state, position, lookAt, aimAtTarget, moveUntil, presetLoadout, openGame} from './helpers.js'
import { TARGETS } from '../src/game/config.js'

async function start(page,primary='rifle') {
  await presetLoadout(page,{ character:'aegis',primary,unique:'scanner' })
  await openGame(page,'/')
  await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await page.getByRole('tab',{ name:'Graphics',exact:true }).click();await page.getByLabel('Render quality').selectOption('Low')
  await page.getByRole('button',{ name:'BACK' }).click()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await expect(page.getByRole('button',{ name:'RESUME / ENTER ARENA' })).toBeEnabled({ timeout:30000 })
  await resume(page)
}
async function resume(page) {
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async () => (await state(page)).mode).toBe('playing')
}
async function pause(page) {
  await page.evaluate(() => document.exitPointerLock())
  await expect.poll(async () => (await state(page)).mode).toBe('paused')
}
const attack = async page => { await page.mouse.down(); await page.mouse.up() }
function errorsFor(page) {
  const errors = []; page.on('pageerror',e => errors.push(e.message)); return errors
}

test('shotgun has finite spread/range, close-range pellet damage, semi-auto fire and its own reload', async ({ page }) => {
  const errors = errorsFor(page)
  await start(page,'shotgun')
  await page.keyboard.press('Digit1')
  await expect(page.getByText('1 / BREACH-12',{ exact:true })).toBeVisible()
  await page.waitForTimeout(300)
  await aimAtTarget(page); await attack(page)
  expect((await state(page)).targets[1].hp).toBe(100) // outside the 24-unit cone
  expect((await state(page)).magazines.shotgun).toBe(5)
  await lookAt(page,0,0)
  await moveUntil(page,'KeyW',2,-12.8,-1)
  await moveUntil(page,'KeyA',0,TARGETS[1][0]+0.1,-1)
  await moveUntil(page,'KeyW',2,-14,-1)
  await aimAtTarget(page)
  await page.screenshot({ path:'shotgun-preview.png' })
  await page.mouse.down(); await page.waitForTimeout(1000); await page.mouse.up()
  expect((await state(page)).targets[1].hp).toBe(0)
  expect((await state(page)).score).toBe(100)
  expect((await state(page)).weaponStats.shotgun).toEqual({ shots:2,hits:1 })
  expect((await state(page)).magazines.shotgun).toBe(4)
  await page.keyboard.press('KeyR')
  await expect.poll(async () => (await state(page)).magazines.shotgun).toBe(6)
  expect((await state(page)).magazines.pistol).toBe(15)
  expect((await state(page)).magazines.rifle).toBe(30)
  expect(errors).toEqual([])
})

test('scanner reveals targets, dash respects cooldown and boundaries, pause and restart clear ability state', async ({ page }) => {
  const errors = errorsFor(page)
  await start(page)
  await page.keyboard.press('KeyC')
  await expect(page.getByTestId('ability-scanner')).toContainText('ACTIVE')
  await aimAtTarget(page,0)
  await expect(page.getByTestId('scan-target-0')).toHaveCSS('opacity','1')
  await expect(page.getByTestId('scan-target-0')).toContainText('T-01')
  await expect(page.getByTestId('scan-target-0')).not.toContainText('HP')
  await page.screenshot({ path:'scanner-preview.png' })
  await lookAt(page,0,0)
  const before = await position(page)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400)
  const after = await position(page)
  expect(before[2]-after[2]).toBeGreaterThan(2.5)
  expect(before[2]-after[2]).toBeLessThan(5)
  await page.keyboard.press('KeyE')
  expect((await state(page)).abilities.dash.uses).toBe(1)
  await pause(page)
  const paused = await state(page)
  await page.keyboard.press('KeyF'); await page.keyboard.press('KeyV'); await page.keyboard.press('KeyC')
  await page.waitForTimeout(300)
  expect((await state(page)).abilities).toEqual(paused.abilities)
  expect((await state(page)).time).toBe(paused.time)
  await resume(page)
  await moveUntil(page,'KeyW',2,-12,-1)
  await expect(page.getByTestId('ability-scanner')).not.toContainText('ACTIVE')
  await moveUntil(page,'KeyW',2,-18,-1)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400)
  expect((await state(page)).abilities.dash.uses).toBe(2)
  expect((await position(page))[2]).toBeGreaterThan(-19.3)
  // The north wall has a visible pillar at x=0; its capsule-facing surface
  // stops us around z=-18.43, before the wall panel behind it.
  expect((await position(page))[2]).toBeLessThan(-18.35)
  await pause(page)
  await page.getByRole('button',{ name:'RESTART TRAINING',exact:true }).click()
  const reset = await state(page)
  expect(Object.values(reset.abilities).every(a => a.uses === 0 && a.readyAt === 0 && a.activeUntil === 0)).toBe(true)
  expect(reset.empHits).toBe(0)
  expect(reset.targets.every(t => t.hp === 100 && t.disabledUntil === 0)).toBe(true)
  expect(errors).toEqual([])
})

test('dash stops at cover, general and ultimate shields absorb hazards and protection expires', async ({ page }) => {
  const errors = errorsFor(page)
  await start(page)
  await moveUntil(page,'KeyD',0,7.7,1)
  await moveUntil(page,'KeyW',2,10,-1)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400)
  expect((await position(page))[2]).toBeGreaterThan(7.3)
  expect((await position(page))[2]).toBeLessThan(7.6)
  await moveUntil(page,'KeyD',0,14.7,1)
  await moveUntil(page,'KeyW',2,7,-1)
  const health = (await state(page)).hp
  await page.keyboard.press('KeyF')
  await expect(page.getByTestId('shield-charge')).toContainText('50 / 50')
  await moveUntil(page,'KeyW',2,3.3,-1)
  await expect.poll(async () => (await state(page)).shieldCharge).toBeLessThan(50)
  expect((await state(page)).hp).toBe(health)
  await page.keyboard.press('KeyX')
  await expect(page.getByTestId('ultimate-shield')).toContainText('FORTRESS SHIELD')
  await page.waitForTimeout(2000)
  expect((await state(page)).hp).toBe(health)
  expect((await state(page)).ultimateShield).toBeGreaterThan(0)
  await expect.poll(async () => (await state(page)).hp,{ timeout:6000 }).toBeLessThan(health)
  expect(errors).toEqual([])
})
