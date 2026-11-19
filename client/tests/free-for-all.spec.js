import {test,expect} from '@playwright/test'
import {Client} from '@colyseus/sdk'
import {openGame,openMultiplayer,enterOnlineArena,presetLoadout} from './helpers.js'

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
})
const network=page=>page.evaluate(async()=>{
  const path='/src/multiplayer/lobby.js',url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
  return (await import(url)).lobby.get()
})

test('Free for All results show the winner and all five finishing places',async({page})=>{
  await openGame(page)
  await page.evaluate(async()=>{
    const resources=performance.getEntriesByType('resource')
    const react=resources.find(e=>new URL(e.name).pathname.endsWith('/react.js')).name
    const dom=resources.find(e=>new URL(e.name).pathname.endsWith('/react-dom_client.js')).name
    const [reactModule,domModule,{default:Results}]=await Promise.all([import(react),import(dom),import('/src/multiplayer/FreeForAllHud.jsx')])
    const createElement=reactModule.createElement || reactModule.default.createElement,createRoot=domModule.createRoot || domModule.default.createRoot
    const element=document.createElement('div');document.body.append(element)
    const results=[15,12,9,6,2].map((kills,i)=>({id:`p${i}`,name:`Finisher ${i+1}`,slot:i,kills,deaths:i+1,roundWins:0}))
    createRoot(element).render(createElement(Results,{state:{sessionId:'p0',room:{matchPhase:'finished',winnerId:'p0',results}},onLeave:()=>{}}))
  })
  const dialog=page.getByRole('dialog',{name:'VICTORY',exact:true})
  await expect(dialog).toContainText('Finisher 1 reached 15 kills.')
  await expect(dialog.getByRole('table')).toHaveAccessibleName('Free for All final standings')
  await expect(dialog.locator('tbody tr')).toHaveCount(5)
  await expect(dialog.locator('tbody tr').first()).toContainText('Finisher 1')
  await page.screenshot({path:'ffa-results-preview.png'})
})

test('Free for All opens five slots, fits mobile and starts a solo match',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await openGame(page);await openMultiplayer(page)
  await page.getByLabel('Match format').selectOption('ffa')
  await expect(page.locator('.ffa-roster .lobby-player')).toHaveCount(5)
  await expect(page.getByRole('button',{name:'READY UP',exact:true})).toBeEnabled()
  await page.screenshot({path:'ffa-lobby-preview.png'})
  await page.setViewportSize({width:390,height:844})
  expect(await page.getByRole('dialog',{name:'PRIVATE MULTIPLAYER',exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  await page.screenshot({path:'ffa-lobby-mobile-preview.png'})
  await page.setViewportSize({width:1280,height:800})
  await page.getByRole('button',{name:'READY UP',exact:true}).click()
  await expect(page.getByText(/ALL PLAYERS READY.*STARTING IN/)).toBeVisible()
  await enterOnlineArena(page)
  await expect(page.getByTestId('ffa-score')).toContainText('/ 15 KILLS')
  await expect(page.getByRole('dialog',{name:'SHARED ARENA',exact:true})).toHaveCount(0)
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('room-scoreboard')).toContainText('FREE FOR ALL')
  await expect(page.locator('[data-testid^="scoreboard-player-"]')).toHaveCount(1)
  await page.keyboard.press('Tab');await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'END MATCH / RETURN TO LOBBY',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'PRIVATE MULTIPLAYER',exact:true})).toBeVisible()
  expect((await network(page)).room.arenaActive).toBe(false)
  expect(errors).toEqual([])
})

test('five-player Free for All synchronizes the lobby, four opponents and the full scoreboard',async({page,baseURL})=>{
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await presetLoadout(page,{unique:'scanner'})
  await openGame(page);await openMultiplayer(page,'casual','FFA Host')
  await page.getByLabel('Match format').selectOption('ffa')
  await expect(page.locator('.ffa-roster')).toBeVisible()
  const code=await page.getByTestId('invite-code').textContent(),peers=[]
  const endpoint=new URL(baseURL).port==='5180' ? 'http://127.0.0.1:2590' : 'http://127.0.0.1:2567'
  try {
    for(let i=1;i<5;i++) {
      const peer=await new Client(endpoint).joinById(code,{name:`Rival ${i}`})
      peer.onMessage('loadout-bank',()=>{});peer.onMessage('shot-trail',()=>{});peers.push(peer)
    }
    await expect(page.locator('.lobby-player:not(.open-player-slot)')).toHaveCount(5)
    await expect(page.getByLabel('Match format').locator('option[value="duel"]')).toBeDisabled()
    await expect(page.getByLabel('Match format').locator('option[value="freeplay"]')).toBeDisabled()
    await page.screenshot({path:'ffa-full-lobby-preview.png'})
    for(const peer of peers) peer.send('ready',{ready:true})
    await page.getByRole('button',{name:'READY UP',exact:true}).click()
    await enterOnlineArena(page)
    await expect(page.locator('.online-link')).toContainText('5 PLAYERS')
    await page.keyboard.press('KeyC')
    await expect.poll(async()=>{
      const n=await network(page),self=n.room.players.find(p=>p.id===n.sessionId)
      return self.combat.abilities.scanner.uses
    }).toBe(1)
    await expect(page.getByTestId('online-scan-opponent')).toHaveCount(4)
    const remoteCount=await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
      const {_roots}=await import(url),scene=_roots.get(document.querySelector('canvas')).store.getState().scene
      let count=0;scene.traverse(node=>{if(node.name.startsWith('remote-player-')) count++});return count
    })
    expect(remoteCount).toBe(4)
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid^="scoreboard-player-"]')).toHaveCount(5)
    for(let i=1;i<5;i++) await expect(page.getByTestId('room-scoreboard')).toContainText(`Rival ${i}`)
    await page.screenshot({path:'ffa-five-player-scoreboard-preview.png'})
    expect(errors).toEqual([])
  } finally {for(const peer of peers) await peer.leave().catch(()=>{})}
})
