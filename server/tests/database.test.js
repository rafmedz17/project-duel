import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const one='11111111-1111-4111-8111-111111111111', two='22222222-2222-4222-8222-222222222222', other='33333333-3333-4333-8333-333333333333'
before(async () => {
  // Auth roles/UID claims stand in for Supabase Auth; the migration runs unchanged
  // against actual PostgreSQL, including grants, RLS and the result transaction.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    insert into auth.users values ('${one}'),('${two}'),('${other}');`)
  await db.exec(await readFile(new URL('../../supabase/migrations/20261112182313_accounts_loadouts_rankings.sql',import.meta.url),'utf8'))
  await db.query("insert into public.loadouts(user_id,starting_weapon,weapons,abilities) values ($1,'shotgun',array['pistol','shotgun'],array['scanner','emp'])",[other])
  await db.exec(await readFile(new URL('../../supabase/migrations/20261113064353_characters_and_slot_loadouts.sql',import.meta.url),'utf8'))
  const migrated=(await db.query('select * from public.loadouts where user_id=$1',[other])).rows[0]
  assert.equal(migrated.primary_weapon,'shotgun'); assert.equal(migrated.unique_skill,'scanner')
  assert.deepEqual(migrated.weapons,['pistol','blade','shotgun']); assert.deepEqual(migrated.abilities,['dash','shield','scanner','ultimate'])
  await db.exec(await readFile(new URL('../../supabase/migrations/20261113074736_full_weapon_arsenal.sql',import.meta.url),'utf8'))
  const expanded=(await db.query('select * from public.loadouts where user_id=$1',[other])).rows[0]
  assert.equal(expanded.secondary_weapon,'pistol');assert.equal(expanded.melee_weapon,'blade')
  await db.query('insert into public.profiles(user_id,callsign) values ($1,$2),($3,$4),($5,$6)',[one,'Nova',two,'Echo',other,'Other'])
})
after(async () => { await db.close() })
async function as(role,uid,action) {
  assert.ok(['anon','authenticated','service_role'].includes(role))
  await db.exec('begin')
  try {
    await db.exec(`set local role ${role}`)
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid || ''])
    const result=await action()
    await db.exec('commit')
    return result
  } catch (error) { await db.exec('rollback'); throw error }
}
const result = (extra={}) => ({ id:randomUUID(),player_one:one,player_two:two,name_one:'Nova',name_two:'Echo',score_one:2,score_two:1,kills_one:2,kills_two:1,deaths_one:1,deaths_two:2,winner_slot:0,map_id:'neon',reason:'elimination',started_at:'2026-11-13T00:00:00Z',ended_at:'2026-11-13T00:02:00Z',ranked:true,rounds:[],...extra })
const record = value => as('service_role',null,async () => (await db.query('select public.record_duel_result($1::jsonb) result',[JSON.stringify(value)])).rows[0].result)
test('RLS allows safe public profile reads and only owner profile edits',async () => {
  const rows=await as('anon',null,() => db.query('select * from public.profiles'))
  assert.equal(rows.rows.length,3)
  assert.deepEqual(Object.keys(rows.rows[0]).sort(),['callsign','created_at','user_id'])
  await as('authenticated',one,() => db.query("update public.profiles set callsign='Nova Prime' where user_id=$1",[one]))
  const changed=await as('authenticated',two,() => db.query("update public.profiles set callsign='Stolen' where user_id=$1 returning *",[one]))
  assert.equal(changed.rows.length,0)
  await assert.rejects(as('authenticated',two,() => db.query('insert into public.profiles(user_id,callsign) values ($1,$2)',[one,'Spoof'])))
  await assert.rejects(as('authenticated',one,() => db.query('update public.profiles set user_id=$1 where user_id=$2',[other,one])))
})
test('saved loadouts are private and reject invalid or duplicate equipment',async () => {
  await as('authenticated',one,() => db.query("insert into public.loadouts(user_id,starting_weapon) values ($1,'rifle')",[one]))
  assert.equal((await as('authenticated',two,() => db.query('select * from public.loadouts'))).rows.length,0)
  assert.equal((await as('authenticated',one,() => db.query('select * from public.loadouts'))).rows[0].starting_weapon,'rifle')
  await assert.rejects(as('anon',null,() => db.query('select * from public.loadouts')))
  assert.equal((await as('authenticated',two,() => db.query("update public.loadouts set weapons=array['pistol'] where user_id=$1 returning *",[one]))).rows.length,0)
  await assert.rejects(as('authenticated',one,() => db.query("update public.loadouts set weapons=array['rifle','rifle'] where user_id=$1",[one])))
  await assert.rejects(as('authenticated',one,() => db.query("update public.loadouts set abilities=array['flight'] where user_id=$1",[one])))
})

