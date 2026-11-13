import { test, expect } from '@playwright/test'
import { state, aimAtTarget, presetLoadout } from './helpers.js'

async function resume(page) {
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async () => (await state(page)).mode).toBe('playing')
}
async function start(page,primary='rifle') {
  await presetLoadout(page,{ primary })
  await page.goto('/')
  await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await page.getByLabel('Render quality').selectOption('Low')
  await page.getByRole('button',{ name:'BACK' }).click()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await expect(page.getByRole('button',{ name:'RESUME / ENTER ARENA' })).toBeEnabled({ timeout:30000 })
  await resume(page)
}
const attack = async page => { await page.mouse.down(); await page.mouse.up() }

// Inspect rendered Three objects without modifying the simulation or input.
const weaponPose = (page, waitForCell = false) => page.evaluate(async waitForCell => {
  const moduleUrl = performance.getEntriesByType('resource').find(e => new URL(e.name).pathname.endsWith('/@react-three_fiber.js'))?.name
  const { _roots } = await import(moduleUrl)
  const scene = _roots.get(document.querySelector('canvas')).store.getState().scene
  const weapon = scene.getObjectByName('first-person-weapon')
  const cell = weapon.getObjectsByProperty('name','reload-energy-cell')[0]
  if (waitForCell) {
    const started = performance.now()
    await new Promise((resolve,reject) => {
      const sample = () => {
        if (cell.position.y < -0.15) resolve()
        else if (performance.now()-started>5000) reject(new Error('The energy cell did not move out during reload'))
        else requestAnimationFrame(sample)
      }
      sample()
    })
  }
  return { rotation:weapon.quaternion.clone().premultiply(_roots.get(document.querySelector('canvas')).store.getState().camera.quaternion.clone().invert()).toArray().map(n=>Math.round(n*1e6)/1e6 || 0),cellY:cell.position.y }
},waitForCell)

test('every firearm animates its reload, shows progress, freezes on pause and returns to its ready pose', async ({ page }) => {
  const errors = []
  page.on('pageerror',error => errors.push(error.message))
  for (const [id,key] of [['pistol','Digit2'],['rifle','Digit1'],['shotgun','Digit1']]) {
    await start(page,id==='shotgun' ? 'shotgun' : 'rifle')
    await page.keyboard.press(key)
    await page.waitForTimeout(350)
    const ready = await weaponPose(page)
    await attack(page)
    await page.keyboard.press('KeyR')
    const animating = await weaponPose(page,true)
    await expect(page.getByRole('status').filter({ hasText:'RELOADING' })).toBeVisible()
    expect((await state(page)).reloadReason).toBe('manual')
    expect(Number(await page.getByRole('progressbar',{ name:'Reload progress' }).getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    expect(animating.cellY).toBeLessThan(-0.15)
    expect(animating.rotation).not.toEqual(ready.rotation)
    await page.screenshot({ path:`${id}-reload-preview.png` })
    if (id === 'shotgun') {
      await page.evaluate(() => document.exitPointerLock())
      await expect.poll(async () => (await state(page)).mode).toBe('paused')
      const paused = await state(page), frozen = await weaponPose(page)
      await page.waitForTimeout(400)
      expect((await state(page)).time).toBe(paused.time)
      expect(await weaponPose(page)).toEqual(frozen)
      await resume(page)
    }
    await expect(page.getByRole('progressbar',{ name:'Reload progress' })).toHaveCount(0)
    const loaded = await state(page)
    expect(loaded.magazines[id]).toBe(id === 'pistol' ? 15 : id === 'rifle' ? 30 : 6)
    await expect.poll(async () => Math.abs((await weaponPose(page)).cellY)).toBeLessThan(0.000001)
    expect((await weaponPose(page)).rotation).toEqual(ready.rotation)
  }
  expect(errors).toEqual([])
})

test('shotgun uses only a dotted ring; hit feedback shows damage, distinct eliminations and clears after misses', async ({ page }) => {
  const errors = []
  page.on('pageerror',error => errors.push(error.message))
  await start(page,'shotgun')
  await expect(page.locator('.crosshair')).toHaveText('+')
  await page.keyboard.press('Digit1')
  await expect(page.locator('.shotgun-crosshair')).toHaveText('')
  expect(await page.locator('.shotgun-crosshair').evaluate(el => getComputedStyle(el,'::before').borderTopStyle)).toBe('dotted')
  await page.screenshot({ path:'shotgun-crosshair-preview.png' })
  await page.keyboard.press('Digit2'); await page.waitForTimeout(350)
  await expect(page.locator('.crosshair')).toHaveText('+')
  await aimAtTarget(page)
  // Capture each brief DOM flash when React mounts it, avoiding remote-polling latency.
  await page.evaluate(() => {
    window.__feedbackEvents = []
    let last
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="hit-feedback"]')
      if (el && el !== last) window.__feedbackEvents.push({ damage:el.dataset.damage,defeated:el.dataset.defeated,strokes:el.querySelectorAll('.hit-strokes i').length,text:el.textContent })
      last = el
    }).observe(document.querySelector('.hud'),{ childList:true,subtree:true })
  })
  await attack(page)
  const marker = page.getByTestId('hit-feedback')
  await expect.poll(() => page.evaluate(() => window.__feedbackEvents.length)).toBe(1)
  expect(await page.evaluate(() => window.__feedbackEvents[0])).toMatchObject({ damage:'28',defeated:'false',strokes:4 })
  const firstHit = (await state(page)).hitId
  for (let i=0;i<3;i++) {
    await expect.poll(async () => { const s = await state(page); return s.time >= s.attackReadyAt },{ intervals:[20] }).toBe(true)
    await aimAtTarget(page); await attack(page)
  }
  await page.screenshot({ path:'hitmarker-preview.png' })
  await expect.poll(() => page.evaluate(() => window.__feedbackEvents.length)).toBe(4)
  expect(await page.evaluate(() => window.__feedbackEvents.at(-1))).toMatchObject({ damage:'16',defeated:'true',text:'16ELIMINATED',strokes:4 })
  expect((await state(page)).hitId).toBe(firstHit+3)
  await page.waitForTimeout(650)
  await attack(page) // The folded target cannot generate another hit or defeat.
  await expect(marker).toHaveCount(0)
  expect((await state(page)).hitId).toBe(firstHit+3)
  expect((await state(page)).score).toBe(100)
  expect(errors).toEqual([])
})
