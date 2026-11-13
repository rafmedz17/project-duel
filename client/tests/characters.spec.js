import { test,expect } from '@playwright/test'
import { state,presetLoadout,lookAt } from './helpers.js'

async function start(page,gear) {
  await presetLoadout(page,gear)
  await page.goto('/')
  await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await page.getByLabel('Render quality').selectOption('Low')
  await page.getByRole('button',{ name:'BACK' }).click()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async () => (await state(page)).mode).toBe('playing')
}
test('character armory shows four distinct operatives, the full arsenal and fits smaller screens',async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{ name:/^CHARACTER & LOADOUT/ }).click()
  const dialog=page.getByRole('dialog',{ name:'CHARACTER & LOADOUT' })
  await expect(dialog.locator('.character-card')).toHaveCount(4)
  for(const category of ['SNIPER RIFLES','SUBMACHINE GUNS','LIGHT MACHINE GUNS']) await expect(dialog.getByRole('button',{ name:category,exact:true })).toBeEnabled()
  for(const character of ['VEX','AEGIS','ION','RAZE']) {
    await dialog.getByRole('button',{ name:`Select ${character}` }).click()
    await expect(dialog.getByRole('button',{ name:`Select ${character}` })).toHaveAttribute('aria-pressed','true')
    await expect(dialog.locator('.ultimate-dossier')).toContainText('5 SECONDS')
  }
  await dialog.evaluate(el=>{ el.scrollTop=0 })
  await dialog.screenshot({ path:'character-armory-preview.png' })
  await page.setViewportSize({ width:640,height:850 })
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await dialog.getByRole('button',{ name:/SAVE & EQUIP/ }).scrollIntoViewIfNeeded()
  const button=await dialog.getByRole('button',{ name:/SAVE & EQUIP/ }).boundingBox()
  expect(button.x).toBeGreaterThanOrEqual(0); expect(button.x+button.width).toBeLessThanOrEqual(640)
  await dialog.screenshot({ path:'character-armory-small-preview.png' })
})
for(const character of ['vex','aegis','ion','raze']) test(`${character} has a visible five-second ultimate and exactly four equipped skills`,async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message))
  await start(page,{ character,unique:'stun' })
  await expect(page.locator('.ability-bar .ability')).toHaveCount(4)
  await page.keyboard.press('KeyX')
  await expect(page.getByTestId('ability-ultimate')).toContainText('ACTIVE')
  await expect(page.locator('.ultimate-notice')).toBeVisible()
  const s=await state(page)
  expect(s.abilities.ultimate.activeUntil-s.abilities.ultimate.startedAt).toBe(5)
  if(character==='aegis') await expect(page.getByTestId('ultimate-shield')).toContainText('+200')
  if(character==='vex') {
    await page.keyboard.press('KeyE'); await page.waitForTimeout(250); await page.keyboard.press('KeyE')
    expect((await state(page)).abilities.dash.uses).toBe(2)
  }
  if(character==='ion') {
    await page.mouse.click(600,350)
    expect((await state(page)).magazines.rifle).toBe(30)
  }
  await page.screenshot({ path:`${character}-ultimate-preview.png` })
  await expect(page.locator('.ultimate-notice')).toHaveCount(0,{ timeout:7000 })
  await expect(page.getByTestId('ability-ultimate')).not.toContainText('READY')
  expect(errors).toEqual([])
})
for(const unique of ['flashbang','smoke','stun']) test(`${unique} throws a visible grenade, detonates after its fuse and rejects cooldown spam`,async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message))
  await start(page,{ unique })
  await lookAt(page,0,-1.2)
  await page.keyboard.press('KeyC')
  expect((await state(page)).abilities[unique].flying).toBe(true)
  await page.keyboard.press('KeyC')
  expect((await state(page)).abilities[unique].uses).toBe(1)
  await expect.poll(async () => (await state(page)).abilities[unique].flying).toBe(false)
  expect((await state(page)).abilities[unique].detonatedAt).toBeGreaterThan(0)
  if(unique==='flashbang') {
    await expect(page.getByTestId('flash-screen')).toBeVisible()
    await page.evaluate(()=>document.exitPointerLock())
    await expect.poll(async ()=>(await state(page)).mode).toBe('paused')
    await expect(page.getByTestId('flash-screen')).toHaveCount(0)
    const frozen=(await state(page)).time
    await page.waitForTimeout(250)
    expect((await state(page)).time).toBe(frozen)
    await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  }
  if(unique==='stun') expect((await state(page)).rootedUntil).toBe(0)
  if(unique==='smoke') {
    const a=(await state(page)).abilities.smoke
    expect(a.activeUntil-a.detonatedAt).toBe(8)
  }
  await page.screenshot({ path:`${unique}-preview.png` })
  expect(errors).toEqual([])
})
