import {test,expect} from '@playwright/test'
import {openGame,enterTraining,presetLoadout,equipWeapon,state} from './helpers.js'

async function inspect(page) {
  return page.evaluate(async()=>{
    const path=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const {_roots}=await import(path),{scene,camera,size}=_roots.get(document.querySelector('canvas')).store.getState()
    const root=scene.getObjectByName('first-person-weapon'),cylinder=root.getObjectByName('revolver-cylinder'),cell=root.getObjectByName('reload-energy-cell'),sight=root.getObjectByName('mythic-iron-sight'),zero=root.getObjectByName('iron-sight-zero')
    const aim=camera.position.clone();zero?.getWorldPosition(aim).project(camera)
    let finite=true;root.traverse(node=>{finite&&=node.position.toArray().every(Number.isFinite)})
    return {bullpup:Boolean(root.getObjectByName('astral-bullpup-receiver')),magazineZ:cell?.parent.position.z,gripZ:root.getObjectByName('weapon-grip-right')?.position.z,scale:sight?.scale.x,zero:zero ? Math.hypot(aim.x*size.width/2,aim.y*size.height/2) : null,cylinder:cylinder ? {chambers:cylinder.userData.chambers,angle:cylinder.rotation.z,swing:cell.position.x} : null,finite}
  })
}

test('Astral has a rear magazine and centered smaller hologram; Magnus fires and reloads as an eight-chamber revolver',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
  await presetLoadout(page,{primary:'astral',secondary:'magnus'})
  await openGame(page);await enterTraining(page)
  let view=await inspect(page)
  expect(view.bullpup).toBe(true);expect(view.magazineZ).toBeGreaterThan(view.gripZ)
  expect(view.scale).toBe(.92)
  await page.mouse.down({button:'right'})
  await expect.poll(async()=>(await inspect(page)).zero).toBeLessThan(3)
  await page.mouse.click(640,400)
  await expect.poll(async()=>(await state(page)).magazines.astral).toBe(24)
  await page.mouse.up({button:'right'})
  await equipWeapon(page,'magnus')
  view=await inspect(page);expect(view.cylinder.chambers).toBe(8)
  await page.mouse.click(640,400)
  await expect.poll(async()=>(await state(page)).magazines.magnus).toBe(7)
  await expect.poll(async()=>Math.abs((await inspect(page)).cylinder.angle+Math.PI)).toBeLessThan(.01)
  await page.keyboard.press('KeyR')
  await expect.poll(async()=>(await inspect(page)).cylinder.swing).toBeLessThan(-.14)
  await expect.poll(async()=>(await state(page)).magazines.magnus).toBe(8)
  await expect.poll(async()=>Math.abs((await inspect(page)).cylinder.swing)).toBeLessThan(.001)
  expect((await inspect(page)).finite).toBe(true)
  await page.screenshot({path:'magnus-revolver-preview.png'})
  expect(errors).toEqual([])
})
