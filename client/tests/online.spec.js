import { test, expect } from '@playwright/test'
import { observeHitFeedback, observedFeedback } from './helpers.js'
import { PLAYER } from '../src/game/config.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

async function onlineState(page) {
  return page.evaluate(async () => {
    const module = path => performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === path)?.name || path
    const { lobby } = await import(module('/src/multiplayer/lobby.js'))
    const { latestPose,arenaView } = await import(module('/src/multiplayer/poses.js'))
    const state = lobby.get()
    return { ...state,self:latestPose(state.sessionId),poses:Object.fromEntries((state.room?.players || []).map(player => [player.id,latestPose(player.id)])),view:arenaView }
  })
}
async function open(page,name) {
  await page.goto('/')
  await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
  await page.getByLabel('YOUR CALLSIGN').fill(name)
}
async function pair(browser,format = 'freeplay',primary = 'rifle',unique = 'scanner',character = 'vex') {
  const contexts = await Promise.all([browser.newContext(),browser.newContext()])
  await Promise.all(contexts.map(context => context.addInitScript(loadout => localStorage.setItem('duel-loadout',JSON.stringify(loadout)),{ character,primary,unique })))
  const [host,guest] = await Promise.all(contexts.map(context => context.newPage()))
  await open(host,'Nova')
  await host.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
  await expect(host.getByTestId('invite-code')).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/)
  const code = await host.getByTestId('invite-code').textContent()
  await host.getByLabel('Match format').selectOption(format)
  await expect(host.getByLabel('Match format')).toHaveValue(format)
  await open(guest,'Echo')
  await guest.getByLabel('INVITE CODE',{ exact:true }).fill(code)
  await guest.getByRole('button',{ name:'JOIN ROOM',exact:true }).click()
  await host.getByRole('button',{ name:'READY UP',exact:true }).click()
  await guest.getByRole('button',{ name:'READY UP',exact:true }).click()
  await expect(host.getByRole('button',{ name:'START SHARED ARENA' })).toBeVisible()
  return { host,guest,contexts }
}
async function enter(page) {
  await page.bringToFront()
  await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
  await expect.poll(async () => (await onlineState(page)).captured).toBe(true)
}

test('selected online shotgun uses a dotted ring and automatically reloads its empty magazine',async ({ browser }) => {
  const { host,contexts }=await pair(browser,'freeplay','shotgun')
  try {
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await host.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    await expect.poll(async () => (await onlineState(host)).captured).toBe(true)
    await look(host,0,0.6); await host.keyboard.press('Digit1')
    await expect.poll(async () => (await selfCombat(host)).weapon).toBe('shotgun')
    await expect(host.locator('.shotgun-crosshair')).toHaveText('')
    for(let i=0;i<6;i++) { await fire(host); await expect.poll(async () => (await selfCombat(host)).magazines.shotgun).toBe(5-i) }
    expect((await selfCombat(host)).reloadReason).toBe('auto')
    await expect(host.getByRole('progressbar',{ name:'Reload progress' })).toBeVisible()
    await expect.poll(async () => (await selfCombat(host)).magazines.shotgun,{ timeout:5000 }).toBe(6)
    expect((await selfCombat(host)).magazines.pistol).toBe(15)
  } finally { await Promise.all(contexts.map(context=>context.close())) }
})

