import {test,expect} from '@playwright/test'
import {Client} from '@colyseus/sdk'
import {ONLINE} from '../../shared/arena.js'
import {openGame,presetLoadout,state} from './helpers.js'

async function inspect(page,id) {
  return page.evaluate(async id=>{
    const path=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const {_roots}=await import(path),{scene}=_roots.get(document.querySelector('canvas')).store.getState()
    const base=id ? scene.getObjectByName(`remote-player-${id}`) : scene
    const weapon=base?.getObjectByName(id ? 'remote-weapon' : 'first-person-weapon'),arms=base?.getObjectByName(id ? 'remote-arms' : 'view-arms')
    if(!weapon || !arms) return null
    weapon.updateWorldMatrix(true,true);arms.updateWorldMatrix(true,true)
    const hands=['right','left'].map(side=>{
      const hand=arms.getObjectByName(`${id ? 'remote' : 'view'}-hand-${side}`),grip=weapon.getObjectByName(`weapon-grip-${side}`)
      return {position:hand.position.toArray(),finger:hand.getObjectByName(`${id ? 'remote' : 'view'}-hand-${side}-finger-0`).rotation.x,gap:grip ? hand.getWorldPosition(hand.position.clone()).distanceTo(grip.getWorldPosition(grip.position.clone())) : null}
    })
    let finite=true;arms.traverse(node=>{finite &&= node.position.toArray().every(Number.isFinite) && node.quaternion.toArray().every(Number.isFinite)})
    return {model:weapon.children.find(child=>child.name.startsWith('model-'))?.name,weapon:weapon.visible,arms:arms.visible,hands,finite}
  },id)
}
async function watch(page,id) {
  await page.evaluate(async id=>{
    const path=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
    const {_roots}=await import(path),scene=_roots.get(document.querySelector('canvas')).store.getState().scene
    window.armMotion={travel:0,trigger:0,finite:true};const before={}
    const sample=()=>{
      const base=id ? scene.getObjectByName(`remote-player-${id}`) : scene
      for(const side of ['left','right']) {
        const hand=base?.getObjectByName(`${id ? 'remote' : 'view'}-hand-${side}`)
        if(!hand) continue
        if(!before[side]) before[side]={position:hand.position.clone(),finger:hand.children.find(n=>n.name.endsWith('finger-0')).rotation.x}
        window.armMotion.travel=Math.max(window.armMotion.travel,hand.position.distanceTo(before[side].position))
        window.armMotion.trigger=Math.max(window.armMotion.trigger,Math.abs(hand.children.find(n=>n.name.endsWith('finger-0')).rotation.x-before[side].finger))
        window.armMotion.finite &&= hand.position.toArray().every(Number.isFinite)
      }
      window.armFrame=requestAnimationFrame(sample)
    }
    cancelAnimationFrame(window.armFrame);sample()
  },id)
}

test('first-person armored hands grip the gun, animate firing and reloads, and follow dual melee',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await presetLoadout(page,{primary:'rifle',secondary:'pistol',melee:'fangs',character:'ion'})
  await openGame(page)
  await page.getByRole('button',{name:/ENTER TRAINING/}).click()
  await page.getByRole('button',{name:'RESUME / ENTER ARENA'}).click()
  await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(.7)
  await expect.poll(()=>inspect(page)).not.toBeNull()
  const initial=await inspect(page)
  expect(initial).toMatchObject({weapon:true,arms:true,finite:true,model:'model-phantom'})
  for(const hand of initial.hands) expect(hand.gap).toBeLessThan(.0001)
  await page.screenshot({path:'first-person-arms-preview.png'})
  await watch(page)
  await page.mouse.down();await page.waitForTimeout(250);await page.mouse.up()
  await expect.poll(()=>page.evaluate(()=>window.armMotion.trigger)).toBeGreaterThan(.05)
  await page.keyboard.press('KeyR')
  await expect.poll(()=>page.evaluate(()=>window.armMotion.travel)).toBeGreaterThan(.12)
  await expect.poll(async()=>(await state(page)).reloading,{timeout:5000}).toBe(false)
  await page.keyboard.press('Digit2')
  await expect.poll(async()=>(await inspect(page))?.model).toBe('model-echo')
  for(const hand of (await inspect(page)).hands) expect(hand.gap).toBeLessThan(.0001)
  await page.keyboard.press('Digit3')
  await expect.poll(async()=>(await inspect(page))?.model).toBe('model-fangs')
  await page.waitForTimeout(400);await watch(page);await page.mouse.down();await page.mouse.up()
  await expect.poll(()=>page.evaluate(()=>window.armMotion.travel)).toBeGreaterThan(.08)
  await page.screenshot({path:'dual-melee-hands-preview.png'})
  expect((await inspect(page)).finite).toBe(true);expect(errors).toEqual([])
})

