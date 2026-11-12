import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { Client } from '@colyseus/sdk'
import { createAccountsService } from '../src/accounts.js'
import { createLobbyServer } from '../src/createServer.js'
import { DEFAULT_LOADOUT } from '../../shared/loadout.js'

const userId='11111111-1111-4111-8111-111111111111'
async function temp(t) {
  const directory=await mkdtemp(join(tmpdir(),'duel-results-'))
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}\\duel-results-`) || resolve(directory).startsWith(`${resolve(tmpdir())}/duel-results-`))
    await rm(directory,{ recursive:true,force:true })
  })
  return directory
}
test('Auth validates the token remotely and loads canonical profile/equipment, ignoring editable metadata',async t => {
  let token
  const client = {
    auth:{ getUser:async value => { token=value; return value==='valid' ? { data:{ user:{ id:userId,user_metadata:{ callsign:'Forged',rating:99999 } } } } : { error:value==='offline' ? Object.assign(new Error('Offline'),{ status:0,name:'AuthRetryableFetchError' }) : new Error('Invalid') } } },
    from(table) { return { select() { return this },eq() { return this },async maybeSingle() { return { data:table==='profiles' ? { callsign:'Canonical' } : { starting_weapon:'rifle',weapons:['rifle'],abilities:[] } } } } },
  }
  const service=createAccountsService({ client,directory:await temp(t) }); t.after(() => service.close())
  assert.deepEqual(await service.verify('valid'),{ userId,name:'Canonical',loadout:{ startingWeapon:'rifle',weapons:['rifle'],abilities:[] } })
  assert.equal(token,'valid')
  await assert.rejects(service.verify('forged'),/expired/)
  await assert.rejects(service.verify('offline'),/temporarily unavailable/)
  await assert.rejects(service.verify({ sub:userId }),/expired/)
})
test('failed uploads persist without tokens, survive restart, and retry the same idempotency key',async t => {
  const directory=await temp(t), sent=[]
  let available=false
  const client={ rpc:async (name,{ p_result }) => { sent.push({ name,result:p_result }); return available ? { data:{ saved:true,ranked:true } } : { error:new Error('Unavailable') } } }
  const first=createAccountsService({ client,directory }); t.after(() => first.close())
  // Let the startup directory scan finish before creating the first queue file.
  await first.retry()
  const result={ id:randomUUID(),player_one:userId,player_two:null,name_one:'Nova',name_two:'Guest' }
  assert.deepEqual(await first.save(result),{ status:'pending',ranked:false })
  assert.equal((await readdir(directory)).length,1)
  assert.deepEqual(JSON.parse(await readFile(join(directory,`${result.id}.json`),'utf8')),result)
  first.close(); available=true
  const second=createAccountsService({ client,directory }); t.after(() => second.close())
  await second.retry()
  assert.equal((await readdir(directory)).length,0)
  assert.ok(sent.length>=2)
  assert.ok(sent.every(value => value.name==='record_duel_result' && value.result.id===result.id))
  assert.deepEqual(await second.save({ id:randomUUID(),player_one:null,player_two:null }),{ status:'skipped',ranked:false })
})
async function until(predicate,timeout=6000) {
  const end=Date.now()+timeout
  while (!predicate()) { if (Date.now()>end) throw new Error('Room synchronization timed out'); await delay(15) }
}
test('real rooms use verified identities/loadouts, reject duplicate accounts, host-lock maps/ranked, and save final snapshots once',async t => {
  const saved=[]
  const accounts={ configured:true,verify:async token => {
    if (!['alpha','bravo'].includes(token)) throw new Error('Invalid token')
    return { userId:token==='alpha' ? userId : '22222222-2222-4222-8222-222222222222',name:token==='alpha' ? 'Verified Nova' : 'Verified Echo',loadout:{ startingWeapon:'rifle',weapons:['rifle'],abilities:['shield'] } }
  },save:async result => { saved.push(structuredClone(result)); return { status:'saved',ranked:false } } }
  const { server,httpServer }=createLobbyServer({ accounts })
  await server.listen(0,'127.0.0.1'); t.after(() => server.gracefullyShutdown(false))
  const sdk=new Client(`http://127.0.0.1:${httpServer.address().port}`)
  const host=await sdk.create('duel_lobby',{ name:'Spoofed',accessToken:'alpha',loadout:DEFAULT_LOADOUT,ranked:true,mapId:'orbital' })
  t.after(() => host.leave().catch(() => {}))
  await until(() => host.state.players?.has(host.sessionId))
  assert.equal(host.state.players.get(host.sessionId).name,'Verified Nova')
  assert.equal(host.state.mapId,'facility'); assert.equal(host.state.ranked,false)
  await assert.rejects(sdk.joinById(host.roomId,{ name:'Impostor',accessToken:'alpha' }))
  await assert.rejects(sdk.joinById(host.roomId,{ name:'Fake',accessToken:'invalid' }))
  const guest=await sdk.joinById(host.roomId,{ name:'Spoofed',accessToken:'bravo' })
  t.after(() => guest.leave().catch(() => {}))
  await until(() => host.state.players.size===2)
  guest.send('map',{ mapId:'orbital' }); guest.send('ranked',{ ranked:true }); await delay(100)
  assert.equal(host.state.mapId,'facility'); assert.equal(host.state.ranked,false)
  host.send('map',{ mapId:['neon'] }); host.send('map',{ mapId:{ toString:'neon' } }); await delay(100)
  assert.equal(host.state.mapId,'facility')
  host.send('ready',{ ready:true }); guest.send('ready',{ ready:true }); await until(() => host.state.phase==='ready')
  host.send('map',{ mapId:'neon' }); await until(() => host.state.mapId==='neon')
  assert.equal(host.state.players.get(host.sessionId).ready,false)
  host.send('ranked',{ ranked:true }); await until(() => host.state.ranked)
  host.send('ready',{ ready:true }); guest.send('ready',{ ready:true }); await until(() => host.state.phase==='ready')
  host.send('start'); await until(() => host.state.matchPhase==='live')
  const player=host.state.players.get(host.sessionId)
  assert.equal(player.weapon,'rifle'); assert.deepEqual([...player.allowedWeapons],['rifle'])
  host.send('combat',{ action:'switch',weapon:'shotgun',sequence:0,epoch:host.state.arenaEpoch,round:host.state.roundId })
  host.send('combat',{ action:'ability',ability:'emp',sequence:1,epoch:host.state.arenaEpoch,round:host.state.roundId })
  host.send('map',{ mapId:'orbital' }); await delay(100)
  assert.equal(player.weapon,'rifle'); assert.equal(player.abilities.get('emp').uses,0); assert.equal(host.state.mapId,'neon')
  host.send('forfeit'); await until(() => host.state.saveStatus==='saved')
  assert.equal(saved.length,1)
  assert.equal(saved[0].name_one,'Verified Nova'); assert.equal(saved[0].player_one,userId)
  assert.equal(saved[0].winner_slot,1); assert.equal(saved[0].map_id,'neon'); assert.equal(saved[0].ranked,true)
  assert.equal(Object.hasOwn(saved[0],'accessToken'),false)
  host.send('forfeit'); await delay(100); assert.equal(saved.length,1)
})
test('guest rooms cannot enable ranked and supplied tokens never silently become guests',async t => {
  const { server,httpServer }=createLobbyServer()
  await server.listen(0,'127.0.0.1'); t.after(() => server.gracefullyShutdown(false))
  const sdk=new Client(`http://127.0.0.1:${httpServer.address().port}`)
  await assert.rejects(sdk.create('duel_lobby',{ name:'Fake',accessToken:'' }))
  const host=await sdk.create('duel_lobby',{ name:'Guest' }); t.after(() => host.leave().catch(() => {}))
  await until(() => host.state.players?.has(host.sessionId))
  host.send('ranked',{ ranked:true }); await delay(100)
  assert.equal(host.state.ranked,false)
  assert.match(host.state.note,/two different signed-in/)
})