for(const unique of ['flashbang','stun','smoke']) test(`online ${unique} renders the server-validated grenade and its effect`,async ({ browser }) => {
  test.setTimeout(90000)
  const { host,guest,contexts }=await pair(browser,'freeplay','rifle',unique),errors=[]
  for(const page of [host,guest]) page.on('pageerror',e=>errors.push(e.message))
  try {
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await enter(host)
    if(unique==='flashbang') await look(host,0,-1.2)
    else { await host.keyboard.down('ShiftLeft'); await moveTo(host,'KeyW',2,-8,-1); await host.keyboard.up('ShiftLeft'); await look(host,0,-0.2) }
    await host.keyboard.press('KeyC')
    await expect.poll(async () => (await selfCombat(host)).abilities[unique].uses).toBe(1)
    await expect.poll(async () => (await selfCombat(host)).abilities[unique].detonatedAt).toBeGreaterThan(0)
    const ability=(await selfCombat(host)).abilities[unique]
    expect(ability.flying).toBe(false)
    if(unique==='flashbang') await expect(host.getByTestId('flash-screen')).toBeVisible()
    if(unique==='stun') {
      await expect(guest.locator('.root-notice')).toBeVisible()
      expect((await selfCombat(guest)).hp).toBe(100)
      expect((await selfCombat(host)).rooted).toBe(false)
    }
    if(unique==='smoke') {
      expect(Math.abs(ability.activeUntil-ability.detonatedAt-8)).toBeLessThan(0.001)
      await expect(guest.getByLabel('Inside enemy smoke')).toBeVisible()
      const revealed=await host.evaluate(async () => {
        const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
        const { _roots }=await import(url),scene=_roots.get(document.querySelector('canvas')).store.getState().scene
        return scene.getObjectsByProperty('name','robot-torso').some(mesh=>mesh.material.transparent && !mesh.material.depthTest)
      })
      expect(revealed).toBe(true)
    }
    await host.screenshot({ path:`online-${unique}-preview.png` })
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context=>context.close())) }
})
async function look(page,yaw,pitch = 0) {
  const s = await onlineState(page)
  const yawDelta = Math.atan2(Math.sin(s.view.yaw-yaw),Math.cos(s.view.yaw-yaw))
  await page.evaluate(({ x,y }) => document.dispatchEvent(new MouseEvent('mousemove',{ movementX:x,movementY:y })),{ x:yawDelta/PLAYER.sensitivity,y:(s.view.pitch-pitch)/PLAYER.sensitivity })
  await expect.poll(async () => {
    const delta = (await onlineState(page)).self.yaw-yaw
    return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))
  }).toBeLessThan(0.005)
  await expect.poll(async () => Math.abs((await onlineState(page)).self.pitch-pitch)).toBeLessThan(0.005)
}
async function moveTo(page,key,axis,value,direction) {
  await page.keyboard.down(key)
  try {
    await page.evaluate(async ({ key,axis,value,direction }) => {
      const path = '/src/multiplayer/poses.js'
      const url = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === path)?.name || path
      const { arenaView } = await import(url)
      const start = performance.now()
      await new Promise((resolve,reject) => {
        const check = () => {
          if (direction*(arenaView.position[axis]-value)>=0) { document.dispatchEvent(new KeyboardEvent('keyup',{ code:key,bubbles:true })); resolve() }
          else if (performance.now()-start>12000) reject(new Error('Movement threshold not reached'))
          else requestAnimationFrame(check)
        }
        check()
      })
    },{ key,axis,value,direction })
  } finally { await page.keyboard.up(key) }
  await page.waitForTimeout(200)
}

