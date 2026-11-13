import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'

async function state(page) {
  return page.evaluate(async () => {
    const path = '/src/multiplayer/lobby.js'
    const url = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname===path)?.name || path
    const { lobby } = await import(url)
    return lobby.get()
  })
}
test('refresh restores the same arena seat and ammo, accepts new actions, and explicit leave clears recovery',async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/')
  await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
  await page.getByLabel('YOUR CALLSIGN').fill('Refresh Pilot')
  await page.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
  await expect(page.getByTestId('invite-code')).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/)
  const code = await page.getByTestId('invite-code').textContent()
  const peer = await new Client('http://127.0.0.1:2567').joinById(code,{ name:'Recovery Peer' })
  try {
    await page.getByLabel('Match format').selectOption('freeplay')
    await page.getByRole('button',{ name:'READY UP',exact:true }).click()
    peer.send('ready',{ ready:true })
    await page.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    await expect.poll(async () => (await state(page)).captured).toBe(true)
    await page.mouse.click(640,400)
    await expect(page.getByTestId('online-ammo')).toHaveText('14 / 15')
    const before = await state(page)
    await page.reload()
    await expect.poll(async () => (await state(page)).status).toBe('connected')
    await expect(page.getByRole('button',{ name:'ENTER ARENA',exact:true })).toBeVisible()
    const restored = await state(page)
    await expect.poll(async ()=>(await state(page)).bank?.slots.length).toBe(5)
    expect(restored.sessionId).toBe(before.sessionId)
    expect(restored.room.code).toBe(code)
    expect(restored.room.players).toHaveLength(2)
    expect(restored.captured).toBe(false)
    await expect(page.getByTestId('online-ammo')).toHaveText('14 / 15')
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    await expect.poll(async () => (await state(page)).captured).toBe(true)
    await page.mouse.click(640,400)
    await expect(page.getByTestId('online-ammo')).toHaveText('13 / 15')
    await page.keyboard.press('Escape');await page.evaluate(() => document.exitPointerLock())
    await page.getByRole('button',{ name:'RETURN TO LOBBY',exact:true }).click()
    await page.getByRole('button',{ name:'LEAVE ROOM',exact:true }).click()
    await page.reload()
    expect((await state(page)).status).toBe('idle')
    expect(await page.evaluate(() => sessionStorage.getItem('duel-room-recovery-v1'))).toBeNull()
  } finally { await peer.leave() }
})

test('an invalid recovery token shows a retryable lobby and never creates a replacement room',async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.setItem('duel-room-recovery-v1',JSON.stringify({ endpoint:'http://127.0.0.1:2567',token:'BAD234:invalid',expires:Date.now()+30000 })))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('reserved seat expired')
  expect((await state(page)).room).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('duel-room-recovery-v1'))).toBeNull()
  await expect(page.getByRole('button',{ name:'CREATE PRIVATE ROOM' })).toBeEnabled()
})