test('multiplayer opponents carry their selected gun and animate server-owned reloads, stance and weapon switches',async({page})=>{
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page)
  await page.getByRole('button',{name:/^MULTIPLAYER/}).click()
  await page.getByLabel('YOUR CALLSIGN').fill('Arms Pilot')
  await page.getByRole('button',{name:'CREATE PRIVATE ROOM'}).click()
  const peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{name:'Arms Peer',loadout:{character:'aegis',primary:'rifle',secondary:'magnus',melee:'gravity',unique:'scanner'}})
  peer.onMessage('loadout-bank',()=>{});peer.onMessage('shot-trail',()=>{})
  let interval,sequence=0,combatSequence=0,z=-1,crouch=false,pitch=0
  const command=action=>peer.send('combat',{action,epoch:peer.state.arenaEpoch,round:peer.state.roundId,sequence:combatSequence++,yaw:Math.PI,pitch})
  try {
    await page.getByLabel('Match format').selectOption('freeplay')
    peer.send('ready',{ready:true})
    await page.getByRole('button',{name:'READY UP',exact:true}).click()
    await page.getByRole('button',{name:'START SHARED ARENA'}).click()
    await page.getByRole('button',{name:'ENTER ARENA',exact:true}).click()
    await expect.poll(()=>inspect(page,peer.sessionId)).not.toBeNull()
    await expect.poll(async()=>(await inspect(page,peer.sessionId)).model).toBe('model-phantom')
    interval=setInterval(()=>peer.send('move',{sequence:sequence++,round:peer.state.roundId,x:0,z,yaw:Math.PI,pitch,crouch,sprint:false,jump:false,active:true}),50)
    await expect.poll(()=>peer.state.players.get(peer.sessionId).z,{timeout:10000}).toBeGreaterThan(-4);z=0
    await page.keyboard.down('KeyW')
    try {
      // Release on the browser frame that reaches the destination; slow remote
      // round trips must not keep walking into the opponent during inspection.
      await page.evaluate(async()=>{
        const path='/src/multiplayer/poses.js',url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
        const {arenaView}=await import(url),start=performance.now()
        await new Promise((resolve,reject)=>{
          const check=()=>{
            if(arenaView.position[2]<5) {document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));resolve()}
            else if(performance.now()-start>10000) reject(new Error('Did not approach opponent'))
            else requestAnimationFrame(check)
          };check()
        })
      })
    } finally {await page.keyboard.up('KeyW')}
    await page.screenshot({path:'multiplayer-enemy-weapon-preview.png'})
    const equipped=await inspect(page,peer.sessionId)
    expect(equipped).toMatchObject({weapon:true,arms:true,finite:true})
    for(const hand of equipped.hands) expect(hand.gap).toBeLessThan(.0001)
    await watch(page,peer.sessionId);pitch=.6;command('fire')
    await expect.poll(()=>peer.state.players.get(peer.sessionId).shot).toBeGreaterThan(0)
    command('reload')
    await expect.poll(()=>page.evaluate(()=>window.armMotion.travel)).toBeGreaterThan(.08)
    await expect.poll(()=>peer.state.players.get(peer.sessionId).reloading,{timeout:6000}).toBe(false)
    crouch=true
    await expect.poll(()=>peer.state.players.get(peer.sessionId).arsenal.crouched).toBe(true)
    expect((await inspect(page,peer.sessionId)).finite).toBe(true)
    peer.send('combat',{action:'switch',weapon:'magnus',epoch:peer.state.arenaEpoch,round:peer.state.roundId,sequence:combatSequence++})
    await expect.poll(async()=>(await inspect(page,peer.sessionId))?.model).toBe('model-magnus')
    await expect.poll(()=>peer.state.tick/ONLINE.tickRate>=peer.state.players.get(peer.sessionId).attackReadyAt).toBe(true)
    peer.send('combat',{action:'switch',weapon:'gravity',epoch:peer.state.arenaEpoch,round:peer.state.roundId,sequence:combatSequence++})
    await expect.poll(async()=>(await inspect(page,peer.sessionId))?.model).toBe('model-breaker')
    await page.waitForTimeout(700);await watch(page,peer.sessionId);command('fire')
    await expect.poll(()=>page.evaluate(()=>window.armMotion.travel)).toBeGreaterThan(.1)
    expect((await inspect(page,peer.sessionId)).finite).toBe(true)
    expect(errors).toEqual([])
  } finally {clearInterval(interval);await peer.leave()}
})
