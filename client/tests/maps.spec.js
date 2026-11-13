import { test,expect } from '@playwright/test'

test('host selects both new maps; players share the map, move, and return to change it',async ({ browser }) => {
  test.setTimeout(90000)
  const hostContext=await browser.newContext(),guestContext=await browser.newContext()
  const host=await hostContext.newPage(),guest=await guestContext.newPage(),errors=[]
  for (const page of [host,guest]) page.on('pageerror',e => errors.push(e.message))
  const snapshot=page => page.evaluate(async () => {
    const path='/src/multiplayer/lobby.js'
    const url=performance.getEntriesByType('resource').find(e => new URL(e.name).pathname===path)?.name || path
    const { lobby }=await import(url)
    return lobby.get()
  })
  try {
    await host.goto('/'); await host.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
    await host.getByLabel('YOUR CALLSIGN').fill('Nova')
    await host.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
    await expect(host.getByTestId('invite-code')).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/)
    const code=await host.getByTestId('invite-code').textContent()
    await host.getByLabel('Match format').selectOption('freeplay')
    await guest.goto('/'); await guest.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
    await guest.getByLabel('YOUR CALLSIGN').fill('Echo')
    await guest.getByLabel('INVITE CODE',{ exact:true }).fill(code)
    await guest.getByRole('button',{ name:'JOIN ROOM',exact:true }).click()
    await expect(guest.getByLabel('Arena map')).toBeDisabled()
    await expect(guest.getByLabel('Match type').locator('option[value=ranked]')).toBeDisabled()
    for (const [mapId,name] of [['neon','NEON DISTRICT'],['orbital','ORBITAL STATION']]) {
      await host.getByLabel('Arena map').selectOption(mapId)
      await expect(guest.getByLabel('Arena map')).toHaveValue(mapId)
      await host.getByRole('button',{ name:'READY UP',exact:true }).click()
      await guest.getByRole('button',{ name:'READY UP',exact:true }).click()
      await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
      await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:10000 })
      await expect(guest.locator('.online-top')).toContainText(name)
      await host.bringToFront(); await host.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
      await expect.poll(async () => (await snapshot(host)).captured).toBe(true)
      await host.keyboard.down('KeyW'); await host.waitForTimeout(600); await host.keyboard.up('KeyW')
      await host.screenshot({ path:`${mapId}-preview.png` })
      await host.keyboard.press('Escape');await host.evaluate(() => document.exitPointerLock())
      await host.getByRole('button',{ name:'RETURN TO LOBBY',exact:true }).click()
      await expect(guest.getByRole('dialog',{ name:'PRIVATE MULTIPLAYER' })).toBeVisible()
    }
    expect(errors).toEqual([])
  } finally { await hostContext.close(); await guestContext.close() }
})
