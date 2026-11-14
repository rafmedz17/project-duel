import {test,expect} from '@playwright/test'
import {openGame,enterTraining,presetLoadout} from './helpers.js'

test('rapid fire renders tapered trails, glowing heads and impact sparks, then clears the effects',async({page})=>{
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error' && /WebGLProgram|VALIDATE_STATUS|shader error/i.test(message.text())) errors.push(message.text())})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>localStorage.setItem('duel-settings',JSON.stringify({quality:'Low'})))
  await presetLoadout(page,{primary:'rifle'})
  await openGame(page);await enterTraining(page)
  await page.evaluate(async()=>{
    const path=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname.endsWith('/@react-three_fiber.js')).name
    const {_roots}=await import(path),{scene}=_roots.get(document.querySelector('canvas')).store.getState()
    window.trailProbe={heads:0,cores:0,sparks:false,finite:true,longest:0}
    const sample=()=>{
      const cores=scene.getObjectByName('bullet-trail-cores'),heads=scene.getObjectByName('bullet-trail-heads')
      if(cores && heads) {
        const p=window.trailProbe
        p.cores=Math.max(p.cores,cores.count);p.heads=Math.max(p.heads,heads.count)
        p.sparks ||= cores.count>heads.count
        const matrices=cores.instanceMatrix.array.slice(0,cores.count*16)
        p.finite &&= [...matrices].every(Number.isFinite)
        for(let i=0;i<cores.count;i++) p.longest=Math.max(p.longest,Math.hypot(...matrices.slice(i*16+4,i*16+7)))
        p.current=cores.count
      }
      requestAnimationFrame(sample)
    }
    sample()
  })
  await page.mouse.down()
  await expect.poll(()=>page.evaluate(()=>window.trailProbe.heads)).toBeGreaterThan(0)
  await expect.poll(()=>page.evaluate(()=>window.trailProbe.sparks)).toBe(true)
  await page.screenshot({path:'enhanced-bullet-trails-preview.png'})
  await page.mouse.up()
  await expect.poll(()=>page.evaluate(()=>window.trailProbe.current)).toBe(0)
  const probe=await page.evaluate(()=>window.trailProbe)
  expect(probe.finite).toBe(true);expect(probe.longest).toBeLessThanOrEqual(3.21)
  expect(probe.cores).toBeLessThanOrEqual(448)
  expect(errors).toEqual([])
})
