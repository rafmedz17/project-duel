import { test,expect } from '@playwright/test'
import { Client } from '@colyseus/sdk'
import { makeLoadoutBank } from '../../shared/loadoutBank.js'
import { validateLoadout } from '../../shared/loadout.js'
import { PLAYER } from '../../shared/arena.js'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'
import { state,editLoadout } from './helpers.js'

const gear=(primary,character='vex')=>validateLoadout({ character,primary,secondary:'volt',melee:'gravity',unique:'scanner',startingWeapon:primary })
function bank() {
  const value=makeLoadoutBank(gear('hyperion'));value.slots[1]=gear('omega','ion');value.slots[2]=gear('railbreaker','aegis');value.slots[4]=gear('shotgun','raze');return value
}
const network=page=>page.evaluate(async ()=> {
  const path='/src/multiplayer/lobby.js',url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
  return (await import(url)).lobby.get()
})
const self=async page=> { const s=await network(page);return s.room?.players.find(p=>p.id===s.sessionId)?.combat }
async function openRoom(page,format) {
  await page.addInitScript(value=>localStorage.setItem('duel-loadout-bank',JSON.stringify(value)),bank())
  await page.goto('/');await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
  await page.getByLabel('YOUR CALLSIGN').fill('Preset Pilot');await page.getByRole('button',{ name:'CREATE PRIVATE ROOM' }).click()
  const peer=await new Client('http://127.0.0.1:2567').joinById(await page.getByTestId('invite-code').textContent(),{ name:'Preset Peer',loadout:gear('hyperion') })
  peer.onMessage('shot-trail',()=>{})
  await page.getByLabel('Match format').selectOption(format)
  peer.send('ready',{ ready:true });await page.getByRole('button',{ name:'READY UP',exact:true }).click()
  await page.getByRole('button',{ name:'START SHARED ARENA' }).click()
  return peer
}
async function aimAtPeer(page,id) {
  await page.evaluate(async ({ id,eye,head,sensitivity })=> {
    const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
    const { arenaView,latestPose }=await import(url('/src/multiplayer/poses.js')),{ game }=await import(url('/src/game/store.js'))
    const p=arenaView.position,target=latestPose(id),scale=sensitivity*game.get().settings.sensitivity
    const yaw=Math.atan2(p[0]-target.x,p[2]-target.z),pitch=Math.atan2(target.y+head-p[1]-eye,Math.hypot(p[0]-target.x,p[2]-target.z))
    document.dispatchEvent(new MouseEvent('mousemove',{ movementX:(arenaView.yaw-yaw)/scale,movementY:(arenaView.pitch-pitch)/scale }))
  },{ id,eye:PLAYER.eye,head:ROBOT_HEAD_Y,sensitivity:PLAYER.sensitivity })
}

test('five presets automatically save independent choices, survive reload and fit a smaller screen',async ({ page })=> {
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/');await page.getByRole('button',{ name:/^CHARACTER & LOADOUT/ }).click()
  const dialog=page.getByRole('dialog'),slots=dialog.getByRole('group',{ name:'Five loadout slots' })
  await expect(slots.getByRole('button')).toHaveCount(5)
  await expect(dialog.getByLabel('Starting weapon')).toHaveCount(0)
  await expect(dialog.getByText(/GENERAL SKILLS/)).toHaveCount(0)
  const configs=[['aegis','shotgun'],['ion','hyperion'],['raze','nova'],['vex','omega']]
  for(let i=0;i<configs.length;i++) {
    const [character,primary]=configs[i]
    await slots.getByRole('button',{ name:`Loadout slot ${i+2}`,exact:true }).click()
    await editLoadout(page,{character,primary})
  }
  await editLoadout(page,{secondary:'magnus',melee:'fangs'})
  await expect(dialog.getByRole('button',{name:/SAVE & EQUIP/})).toHaveCount(0)
  await expect(dialog.getByRole('status')).toContainText('AUTO-SAVED')
  await page.reload();await page.getByRole('button',{ name:/^CHARACTER & LOADOUT/ }).click()
  await expect(dialog.getByRole('button',{ name:'Loadout slot 5',exact:true })).toHaveAttribute('aria-pressed','true')
  await expect(dialog.getByRole('button',{ name:'Change primary gun',exact:true })).toContainText('OMEGA-88')
  await dialog.getByRole('button',{ name:'Loadout slot 2',exact:true }).click()
  await expect(dialog.getByRole('button',{ name:'Change character',exact:true })).toContainText('AEGIS')
  await page.setViewportSize({ width:640,height:670 });await slots.scrollIntoViewIfNeeded()
  const box=await slots.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(641)
  await page.screenshot({ path:'five-loadouts-preview.png' })
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('duel-loadout-bank')))
  expect(saved.activeSlot).toBe(1);expect(saved.slots.map(slot=>slot.primary)).toEqual(['rifle','shotgun','hyperion','nova','omega'])
  expect(saved.slots[4]).toMatchObject({ secondary:'magnus',melee:'fangs' })
  expect(saved.slots.every(slot=>slot.startingWeapon===slot.primary)).toBe(true)
  await dialog.getByRole('button',{ name:'BACK',exact:true }).click()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async ()=>(await state(page)).weapon).toBe('shotgun')
  expect(errors).toEqual([])
})

