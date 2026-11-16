import {test,expect} from '@playwright/test'
import {Client} from '@colyseus/sdk'
import {openGame,enterTraining,presetLoadout,state,lookAt,moveUntil,openMultiplayer,enterOnlineArena,equipWeapon} from './helpers.js'

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
})
async function sceneInfo(page,remoteId) {
  return page.evaluate(async remoteId=>{
    const path=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const {_roots}=await import(path),scene=_roots.get(document.querySelector('canvas')).store.getState().scene
    const remote=remoteId && scene.getObjectByName(`remote-player-${remoteId}`),guide=scene.getObjectByName('grenade-throw-guide')
    const smoke=scene.getObjectByName('billowing-smoke'),stun=scene.getObjectByName('stun-popcorn-sparks')
    const heads=[];scene.traverse(n=>{if(n.name==='flashed-head-effect' && n.visible) heads.push(n.name)})
    const shield=scene.getObjectByName('tactical-shield')
    return {guide:guide?.visible,landing:guide?.userData.landing,smoke:smoke?.visible,smokeCount:smoke?.count,stun:stun?.visible,heads:heads.length,remoteFlashed:remote?.getObjectByName('flashed-head-effect')?.visible,shieldPanels:shield?.children.length,shieldIsSphere:shield?.isMesh || false}
  },remoteId)
}
function watchErrors(page) {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text())});return errors
}
const sound=page=>page.evaluate(async()=>{
  const path='/src/audio/synth.js',url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
  return (await import(url)).audio.diagnostics()
})
test('hold previews a real bouncing throw, releasing flashes without text, and Q swaps weapon history',async({page})=>{
  const errors=watchErrors(page)
  await openGame(page);await enterTraining(page);await lookAt(page,0,-1.2)
  await page.keyboard.down('KeyC')
  await expect.poll(async()=>(await sceneInfo(page)).guide).toBe(true)
  expect((await state(page)).abilities.flashbang.uses).toBe(0)
  const landing=(await sceneInfo(page)).landing
  await page.screenshot({path:'flash-throw-guide-preview.png'})
  await page.keyboard.up('KeyC')
  await expect.poll(async()=>(await state(page)).abilities.flashbang.detonatedAt).toBeGreaterThan(0)
  const origin=(await state(page)).abilities.flashbang.origin
  expect(Math.hypot(...origin.map((v,i)=>v-landing[i]))).toBeLessThan(.1)
  await expect(page.getByTestId('flash-screen')).toBeVisible()
  await expect(page.getByTestId('flash-screen')).toHaveText('')
  await expect.poll(async()=>(await sound(page)).counts['flashbang-detonate'] || 0).toBe(1)
  await expect(page.getByTestId('flash-screen')).toHaveCount(0,{timeout:6000})
  await equipWeapon(page,'pistol');await equipWeapon(page,'blade')
  await page.keyboard.press('KeyQ');await expect.poll(async()=>(await state(page)).weapon).toBe('pistol')
  await expect.poll(async()=>{const s=await state(page);return s.time>=s.attackReadyAt}).toBe(true)
  await page.keyboard.press('KeyQ');await expect.poll(async()=>(await state(page)).weapon).toBe('blade')
  await page.evaluate(()=>{window.__dashSeen=false;new MutationObserver(()=>{if(document.querySelector('[data-testid="dash-slipstream"]')) window.__dashSeen=true}).observe(document.body,{childList:true,subtree:true})})
  await page.keyboard.press('KeyF');await page.keyboard.press('KeyE')
  await expect.poll(()=>page.evaluate(()=>window.__dashSeen)).toBe(true)
  await expect(page.locator('.shield-visor-panels')).toBeAttached()
  expect(errors).toEqual([])
})

