import {test,expect} from '@playwright/test'
import {Client} from '@colyseus/sdk'
import {openGame,openMultiplayer,enterOnlineArena,presetLoadout} from './helpers.js'
import {PLAYER} from '../src/game/config.js'
import {ROBOT_HEAD_Y} from '../../shared/robot.js'

test('a real multiplayer kill reaches both clients and the feed expires without removing weapon information',async({page,baseURL})=>{
  test.setTimeout(90000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
  await presetLoadout(page,{primary:'hyperion'});await openGame(page);await openMultiplayer(page,'casual','raf1')
  const endpoint=new URL(baseURL).port==='5180' ? 'http://127.0.0.1:2590' : 'http://127.0.0.1:2567'
  const peer=await new Client(endpoint).joinById(await page.getByTestId('invite-code').textContent(),{name:'raf2'}),events=[]
  peer.onMessage('elimination',event=>events.push(event));peer.onMessage('shot-trail',()=>{});peer.onMessage('loadout-bank',()=>{})
  try {
    await page.getByLabel('Match format').selectOption('freeplay');peer.send('ready',{ready:true})
    await page.getByRole('button',{name:'READY UP',exact:true}).click();await enterOnlineArena(page)
    await expect(page.locator('.online-names')).toHaveCount(0)
    await expect(page.locator('.online-top')).not.toContainText('TRAINING FACILITY')
    const ammo=page.locator('.online-vitals .ammo')
    await expect(ammo.getByLabel('Weapon selection')).toBeVisible();await expect(ammo.locator('.scope-hint')).toBeVisible()
    await expect(page.getByTestId('online-ammo')).toHaveText('05 / 5')
    async function assertWeaponLayout() {
      const bounds=await ammo.locator(':scope > *').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {tag:n.tagName,cls:n.className,top:r.top,bottom:r.bottom,left:r.left,right:r.right}}))
      expect(bounds.length).toBeGreaterThanOrEqual(4)
      for(let i=1;i<bounds.length;i++) expect(bounds[i].top,JSON.stringify(bounds)).toBeGreaterThanOrEqual(bounds[i-1].bottom-1)
      for(const r of bounds) {expect(r.left).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(page.viewportSize().width)}
    }
    await assertWeaponLayout()
    await page.setViewportSize({width:390,height:844});await assertWeaponLayout();await page.setViewportSize({width:1280,height:800})
    await page.evaluate(async({id,eye,head})=>{
      const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name || path
      const {arenaView,latestPose}=await import(url('/src/multiplayer/poses.js')),{game}=await import(url('/src/game/store.js'))
      const p=arenaView.position,target=latestPose(id),yaw=Math.atan2(p[0]-target.x,p[2]-target.z),pitch=Math.atan2(target.y+head-p[1]-eye,Math.hypot(p[0]-target.x,p[2]-target.z))
      const sensitivity=.002*game.get().settings.sensitivity
      document.dispatchEvent(new MouseEvent('mousemove',{movementX:(arenaView.yaw-yaw)/sensitivity,movementY:(arenaView.pitch-pitch)/sensitivity}))
    },{id:peer.sessionId,eye:PLAYER.eye,head:ROBOT_HEAD_Y})
    await page.mouse.down();await page.mouse.up()
    const row=page.getByTestId('kill-feed-entry')
    await expect(row).toContainText('raf1');await expect(row).toContainText('raf2')
    await expect(row.getByRole('img',{name:'HYPERION X',exact:true})).toBeVisible()
    await expect(row.getByRole('img',{name:'Headshot',exact:true})).toBeVisible()
    await expect.poll(()=>events.length).toBe(1);expect(events[0].targetId).toBe(peer.sessionId)
    await page.screenshot({path:'kill-feed-online-preview.png'})
    await expect(row).toHaveCount(0,{timeout:4500})
    await expect(ammo.getByLabel('Weapon selection')).toBeVisible();await expect(page.getByTestId('online-ammo')).toHaveText('04 / 5')
    expect(errors).toEqual([])
  } finally {await peer.leave()}
})

test('rapid eliminations stack with distinct gun and melee icons and fade after three seconds',async({page})=>{
  await openGame(page)
  await page.evaluate(async()=>{
    const resources=performance.getEntriesByType('resource'),react=resources.find(e=>new URL(e.name).pathname.endsWith('/react.js')).name,dom=resources.find(e=>new URL(e.name).pathname.endsWith('/react-dom_client.js')).name
    const [r,d,{default:KillFeed},{appendKill}]=await Promise.all([import(react),import(dom),import('/src/multiplayer/KillFeed.jsx'),import('/src/multiplayer/killFeed.js')])
    let entries=[]
    for(const [index,weapon] of ['rifle','magnus','blade'].entries()) entries=appendKill(entries,{epoch:1,round:1,sequence:index+1,attackerId:'a',targetId:`b${index}`,attacker:'raf1',target:`raf${index+2}`,weapon},performance.now())
    const el=document.createElement('div');document.body.append(el)
    ;(d.createRoot || d.default.createRoot)(el).render((r.createElement || r.default.createElement)(KillFeed,{entries,selfId:'a'}))
  })
  const rows=page.getByTestId('kill-feed-entry');await expect(rows).toHaveCount(3)
  await expect(rows.first().getByRole('img')).toHaveAccessibleName('PHANTOM EDGE')
  await expect(rows.nth(1).getByRole('img')).toHaveAccessibleName('MAGNUS-45')
  const boxes=await rows.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
  expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom);expect(boxes[2].top).toBeGreaterThan(boxes[1].bottom)
  await expect.poll(()=>rows.first().evaluate(n=>Number(getComputedStyle(n).opacity))).toBe(1)
  await page.screenshot({path:'kill-feed-stack-preview.png'})
  await expect.poll(()=>rows.first().evaluate(n=>Number(getComputedStyle(n).opacity)),{timeout:4500}).toBe(0)
})
