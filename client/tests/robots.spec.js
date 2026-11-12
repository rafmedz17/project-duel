import { test, expect } from '@playwright/test'
import { state, position, lookAt, moveUntil, observeHitFeedback, observedFeedback } from './helpers.js'
import { PLAYER, TARGETS } from '../src/game/config.js'

async function start(page) {
  await page.goto('/')
  await expect(page.getByRole('button',{ name:'ENTER SPARRING',exact:true })).toHaveCount(0)
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await expect(page.getByRole('button',{ name:'RESUME / ENTER ARENA' })).toBeEnabled({ timeout:30000 })
  await expect(page.getByRole('button',{ name:/TRAINING OPPONENT/ })).toHaveCount(0)
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async () => (await state(page)).mode).toBe('playing')
}
async function aim(page,region) {
  const p = await position(page), [x,y,z] = TARGETS[1]
  const offsets = { head:[0,0.48],body:[0,-0.03],foot:[-0.13,-0.79] }
  const [ox,oy] = offsets[region], dx = p[0]-(x+ox), dz = p[2]-z
  await lookAt(page,Math.atan2(dx,dz),Math.atan2(y+oy-p[1]-PLAYER.eye,Math.hypot(dx,dz)))
}
const fire = async page => { await page.mouse.down(); await page.mouse.up() }

test('practice uses robot hit zones, distinguishes headshots and feet, and resets defeated robots',async ({ page }) => {
  const errors = []; page.on('pageerror',error => errors.push(error.message))
  await start(page)
  await observeHitFeedback(page)
  expect((await state(page)).opponent.enabled).toBe(false)
  // Approach through the center lane, past low cover, for an unobstructed foot shot.
  await moveUntil(page,'KeyW',2,-8,-1)
  await aim(page,'head'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(60)
  expect(await observedFeedback(page)).toMatchObject({ damage:40,headshot:true })
  expect((await observedFeedback(page)).text).toContain('HEADSHOT')
  await page.waitForTimeout(280)
  await aim(page,'body'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(40)
  expect(await observedFeedback(page)).toMatchObject({ damage:20,headshot:false })
  await page.waitForTimeout(280)
  await aim(page,'foot'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(30)
  expect(await observedFeedback(page)).toMatchObject({ damage:10,headshot:false })
  await page.waitForTimeout(280)
  await aim(page,'head'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(0)
  expect((await state(page)).hitDamage).toBe(30)
  expect((await state(page)).score).toBe(100)
  await page.screenshot({ path:'robot-headshot-preview.png' })
  await expect.poll(async () => (await state(page)).targets[1].hp,{ timeout:5000 }).toBe(100)
  await aim(page,'body'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(80)
  expect((await state(page)).opponent.enabled).toBe(false)
  expect(errors).toEqual([])
})
