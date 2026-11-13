import { test,expect } from '@playwright/test'
import { state,position,lookAt,moveUntil,equipWeapon,observeHitFeedback,observedFeedback } from './helpers.js'
import { PLAYER } from '../src/game/config.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

async function start(page) {
  await page.goto('/');await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await page.getByRole('tab',{ name:'Graphics',exact:true }).click();await page.getByLabel('Render quality').selectOption('Low');await page.getByRole('button',{ name:'BACK' }).click()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
}
async function aim(page,index,region='body') {
  await expect.poll(async ()=> { const s=await state(page);return s.time>=s.attackReadyAt && !s.reloading }).toBe(true)
  const p=await position(page)
  const target=await page.evaluate(async index=> {
    const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
    const { game }=await import(url('/src/game/store.js')),{ targetPosition }=await import(url('/src/game/training/config.js'))
    return targetPosition(index,game.get().targets[index])
  },index)
  target[1]+=index>=21 ? 0 : region==='head' ? ROBOT_HEAD_Y : region==='foot' ? -0.79 : 0.075
  if(region==='foot') target[0]+=0.13
  await lookAt(page,Math.atan2(p[0]-target[0],p[2]-target[2]),Math.atan2(target[1]-p[1]-PLAYER.eye,Math.hypot(p[0]-target[0],p[2]-target[2])))
}
async function fire(page) {
  await expect.poll(async ()=> { const s=await state(page);return s.time>=s.attackReadyAt && !s.reloading }).toBe(true)
  await page.mouse.down();await page.mouse.up()
}
async function goEast(page) {
  await lookAt(page,0,0);await moveUntil(page,'KeyW',2,0,-1);await moveUntil(page,'KeyD',0,25,1)
  await expect(page.getByTestId('training-course')).toContainText('REFLEX LAB')
}

test('central hub leads to a ten-robot room with ground-level head, body and foot hits',async ({ page })=> {
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await start(page);await expect(page.getByTestId('training-course')).toContainText('TRAINING NEXUS')
  expect((await state(page)).targets).toHaveLength(22)
  await moveUntil(page,'KeyW',2,-23,-1)
  await expect(page.getByTestId('training-course')).toContainText('10 / 10 ROBOTS STANDING')
  expect((await position(page))[1]).toBeLessThan(0.95)
  await equipWeapon(page,'pistol');await observeHitFeedback(page)
  for(const [region,hp,damage] of [['head',44,56],['body',16,28],['foot',2,14],['head',0,2]]) {
    await aim(page,5,region);await fire(page)
    await expect.poll(async ()=>(await state(page)).targets[5].hp).toBe(hp)
    expect(await observedFeedback(page)).toMatchObject({ damage,headshot:region==='head' })
  }
  await page.screenshot({ path:'training-range-preview.png' })
  await page.keyboard.press('KeyG');expect((await state(page)).targets.slice(0,10).every(t=>t.hp===100)).toBe(true)
  expect(errors).toEqual([])
})

