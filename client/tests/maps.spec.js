import {openGame,openMultiplayer} from './helpers.js'
import {test,expect} from '@playwright/test'
import {Client} from '@colyseus/sdk'

test('host selects both new maps; players share the map, move, and return to change it',async({page})=>{
  test.setTimeout(90000)
  // A socket peer verifies replication without a second software-rendered arena.
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const snapshot=()=>page.evaluate(async()=>{
    const path='/src/multiplayer/lobby.js',url=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname===path)?.name || path
    return (await import(url)).lobby.get()
  })
  await openGame(page);await openMultiplayer(page,'casual','Nova')
  const code=await page.getByTestId('invite-code').textContent()
  const peer=await new Client('http://127.0.0.1:2567').joinById(code,{name:'Echo'})
  peer.onMessage('loadout-bank',()=>{});peer.onMessage('shot-trail',()=>{})
  try {
    await expect(page.getByTestId('lobby-slot-1')).toContainText('Echo')
    await page.getByLabel('Match format').selectOption('freeplay')
    await expect.poll(()=>peer.state.format).toBe('freeplay')
    for(const [mapId,name] of [['neon','NEON DISTRICT'],['orbital','ORBITAL STATION']]) {
      await page.getByLabel('Arena map').selectOption(mapId)
      await expect.poll(()=>peer.state.mapId).toBe(mapId)
      peer.send('ready',{ready:true})
      await page.getByRole('button',{name:'READY UP',exact:true}).click()
      await expect(page.getByText(/BOTH PLAYERS READY.*STARTING IN 5/)).toBeVisible()
      await expect(page.getByRole('button',{name:'START SHARED ARENA',exact:true})).toHaveCount(0)
      await expect(page.getByRole('dialog',{name:'SHARED ARENA'})).toBeVisible({timeout:15000})
      await expect(page.locator('.online-top')).toContainText(name)
      await page.getByRole('button',{name:'ENTER ARENA',exact:true}).click()
      await expect.poll(async()=>(await snapshot()).captured).toBe(true)
      const before=peer.state.players.get(peer.state.hostId).z
      await page.keyboard.down('KeyW');await page.waitForTimeout(600);await page.keyboard.up('KeyW')
      await expect.poll(()=>peer.state.players.get(peer.state.hostId).z).toBeLessThan(before-.2)
      await page.screenshot({path:`${mapId}-preview.png`})
      await page.keyboard.press('Escape');await page.evaluate(()=>document.exitPointerLock())
      await page.getByRole('button',{name:'RETURN TO LOBBY',exact:true}).click()
      await expect(page.getByRole('dialog',{name:'PRIVATE MULTIPLAYER'})).toBeVisible()
      await expect.poll(()=>peer.state.arenaActive).toBe(false)
    }
    expect(errors).toEqual([])
  } finally {await peer.leave().catch(()=>{})}
})
