import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp,rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

async function start(t,overrides={}) {
  const directory=await mkdtemp(join(tmpdir(),'duel-startup-'))
  const reservation=createServer()
  reservation.listen(0,'127.0.0.1')
  await once(reservation,'listening')
  const port=reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const child=spawn(process.execPath,[fileURLToPath(new URL('../src/index.js',import.meta.url))],{
    cwd:directory,
    env:{ ...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',CLIENT_DIRECTORY:'',RESULTS_DIRECTORY:join(directory,'results'),PUBLIC_ORIGIN:'',ALLOWED_ORIGINS:'',RENDER_EXTERNAL_URL:'',RAILWAY_PUBLIC_DOMAIN:'',...overrides },
    stdio:['ignore','pipe','pipe'],
  })
  const exited=once(child,'exit')
  let output=''
  child.stdout.on('data',chunk => { output+=chunk })
  child.stderr.on('data',chunk => { output+=chunk })
  t.after(async () => {
    if (child.exitCode===null && child.signalCode===null) child.kill()
    await exited
    await rm(directory,{ recursive:true,force:true })
  })
  const ready=new Promise((resolve,reject) => {
    child.once('error',reject)
    child.stdout.on('data',() => {
      if (output.includes('PROJECT DUEL lobby listening')) resolve()
    })
    child.once('exit',code => reject(new Error(`Server exited with ${code}: ${output}`)))
  })
  return { ready,exited,output:() => output,endpoint:`http://127.0.0.1:${port}` }
}

test('Render URL starts the production entry point and enforces the browser origin', { timeout:15000 },async t => {
  const server=await start(t,{ RENDER_EXTERNAL_URL:'https://duel-test.onrender.com' })
  await server.ready
  const response=await fetch(`${server.endpoint}/health`,{ headers:{ origin:'https://duel-test.onrender.com' } })
  assert.equal(response.status,200)
  assert.equal((await response.json()).status,'ok')
  assert.equal((await fetch(`${server.endpoint}/health`,{ headers:{ origin:'https://foreign.example' } })).status,403)
})

test('explicit public origin overrides Render URL for custom domains', { timeout:15000 },async t => {
  const server=await start(t,{ PUBLIC_ORIGIN:'https://duel.example',RENDER_EXTERNAL_URL:'https://duel-test.onrender.com' })
  await server.ready
  assert.equal((await fetch(`${server.endpoint}/health`,{ headers:{ origin:'https://duel.example' } })).status,200)
  assert.equal((await fetch(`${server.endpoint}/health`,{ headers:{ origin:'https://duel-test.onrender.com' } })).status,403)
})

test('production still refuses startup without an explicit or platform origin', { timeout:15000 },async t => {
  const server=await start(t)
  await assert.rejects(server.ready,/Set PUBLIC_ORIGIN or ALLOWED_ORIGINS/)
  const [code]=await server.exited
  assert.equal(code,1)
})
