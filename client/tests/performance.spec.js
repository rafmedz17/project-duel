import { test,expect } from '@playwright/test'

test('menu and paused training stop drawing; active training resumes rendering',async ({ page }) => {
  await page.addInitScript(() => {
    window.duelDrawCalls = 0
    for (const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]) {
      for (const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
        const original = proto[name]
        if (!original) continue
        proto[name] = function (...args) { window.duelDrawCalls++; return original.apply(this,args) }
      }
    }
  })
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => window.duelDrawCalls)).toBeGreaterThan(0)
  await page.waitForTimeout(500)
  const menu = await page.evaluate(() => window.duelDrawCalls)
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => window.duelDrawCalls)).toBe(menu)
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(() => page.evaluate(() => window.duelDrawCalls)).toBeGreaterThan(menu+100)
  await page.evaluate(() => document.exitPointerLock())
  await expect(page.getByRole('button',{ name:'RESUME / ENTER ARENA' })).toBeVisible()
  await page.waitForTimeout(500)
  const paused = await page.evaluate(() => window.duelDrawCalls)
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => window.duelDrawCalls)).toBe(paused)
})