test('B edits character, guns, melee and skill in place while freezing an active reflex challenge',async ({ page })=> {
  test.setTimeout(100000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await start(page);await goEast(page);await page.keyboard.press('KeyG')
  await expect.poll(async ()=>(await state(page)).training.aim.active).toBe(true)
  await page.keyboard.press('KeyE');await page.waitForTimeout(450)
  const p=await position(page);await page.keyboard.press('KeyB')
  const dialog=page.getByRole('dialog',{ name:'FIELD ARMORY',exact:true })
  await expect(dialog).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true)
  const before=await state(page);await page.waitForTimeout(500);expect((await state(page)).time).toBe(before.time)
  await dialog.getByRole('button',{ name:'Loadout slot 2',exact:true }).click()
  await dialog.getByRole('button',{ name:'Select ION',exact:true }).click()
  await dialog.getByRole('button',{ name:'SNIPER RIFLES',exact:true }).click();await dialog.getByRole('button',{ name:'Equip HYPERION X',exact:true }).click()
  await dialog.getByRole('tab',{ name:'PISTOL slot' }).click();await dialog.getByRole('button',{ name:'Equip VOLT-3',exact:true }).click()
  await dialog.getByRole('tab',{ name:'MELEE slot' }).click();await dialog.getByRole('button',{ name:'Equip GRAVITY BREAKER',exact:true }).click()
  await dialog.getByRole('button',{ name:'Equip SPECTRAL SMOKE',exact:true }).click()
  await dialog.getByRole('button',{ name:/SAVE & RETURN/ }).click()
  await expect(dialog).toHaveCount(0);await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
  expect((await state(page)).loadout).toMatchObject({ character:'ion',primary:'hyperion',secondary:'volt',melee:'gravity',unique:'smoke' })
  expect((await state(page)).generation).toBe(before.generation);expect((await state(page)).weapon).toBe('hyperion')
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('duel-loadout-bank')))
  expect(saved.activeSlot).toBe(1)
  expect(saved.slots[1]).toMatchObject({character:'ion',primary:'hyperion',secondary:'volt',melee:'gravity',unique:'smoke'})
  const after=await position(page);expect(Math.hypot(...after.map((n,i)=>n-p[i]))).toBeLessThan(0.25)
  expect((await state(page)).training.aim.active).toBe(true)
  await aim(page,21);await fire(page)
  await expect.poll(async ()=>(await state(page)).training.aim.hits).toBe(1)
  expect((await state(page)).killCombo).toBe(0)
  await expect.poll(async ()=>(await state(page)).targets[21].hp).toBe(1)
  expect(await page.evaluate(async ()=> {
    const path=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const { _roots }=await import(path),scene=_roots.get(document.querySelector('canvas')).store.getState().scene
    let count=0;scene.traverse(object=> { if(object.name.startsWith('reflex-target-') && object.visible) count++ });return count
  })).toBe(1)
  await page.screenshot({ path:'training-reflex-preview.png' })
  await page.keyboard.press('KeyB');await expect(dialog).toBeVisible()
  await dialog.getByRole('button',{ name:'Select RAZE',exact:true }).click()
  await dialog.getByRole('button',{ name:'CANCEL / RETURN TO TRAINING',exact:true }).click()
  expect((await state(page)).loadout.character).toBe('ion')
  await page.keyboard.press('KeyB');await expect(dialog).toBeVisible()
  await page.keyboard.press('KeyB');await expect(dialog).toHaveCount(0)
  await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
  await page.evaluate(()=>document.exitPointerLock())
  await page.getByRole('button',{ name:'RESTART TRAINING',exact:true }).click()
  expect((await state(page)).loadout.character).toBe('ion')
  expect((await state(page)).trainingBank.activeSlot).toBe(1)
  await page.getByRole('button',{name:'RETURN TO MAIN MENU',exact:true}).click()
  await page.getByRole('button',{name:/^CHARACTER & LOADOUT/}).click()
  const presets=page.getByRole('dialog',{name:'CHARACTER & LOADOUT',exact:true})
  await expect(presets.getByRole('button',{name:'Loadout slot 2',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(presets.getByRole('tab',{name:'PRIMARY slot'})).toContainText('HYPERION X')
  await presets.getByRole('button',{name:'BACK',exact:true}).click()
  await page.reload()
  await page.getByRole('button',{name:/ENTER TRAINING/}).click()
  expect((await state(page)).loadout).toMatchObject(saved.slots[1])
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('duel-loadout-bank')))).toEqual(saved)
  expect(errors).toEqual([])
})

test('training ammo mode applies to both guns, cancels reloads, survives refresh and supports returning to normal magazines',async ({ page })=> {
  test.setTimeout(90000)
  await start(page);await page.keyboard.press('KeyB')
  const dialog=page.getByRole('dialog',{ name:'FIELD ARMORY',exact:true })
  await dialog.getByLabel('Training ammo').selectOption('unlimited')
  await dialog.getByRole('button',{ name:/SAVE & RETURN/ }).click()
  await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
  await expect.poll(async ()=>{ const s=await state(page);return s.time>=s.attackReadyAt }).toBe(true)
  await page.mouse.down();await expect.poll(async ()=>(await state(page)).shot,{timeout:15000}).toBeGreaterThan(8);await page.mouse.up()
  expect((await state(page)).magazines.rifle).toBe(30)
  await page.keyboard.press('KeyR');expect((await state(page)).reloading).toBe(false)
  await equipWeapon(page,'pistol');await fire(page);expect((await state(page)).magazines.pistol).toBe(15)
  await page.keyboard.press('KeyB');await dialog.getByLabel('Training ammo').selectOption('normal')
  await dialog.getByRole('button',{ name:'CANCEL / RETURN TO TRAINING' }).click()
  expect((await state(page)).trainingOptions.noReload).toBe(true)
  await page.keyboard.press('KeyB');await dialog.getByLabel('Training ammo').selectOption('normal')
  await dialog.getByRole('button',{ name:/SAVE & RETURN/ }).click()
  // An automatic rifle may fire more than once between browser mouse commands.
  // Normal mode must consume ammunition and leave a partial magazine to reload.
  await fire(page)
  expect((await state(page)).magazines.rifle).toBeLessThan(30)
  expect((await state(page)).magazines.rifle).toBeGreaterThan(0)
  await page.keyboard.press('KeyR');expect((await state(page)).reloading).toBe(true)
  await page.evaluate(()=>document.exitPointerLock());await page.getByRole('button',{ name:'SETTINGS',exact:true }).click()
  await page.getByLabel('Training ammo').selectOption('unlimited')
  expect((await state(page)).reloading).toBe(false)
  await page.reload();await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  expect((await state(page)).trainingOptions.noReload).toBe(true)
})

