import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import { PLAYER } from '../src/game/config.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'

async function inspect(page) {
  return page.evaluate(async()=>{
    const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
    const { lobby }=await import(url('/src/multiplayer/lobby.js'))
    const { audio }=await import(url('/src/audio/synth.js'))
    return { ...lobby.get(),self:lobby.self(),audio:audio.diagnostics() }
  })
}
async function observe(page) {
  await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const { _roots }=await import(url),scene=_roots.get(document.querySelector('canvas')).store.getState().scene
    window.__trails={ peak:0,count:0,finite:true }
    const frame=()=>{
      const mesh=scene.getObjectByName('bullet-trail-cores')
      if(mesh) {
        window.__trails.count=mesh.count
        window.__trails.peak=Math.max(window.__trails.peak,mesh.count)
        window.__trails.finite &&= [...mesh.instanceMatrix.array.slice(0,mesh.count*16)].every(Number.isFinite)
      }
      requestAnimationFrame(frame)
    }
    frame()
  })
}
async function aim(page,id,miss=false) {
  await page.evaluate(async({id,miss,eye,head})=>{
    const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
    const { arenaView,latestPose }=await import(url('/src/multiplayer/poses.js'))
    const p=arenaView.position,target=latestPose(id)
    const yaw=miss ? 0 : Math.atan2(p[0]-target.x,p[2]-target.z)
    const pitch=miss ? .6 : Math.atan2(target.y+head-p[1]-eye,Math.hypot(p[0]-target.x,p[2]-target.z))
    document.dispatchEvent(new MouseEvent('mousemove',{ movementX:Math.atan2(Math.sin(arenaView.yaw-yaw),Math.cos(arenaView.yaw-yaw))/.002,movementY:(arenaView.pitch-pitch)/.002 }))
  },{id,miss,eye:PLAYER.eye,head:ROBOT_HEAD_Y})
}
async function setup(page,format) {
  await page.addInitScript(()=>localStorage.setItem('duel-loadout',JSON.stringify({ character:'ion',primary:'hyperion',unique:'scanner' })))
  await page.goto('/')
  await page.getByRole('button',{name:/^MULTIPLAYER/}).click()
  await page.getByLabel('YOUR CALLSIGN').fill('Effects Pilot')
  await page.getByRole('button',{name:'CREATE PRIVATE ROOM'}).click()
  const peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{name:'Effects Peer',loadout:{character:'vex',primary:'railbreaker',unique:'flashbang'}})
  const events=[];peer.onMessage('shot-trail',event=>events.push(event));peer.onMessage('loadout-bank',()=>{})
  await page.getByLabel('Match format').selectOption(format)
  peer.send('ready',{ready:true})
  await page.getByRole('button',{name:'READY UP',exact:true}).click()
  await page.getByRole('button',{name:'START SHARED ARENA'}).click()
  const enter=async()=>{
    await expect(page.getByRole('button',{name:'ENTER ARENA',exact:true})).toBeEnabled({timeout:25000})
    await page.getByRole('button',{name:'ENTER ARENA',exact:true}).click()
    await expect.poll(async()=>(await inspect(page)).captured).toBe(true)
  }
  await enter();await observe(page)
  let sequence=0
  const firePeer=(pitch=1)=>peer.send('combat',{action:'fire',epoch:peer.state.arenaEpoch,round:peer.state.roundId,sequence:sequence++,yaw:Math.PI,pitch})
  return {peer,events,enter,firePeer}
}
const fire=async page=>{await page.mouse.down();await page.mouse.up()}

test('Best of Three displays shot trails, headshot feedback, kill sounds and badges after round and match winning kills',async({page})=>{
  test.setTimeout(120000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const {peer,events,enter,firePeer}=await setup(page,'duel')
  try {
    firePeer()
    await expect.poll(()=>page.evaluate(()=>window.__trails.peak)).toBeGreaterThan(0)
    for(let round=1;round<=2;round++) {
      if(round===2) await enter()
      await aim(page,peer.sessionId)
      await fire(page)
      await expect.poll(async()=>(await inspect(page)).self.kills).toBe(round)
      await expect(page.getByTestId('kill-badge')).toContainText('HEADSHOT')
      await expect(page.getByTestId('kill-badge')).toHaveAttribute('data-combo','1')
      await expect.poll(async()=>(await inspect(page)).audio.counts.elimination || 0).toBe(round)
      if(round===1) await expect(page.getByTestId('round-result')).toContainText('ROUND WON')
      else await expect(page.getByRole('dialog',{name:'VICTORY',exact:true})).toBeVisible()
    }
    expect(events.filter(event=>event.weapon==='hyperion')).toHaveLength(2)
    expect(await page.evaluate(()=>window.__trails.finite)).toBe(true)
    expect(errors).toEqual([])
    await page.screenshot({path:'online-winning-kill-preview.png'})
  } finally {await peer.leave()}
})

test('Free Play renders opponent and own first-shot trails again after each player respawns',async({page})=>{
  test.setTimeout(120000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const {peer,events,enter,firePeer}=await setup(page,'freeplay')
  const resetProbe=async()=>{
    await expect.poll(()=>page.evaluate(()=>window.__trails.count)).toBe(0)
    await page.evaluate(()=>{window.__trails.peak=0})
  }
  try {
    firePeer()
    await expect.poll(()=>page.evaluate(()=>window.__trails.peak)).toBeGreaterThan(0)
    await aim(page,peer.sessionId);await fire(page)
    await expect(page.getByTestId('kill-badge')).toContainText('HEADSHOT')
    await expect.poll(()=>peer.state.players.get(peer.sessionId).hp,{timeout:7000}).toBe(100)
    await resetProbe();firePeer()
    await expect.poll(()=>page.evaluate(()=>window.__trails.peak)).toBeGreaterThan(0)
    const remote=events.filter(event=>event.id===peer.sessionId)
    expect(remote.slice(0,2).map(event=>event.shot)).toEqual([1,1])
    await page.waitForTimeout(2100)
    firePeer(Math.atan2(-PLAYER.eye,30))
    await expect.poll(async()=>(await inspect(page)).self.hp).toBe(0)
    await expect.poll(async()=>(await inspect(page)).self.hp,{timeout:7000}).toBe(100)
    await enter();await resetProbe();await aim(page,peer.sessionId,true);await fire(page)
    await expect.poll(()=>page.evaluate(()=>window.__trails.peak)).toBeGreaterThan(0)
    const own=events.filter(event=>event.id!==peer.sessionId)
    expect(own.slice(0,2).map(event=>event.shot)).toEqual([1,1])
    expect(await page.evaluate(()=>window.__trails.finite)).toBe(true)
    expect(errors).toEqual([])
  } finally {await peer.leave()}
})
