import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_LOADOUT, validateLoadout } from '../../shared/loadout.js'
import { validateName } from './config.js'

export function createAccountsService({ url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY,directory=resolve('data/results'),client } = {}) {
  const configured = Boolean(client || (url && key))
  const db = client || (configured ? createClient(url,key,{ auth:{ persistSession:false,autoRefreshToken:false },global:{ fetch:(input,options={}) => fetch(input,{ ...options,signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) }) } }) : null)
  const inFlight = new Map()
  const validFile = /^[0-9a-f-]{36}\.json$/
  async function deliver(result) {
    if (inFlight.has(result.id)) return inFlight.get(result.id)
    const operation = (async () => {
      const { data,error } = await db.rpc('record_duel_result',{ p_result:result })
      if (error || !data?.saved) throw new Error('Result upload failed')
      try { await unlink(join(directory,`${result.id}.json`)) }
      catch (error) { if (error.code!=='ENOENT') throw error }
      return { status:'saved',ranked:data.ranked }
    })().finally(() => inFlight.delete(result.id))
    inFlight.set(result.id,operation)
    return operation
  }
  async function retry() {
    if (!configured) return
    try {
      for (const filename of (await readdir(directory)).filter(name => validFile.test(name))) {
        try { await deliver(JSON.parse(await readFile(join(directory,filename),'utf8'))) }
        catch { /* Keep the durable result for the next retry. */ }
      }
    } catch (error) { if (error.code!=='ENOENT') console.error('Could not read pending match results.') }
  }
  const timer = configured ? setInterval(retry,60000) : null
  timer?.unref()
  if (configured) void retry()
  return {
    configured,
    close() { clearInterval(timer) },
    retry,
    async verify(accessToken) {
      if (!configured) throw new Error('Accounts are not enabled on this game server yet. Sign out to play as a guest.')
      if (typeof accessToken!=='string' || !accessToken.trim() || accessToken.length>8192) throw new Error('Your sign-in expired. Sign in again.')
      const { data,error } = await db.auth.getUser(accessToken)
      if (error && (error.name==='AuthRetryableFetchError' || error.status===0 || error.status>=500)) throw new Error('Account verification is temporarily unavailable. Try again shortly.')
      if (error || !data?.user) throw new Error('Your sign-in expired. Sign in again.')
      const userId = data.user.id
      const [profile,loadout] = await Promise.all([
        db.from('profiles').select('callsign').eq('user_id',userId).maybeSingle(),
        db.from('loadouts').select('character_id,primary_weapon,secondary_weapon,melee_weapon,unique_skill,starting_weapon,weapons,abilities').eq('user_id',userId).maybeSingle(),
      ])
      if (profile.error || loadout.error) throw new Error('Could not load your saved profile. Try again shortly.')
      const name = validateName(profile.data?.callsign)
      if (!name) throw new Error('Save a valid callsign in Player Profile before joining a room.')
      const saved = loadout.data
      const equipment = saved ? validateLoadout({ character:saved.character_id,primary:saved.primary_weapon,secondary:saved.secondary_weapon,melee:saved.melee_weapon,unique:saved.unique_skill,startingWeapon:saved.starting_weapon,weapons:saved.weapons,abilities:saved.abilities }) : DEFAULT_LOADOUT
      if (!equipment) throw new Error('Save your loadout again before joining a room.')
      return { userId,name,loadout:equipment }
    },
    async save(result) {
      if (!configured || (!result.player_one && !result.player_two)) return { status:'skipped',ranked:false }
      await mkdir(directory,{ recursive:true })
      const file = join(directory,`${result.id}.json`)
      await writeFile(`${file}.tmp`,JSON.stringify(result),{ mode:0o600 })
      await rename(`${file}.tmp`,file)
      try { return await deliver(result) }
      catch { return { status:'pending',ranked:false } }
    },
  }
}
