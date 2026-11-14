import {test,expect} from '@playwright/test'
import {Client} from '@colyseus/sdk'
import {diagnostics,state, openGame,openMultiplayer} from './helpers.js'

const crosshair=page=>page.locator('.custom-crosshair[data-crouched]')
const view=(page,id)=>page.evaluate(async id=>{
  const path=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/@react-three_fiber.js')).name
  const {_roots}=await import(path),{scene,camera}=_roots.get(document.querySelector('canvas')).store.getState()
  const remote=scene.getObjectByName(`remote-player-${id}`)
  return {eye:camera.position.y,head:remote?.getObjectByName('robot-head')?.parent.position.y,leg:remote?.getObjectByName('robot-leg1')?.parent.rotation.x}
},id)
async function pressCrouch(page,key='ControlLeft') {
  await page.keyboard.down(key)
  await expect(crosshair(page)).toHaveAttribute('data-crouched','true')
  await expect(page.locator('.movement-spread-hint')).toHaveText('CROUCHED / STEADY AIM')
}

test('training crouch lowers the capsule, slows sprinting and clears on release/pause with a rebindable control',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page,'/')
  await page.getByRole('button',{name:/SETTINGS/}).click()
  await page.getByRole('tab',{name:'Controls',exact:true}).click()
  await expect(page.getByRole('button',{name:'Rebind Crouch (hold)',exact:true})).toHaveText('L CTRL')
  await page.getByRole('button',{name:/^BACK/}).click()
  await page.getByRole('button',{name:/ENTER TRAINING/}).click()
  await page.getByRole('button',{name:'RESUME / ENTER ARENA'}).click()
  await expect.poll(async()=>(await diagnostics(page)).grounded).toBe(true)
  const initial=(await diagnostics(page)).position[1]
  const initialEye=(await view(page)).eye
  await pressCrouch(page)
  await expect.poll(async()=>(await diagnostics(page)).position[1]).toBeLessThan(initial-.25)
  expect((await view(page)).eye).toBeLessThan(initialEye-.5)
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW')
  await expect.poll(async()=>Math.hypot(...(await diagnostics(page)).velocity.filter((_,i)=>i!==1))).toBeGreaterThan(2.5)
  expect(Math.hypot(...(await diagnostics(page)).velocity.filter((_,i)=>i!==1))).toBeLessThan(3)
  await page.screenshot({path:'crouch-preview.png'})
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.keyboard.up('ControlLeft')
  await expect(crosshair(page)).toHaveAttribute('data-crouched','false')
  await expect.poll(async()=>(await diagnostics(page)).position[1]).toBeGreaterThan(initial-.02)
  await pressCrouch(page,'ControlRight')
  await page.evaluate(()=>document.exitPointerLock());await page.keyboard.up('ControlRight')
  await page.getByRole('button',{name:'RESUME / ENTER ARENA'}).click()
  await expect(crosshair(page)).toHaveAttribute('data-crouched','false')
  await page.evaluate(()=>document.exitPointerLock())
  await page.getByRole('button',{name:'SETTINGS',exact:true}).click()
  await page.getByRole('tab',{name:'Controls',exact:true}).click()
  await page.getByRole('button',{name:'Rebind Crouch (hold)',exact:true}).click()
  await page.keyboard.press('KeyV')
  await page.getByRole('button',{name:'SAVE ON DEVICE',exact:true}).click()
  await page.getByRole('button',{name:/^BACK/}).click()
  await page.getByRole('button',{name:'RESUME / ENTER ARENA'}).click()
  expect((await state(page)).settings.bindings.crouch).toBe('KeyV')
  await pressCrouch(page,'KeyV');await page.keyboard.up('KeyV')
  await expect(crosshair(page)).toHaveAttribute('data-crouched','false')
  expect(errors).toEqual([])
})

test('online crouch predicts locally, replicates both players and fires from the lowered authoritative eye',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await openGame(page,'/')
  await openMultiplayer(page,'casual','Crouch Pilot')
  const peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{name:'Crouch Peer'}),trails=[]
  peer.onMessage('loadout-bank',()=>{});peer.onMessage('shot-trail',trail=>trails.push(trail))
  let peerInput
  try {
    await page.getByLabel('Match format').selectOption('freeplay')
    peer.send('ready',{ready:true})
    await page.getByRole('button',{name:'READY UP',exact:true}).click()
    await page.getByRole('button',{name:'ENTER ARENA',exact:true}).click()
    const host=()=>peer.state.players.get(peer.state.hostId)
    await expect.poll(()=>host()?.grounded).toBe(true)
    const standing=host().y
    await pressCrouch(page)
    await expect.poll(()=>host()?.arsenal.crouched).toBe(true)
    expect(host().y).toBeLessThan(standing-.25)
    await page.mouse.down();await page.mouse.up()
    await expect.poll(()=>trails.length).toBe(1)
    expect(trails[0].origin[1]).toBeCloseTo(host().y+.4,2)
    let sequence=0
    const move=()=>peer.send('move',{sequence:sequence++,round:peer.state.roundId,x:0,z:0,yaw:Math.PI,pitch:0,sprint:false,jump:false,crouch:true,active:true})
    move();peerInput=setInterval(move,50)
    await expect.poll(()=>peer.state.players.get(peer.sessionId)?.arsenal.crouched).toBe(true)
    await expect.poll(async()=>(await view(page,peer.sessionId)).head).toBeCloseTo(.4,4)
    expect((await view(page,peer.sessionId)).leg).toBeCloseTo(-.85,4)
    await page.keyboard.up('ControlLeft')
    await expect(crosshair(page)).toHaveAttribute('data-crouched','false')
    await expect.poll(()=>host()?.arsenal.crouched).toBe(false)
    expect(errors).toEqual([])
  } finally {clearInterval(peerInput);await peer.leave()}
})