test('Best of Three opens selection before both rounds and deploys the chosen character and weapons',async ({ page })=> {
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let peer
  try {
    peer=await openRoom(page,'duel')
    const phase=page.getByRole('dialog',{ name:'LOADOUT PHASE',exact:true })
    await expect(phase).toBeVisible();await expect(phase.getByRole('button',{ name:/Loadout slot/ })).toHaveCount(5)
    await phase.getByRole('button',{ name:'Loadout slot 2',exact:true }).click()
    await expect.poll(async ()=>(await self(page)).activeSlot).toBe(1)
    expect((await self(page)).characterId).toBe('ion')
    await phase.getByRole('button',{ name:'Loadout slot 3',exact:true }).click()
    await expect.poll(async ()=>(await self(page)).activeSlot).toBe(2)
    await page.screenshot({ path:'round-loadout-phase-preview.png' })
    await expect(page.getByRole('button',{ name:'ENTER ARENA',exact:true })).toBeVisible({ timeout:18000 })
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    expect((await self(page)).loadout).toMatchObject({ character:'aegis',primary:'railbreaker',secondary:'volt',melee:'gravity' })
    expect((await self(page)).magazines.railbreaker).toBe(3)
    await aimAtPeer(page,peer.sessionId);await page.mouse.down();await page.mouse.up()
    await expect(page.getByTestId('round-result')).toContainText('ROUND WON')
    await expect(phase).toBeVisible({ timeout:6500 });await expect(phase).toContainText('ROUND 2')
    await expect(page.getByTestId('kill-badge')).toHaveCount(0)
    await phase.getByRole('button',{ name:'Loadout slot 2',exact:true }).click()
    await expect.poll(async ()=>(await self(page)).activeSlot).toBe(1)
    await expect(page.getByRole('button',{ name:'ENTER ARENA',exact:true })).toBeVisible({ timeout:18000 })
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    expect((await self(page)).weapon).toBe('omega');expect((await self(page)).magazines.omega).toBe(100)
    expect((await self(page)).hp).toBe(100);expect((await self(page)).kills).toBe(1)
    expect(errors).toEqual([])
  } finally { await peer?.leave() }
})

test('Free Play releases the cursor after death, gives five seconds to swap and respawns with the selected preset',async ({ page })=> {
  test.setTimeout(60000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let peer
  try {
    peer=await openRoom(page,'freeplay')
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    const shooter=peer.state.players.get(peer.sessionId),victim=[...peer.state.players.entries()].find(([id])=>id!==peer.sessionId)[1]
    peer.send('combat',{ sequence:0,epoch:peer.state.arenaEpoch,action:'fire',yaw:Math.atan2(shooter.x-victim.x,shooter.z-victim.z),pitch:Math.atan2(victim.y+ROBOT_HEAD_Y-shooter.y-PLAYER.eye,Math.hypot(shooter.x-victim.x,shooter.z-victim.z)) })
    const picker=page.getByRole('dialog',{ name:'RESPAWN LOADOUT',exact:true })
    await expect(picker).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===null)).toBe(true)
    const before=await self(page),seconds=before.respawnAt-(await network(page)).room.time
    expect(seconds).toBeGreaterThan(3.5);expect(seconds).toBeLessThanOrEqual(5)
    await picker.getByRole('button',{ name:'Loadout slot 2',exact:true }).click()
    await expect.poll(async ()=>(await self(page)).activeSlot).toBe(1)
    expect((await self(page)).hp).toBe(0)
    await page.screenshot({ path:'respawn-loadout-phase-preview.png' })
    await expect.poll(async ()=>(await self(page)).hp,{ timeout:6500 }).toBe(100)
    await expect(picker).toHaveCount(0)
    expect((await self(page)).weapon).toBe('omega');expect((await self(page)).magazines.omega).toBe(100)
    expect((await self(page)).characterId).toBe('ion');expect((await self(page)).deaths).toBe(1)
    await page.getByRole('button',{ name:'ENTER ARENA',exact:true }).click()
    expect(errors).toEqual([])
  } finally { await peer?.leave() }
})