test('VEX gains real movement speed and uses a double-distance dash during its ten-second ultimate',async ({ page })=> {
  test.setTimeout(60000)
  await start(page);await page.keyboard.down('KeyW');await page.waitForTimeout(500)
  const sample=()=>page.evaluate(async ()=> {
    const path=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/runtime.js')?.name || '/src/game/runtime.js'
    const { runtime }=await import(path)
    return { p:[...runtime.position],time:performance.now()/1000 }
  })
  const a=await sample();await page.waitForTimeout(500);const b=await sample()
  await page.keyboard.press('KeyX');await page.waitForTimeout(400)
  const c=await sample();await page.waitForTimeout(500);const d=await sample()
  await page.keyboard.up('KeyW');await page.waitForTimeout(350)
  const normal=(a.p[2]-b.p[2])/(b.time-a.time),boost=(c.p[2]-d.p[2])/(d.time-c.time)
  expect(boost/normal,JSON.stringify({ a,b,c,d,normal,boost })).toBeGreaterThan(1.3);expect(boost/normal).toBeLessThan(1.75)
  const before=await position(page);await page.keyboard.press('KeyE');await page.waitForTimeout(500)
  const after=await position(page);expect(before[2]-after[2]).toBeGreaterThan(7);expect(before[2]-after[2]).toBeLessThan(7.5)
  expect((await state(page)).abilities.ultimate.activeUntil-(await state(page)).abilities.ultimate.startedAt).toBe(10)
})

test('rear course pauses real moving robots and left course only fires after explicit activation',async ({ page })=> {
  test.setTimeout(100000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await start(page);await lookAt(page,0,0)
  await moveUntil(page,'KeyS',2,22,1)
  await expect(page.getByTestId('training-course')).toContainText('TRACKING BAY')
  const before=(await state(page)).targets[10].motionTime;await page.waitForTimeout(450)
  expect((await state(page)).targets[10].motionTime).toBeGreaterThan(before)
  await page.keyboard.press('KeyG');const paused=(await state(page)).targets[10].motionTime
  await page.waitForTimeout(450);expect((await state(page)).targets[10].motionTime).toBe(paused)
  await lookAt(page,Math.PI,0);await page.screenshot({ path:'training-tracking-preview.png' });await lookAt(page,0,0)
  await moveUntil(page,'KeyW',2,0,-1);await moveUntil(page,'KeyA',0,-22,-1)
  await moveUntil(page,'KeyW',2,-9,-1)
  await expect(page.getByTestId('training-course')).toContainText('ROBOTS DISARMED')
  await page.waitForTimeout(1500);expect((await state(page)).hp).toBe(100)
  await page.keyboard.press('KeyG')
  await expect.poll(async ()=>(await state(page)).training.combat.active).toBe(true)
  await expect.poll(async ()=>(await state(page)).hp).toBeLessThan(100)
  expect((await state(page)).training.combat.shots).toBeGreaterThan(0)
  await lookAt(page,Math.PI/2,0);await page.screenshot({ path:'training-combat-preview.png' })
  await page.keyboard.press('KeyG');const hp=(await state(page)).hp
  await page.waitForTimeout(1700);expect((await state(page)).hp).toBe(hp)
  expect(errors).toEqual([])
})
