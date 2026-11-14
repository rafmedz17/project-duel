import {test,expect} from '@playwright/test'
import {Client} from '@colyseus/sdk'
import {openGame,openMultiplayer,selectArenaMap} from './helpers.js'

async function arena(page) {
  return page.evaluate(async()=>{
    const fiberUrl=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const {_roots}=await import(fiberUrl),{scene,gl}=_roots.get(document.querySelector('canvas')).store.getState()
    const map=scene.getObjectByName('aether-spire')
    if(!map) return null
    let colliders=0,points=0,lights=0
    map.traverse(node=>{if(node.userData.coverSolid) colliders++;if(node.isPoints) points++;if(node.isPointLight) lights++})
    const foliage=map.getObjectByName('spire-blossoms')
    return {quality:map.userData.quality,colliders,points,lights,leaves:foliage.count,shadows:gl.shadowMap.enabled,fog:scene.fog.near,calls:gl.info.render.calls,triangles:gl.info.render.triangles}
  })
}

test('Aether Spire replicates through the lobby, plays online and scales graphics without changing collision',async({page,baseURL})=>{
  test.setTimeout(120000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
  await openGame(page);await openMultiplayer(page,'casual','Spire Pilot')
  const code=await page.getByTestId('invite-code').textContent()
  const multiplayer=new URL(baseURL).port==='5175' ? 'http://127.0.0.1:2570' : 'http://127.0.0.1:2567'
  const peer=await new Client(multiplayer).joinById(code,{name:'Spire Rival'})
  peer.onMessage('loadout-bank',()=>{});peer.onMessage('shot-trail',()=>{})
  try {
    await expect(page.getByTestId('lobby-slot-1')).toContainText('Spire Rival')
    await selectArenaMap(page,'spire')
    await expect.poll(()=>peer.state.mapId).toBe('spire')
    await expect(page.locator('.map-description')).toContainText('raised overlooks')
    await page.getByLabel('Match format').selectOption('freeplay')
    await expect.poll(()=>peer.state.format).toBe('freeplay')
    peer.send('ready',{ready:true})
    await page.getByRole('button',{name:'READY UP',exact:true}).click()
    await expect(page.locator('.online-top')).toContainText('AETHER SPIRE',{timeout:20000})
    await expect.poll(()=>arena(page),{timeout:20000}).not.toBeNull()
    const low=await arena(page)
    expect(low.lights).toBe(0);expect(low.points).toBe(0);expect(low.shadows).toBe(false)
    expect(low.colliders).toBeGreaterThan(60)
    const enter=page.getByRole('button',{name:'ENTER ARENA',exact:true})
    if(await enter.isVisible()) await enter.click()
    else await page.locator('canvas').click({position:{x:640,y:300}})
    const host=()=>peer.state.players.get(peer.state.hostId)
    await expect.poll(()=>host()?.grounded).toBe(true)
    const before=host().x
    await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW')
    await expect.poll(()=>host().x).toBeGreaterThan(before+.3)
    await page.screenshot({path:'spire-low-preview.png'})
    // Update the same persisted preference used by Settings, while in the arena.
    const setQuality=quality=>page.evaluate(async quality=>{
      const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.js').name
      const {game}=await import(url)
      game.set({settings:{...game.get().settings,quality}})
    },quality)
    await setQuality('High')
    await expect.poll(async()=>(await arena(page))?.quality).toBe('High')
    const high=await arena(page)
    expect(high.colliders).toBe(low.colliders);expect(high.lights).toBe(3)
    expect(high.points).toBe(1);expect(high.shadows).toBe(true);expect(high.leaves).toBeGreaterThan(low.leaves)
    await page.screenshot({path:'spire-high-preview.png'})
    await setQuality('Medium')
    await expect.poll(async()=>(await arena(page))?.quality).toBe('Medium')
    const medium=await arena(page)
    expect(medium.colliders).toBe(low.colliders);expect(medium.lights).toBe(1);expect(medium.shadows).toBe(false)
    await setQuality('Low')
    await expect.poll(async()=>(await arena(page))?.lights).toBe(0)
    expect((await arena(page)).colliders).toBe(low.colliders)
    expect(errors).toEqual([])
  } finally {await peer.leave().catch(()=>{})}
})