test('actual flash detonation gives affected training robots an animated head indicator',async({page})=>{
  const errors=watchErrors(page)
  await openGame(page);await enterTraining(page)
  await moveUntil(page,'KeyW',2,-18,-1)
  await lookAt(page,0,0)
  await page.keyboard.press('KeyC')
  await expect.poll(async()=>(await sceneInfo(page)).heads).toBeGreaterThan(0)
  await page.screenshot({path:'flashed-enemy-head-preview.png'})
  await expect.poll(async()=>(await sceneInfo(page)).heads,{timeout:6000}).toBe(0)
  expect(errors).toEqual([])
})

for(const unique of ['smoke','stun']) test(`${unique} renders its enhanced burst on Low graphics`,async({page})=>{
  const errors=watchErrors(page)
  await presetLoadout(page,{unique})
  await openGame(page);await enterTraining(page);await lookAt(page,0,-.35)
  await page.keyboard.press('KeyC')
  await expect.poll(async()=>(await sceneInfo(page))[unique],{timeout:15000}).toBe(true)
  if(unique==='smoke') expect((await sceneInfo(page)).smokeCount).toBe(12)
  await page.screenshot({path:`${unique}-enhanced-preview.png`})
  await expect.poll(async()=>(await sound(page)).counts[`${unique}-detonate`] || 0).toBe(1)
  expect((await sound(page)).events.find(e=>e.name===`${unique}-detonate`).spatial).toBe(true)
  if(unique==='smoke') {
    await page.evaluate(async()=>{
      const path='/src/game/store.js',url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
      const {game}=await import(url);game.set({settings:{...game.get().settings,quality:'High'}})
    })
    await expect.poll(async()=>(await sceneInfo(page)).smokeCount).toBe(30)
  }
  expect(errors).toEqual([])
})

test('multiplayer previews grenades, swaps accepted history and shows an enemy flash status plus shield panels',async({page,baseURL})=>{
  const errors=watchErrors(page)
  await openGame(page);await openMultiplayer(page)
  const port=new URL(baseURL).port==='5180' ? 2590 : 2567
  const peer=await new Client(`http://127.0.0.1:${port}`).joinById(await page.getByTestId('invite-code').textContent(),{name:'Effects Rival'})
  peer.onMessage('loadout-bank',()=>{});peer.onMessage('shot-trail',()=>{})
  try {
    await page.getByLabel('Match format').selectOption('freeplay')
    peer.send('ready',{ready:true});await page.getByRole('button',{name:'READY UP',exact:true}).click()
    await enterOnlineArena(page)
    await page.keyboard.press('Digit3')
    const host=()=>peer.state.players.get(peer.state.hostId)
    await expect.poll(()=>host().weapon).toBe('blade')
    await expect.poll(()=>peer.state.time || peer.state.tick/60).toBeGreaterThan(host().attackReadyAt)
    await page.keyboard.press('KeyQ');await expect.poll(()=>host().weapon).toBe('rifle')
    expect(host().arsenal.previousWeapon).toBe('blade')
    await page.keyboard.down('KeyC');await expect.poll(async()=>(await sceneInfo(page)).guide).toBe(true)
    expect(host().abilities.get('flashbang').uses).toBe(0)
    // Losing capture cancels an unthrown grenade.
    await page.evaluate(()=>document.exitPointerLock());await page.keyboard.up('KeyC')
    expect(host().abilities.get('flashbang').uses).toBe(0)
    peer.send('combat',{action:'ability',ability:'flashbang',yaw:0,pitch:-1.3,epoch:peer.state.arenaEpoch,sequence:1})
    await expect.poll(async()=>(await sceneInfo(page,peer.sessionId)).remoteFlashed).toBe(true)
    peer.send('combat',{action:'ability',ability:'shield',epoch:peer.state.arenaEpoch,sequence:2})
    await expect.poll(()=>peer.state.players.get(peer.sessionId).shieldCharge).toBe(50)
    expect((await sceneInfo(page)).shieldIsSphere).toBe(false)
    expect((await sceneInfo(page)).shieldPanels).toBe(6)
    await page.screenshot({path:'multiplayer-flashed-shield-preview.png'})
    expect(errors).toEqual([])
  } finally {await peer.leave().catch(()=>{})}
})