test('ready host starts a shared countdown; both see remote movement, jump and look; releasing controls stops only self',async ({ browser }) => {
  test.setTimeout(120000)
  const { host,guest,contexts } = await pair(browser), errors = []
  for (const page of [host,guest]) page.on('pageerror',error => errors.push(error.message))
  try {
    await expect(guest.getByRole('button',{ name:'START SHARED ARENA' })).toHaveCount(0)
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByText(/ENTERING ARENA IN/)).toBeVisible()
    await expect(guest.getByText(/ENTERING ARENA IN/)).toBeVisible()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:10000 })
    await expect(guest.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible()
    await enter(host)
    const start = await onlineState(host)
    expect(start.self.z).toBeGreaterThan(14.9)
    await moveTo(host,'KeyW',2,11.5,-1)
    await expect.poll(async () => (await onlineState(host)).self.z).toBeLessThan(start.self.z-2)
    const moved = await onlineState(host)
    await expect.poll(async () => (await onlineState(guest)).poses[start.sessionId]?.z).toBeLessThan(start.self.z-2)
    await expect.poll(async () => (await onlineState(guest)).view.remotes[start.sessionId]?.position[2],{ timeout:6000 }).toBeLessThan(start.self.z-2)
    const floor = moved.self.y
    await host.keyboard.press('Space')
    await expect.poll(async () => (await onlineState(guest)).poses[start.sessionId]?.y,{ intervals:[20] }).toBeGreaterThan(floor+0.5)
    await expect.poll(async () => (await onlineState(host)).self.grounded).toBe(true)
    await host.keyboard.down('ShiftLeft')
    await moveTo(host,'KeyW',2,-7,-1)
    await host.keyboard.up('ShiftLeft')
    await look(host,0.3,0.15)
    await expect.poll(async () => (await onlineState(guest)).poses[start.sessionId]?.yaw).toBeCloseTo(0.3,2)
    await host.screenshot({ path:'online-arena-preview.png' })
    await host.keyboard.down('KeyW')
    await host.evaluate(() => document.exitPointerLock())
    await expect.poll(async () => (await onlineState(host)).captured).toBe(false)
    await host.keyboard.up('KeyW'); await host.waitForTimeout(400)
    const stopped = await onlineState(host)
    await host.waitForTimeout(350)
    expect(Math.abs((await onlineState(host)).self.z-stopped.self.z)).toBeLessThan(0.01)
    await enter(guest)
    const before = (await onlineState(guest)).self.x
    await moveTo(guest,'KeyD',0,-2,-1)
    await expect.poll(async () => (await onlineState(guest)).self.x).toBeLessThan(before-1)
    await guest.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect.poll(async () => (await onlineState(guest)).captured).toBe(false)
    await guest.getByRole('button',{ name:'RETURN TO LOBBY',exact:true }).click()
    await expect(host.getByRole('dialog',{ name:'PRIVATE MULTIPLAYER' })).toBeVisible()
    await expect(guest.getByRole('dialog',{ name:'PRIVATE MULTIPLAYER' })).toBeVisible()
    expect((await onlineState(host)).room.arenaActive).toBe(false)
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

async function aimAtPlayer(page,region = 'body') {
  const s = await onlineState(page), other = s.room.players.find(player => player.id!==s.sessionId)
  const target = s.poses[other.id], p = s.self
  const [x,y] = { body:[0,-0.03],head:[0,ROBOT_HEAD_Y],foot:[0.13,-0.8] }[region]
  await look(page,Math.atan2(p.x-target.x-x,p.z-target.z),Math.atan2(target.y+y-p.y-PLAYER.eye,Math.hypot(p.x-target.x-x,p.z-target.z)))
}
const selfCombat = async page => { const s = await onlineState(page); return s.room.players.find(player => player.id===s.sessionId).combat }
async function readyToFire(page) {
  await expect.poll(async () => {
    const s = await onlineState(page), combat = s.room.players.find(player => player.id===s.sessionId).combat
    return !combat.reloading && s.room.time>=combat.attackReadyAt
  }).toBe(true)
}
const fire = async page => { await readyToFire(page); await page.mouse.down(); await page.mouse.up() }

test('two browsers confirm body, head and foot damage, a single kill, death feedback and full-health respawn',async ({ browser }) => {
  test.setTimeout(120000)
  const { host,guest,contexts } = await pair(browser), errors = []
  for (const page of [host,guest]) page.on('pageerror',error => errors.push(error.message))
  try {
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:25000 })
    await enter(host)
    await expect.poll(async () => (await onlineState(host)).self.grounded).toBe(true)
    await host.keyboard.down('ShiftLeft')
    await moveTo(host,'KeyW',2,0,-1)
    await host.keyboard.up('ShiftLeft')
    await host.keyboard.press('Digit2');await host.waitForTimeout(350)
    await observeHitFeedback(host)
    for (const [region,hp,damage] of [['body',72,28],['head',16,56],['foot',2,14],['head',0,2]]) {
      await aimAtPlayer(host,region); await fire(host)
      await expect.poll(async () => (await selfCombat(guest)).hp).toBe(hp)
      await expect.poll(async () => (await selfCombat(host)).hitDamage).toBe(damage)
      expect((await selfCombat(host)).hitHeadshot).toBe(region==='head')
      if (region==='head') expect((await observedFeedback(host)).text).toContain('HEADSHOT')
      await host.waitForTimeout(280)
    }
    expect((await selfCombat(host)).kills).toBe(1)
    expect((await selfCombat(guest)).deaths).toBe(1)
    await expect(guest.getByText('SYSTEM OFFLINE',{ exact:true })).toBeVisible()
    await host.screenshot({ path:'online-combat-preview.png' })
    await expect.poll(async () => (await selfCombat(guest)).hp,{ timeout:6000 }).toBe(100)
    expect((await selfCombat(guest)).magazines).toMatchObject({ pistol:15,rifle:30,shotgun:6 })
    expect((await selfCombat(host)).kills).toBe(1)
    await enter(guest)
    await expect(guest.getByTestId('online-health')).toContainText('100')
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

test('online rifle hold, reload animation and focus release use server snapshots',async ({ browser }) => {
  test.setTimeout(120000)
  const { host,contexts } = await pair(browser), errors = []
  host.on('pageerror',error => errors.push(error.message))
  try {
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:10000 })
    await enter(host); await look(host,0,0.6)
    await host.keyboard.press('Digit1')
    await expect.poll(async () => (await selfCombat(host)).weapon).toBe('rifle')
    await host.waitForTimeout(300)
    await host.mouse.down()
    await expect.poll(async () => (await selfCombat(host)).magazines.rifle,{ timeout:4000 }).toBeLessThan(26)
    await host.mouse.up()
    await host.keyboard.press('KeyR')
    await expect(host.getByRole('progressbar',{ name:'Reload progress' })).toBeVisible()
    await expect.poll(async () => (await selfCombat(host)).magazines.rifle).toBe(30)
    await host.keyboard.press('Digit1'); await host.waitForTimeout(350)
    await host.mouse.down()
    await expect.poll(async () => (await selfCombat(host)).magazines.rifle).toBeLessThan(30)
    await host.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect.poll(async () => (await onlineState(host)).captured).toBe(false)
    await host.mouse.up(); await host.waitForTimeout(300)
    const stopped = (await selfCombat(host)).magazines.rifle
    await host.waitForTimeout(500)
    expect((await selfCombat(host)).magazines.rifle).toBe(stopped)
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

test('online capsule stops at shared cover and walls; returning to lobby and re-entry reset both spawns',async ({ browser }) => {
  test.setTimeout(120000)
  const { host,guest,contexts } = await pair(browser)
  try {
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:10000 })
    await enter(host)
    await moveTo(host,'KeyD',0,8,1)
    await moveTo(host,'KeyW',2,7.5,-1)
    const covered = (await onlineState(host)).self
    expect(covered.x).toBeGreaterThan(7.5)
    expect(covered.z).toBeGreaterThan(7.3)
    expect(covered.z).toBeLessThan(7.6)
    await moveTo(host,'KeyS',2,11,1) // Test the wall between its visible pillars.
    await look(host,Math.PI/2)
    await host.keyboard.down('ShiftLeft')
    await moveTo(host,'KeyS',0,19,1)
    await host.keyboard.up('ShiftLeft')
    const wall = (await onlineState(host)).self
    expect(wall.x).toBeGreaterThan(18.9)
    expect(wall.x).toBeLessThan(19.2)
    await host.evaluate(() => document.exitPointerLock())
    await host.getByRole('button',{ name:'RETURN TO LOBBY',exact:true }).click()
    await host.getByRole('button',{ name:'READY UP',exact:true }).click()
    await guest.getByRole('button',{ name:'READY UP',exact:true }).click()
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:10000 })
    const reset = await onlineState(host)
    expect(reset.room.arenaEpoch).toBe(2)
    expect(Math.abs(reset.self.x)).toBeLessThan(0.01)
    expect(reset.self.z).toBeGreaterThan(14.9)
    await enter(host)
    await host.evaluate(() => document.exitPointerLock())
    await host.getByRole('button',{ name:'LEAVE ROOM',exact:true }).click()
    await expect(host.getByRole('dialog')).toHaveCount(0)
    await expect(guest.getByRole('dialog',{ name:'PRIVATE MULTIPLAYER' })).toBeVisible()
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

test('online scanner reveals the opponent; dash travels once, respects cooldown and stops at cover',async ({ browser }) => {
  test.setTimeout(120000)
  const { host,contexts } = await pair(browser), errors = []
  host.on('pageerror',error => errors.push(error.message))
  try {
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:10000 })
    await enter(host)
    await expect.poll(async () => (await onlineState(host)).self.grounded).toBe(true)
    await expect(host.getByTestId('ability-dash')).toContainText('READY')
    await host.keyboard.press('KeyC')
    await expect(host.getByTestId('ability-scanner')).toContainText('ACTIVE')
    await expect(host.getByTestId('online-scan-opponent')).toHaveCSS('opacity','1')
    await expect(host.getByTestId('online-scan-opponent')).toContainText('Echo')
    await host.keyboard.press('KeyC')
    expect((await selfCombat(host)).abilities.scanner.uses).toBe(1)
    const start = (await onlineState(host)).self.z
    await host.keyboard.press('KeyE')
    await expect.poll(async () => (await selfCombat(host)).abilities.dash.uses).toBe(1)
    await expect.poll(async () => {
      const s = await onlineState(host), combat = s.room.players.find(player => player.id===s.sessionId).combat
      return s.room.time>=combat.abilities.dash.activeUntil
    }).toBe(true)
    const distance = start-(await onlineState(host)).self.z
    expect(distance).toBeGreaterThan(3.4); expect(distance).toBeLessThan(3.8)
    await host.keyboard.press('KeyE')
    expect((await selfCombat(host)).abilities.dash.uses).toBe(1)
    await moveTo(host,'KeyD',0,8,1)
    await moveTo(host,'KeyW',2,9,-1)
    await expect(host.getByTestId('ability-dash')).toContainText('READY',{ timeout:6000 })
    await host.keyboard.press('KeyE')
    await expect.poll(async () => (await selfCombat(host)).abilities.dash.uses).toBe(2)
    await expect.poll(async () => (await onlineState(host)).self.z).toBeLessThan(7.5)
    expect((await onlineState(host)).self.z).toBeGreaterThan(7.3)
    await expect(host.getByTestId('online-scan-opponent')).toHaveCSS('opacity','0',{ timeout:8000 })
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

test('online shields absorb actual hits and VEX overdrive allows repeated dash without spending shield',async ({ browser }) => {
  const { host,guest,contexts }=await pair(browser),errors=[]
  for(const page of [host,guest]) page.on('pageerror',e=>errors.push(e.message))
  try {
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:10000 })
    await enter(host); await observeHitFeedback(host); await aimAtPlayer(host)
    await host.evaluate(() => document.exitPointerLock())
    await enter(guest); await guest.keyboard.press('KeyF')
    await expect(guest.getByTestId('online-shield-charge')).toContainText('50 / 50')
    await guest.evaluate(() => document.exitPointerLock())
    await enter(host); await fire(host)
    await expect.poll(async () => (await selfCombat(guest)).shieldCharge).toBe(22)
    expect((await selfCombat(guest)).hp).toBe(100)
    expect((await selfCombat(host)).hitShieldDamage).toBe(28)
    await host.keyboard.press('KeyX')
    await expect(host.getByTestId('ability-ultimate')).toContainText('ACTIVE')
    await host.keyboard.press('KeyE'); await host.waitForTimeout(250); await host.keyboard.press('KeyE')
    await expect.poll(async () => (await selfCombat(host)).abilities.dash.uses).toBe(2)
    await expect(host.getByTestId('ability-ultimate')).not.toContainText('ACTIVE',{ timeout:7000 })
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context=>context.close())) }
})

