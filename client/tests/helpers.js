import { expect } from '@playwright/test'
import { PLAYER, TARGETS } from '../src/game/config.js'

// Match Vite's active module URL so HMR timestamps cannot create a second store.
export const state = page => page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === '/src/game/store.js')?.name
  return (await import(url || '/src/game/store.js')).game.get()
})
export const diagnostics = page => page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === '/src/game/runtime.js')?.name
  return (await import(url || '/src/game/runtime.js')).runtime
})
export const position = async page => (await diagnostics(page)).position

export async function lookAt(page, yaw, pitch) {
  const look = await diagnostics(page), sensitivity = PLAYER.sensitivity*(await state(page)).settings.sensitivity
  await page.evaluate(({ x,y }) => document.dispatchEvent(new MouseEvent('mousemove',{ movementX:x,movementY:y })), { x:(look.yaw-yaw)/sensitivity,y:(look.pitch-pitch)/sensitivity })
  await expect.poll(async () => Math.abs((await diagnostics(page)).yaw-yaw)).toBeLessThan(sensitivity*1.5)
  await expect.poll(async () => Math.abs((await diagnostics(page)).pitch-pitch)).toBeLessThan(sensitivity*1.5)
}

export async function aimAtTarget(page,index = 1) {
  const p = await position(page), [x,y,z] = TARGETS[index], dx = p[0]-x, dz = p[2]-z
  await lookAt(page,Math.atan2(dx,dz),Math.atan2(y+0.12-(p[1]+PLAYER.eye),Math.hypot(dx,dz)))
}

export async function aimAtOpponent(page) {
  const p = await position(page), bot = (await diagnostics(page)).opponent.position
  await lookAt(page,Math.atan2(p[0]-bot[0],p[2]-bot[2]),Math.atan2(bot[1]+0.05-(p[1]+PLAYER.eye),Math.hypot(p[0]-bot[0],p[2]-bot[2])))
}

export async function moveUntil(page,key,index,value,direction) {
  await page.keyboard.down(key)
  try {
    // Release the actual input inside the browser on the threshold frame.
    // Remote polling can otherwise keep a key held during a slow round trip.
    await page.evaluate(async ({ key,index,value,direction }) => {
      const url = performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === '/src/game/runtime.js')?.name
      const { runtime } = await import(url || '/src/game/runtime.js')
      const start = performance.now()
      await new Promise((resolve,reject) => {
        const release = () => document.dispatchEvent(new KeyboardEvent('keyup',{ code:key,bubbles:true }))
        const check = () => {
          if (direction*(runtime.position[index]-value)>0) { release(); resolve() }
          else if (performance.now()-start>12000) { release(); reject(new Error(`Movement did not reach ${value}`)) }
          else requestAnimationFrame(check)
        }
        check()
      })
    },{ key,index,value,direction })
  } finally { await page.keyboard.up(key) }
  await page.waitForTimeout(350)
}

// Capture the actual short-lived DOM feedback before slow automation round trips.
export async function observeHitFeedback(page) {
  await page.evaluate(() => {
    window.__duelFeedback = null
    new MutationObserver(() => {
      const element = document.querySelector('[data-testid="hit-feedback"]')
      if (element) window.__duelFeedback = { damage:Number(element.dataset.damage),headshot:element.dataset.headshot==='true',text:element.textContent }
    }).observe(document.body,{ childList:true,subtree:true,attributes:true })
  })
}
export const observedFeedback = page => page.evaluate(() => window.__duelFeedback)

export async function presetLoadout(page, { character='vex',primary='rifle',unique='flashbang',startingWeapon='pistol' } = {}) {
  await page.addInitScript(loadout => localStorage.setItem('duel-loadout',JSON.stringify(loadout)),{ character,primary,unique,startingWeapon })
}
