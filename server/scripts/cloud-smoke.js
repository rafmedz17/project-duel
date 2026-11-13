// Opt-in integration check. Creates and removes ONLY its own temporary accounts
// and match. Uses normal signed-in sockets and real, server-validated shots.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { loadEnvFile } from 'node:process'
import { parseEnv } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import { Client } from '@colyseus/sdk'
import { ROBOT_HEAD_Y } from '../../shared/robot.js'
import { makeLoadoutBank } from '../../shared/loadoutBank.js'
import { validateLoadout } from '../../shared/loadout.js'

loadEnvFile(new URL('../.env',import.meta.url))
const publicEnv=parseEnv(await readFile(new URL('../../client/.env.local',import.meta.url),'utf8'))
const project=process.argv.find(arg => arg.startsWith('--project-ref='))?.split('=')[1]
assert.ok(project && process.env.SUPABASE_URL===`https://${project}.supabase.co`,'Pass --project-ref=YOUR_PROJECT_REF to confirm the configured test project.')
assert.equal(publicEnv.VITE_SUPABASE_URL,process.env.SUPABASE_URL)
const options={ auth:{ persistSession:false,autoRefreshToken:false },global:{ fetch:(input,init={}) => fetch(input,{ ...init,signal:AbortSignal.timeout(15000) }) } }
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,options)
const publicClient=() => createClient(publicEnv.VITE_SUPABASE_URL,publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY,options)
const created=[],rooms=[]
let browser,browserPage
let matchId
const checked=result => { if (result.error) throw new Error(`Cloud request failed (${result.error.code || result.error.status || result.status || 'unknown'}): ${result.error.message}`); return result.data }
async function until(predicate,timeout=30000) {
  const end=Date.now()+timeout
  while (!predicate()) { if (Date.now()>end) throw new Error('Live match synchronization timed out.'); await delay(25) }
}
try {
  for (const name of ['Smoke Nova','Smoke Echo']) {
    const email=`duel-smoke-${randomUUID()}@example.test`,password=`Duel-${randomUUID()}-9!`
    const { user }=checked(await admin.auth.admin.createUser({ email,password,email_confirm:true }))
    created.push({ user,email,password,client:publicClient() })
    const entry=created.at(-1)
    const auth=checked(await entry.client.auth.signInWithPassword({ email,password }))
    entry.token=auth.session.access_token
    checked(await entry.client.from('profiles').insert({ user_id:user.id,callsign:name }))
    checked(await entry.client.from('loadouts').upsert({ user_id:user.id,character_id:'vex',primary_weapon:'rifle',unique_skill:'scanner',starting_weapon:'rifle',weapons:['pistol','blade','rifle'],abilities:['dash','shield','scanner','ultimate'] }))
  }
  const [one,two]=created
  const bank=makeLoadoutBank(validateLoadout({ character:'vex',primary:'rifle',unique:'scanner',startingWeapon:'rifle' }))
  bank.slots[4]=validateLoadout({ character:'ion',primary:'omega',secondary:'volt',melee:'fangs',unique:'smoke' })
  checked(await one.client.rpc('save_loadout_bank',{ p_slots:bank.slots,p_active_slot:0 }))
  const slots=checked(await one.client.from('loadout_slots').select('*').order('slot_id'))
  assert.equal(slots.length,5);assert.equal(slots[4].primary_weapon,'omega')
  assert.equal(checked(await two.client.from('loadout_slots').select('*').eq('user_id',one.user.id)).length,0)
  // Exercise the expanded slots on the hosted schema, then restore the rifle
  // used by this script's ranked match below.
  checked(await created[0].client.from('loadouts').update({ primary_weapon:'omega',secondary_weapon:'volt',melee_weapon:'fangs',starting_weapon:'volt',weapons:['volt','fangs','omega'] }).eq('user_id',created[0].user.id))
  const expanded=checked(await created[0].client.from('loadouts').select('primary_weapon,secondary_weapon,melee_weapon,weapons').eq('user_id',created[0].user.id).single())
  assert.equal(expanded.primary_weapon,'omega'); assert.equal(expanded.secondary_weapon,'volt'); assert.equal(expanded.melee_weapon,'fangs')
  assert.deepEqual(expanded.weapons,['volt','fangs','omega'])
  checked(await created[0].client.from('loadouts').update({ primary_weapon:'rifle',secondary_weapon:'pistol',melee_weapon:'blade',starting_weapon:'rifle',weapons:['pistol','blade','rifle'] }).eq('user_id',created[0].user.id))
  const savedGear=checked(await one.client.from('loadouts').select('character_id,primary_weapon,unique_skill,weapons,abilities').eq('user_id',one.user.id).single())
  assert.equal(savedGear.character_id,'vex'); assert.equal(savedGear.unique_skill,'scanner')
  assert.deepEqual(savedGear.weapons,['pistol','blade','rifle'])
  const invalidGear=await one.client.from('loadouts').update({ primary_weapon:'sniper' }).eq('user_id',one.user.id)
  assert.ok(invalidGear.error,'Unknown weapon identifiers must be rejected by the database.')
  if (process.argv.includes('--browser')) {
    const { chromium,expect }=await import('../../client/node_modules/@playwright/test/index.mjs')
    browser=await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,args:['--enable-unsafe-swiftshader'] })
    browserPage=await browser.newPage()
    await browserPage.goto('http://127.0.0.1:5173')
    await browserPage.getByRole('button',{ name:/^PLAYER PROFILE/ }).click()
    await browserPage.getByLabel('EMAIL',{ exact:true }).fill(one.email)
    await browserPage.getByLabel('PASSWORD',{ exact:true }).fill(one.password)
    await browserPage.getByRole('dialog').getByRole('button',{ name:'SIGN IN',exact:true }).last().click()
    await expect(browserPage.getByLabel('CALLSIGN')).toHaveValue('Smoke Nova',{ timeout:20000 })
    await browserPage.getByRole('button',{ name:'SAVE CALLSIGN',exact:true }).click()
    await expect(browserPage.getByText('Callsign saved.',{ exact:true })).toBeVisible()
    await browserPage.getByRole('dialog').getByRole('button',{ name:'CHARACTER & LOADOUT',exact:true }).click()
    await expect(browserPage.getByRole('tab',{ name:'PRIMARY slot' })).toContainText('VXR-9 PHANTOM')
    await browserPage.getByRole('button',{ name:/SAVE & EQUIP/ }).click()
    await expect(browserPage.getByText('Five loadout slots saved to your account.',{ exact:true })).toBeVisible()
  }
  const privateRows=checked(await two.client.from('loadouts').select('*').eq('user_id',one.user.id))
  assert.equal(privateRows.length,0)
  const forged=await one.client.rpc('record_duel_result',{ p_result:{ id:randomUUID() } })
  assert.ok(forged.error,'Authenticated players must not be able to submit stats.')
  const sdk=new Client(process.env.DUEL_SMOKE_SERVER || 'http://127.0.0.1:2567')
  const host=await sdk.create('duel_lobby',{ name:'Ignored',accessToken:one.token }); rooms.push(host)
  const guest=await sdk.joinById(host.roomId,{ name:'Ignored',accessToken:two.token }); rooms.push(guest)
  await until(() => host.state.players?.size===2 && guest.state.players?.size===2)
  assert.equal(host.state.players.get(host.sessionId).name,'Smoke Nova')
  host.send('map',{ mapId:'neon' }); host.send('ranked',{ ranked:true })
  await until(() => host.state.mapId==='neon' && host.state.ranked)
  host.send('ready',{ ready:true }); guest.send('ready',{ ready:true })
  await until(() => host.state.phase==='ready')
  host.send('start'); await until(() => host.state.matchPhase==='live')
  let sequence=0
  const winRound=async () => {
    for (let i=0;i<4;i++) {
      const a=host.state.players.get(host.sessionId),b=host.state.players.get(guest.sessionId)
      host.send('combat',{ action:'fire',epoch:host.state.arenaEpoch,round:host.state.roundId,sequence:sequence++,yaw:Math.atan2(a.x-b.x,a.z-b.z),pitch:Math.atan2(b.y+ROBOT_HEAD_Y-a.y-0.65,Math.hypot(a.x-b.x,a.z-b.z)) })
      await delay(180)
    }
  }
  await delay(250); await winRound()
  await until(() => host.state.matchPhase==='roundOver')
  assert.equal(host.state.players.get(host.sessionId).roundWins,1)
  await until(() => host.state.matchPhase==='live' && host.state.roundNumber===2)
  await until(() => host.state.tick>=31*60,45000)
  await winRound()
  await until(() => host.state.matchPhase==='finished')
  await until(() => host.state.saveStatus==='saved',25000)
  assert.equal(host.state.resultRanked,true)
  const history=checked(await one.client.from('duel_matches').select('*').eq('player_one',one.user.id).single())
  matchId=history.id
  assert.equal(history.score_one,2); assert.equal(history.score_two,0); assert.equal(history.ranked,true)
  const stats=checked(await one.client.from('profile_stats').select('*').eq('user_id',one.user.id).single())
  assert.equal(stats.rating,1016); assert.equal(stats.wins,1); assert.equal(stats.kills,2)
  const duplicate=checked(await admin.rpc('record_duel_result',{ p_result:history }))
  assert.equal(duplicate.duplicate,true)
  assert.equal(checked(await one.client.from('profile_stats').select('games').eq('user_id',one.user.id).single()).games,1)
  const leaderboard=checked(await publicClient().from('profile_stats').select('rating,profiles(callsign)').eq('user_id',one.user.id))
  assert.equal(leaderboard[0].rating,1016)
  assert.ok((await publicClient().from('duel_matches').select('*')).error)
  if (browserPage) {
    const { expect }=await import('../../client/node_modules/@playwright/test/index.mjs')
    await browserPage.getByRole('dialog').getByRole('button',{ name:'MATCH HISTORY',exact:true }).click()
    await expect(browserPage.getByText('VICTORY',{ exact:true })).toBeVisible({ timeout:20000 })
    await browserPage.getByRole('dialog').getByRole('button',{ name:'LEADERBOARD',exact:true }).click()
    await expect(browserPage.getByRole('cell',{ name:'Smoke Nova',exact:true })).toBeVisible({ timeout:20000 })
    await expect(browserPage.getByRole('cell',{ name:'1016',exact:true })).toBeVisible()
    console.log('Live browser check passed: sign-in, profile/loadout saves, match history and leaderboard.')
  }
  console.log('Live Supabase check passed: Auth sign-in, profile/loadout RLS, canonical room identity, two validated headshot rounds, saved ranked result, Elo, private history, public leaderboard and idempotency.')
} finally {
  await browser?.close()
  await Promise.allSettled(rooms.map(room => room.leave()))
  // Recover our match ID even if a later assertion failed, then remove only
  // matches involving the two UUIDs created by this run, before deleting users.
  if (!matchId && created.length) {
    const response=await admin.from('duel_matches').select('id').eq('player_one',created[0].user.id)
    if (!response.error) for (const row of response.data) checked(await admin.from('duel_matches').delete().eq('id',row.id))
  } else if (matchId) checked(await admin.from('duel_matches').delete().eq('id',matchId))
  for (const { user,client } of created) {
    checked(await client.auth.signOut({ scope:'global' }))
    checked(await admin.auth.admin.deleteUser(user.id))
  }
  console.log('Removed temporary smoke-test accounts and their match records.')
}
