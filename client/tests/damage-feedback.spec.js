import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'

for(const style of ['classic','stacked']) test(`${style} damage numbers survive multiplayer timestamp rounding without a blank page`,async({ page })=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await expect(page.getByRole('button',{ name:'RESUME / ENTER ARENA' })).toBeEnabled()
  // Feed the actual HUD the same clock relationship produced by multiplayer:
  // a float combat timestamp just ahead of tick / tickRate.
  await page.evaluate(async style=>{
    const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.js')?.name || '/src/game/store.js'
    const { game }=await import(url)
    game.settings({ damageStyle:style })
    game.set({ mode:'paused',time:10,hit:10+1e-12,hitId:7,hitDamage:24,hitShieldDamage:0 })
  },style)
  await expect(page.getByTestId('damage-numbers')).toContainText('24')
  await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.js')?.name || '/src/game/store.js'
    const { game }=await import(url)
    game.set({ time:10.2,hit:10.2+1e-12,hitId:8,hitDamage:48 })
  })
  const numbers=page.getByTestId('damage-numbers')
  if(style==='stacked') await expect(numbers.locator('.hit-damage')).toHaveText(/72/)
  else { await expect(numbers.locator('.hit-damage')).toHaveCount(2);await expect(numbers).toContainText('48');await expect(numbers).toContainText('24') }
  await expect(page.getByRole('button',{ name:'RESUME / ENTER ARENA' })).toBeVisible()
  expect(errors).toEqual([])
})

test('multiplayer HUD survives confirmed shield hits while both players use skills and ultimates',async({ page })=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>localStorage.setItem('duel-loadout',JSON.stringify({ character:'ion',primary:'rifle',unique:'scanner' })))
  await page.goto('/')
  await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
  await page.getByLabel('YOUR CALLSIGN').fill('Feedback Pilot')
  await page.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
  const code=await page.getByTestId('invite-code').textContent()
  const peer=await new Client('http://127.0.0.1:2567').joinById(code,{ name:'Shield Pilot',loadout:{ character:'aegis',primary:'rifle',unique:'smoke' } })
  peer.onMessage('shot-trail',()=>{})
  peer.onMessage('loadout-bank',()=>{})
  try {
    await page.getByLabel('Match format').selectOption('freeplay')
    peer.send('ready',{ ready:true })
    await page.getByRole('button',{ name:'READY UP',exact:true }).click()
    await page.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    await expect.poll(()=>page.evaluate(()=>Boolean(document.pointerLockElement))).toBe(true)
    let sequence=0
    for(const ability of ['ultimate','shield','smoke']) peer.send('combat',{ action:'ability',ability,epoch:peer.state.arenaEpoch,round:peer.state.roundId,sequence:sequence++,yaw:Math.PI,pitch:.8 })
    await expect.poll(()=>peer.state.players.get(peer.sessionId).ultimateShield).toBe(200)
    await page.keyboard.press('KeyX');await page.keyboard.press('KeyF');await page.keyboard.press('KeyC')
    await page.evaluate(async()=>{
      const module=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
      const { arenaView }=await import(module('/src/multiplayer/poses.js'))
      document.dispatchEvent(new MouseEvent('mousemove',{ movementX:arenaView.yaw/.002,movementY:(arenaView.pitch-Math.atan2(-.65,30))/.002 }))
      window.__shieldFeedback=false
      new MutationObserver(()=>{
        if(Number(document.querySelector('[data-testid="hit-feedback"]')?.dataset.shieldDamage)>0) window.__shieldFeedback=true
      }).observe(document.body,{ childList:true,subtree:true,attributes:true })
    })
    await page.mouse.down()
    await expect.poll(()=>peer.state.players.get(peer.state.hostId).hitId,{ timeout:10000 }).toBeGreaterThanOrEqual(4)
    await page.mouse.up()
    await expect.poll(()=>page.evaluate(()=>window.__shieldFeedback)).toBe(true)
    await expect(page.getByTestId('online-health')).toContainText('100')
    await expect(page.getByTestId('ability-ultimate')).toContainText('ACTIVE')
    expect(errors).toEqual([])
  } finally { await page.mouse.up();await peer.leave() }
})
