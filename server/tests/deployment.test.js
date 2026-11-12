import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,writeFile,rm,mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { Client } from '@colyseus/sdk'
import { createStaticHandler } from '../src/static.js'
import { createLobbyServer } from '../src/createServer.js'

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(),'duel-static-'))
  t.after(() => rm(directory,{ recursive:true,force:true }))
  await mkdir(join(directory,'assets'))
  await writeFile(join(directory,'index.html'),'<html>PROJECT DUEL</html>')
  await writeFile(join(directory,'assets','app-123.js'),'console.log("duel")')
  await writeFile(join(directory,'assets','app-123.js.gz'),gzipSync('console.log("duel")'))
  await writeFile(join(directory,'assets','large-123.js'),'x'.repeat(200000))
  await writeFile(join(directory,'.env'),'must never be served')
  return directory
}
test('production static responses compress assets, cache hashes and protect private paths',async t => {
  const serve = createStaticHandler(await fixture(t))
  const request = (path,options) => serve(new Request(`http://game.test${path}`,options))
  const index = await request('/')
  assert.match(await index.text(),/PROJECT DUEL/)
  assert.equal(index.headers.get('cache-control'),'no-cache')
  assert.match(index.headers.get('content-security-policy'),/wasm-unsafe-eval/)
  const asset = await request('/assets/app-123.js',{ headers:{ 'accept-encoding':'gzip' } })
  assert.equal(asset.headers.get('content-encoding'),'gzip')
  assert.match(asset.headers.get('cache-control'),/immutable/)
  assert.equal((await request('/assets/app-123.js',{ headers:{ 'accept-encoding':'gzip;q=0' } })).headers.get('content-encoding'),null)
  assert.equal((await request('/assets/missing.js')).status,404)
  for (const path of ['/.env','/.vite/manifest.json','/%2eenv','/assets/%2e%2e%2f.env','/%5c.env']) assert.equal((await request(path)).status,404,path)
  assert.match(await (await request('/account/recovery')).text(),/PROJECT DUEL/)
  assert.equal(await (await request('/',{ method:'HEAD' })).text(),'')
})

test('one production origin serves the game, health, matchmaker and WebSocket rooms; rejects foreign browser origins',async t => {
  const { server,httpServer } = createLobbyServer({ clientDirectory:await fixture(t),allowedOrigins:['https://duel.example'] })
  await server.listen(0,'127.0.0.1')
  t.after(() => server.gracefullyShutdown(false))
  const endpoint = `http://127.0.0.1:${httpServer.address().port}`
  assert.match(await (await fetch(endpoint)).text(),/PROJECT DUEL/)
  assert.equal((await (await fetch(`${endpoint}/health`)).json()).status,'ok')
  // Reuse the same keep-alive connection after a body larger than the socket's
  // high-water mark. A response that never ends stalls subsequent downloads.
  for (const path of ['/assets/large-123.js','/assets/app-123.js','/assets/large-123.js','/']) {
    const asset = await fetch(`${endpoint}${path}`,{ signal:AbortSignal.timeout(3000) })
    assert.equal(asset.status,200)
    assert.ok((await asset.text()).length>0)
  }
  const denied = await fetch(`${endpoint}/matchmake/create/duel_lobby`,{ method:'POST',headers:{ origin:'https://foreign.example','content-type':'application/json' },body:'{"name":"Foreign"}' })
  assert.equal(denied.status,403)
  const room = await new Client(endpoint).create('duel_lobby',{ name:'Deployment Pilot' })
  assert.ok(room.sessionId)
  await room.leave()
})