test('arsenal loadouts save one primary, one pistol and one melee while keeping owner privacy and enforcing slots',async () => {
  await as('authenticated',one,()=>db.query("update public.loadouts set primary_weapon='railbreaker',secondary_weapon='volt',melee_weapon='gravity',starting_weapon='volt',weapons=array['volt','gravity','railbreaker'] where user_id=$1",[one]))
  const row=(await as('authenticated',one,()=>db.query('select * from public.loadouts where user_id=$1',[one]))).rows[0]
  assert.deepEqual(row.weapons,['volt','gravity','railbreaker'])
  assert.equal((await as('authenticated',two,()=>db.query('select * from public.loadouts where user_id=$1',[one]))).rows.length,0)
  for(const sql of ["primary_weapon='magnus'","secondary_weapon='rifle'","melee_weapon='omega'","weapons=array['volt','gravity','railbreaker','nova']","starting_weapon='pistol'"]) await assert.rejects(as('authenticated',one,()=>db.query(`update public.loadouts set ${sql} where user_id=$1`,[one])))
})
test('only the service role can record or alter statistics; results are idempotent',async () => {
  const match=result()
  await assert.rejects(as('authenticated',one,() => db.query('select public.record_duel_result($1::jsonb)',[JSON.stringify(match)])))
  await assert.rejects(as('anon',null,() => db.query('select public.record_duel_result($1::jsonb)',[JSON.stringify(match)])))
  assert.deepEqual(await record(match),{ saved:true,ranked:true,duplicate:false })
  assert.deepEqual(await record({ ...match,winner_slot:1 }),{ saved:true,ranked:true,duplicate:true })
  const stats=(await db.query('select * from public.profile_stats order by user_id')).rows
  assert.equal(stats[0].rating,1016); assert.equal(stats[1].rating,984)
  assert.equal(stats[0].games,1); assert.equal(stats[0].wins,1); assert.equal(stats[1].losses,1)
  await assert.rejects(as('authenticated',one,() => db.query('update public.profile_stats set rating=9999 where user_id=$1',[one])))
  await assert.rejects(as('authenticated',one,() => db.query('delete from public.duel_matches')))
  assert.equal((await as('authenticated',one,() => db.query('select * from public.duel_matches'))).rows.length,1)
  assert.equal((await as('authenticated',other,() => db.query('select * from public.duel_matches'))).rows.length,0)
  await assert.rejects(as('anon',null,() => db.query('select * from public.duel_matches')))
})
test('short games, unscored forfeits, guests and fourth daily pairing do not change Elo',async () => {
  await record(result()); await record(result())
  const before=(await db.query('select rating,ranked_games from public.profile_stats where user_id=$1',[one])).rows[0]
  assert.equal(before.ranked_games,3)
  assert.equal((await record(result())).ranked,false)
  assert.equal((await record(result({ ended_at:'2026-11-13T00:00:05Z' }))).ranked,false)
  assert.equal((await record(result({ score_one:0,score_two:0,reason:'forfeit' }))).ranked,false)
  assert.equal((await record(result({ player_two:null }))).ranked,false)
  const next=(await db.query('select rating,ranked_games from public.profile_stats where user_id=$1',[one])).rows[0]
  assert.deepEqual(next,before)
  await assert.rejects(record(result({ player_two:one })))
  assert.equal((await record(result({ started_at:'2026-11-15T00:00:00Z',ended_at:'2026-11-15T00:02:00Z' }))).ranked,true)
})
test('a failed result rolls back stats changes and leaderboard reads expose no private loadouts/history',async () => {
  const before=(await db.query('select games from public.profile_stats where user_id=$1',[one])).rows[0].games
  await assert.rejects(record(result({ map_id:'forged-map' })))
  assert.equal((await db.query('select games from public.profile_stats where user_id=$1',[one])).rows[0].games,before)
  const rows=await as('anon',null,() => db.query('select p.callsign,s.rating,s.ranked_games from public.profile_stats s join public.profiles p using (user_id) where ranked_games>0 order by rating desc limit 50'))
  assert.equal(rows.rows.length,2)
  assert.equal(rows.rows[0].callsign,'Nova Prime')
})