async function winRound(shooter,target) {
  await shooter.bringToFront()
  if (!(await onlineState(shooter)).captured) await enter(shooter)
  for (let i=0;i<4;i++) {
    await aimAtPlayer(shooter)
    await fire(shooter)
    await expect.poll(async () => (await selfCombat(target)).hp).toBe(Math.max(0,100-(i+1)*28))
  }
}
async function awaitNextRound(page,number) {
  await expect(page.getByTestId('round-countdown')).toContainText(`ROUND ${number}`,{ timeout:20000 })
  expect((await selfCombat(page)).hp).toBe(100)
  expect((await selfCombat(page)).magazines).toMatchObject({ pistol:15,rifle:30,shotgun:6 })
  expect((await selfCombat(page)).abilities.scanner.readyAt).toBe(0)
  await expect.poll(async () => (await onlineState(page)).room.matchPhase,{ timeout:6000 }).toBe('live')
}

test('best of three plays a 2–1 deciding match with shared scoreboard, locked intermissions, fresh rounds and rematch',async ({ browser }) => {
  test.setTimeout(150000)
  const { host,guest,contexts } = await pair(browser,'duel'), errors = []
  for (const page of [host,guest]) page.on('pageerror',error => errors.push(error.message))
  try {
    await expect(guest.getByLabel('Match format')).toBeDisabled()
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:25000 })
    await enter(host)
    await expect.poll(async () => (await onlineState(host)).self.grounded).toBe(true)
    await host.keyboard.press('KeyC')
    await winRound(host,guest)
    await expect(host.getByTestId('round-result')).toContainText('ROUND WON')
    await expect(guest.getByTestId('round-result')).toContainText('ROUND LOST')
    expect((await onlineState(host)).room.players.find(p => p.name==='Nova').roundWins).toBe(1)
    const ammo = (await selfCombat(host)).magazines.pistol
    await fire(host); await host.keyboard.press('KeyX')
    expect((await selfCombat(host)).magazines.pistol).toBe(ammo)
    expect((await selfCombat(guest)).hp).toBe(0)
    await awaitNextRound(host,2)
    expect((await onlineState(host)).captured).toBe(false)
    expect((await onlineState(host)).self.z).toBeCloseTo(15,1)
    await host.evaluate(() => document.exitPointerLock())
    await winRound(guest,host)
    await expect(guest.getByTestId('round-result')).toContainText('ROUND WON')
    await awaitNextRound(guest,3)
    const tied = (await onlineState(guest)).room.players
    expect(tied.map(p => p.roundWins)).toEqual([1,1])
    await guest.evaluate(() => document.exitPointerLock())
    await winRound(host,guest)
    await expect(host.getByRole('dialog',{ name:'VICTORY',exact:true })).toBeVisible()
    await expect(guest.getByRole('dialog',{ name:'DEFEAT',exact:true })).toBeVisible()
    await expect(host.getByRole('table',{ name:'Match scoreboard' })).toContainText('Nova')
    expect((await onlineState(host)).room.results.map(p => p.roundWins)).toEqual([2,1])
    await expect.poll(async () => (await onlineState(host)).captured).toBe(false)
    await host.screenshot({ path:'best-of-three-preview.png' })
    await host.getByRole('button',{ name:'RETURN TO LOBBY',exact:true }).click()
    await expect(guest.getByRole('dialog',{ name:'PRIVATE MULTIPLAYER' })).toBeVisible()
    await host.getByRole('button',{ name:'READY UP',exact:true }).click()
    await guest.getByRole('button',{ name:'READY UP',exact:true }).click()
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(host.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:25000 })
    expect((await onlineState(host)).room.arenaEpoch).toBe(2)
    expect((await onlineState(host)).room.players.map(p => p.roundWins)).toEqual([0,0])
    expect((await onlineState(host)).room.roundNumber).toBe(1)
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

