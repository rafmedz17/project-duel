import {openGame,openMultiplayer} from './helpers.js'
import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import { PLAYER } from '../../shared/arena.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

const network=page=>page.evaluate(async ()=> {
  const path='/src/multiplayer/lobby.js'
  const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
  return (await import(url)).lobby.get()
})

async function pair(page,format) {
  await page.addInitScript(()=>localStorage.setItem('duel-loadout',JSON.stringify({character:'vex',primary:'hyperion',unique:'scanner'})))
  await openGame(page,'/')
  await openMultiplayer(page,'casual','Roster Pilot')
  await expect(page.getByTestId('invite-code')).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/)
  const peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{name:'Roster Peer'})
  peer.onMessage('shot-trail',()=>{})
  peer.onMessage('latency-probe',payload=>peer.send('latency-pong',payload))
  peer.send('latency-ready')
  await page.getByLabel('Match format').selectOption(format)
  peer.send('ready',{ready:true})
  await page.getByRole('button',{name:'READY UP',exact:true}).click()
  await page.getByRole('button',{name:'ENTER ARENA',exact:true}).click({timeout:30000})
  await expect.poll(async ()=>(await network(page)).captured).toBe(true)
  return peer
}

test('Tab toggles both players, measured ping and live kill/death stats without interrupting movement',async ({page})=> {
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const peer=await pair(page,'freeplay')
  try {
    const board=page.getByRole('region',{name:'Room scoreboard'})
    await expect(board).toHaveCount(0)
    await page.keyboard.press('Tab')
    await expect(board).toBeVisible()
    await expect(board).toContainText('TAP TO CLOSE')
    await page.keyboard.down('Tab')
    await expect(board).toHaveCount(0)
    await page.keyboard.down('Tab') // Holding the key must not toggle repeatedly.
    await expect(board).toHaveCount(0)
    await page.keyboard.up('Tab')
    await page.keyboard.press('Tab')
    await expect(board).toBeVisible()
    await expect(board.getByRole('row')).toHaveCount(3)
    await expect(board).toContainText('Roster Pilot')
    await expect(board).toContainText('Roster Peer')
    await expect(board.getByRole('columnheader',{name:'ROUNDS'})).toHaveCount(0)
    const selfId=(await network(page)).sessionId
    const selfRow=board.getByTestId(`scoreboard-player-${selfId}`)
    const peerRow=board.getByTestId(`scoreboard-player-${peer.sessionId}`)
    await expect(selfRow.locator('[data-stat="ping"]')).toHaveText(/^\d+ ms$/)
    await expect(peerRow.locator('[data-stat="ping"]')).toHaveText(/^\d+ ms$/)
    expect((await network(page)).captured).toBe(true)
    const before=(await network(page)).room.time
    // Move through normal input while the scoreboard stays open.
    await page.keyboard.down('KeyW')
    await expect.poll(()=>peer.state.players.get(selfId)?.z,{timeout:12000}).toBeLessThan(0)
    await page.keyboard.up('KeyW')
    await expect(board).toBeVisible()
    expect((await network(page)).room.time).toBeGreaterThan(before)
    await page.keyboard.press('Tab')
    await expect(board).toHaveCount(0)
    expect((await network(page)).room.players.find(p=>p.id===selfId).combat.weapon).toBe('hyperion')
    // Aim and fire at the peer using the actual input/authoritative combat path.
    await page.evaluate(async ({id,eye,head,sensitivity})=> {
      const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
      const {arenaView,latestPose}=await import(url('/src/multiplayer/poses.js'))
      const {game}=await import(url('/src/game/store.js'))
      const p=arenaView.position,target=latestPose(id),scale=sensitivity*game.get().settings.sensitivity
      const yaw=Math.atan2(p[0]-target.x,p[2]-target.z)
      const pitch=Math.atan2(target.y+head-p[1]-eye,Math.hypot(p[0]-target.x,p[2]-target.z))
      document.dispatchEvent(new MouseEvent('mousemove',{movementX:(arenaView.yaw-yaw)/scale,movementY:(arenaView.pitch-pitch)/scale}))
    },{id:peer.sessionId,eye:PLAYER.eye,head:ROBOT_HEAD_Y,sensitivity:PLAYER.sensitivity})
    await page.mouse.down();await page.mouse.up()
    await expect.poll(()=>peer.state.players.get(selfId)?.kills).toBe(1)
    await expect.poll(async ()=>(await network(page)).room.players.find(p=>p.id===selfId).combat.kills).toBe(1)
    await page.keyboard.press('Tab')
    await expect(board).toBeVisible()
    await expect(selfRow.locator('[data-stat="kills"]')).toHaveText('1')
    await expect(peerRow.locator('[data-stat="deaths"]')).toHaveText('1')
    await page.screenshot({path:'scoreboard-preview.png'})
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
    await expect(board).toHaveCount(0)
    expect(errors).toEqual([])
  } finally { await peer.leave().catch(()=>{}) }
})

test('best-of-three roster includes round wins and closes on a second press or Escape',async ({page})=> {
  const peer=await pair(page,'duel')
  try {
    const board=page.getByRole('region',{name:'Room scoreboard'})
    await page.keyboard.press('Tab')
    await expect(board.getByRole('columnheader',{name:'ROUNDS'})).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(board).toHaveCount(0)
    await page.keyboard.press('Tab')
    await expect(board).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(board).toHaveCount(0)
  } finally { await peer.leave().catch(()=>{}) }
})
