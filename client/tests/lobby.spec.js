import {openGame,openMultiplayer} from './helpers.js'
import { test, expect } from '@playwright/test'

async function open(page, name) {
  await openGame(page,'/')
  await openMultiplayer(page,'casual',name)
  await expect(page.getByRole('dialog',{ name:'PRIVATE MULTIPLAYER' })).toBeVisible()
}
async function create(page,name) {
  await open(page,name)
  await expect(page.getByTestId('invite-code')).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/)
  return page.getByTestId('invite-code').textContent()
}
async function join(page,name,code) {
  await open(page,name)
  await page.getByLabel('INVITE CODE',{ exact:true }).fill(code.toLowerCase())
  await page.getByRole('button',{ name:'JOIN ROOM',exact:true }).click()
}

test('two independent browsers create and join by code, synchronize ready state, reject a third and transfer hosting',async ({ browser }) => {
  test.setTimeout(90000)
  const contexts = await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()])
  const [host,guest,third] = await Promise.all(contexts.map(context => context.newPage()))
  const errors = []
  for (const page of [host,guest,third]) page.on('pageerror',error => errors.push(error.message))
  try {
    const code = await create(host,'Nova')
    await contexts[0].grantPermissions(['clipboard-read','clipboard-write'])
    await host.bringToFront()
    await host.getByRole('button',{ name:'COPY CODE',exact:true }).click()
    await expect(host.getByText('CODE COPIED',{ exact:true })).toBeVisible()
    expect(await host.evaluate(() => navigator.clipboard.readText())).toBe(code)
    await expect(host.getByRole('button',{ name:'READY UP',exact:true })).toBeDisabled()
    await join(guest,'Echo',code)
    await expect(host.getByTestId('lobby-slot-1')).toContainText('Echo')
    await expect(guest.getByTestId('lobby-slot-0')).toContainText('Nova')
    await host.getByRole('button',{ name:'READY UP',exact:true }).click()
    await expect(guest.getByTestId('lobby-slot-0').locator('.player-ready')).toHaveText('READY')
    await guest.getByRole('button',{ name:'READY UP',exact:true }).click()
    await expect(host.getByText(/BOTH PLAYERS READY.*STARTING IN/)).toBeVisible()
    await expect(guest.getByText(/BOTH PLAYERS READY.*STARTING IN/)).toBeVisible()
    await guest.getByRole('button',{ name:'CANCEL READY',exact:true }).click()
    await host.screenshot({ path:'lobby-preview.png' })
    await expect(host.getByText('WAITING FOR READY CHECKS',{ exact:true })).toBeVisible()
    await join(third,'Third',code)
    await expect(third.getByRole('alert')).toContainText('full')
    await host.getByRole('button',{ name:'LEAVE ROOM',exact:true }).click()
    await expect(host.getByRole('dialog')).toHaveCount(0)
    await expect(guest.getByTestId('lobby-slot-1')).toContainText('ROOM HOST')
    await expect(guest.getByRole('button',{ name:'READY UP',exact:true })).toBeDisabled()
    await third.getByRole('button',{ name:'JOIN ROOM',exact:true }).click()
    await expect(guest.getByTestId('lobby-slot-0')).toContainText('Third')
    await third.close() // Abrupt tab loss holds its seat before timing out.
    await expect(guest.getByText('HOLDING YOUR FRIEND’S SEAT',{ exact:true })).toBeVisible()
    await expect(guest.getByRole('button',{ name:'READY UP',exact:true })).toBeDisabled()
    await expect(guest.getByText('WAITING FOR A CHALLENGER',{ exact:true })).toBeVisible({ timeout:20000 })
    await guest.getByRole('button',{ name:'LEAVE ROOM',exact:true }).click()
    await contexts[1].close()
    await host.bringToFront()
    await host.getByRole('button',{ name:/ENTER TRAINING/ }).click()
    await expect(host.getByRole('button',{ name:'RESUME / ENTER ARENA' })).toBeEnabled({ timeout:30000 })
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

test('lobby preserves its room after invalid codes or offline joins, cancels late creation, and restores focus',async ({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await open(page,'Tester')
  const original=await page.getByTestId('invite-code').textContent()
  await page.getByRole('button',{name:'JOIN ROOM',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('six-character')
  await page.getByLabel('INVITE CODE',{exact:true}).fill(original)
  await page.getByRole('button',{name:'JOIN ROOM',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('already in this room')
  await page.getByLabel('INVITE CODE',{exact:true}).fill('ZZZZZZ')
  await page.getByRole('button',{name:'JOIN ROOM',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Room not found')
  await expect(page.getByTestId('invite-code')).toHaveText(original)
  await page.route('**/matchmake/**',route=>route.abort('connectionrefused'))
  await page.getByRole('button',{name:'JOIN ROOM',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Could not connect')
  await expect(page.getByTestId('invite-code')).toHaveText(original)
  await page.unroute('**/matchmake/**')
  await page.getByRole('button',{name:'LEAVE ROOM',exact:true}).click()
  let release,signalReached,signalDelivered
  const gate=new Promise(resolve=>{release=resolve}),reached=new Promise(resolve=>{signalReached=resolve}),delivered=new Promise(resolve=>{signalDelivered=resolve})
  const delayed=async route=>{
    if(route.request().method()!=='POST') {await route.continue();return}
    signalReached();await gate;await route.continue();signalDelivered()
  }
  await page.route('**/matchmake/create/**',delayed)
  await openMultiplayer(page,'casual','Tester',false)
  await reached
  await page.getByRole('button',{name:'CANCEL / BACK',exact:true}).click()
  release();await delivered
  await page.unroute('**/matchmake/create/**',delayed)
  await expect(page.getByRole('button',{name:/^MULTIPLAYER/})).toBeFocused()
  await openMultiplayer(page)
  await expect(page.getByTestId('invite-code')).not.toHaveText(original)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button',{name:/^MULTIPLAYER/})).toBeFocused()
  expect(errors).toEqual([])
})
