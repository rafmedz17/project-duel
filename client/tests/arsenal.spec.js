import { test,expect } from '@playwright/test'
import { equipWeapon, state,presetLoadout,lookAt,moveUntil,aimAtTarget,observeHitFeedback,observedFeedback } from './helpers.js'
import { WEAPONS,WEAPON_IDS } from '../../shared/weapons.js'

async function start(page,gear) {
  await presetLoadout(page,gear);await page.goto('/')
  await page.getByRole('button',{ name:/SETTINGS/ }).click();await page.getByRole('tab',{ name:'Graphics',exact:true }).click();await page.getByLabel('Render quality').selectOption('Low')
  await page.getByRole('button',{ name:'BACK' }).click();await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async ()=>(await state(page)).mode).toBe('playing')
  await equipWeapon(page,gear.startingWeapon || gear.primary || 'rifle')
}
const shot=async page=>{ await page.mouse.down();await page.mouse.up() }
async function model(page,name) {
  return page.evaluate(async name=> {
    const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js'))?.name
    if(!url)return null
    const { _roots }=await import(url)
    const scenes=[..._roots.values()].map(root=>root.store.getState().scene)
    const equipped=scenes.map(scene=>scene.getObjectByName('first-person-weapon')).find(Boolean)
    const object=equipped?.getObjectByName(name) || scenes.map(scene=>scene.getObjectByName(name)).find(Boolean)
    return object ? { rotation:object.rotation.toArray().slice(0,3),position:object.position.toArray(),children:object.children.length,visible:object.visible } : null
  },name)
}
test('all 17 arsenal models and stats are selectable; pistol and melee choices persist',async ({ page })=> {
  test.setTimeout(120000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/');await page.getByRole('button',{ name:/^CHARACTER & LOADOUT/ }).click()
  const dialog=page.getByRole('dialog'),labels={ RIFLE:'ASSAULT RIFLES',SNIPER:'SNIPER RIFLES',SMG:'SUBMACHINE GUNS',LMG:'LIGHT MACHINE GUNS',SHOTGUN:'SHOTGUNS' }
  for(const id of WEAPON_IDS) {
    const w=WEAPONS[id]
    await dialog.getByRole('tab',{ name:w.slot==='1' ? 'PRIMARY slot' : w.slot==='2' ? 'PISTOL slot' : 'MELEE slot' }).click()
    if(w.slot==='1')await dialog.getByRole('button',{ name:labels[w.category],exact:true }).click()
    await dialog.getByRole('button',{ name:`Equip ${w.name}`,exact:true }).click()
    await expect(dialog.getByRole('region',{ name:`${w.name} weapon details` })).toBeVisible()
    await expect.poll(()=>model(page,`model-${w.model}`)).not.toBeNull()
    await dialog.getByRole('button',{ name:'PREVIEW FIRE',exact:true }).click()
    if(['omega','gravity','fangs','hyperion'].includes(id))await dialog.screenshot({ path:`arsenal-${id}-preview.png` })
  }
  await dialog.getByRole('tab',{ name:'PRIMARY slot' }).click();await dialog.getByRole('button',{ name:'LIGHT MACHINE GUNS',exact:true }).click();await dialog.getByRole('button',{ name:'Equip OMEGA-88',exact:true }).click()
  await dialog.getByRole('tab',{ name:'PISTOL slot' }).click();await dialog.getByRole('button',{ name:'Equip MAGNUS-45',exact:true }).click()
  await dialog.getByRole('tab',{ name:'MELEE slot' }).click();await dialog.getByRole('button',{ name:'Equip VOID FANGS',exact:true }).click()
  await dialog.getByRole('button',{ name:/SAVE & EQUIP/ }).click();await page.reload()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click();await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  expect((await state(page)).loadout).toMatchObject({ primary:'omega',secondary:'magnus',melee:'fangs' })
  await page.keyboard.press('Digit3');await expect.poll(async ()=>(await state(page)).weapon).toBe('fangs')
  await expect.poll(()=>model(page,'model-fangs')).not.toBeNull()
  expect((await model(page,'first-person-weapon')).position.every(Number.isFinite)).toBe(true)
  expect(errors).toEqual([])
})
test('rifle and pistol bursts complete once per click and use their selected magazines',async ({ page })=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await start(page,{ primary:'astral',secondary:'volt',startingWeapon:'astral' });await lookAt(page,0,0.4)
  await shot(page);await expect.poll(async ()=>(await state(page)).shot).toBe(3)
  expect((await state(page)).magazines.astral).toBe(24)
  await page.waitForTimeout(500);await page.mouse.down();await page.waitForTimeout(700);await page.mouse.up()
  expect((await state(page)).shot).toBe(6)
  await page.keyboard.press('Digit2');await page.waitForTimeout(350);await shot(page)
  await expect.poll(async ()=>(await state(page)).magazines.volt).toBe(21)
  expect(errors).toEqual([])
})
test('rotary spin-up animates before firing, empties the drum and reloads with visible cell movement',async ({ page })=> {
  test.setTimeout(60000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await start(page,{ primary:'omega',startingWeapon:'omega' });await lookAt(page,0,0.4)
  // Sample rendered motion in the browser so automation round trips cannot miss
  // the cell-drop portion of a real reload on a busy software WebGL renderer.
  await page.evaluate(async()=> {
    const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const { _roots }=await import(url),scene=_roots.get(document.querySelector('canvas')).store.getState().scene
    window.__omegaReload={ minimum:0,samples:0 };const started=performance.now()
    const sample=()=> { const cell=scene.getObjectByName('first-person-weapon')?.getObjectByName('reload-energy-cell');if(cell) { window.__omegaReload.minimum=Math.min(window.__omegaReload.minimum,cell.position.y);window.__omegaReload.samples++ };if(performance.now()-started<30000) requestAnimationFrame(sample) }
    requestAnimationFrame(sample)
  })
  await page.mouse.down()
  await expect(page.getByRole('status').filter({ hasText:'SPINNING UP' })).toBeVisible()
  await expect.poll(async ()=>(await state(page)).shot).toBeGreaterThan(0)
  // Automatic fire advances with rendered simulation frames; software WebGL can
  // take longer than real-time to consume the full 100-round drum.
  await expect.poll(async ()=>(await state(page)).magazines.omega,{ timeout:25000 }).toBe(0)
  await page.mouse.up();await expect(page.getByRole('progressbar',{ name:'Reload progress' })).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>window.__omegaReload.minimum)).toBeLessThan(-0.15)
  await page.screenshot({ path:'omega-reload-preview.png' })
  await expect.poll(async ()=>(await state(page)).magazines.omega,{ timeout:6000 }).toBe(100)
  const shots=(await state(page)).shot;await page.waitForTimeout(400);expect((await state(page)).shot).toBe(shots)
  expect(errors).toEqual([])
})
test('heavy melee has a visible wind-up, a validated impact and robot knockback',async ({ page })=> {
  await start(page,{ melee:'gravity',startingWeapon:'gravity' })
  expect((await model(page,'first-person-weapon')).position.every(Number.isFinite)).toBe(true)
  await lookAt(page,0,0);await moveUntil(page,'KeyW',2,-12.8,-1);await moveUntil(page,'KeyA',0,-0.9,-1);await moveUntil(page,'KeyW',2,-14.3,-1)
  await aimAtTarget(page);await observeHitFeedback(page);await shot(page)
  await expect(page.getByRole('status').filter({ hasText:'GRAVITY CORE CHARGING' })).toBeVisible()
  await expect.poll(async ()=>(await state(page)).targets[1].hp).toBe(15)
  expect((await state(page)).targets[1].offsetZ).toBeLessThan(-0.5)
  await expect.poll(async ()=>(await observedFeedback(page))?.damage).toBe(85)
  await page.screenshot({ path:'gravity-impact-preview.png' })
})
test('RAILBREAKER scope and real thin-panel shots use penetration, while a pistol stays blocked',async ({ page })=> {
  await start(page,{ primary:'railbreaker',startingWeapon:'railbreaker' })
  await lookAt(page,0,0);await moveUntil(page,'KeyD',0,12,1);await moveUntil(page,'KeyW',2,4,-1)
  await aimAtTarget(page,3);await page.mouse.down({ button:'right' })
  await expect(page.getByLabel('Precision scope')).toBeVisible()
  await shot(page);await expect.poll(async ()=>(await state(page)).targets[3].hp).toBe(23)
  await page.mouse.up({ button:'right' });await page.keyboard.press('Digit2');await page.waitForTimeout(350)
  await aimAtTarget(page,3);await shot(page);expect((await state(page)).targets[3].hp).toBe(23)
})
