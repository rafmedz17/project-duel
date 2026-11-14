import {test,expect} from '@playwright/test'
import {openGame,state,position} from './helpers.js'

test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
})

test('one training click captures the mouse and starts play; Escape offers Resume only',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page)
  await page.getByRole('button',{name:/ENTER TRAINING/}).click()
  await expect.poll(async()=>{const s=await state(page);return s.ready && s.mode==='playing'},{timeout:20000}).toBe(true)
  expect(await page.evaluate(()=>document.pointerLockElement===document.querySelector('canvas'))).toBe(true)
  await expect(page.getByRole('heading',{name:'READY TO DEPLOY'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'RESUME',exact:true})).toHaveCount(0)
  const initial=await position(page)
  await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW')
  await expect.poll(async()=>(await position(page))[2]).toBeLessThan(initial[2]-.3)
  await page.keyboard.press('Escape');await page.evaluate(()=>document.exitPointerLock())
  await expect(page.getByRole('button',{name:'RESUME',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'SIMULATION PAUSED'})).toBeVisible()
  await page.screenshot({path:'training-resume-preview.png'})
  await page.getByRole('button',{name:'RESUME',exact:true}).click()
  await expect.poll(async()=>(await state(page)).mode).toBe('playing')
  await expect(page.getByRole('button',{name:'RESUME',exact:true})).toHaveCount(0)
  expect(errors).toEqual([])
})

test('blocked initial mouse capture shows a retryable Resume button',async({page})=>{
  await page.addInitScript(()=>{
    const capture=Element.prototype.requestPointerLock
    let first=true
    Element.prototype.requestPointerLock=function(...args){
      if(first) {first=false;return Promise.reject(new Error('Capture denied by browser'))}
      return capture.apply(this,args)
    }
  })
  await openGame(page)
  await page.getByRole('button',{name:/ENTER TRAINING/}).click()
  await expect(page.getByRole('alert')).toContainText('Mouse capture was blocked')
  await expect(page.getByRole('button',{name:'RESUME',exact:true})).toBeEnabled({timeout:20000})
  await page.getByRole('button',{name:'RESUME',exact:true}).click()
  await expect.poll(async()=>(await state(page)).mode).toBe('playing')
  expect(await page.evaluate(()=>Boolean(document.pointerLockElement))).toBe(true)
})
