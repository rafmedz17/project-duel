import { test, expect } from '@playwright/test'
import { state, position, lookAt, moveUntil, observeHitFeedback, observedFeedback } from './helpers.js'
import { PLAYER, TARGETS } from '../src/game/config.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

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
  const offsets = { head:[0,ROBOT_HEAD_Y],body:[0,0.075],foot:[-0.13,-0.79] }
  const [ox,oy] = offsets[region], dx = p[0]-(x+ox), dz = p[2]-z
  await lookAt(page,Math.atan2(dx,dz),Math.atan2(y+oy-p[1]-PLAYER.eye,Math.hypot(dx,dz)))
}
const fire = async page => { await page.mouse.down(); await page.mouse.up() }

test('practice uses robot hit zones, distinguishes headshots and feet, and resets defeated robots',async ({ page }) => {
  const errors = []; page.on('pageerror',error => errors.push(error.message))
  await start(page)
  await observeHitFeedback(page)
  expect((await state(page)).opponent.enabled).toBe(false)
  // Approach on the same floor so the pistol's accuracy cone stays inside the
  // small foot hit volume. Geometry rules separately verify the spawn sightline.
  await lookAt(page,0,0); await moveUntil(page,'KeyW',2,0,-1)
  const floor = (await position(page))[1]
  expect(floor).toBeLessThan(0.92)
  await aim(page,'head'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(44)
  expect(await observedFeedback(page)).toMatchObject({ damage:56,headshot:true })
  expect((await observedFeedback(page)).text).toContain('HEADSHOT')
  await page.waitForTimeout(280)
  await aim(page,'body'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(16)
  expect(await observedFeedback(page)).toMatchObject({ damage:28,headshot:false })
  await page.waitForTimeout(280)
  await aim(page,'foot'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(2)
  expect(await observedFeedback(page)).toMatchObject({ damage:14,headshot:false })
  await page.waitForTimeout(280)
  await aim(page,'head'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(0)
  expect((await state(page)).hitDamage).toBe(2)
  expect((await state(page)).score).toBe(100)
  await page.screenshot({ path:'robot-headshot-preview.png' })
  await expect.poll(async () => (await state(page)).targets[1].hp,{ timeout:5000 }).toBe(100)
  await aim(page,'body'); await fire(page)
  await expect.poll(async () => (await state(page)).targets[1].hp).toBe(72)
  expect((await state(page)).opponent.enabled).toBe(false)
  await lookAt(page,0,0)
  await moveUntil(page,'KeyW',2,-13,-1)
  expect((await position(page))[1]).toBeCloseTo(floor,1)
  expect(errors).toEqual([])
})
