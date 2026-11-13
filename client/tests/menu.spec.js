import {openGame} from './helpers.js'
import {test,expect} from '@playwright/test'

const cinema=page=>page.evaluate(async()=>{
  const path='/src/menu/cinematic.js',url=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname===path)?.name || path
  return {...(await import(url)).menuCinema}
})

test('main menu follows the play layout, renders the map tour and pauses behind panels',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page,'/')
  const menu=page.getByTestId('main-menu')
  await expect(page.getByRole('heading',{name:/PROJECT.*DUEL/})).toBeVisible()
  await expect.poll(async()=>(await cinema(page)).time).toBeGreaterThan(1.3)
  const first=(await cinema(page)).time
  await expect.poll(async()=>(await cinema(page)).time).toBeGreaterThan(first+.15)
  const training=await menu.getByRole('button',{name:/ENTER TRAINING/}).boundingBox()
  const multiplayer=await menu.getByRole('button',{name:/^MULTIPLAYER/}).boundingBox()
  const loadout=await menu.getByRole('button',{name:/^CHARACTER & LOADOUT/}).boundingBox()
  const settings=await menu.getByRole('button',{name:'SETTINGS',exact:true}).boundingBox()
  expect(training.x).toBeGreaterThan(750);expect(training.y+training.height).toBeLessThan(multiplayer.y)
  expect(multiplayer.y+multiplayer.height).toBeLessThan(loadout.y)
  expect(multiplayer.height).toBeGreaterThan(training.height)
  expect(settings.y+settings.height).toBeLessThan(140)
  await page.screenshot({path:'menu-desktop-preview.png'})
  await menu.getByRole('button',{name:'Pause cinematic background'}).click()
  await expect.poll(async()=>(await cinema(page)).running).toBe(false)
  const paused=(await cinema(page)).time
  await page.waitForTimeout(400);expect((await cinema(page)).time).toBe(paused)
  await menu.getByRole('button',{name:'Play cinematic background'}).click()
  await expect.poll(async()=>(await cinema(page)).time).toBeGreaterThan(paused)
  for(const [label,heading] of [['SETTINGS','SETTINGS'],['LEADERBOARD','LEADERBOARD'],['PLAYER PROFILE','PLAYER PROFILE']]) {
    await menu.getByRole('button',{name:label,exact:true}).click()
    await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible()
    await expect.poll(async()=>(await cinema(page)).running).toBe(false)
    await page.getByRole('button',{name:/^BACK/}).click()
    await expect.poll(async()=>(await cinema(page)).running).toBe(true)
  }
  await menu.getByRole('button',{name:/^CHARACTER & LOADOUT/}).click()
  await expect(page.getByRole('dialog',{name:'CHARACTER & LOADOUT',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Close loadout',exact:true}).click()
  await menu.getByRole('button',{name:/^MULTIPLAYER/}).click()
  await expect(page.getByRole('heading',{name:'PRIVATE MULTIPLAYER',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'BACK',exact:true}).click()
  expect(errors).toEqual([])
})

test('cinematic cycles into the next real map without unmounting the menu',async({page})=>{
  await openGame(page,'/')
  await expect(page.getByTestId('main-menu')).toHaveAttribute('data-scene','neon',{timeout:45000})
  await expect(page.getByRole('heading',{name:'NEON DISTRICT',exact:true})).toBeVisible()
  await expect.poll(async()=>(await cinema(page)).progress).toBeGreaterThan(.06)
  await page.screenshot({path:'menu-neon-preview.png'})
  expect((await cinema(page)).fade).toBe(0)
  await expect(page.getByRole('button',{name:/^MULTIPLAYER/})).toBeEnabled()
})

test('reduced motion starts still and the compact menu fits a phone viewport',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.setViewportSize({width:390,height:844})
  await openGame(page,'/')
  const menu=page.getByTestId('main-menu')
  await expect(menu.getByRole('button',{name:'Play cinematic background'})).toBeVisible()
  await expect.poll(async()=>(await cinema(page)).time).toBe(1)
  await page.waitForTimeout(300);expect((await cinema(page)).time).toBe(1)
  expect(await menu.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true)
  for(const name of ['SETTINGS','LEADERBOARD','PLAYER PROFILE',/ENTER TRAINING/,/^MULTIPLAYER/,/^CHARACTER & LOADOUT/]) {
    const rect=await menu.getByRole('button',{name,exact:typeof name==='string'}).boundingBox()
    expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(390)
    expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(844)
  }
  await page.screenshot({path:'menu-mobile-preview.png'})
  await page.setViewportSize({width:844,height:390})
  for(const name of [/ENTER TRAINING/,/^MULTIPLAYER/,/^CHARACTER & LOADOUT/]) {
    const rect=await menu.getByRole('button',{name}).boundingBox()
    expect(rect.y).toBeGreaterThan(80);expect(rect.y+rect.height).toBeLessThan(390)
  }
  await page.screenshot({path:'menu-landscape-preview.png'})
})
