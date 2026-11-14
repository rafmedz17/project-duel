import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import {state,position,lookAt,moveUntil,aimAtTarget, openGame,reloadGame,openMultiplayer} from './helpers.js'

const settings=async page=> { await page.getByRole('button',{ name:/^.*SETTINGS/,exact:false }).first().click();return page.getByRole('dialog',{ name:'SETTINGS',exact:true }) }
const tab=async(page,name)=>page.getByRole('tab',{ name,exact:true }).click()
const rebind=async(page,name,key)=> { await page.getByRole('button',{ name:`Rebind ${name}`,exact:true }).click();await page.keyboard.press(key) }
const enter=async page=> { await page.getByRole('button',{ name:/ENTER TRAINING/ }).click();await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click();await expect.poll(async()=>(await state(page)).mode).toBe('playing') }
const camera=page=>page.evaluate(async()=> { const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name;const { _roots }=await import(url);const { camera,scene }=_roots.get(document.querySelector('canvas')).store.getState();let aura=null;scene.traverse(mesh=> { if(mesh.name==='enemy-aura') aura={ color:mesh.material.color.getHexString(),depthTest:mesh.material.depthTest } });return { fov:camera.fov,aura } })
const sound=page=>page.evaluate(async()=> { const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/audio/synth.js').name;return (await import(url)).audio.diagnostics() })

test('unified settings persist every category, edit crosshair and swap conflicting bindings',async({ page })=> {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await openGame(page,'/')
  await expect(page.getByRole('button',{ name:/^CONTROLS/ })).toHaveCount(0)
  const dialog=await settings(page)
  await expect(dialog.getByRole('tab')).toHaveCount(5)
  for(const name of ['General','Sensitivity','Controls','Graphics','Audio']) await expect(dialog.getByRole('tab',{name,exact:true})).toBeInViewport({ratio:1})
  await expect(page.getByLabel('Mouse sensitivity')).toHaveCount(0)
  await tab(page,'Sensitivity');await page.getByLabel('Mouse sensitivity').fill('1.7');await page.getByLabel('Rifle ADS sensitivity',{exact:true}).fill('0.65');await page.getByLabel('Sniper firing sensitivity',{exact:true}).fill('0.4')
  await page.getByRole('dialog',{name:'SETTINGS',exact:true}).screenshot({path:'settings-sensitivity-preview.png'})
  await tab(page,'General');await page.getByLabel('Field of view').fill('94');await page.getByLabel('Show FPS counter').check()
  await page.getByLabel('Scope input').selectOption('tap');await page.getByLabel('Damage style').selectOption('stacked');await page.getByLabel('Damage opacity').fill('0.4');await page.getByLabel('Crosshair shape').selectOption('circle');await page.getByLabel('Crosshair size').fill('16');await page.getByLabel('Crosshair gap').fill('7')
  await tab(page,'Controls');await rebind(page,'Move forward','KeyS')
  await expect(page.getByRole('button',{ name:'Rebind Move backward',exact:true })).toHaveText('W')
  await rebind(page,'Dash','KeyV');await page.getByRole('button',{ name:'Rebind Reload',exact:true }).click();await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible();await expect(page.getByRole('button',{ name:'Rebind Reload',exact:true })).toHaveText('R')
  await tab(page,'Graphics');await page.getByLabel('Render quality').selectOption('Low');await page.getByLabel('Flashbang color').selectOption('black');await page.getByLabel('Enemy aura color').fill('#00ff99')
  await tab(page,'Audio');await page.getByLabel('General audio').fill('0.6');await page.getByLabel('Sound effects').fill('0.3');await page.getByLabel('Background music').fill('0.2')
  await page.getByRole('button',{ name:'SAVE ON DEVICE',exact:true }).click();await expect(page.getByRole('status')).toHaveText('Settings saved on this device.')
  await reloadGame(page);await settings(page)
  await expect(page.getByLabel('Field of view')).toHaveValue('94');await expect(page.getByLabel('Scope input')).toHaveValue('tap');await expect(page.getByLabel('Damage style')).toHaveValue('stacked')
  await tab(page,'Sensitivity');await expect(page.getByLabel('Mouse sensitivity')).toHaveValue('1.7');await expect(page.getByLabel('Rifle ADS sensitivity',{exact:true})).toHaveValue('0.65');await expect(page.getByLabel('Sniper firing sensitivity',{exact:true})).toHaveValue('0.4')
  await tab(page,'Controls');await expect(page.getByRole('button',{ name:'Rebind Dash',exact:true })).toHaveText('V')
  await tab(page,'Graphics');await page.getByRole('dialog',{ name:'SETTINGS',exact:true }).screenshot({ path:'settings-graphics-preview.png' })
  await expect(page.getByLabel('Enemy aura color')).toHaveValue('#00ff99');await page.getByRole('button',{ name:'BACK →',exact:true }).click();await enter(page)
  await expect.poll(async()=>(await camera(page)).fov).toBeGreaterThan(93)
  await expect.poll(async()=>(await camera(page)).aura?.color).toBe('00ff99');expect((await camera(page)).aura.depthTest).toBe(true)
  expect(errors).toEqual([])
})

test('remapped movement, weapon, mouse ability, tap scope and FOV work in training',async({ page })=> {
  await openGame(page,'/');await settings(page);await page.getByLabel('Scope input').selectOption('tap');await page.getByLabel('Field of view').fill('90')
  await tab(page,'Graphics');await page.getByLabel('Render quality').selectOption('Low')
  await tab(page,'Controls');await rebind(page,'Move forward','KeyI');await rebind(page,'Secondary pistol','KeyO');await rebind(page,'Training armory','KeyH')
  await page.getByRole('button',{ name:'Rebind Dash',exact:true }).click();await page.mouse.click(100,100,{ button:'middle' })
  await expect(page.getByRole('button',{ name:'Rebind Dash',exact:true })).toHaveText('MIDDLE CLICK')
  await page.getByRole('button',{ name:'BACK →',exact:true }).click();await enter(page)
  const p=await position(page);await page.keyboard.down('KeyI');await page.waitForTimeout(400);await page.keyboard.up('KeyI');expect((await position(page))[2]).toBeLessThan(p[2]-.5)
  const stopped=await position(page);await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');expect(Math.abs((await position(page))[2]-stopped[2])).toBeLessThan(.6)
  await page.mouse.click(640,400,{ button:'right' });await expect(page.getByTestId('reflex-sight')).toBeVisible();expect((await state(page)).aiming).toBe(true)
  await page.mouse.click(640,400,{ button:'right' });await expect(page.getByTestId('reflex-sight')).toHaveCount(0);await expect.poll(async()=>(await camera(page)).fov).toBeGreaterThan(89)
  await page.mouse.click(640,400,{ button:'middle' });expect((await state(page)).abilities.dash.uses).toBe(1);await expect(page.getByTestId('ability-dash')).toContainText('MIDDLE CLICK')
  await page.keyboard.press('KeyO');await expect.poll(async()=>(await state(page)).weapon).toBe('pistol')
  await page.keyboard.press('KeyH');await expect(page.getByRole('dialog',{ name:'FIELD ARMORY' })).toBeVisible()
})

test('black flashbang keeps its blind duration and audio mixers independently mute effects and music',async({ page })=> {
  await openGame(page,'/');await settings(page);await tab(page,'Graphics');await page.getByLabel('Render quality').selectOption('Low');await page.getByLabel('Flashbang color').selectOption('black')
  await tab(page,'Audio');await expect.poll(async()=>(await sound(page)).musicPlaying).toBe(true)
  await page.getByLabel('Sound effects').fill('0');await expect(page.getByRole('button',{ name:'TEST AUDIO' })).toBeDisabled();expect((await sound(page)).musicPlaying).toBe(true)
  await page.getByLabel('Background music').fill('0');await expect.poll(async()=>(await sound(page)).musicPlaying).toBe(false)
  await page.getByLabel('Sound effects').fill('0.8');await page.getByRole('button',{ name:'TEST AUDIO' }).click();await expect(page.getByRole('status')).toHaveText('Audio test played.')
  await page.getByRole('button',{ name:'BACK →',exact:true }).click();await enter(page);await lookAt(page,0,-1.2);await page.keyboard.press('KeyC')
  await expect(page.getByTestId('flash-screen')).toBeVisible();await expect(page.getByTestId('flash-screen')).toHaveCSS('background-color','rgb(0, 0, 0)')
  expect((await state(page)).flashUntil-(await state(page)).flashStarted).toBeGreaterThan(0)
})

test('damage opacity and stacked totals use real hits while disabling numbers preserves the hit marker',async({ page })=> {
  await openGame(page,'/');await settings(page);await page.getByLabel('Damage style').selectOption('stacked');await page.getByLabel('Damage opacity').fill('0.4');await tab(page,'Graphics');await page.getByLabel('Render quality').selectOption('Low');await page.getByRole('button',{ name:'BACK →',exact:true }).click();await enter(page)
  await moveUntil(page,'KeyW',2,-23,-1);await aimAtTarget(page,5)
  await page.evaluate(()=> { window.__damage=[];new MutationObserver(()=> { const el=document.querySelector('[data-testid="damage-numbers"]');if(el) window.__damage.push({ text:el.textContent,opacity:getComputedStyle(el).opacity,style:el.dataset.style }) }).observe(document.body,{ subtree:true,childList:true,characterData:true }) })
  await page.mouse.down();await page.waitForTimeout(550);await page.mouse.up()
  const feed=await page.evaluate(()=>window.__damage);expect(feed.some(h=>h.style==='stacked' && h.opacity==='0.4')).toBe(true)
  expect(feed.some(h=>Number.parseInt(h.text)>24)).toBe(true)
  await page.evaluate(()=>document.exitPointerLock());await settings(page);await page.getByLabel('Damage numbers',{ exact:true }).uncheck();await page.getByRole('button',{ name:'BACK →',exact:true }).click();await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click();await aimAtTarget(page,6)
  await page.mouse.down();await page.mouse.up();await expect(page.getByTestId('hit-feedback').locator('.hit-strokes i').first()).toBeVisible();await expect(page.getByTestId('damage-numbers')).toHaveCount(0)
})

test('multiplayer keeps running on tab switch, clears held fire and opens settings only on Escape',async({ page,context })=> {
  let peer
  try {
    await openGame(page,'/');await settings(page);await page.getByLabel('Scope input').selectOption('tap');await tab(page,'Controls');await rebind(page,'Reload','KeyL');await page.getByRole('button',{ name:'BACK →',exact:true }).click()
    await openMultiplayer(page,'casual','Settings Pilot');peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{ name:'Background Peer' });peer.onMessage('shot-trail',()=>{})
    await page.getByLabel('Match format').selectOption('freeplay');peer.send('ready',{ ready:true });await page.getByRole('button',{ name:'READY UP',exact:true }).click();await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    await expect.poll(()=>page.evaluate(()=>Boolean(document.pointerLockElement))).toBe(true)
    await expect.poll(()=>[...peer.state.players.values()].every(p=>p.grounded)).toBe(true)
    await page.mouse.click(640,400,{ button:'right' });await expect(page.getByTestId('reflex-sight')).toBeVisible();await page.mouse.click(640,400,{ button:'right' })
    await page.mouse.click(640,400);await page.keyboard.press('KeyL');await expect(page.getByRole('progressbar',{ name:'Reload progress' })).toBeVisible();await expect(page.getByRole('progressbar',{ name:'Reload progress' })).toHaveCount(0,{ timeout:5000 })
    await page.mouse.down();await page.keyboard.down('KeyW')
    const started=peer.state.tick,other=context.newPage();const tabPage=await other;await tabPage.goto('about:blank');await tabPage.bringToFront();await page.waitForTimeout(1200)
    const host=[...peer.state.players.values()].find(p=>p.id!==peer.sessionId),ammo=host.rifleAmmo,x=host.x,z=host.z
    await page.waitForTimeout(450);expect(peer.state.tick).toBeGreaterThan(started+10);expect(host.rifleAmmo).toBe(ammo);expect(Math.hypot(host.x-x,host.z-z)).toBeLessThan(.2)
    await page.evaluate(()=> { document.dispatchEvent(new KeyboardEvent('keyup',{ code:'KeyW' }));document.dispatchEvent(new MouseEvent('mouseup',{ button:0 })) })
    await page.bringToFront();await expect(page.getByRole('dialog',{ name:'SHARED ARENA' })).toHaveCount(0);await expect(page.getByRole('button',{ name:/MATCH LIVE/ })).toBeVisible()
    await page.getByRole('button',{ name:/MATCH LIVE/ }).click();await expect.poll(()=>page.evaluate(()=>Boolean(document.pointerLockElement))).toBe(true);await page.keyboard.up('KeyW');await page.mouse.up()
    await page.keyboard.press('Escape');await page.evaluate(()=>document.exitPointerLock());await expect(page.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible();await page.getByRole('button',{ name:'SETTINGS',exact:true }).click();await expect(page.getByRole('dialog',{ name:'SETTINGS',exact:true })).toBeVisible();await tabPage.close()
  } finally { await peer?.leave() }
})