test('forfeiting shows the same winner to both players and keeps departed-player results until lobby return',async ({ browser }) => {
  test.setTimeout(90000)
  const { host,guest,contexts } = await pair(browser,'duel'), errors = []
  for (const page of [host,guest]) page.on('pageerror',error => errors.push(error.message))
  try {
    await host.getByRole('button',{ name:'START SHARED ARENA' }).click()
    await expect(guest.getByRole('dialog',{ name:'SHARED ARENA' })).toBeVisible({ timeout:25000 })
    await guest.getByRole('button',{ name:'FORFEIT MATCH',exact:true }).click()
    await expect(host.getByRole('dialog',{ name:'VICTORY',exact:true })).toBeVisible()
    await expect(guest.getByRole('dialog',{ name:'DEFEAT',exact:true })).toContainText('Decided by forfeit')
    await guest.getByRole('button',{ name:'LEAVE ROOM',exact:true }).click()
    await expect(host.getByRole('dialog',{ name:'VICTORY',exact:true })).toBeVisible()
    await expect(host.getByRole('table',{ name:'Match scoreboard' })).toContainText('Echo')
    await host.getByRole('button',{ name:'RETURN TO LOBBY',exact:true }).click()
    await expect(host.getByRole('dialog',{ name:'PRIVATE MULTIPLAYER' })).toBeVisible()
    await expect(host.getByRole('button',{ name:'READY UP',exact:true })).toBeDisabled()
    expect(errors).toEqual([])
  } finally { await Promise.all(contexts.map(context => context.close())) }
})
