import { useSyncExternalStore } from 'react'
import { DEFAULT_LOADOUT, validateLoadout, migrateLoadout } from '../../../shared/loadout.js'
import { makeLoadoutBank,validateLoadoutBank,bankFromRows } from '../../../shared/loadoutBank.js'

const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
function deviceLoadout() {
  try { return migrateLoadout(JSON.parse(localStorage.getItem('duel-loadout'))) || DEFAULT_LOADOUT }
  catch { return DEFAULT_LOADOUT }
}
function deviceBank() {
  try { return validateLoadoutBank(JSON.parse(localStorage.getItem('duel-loadout-bank'))) || makeLoadoutBank(deviceLoadout()) }
  catch { return makeLoadoutBank(deviceLoadout()) }
}
const initialBank=deviceBank()
let state = { configured,loading:configured,busy:false,user:null,profile:null,bank:initialBank,loadout:initialBank.slots[initialBank.activeSlot],stats:null,history:[],leaderboard:[],error:'',notice:'',recovery:false }
let clientPromise, initialized, generation=0
const listeners = new Set()
const update = patch => { state = { ...state,...patch }; listeners.forEach(fn => fn()) }
async function client() {
  if (!configured) throw new Error('Cloud accounts are not enabled for this game yet. You can still play as a guest and save a loadout on this device.')
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{ global:{ fetch:(input,options={}) => fetch(input,{ ...options,signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) } }))
  return clientPromise
}
function check(result) { if (result.error) throw result.error; return result.data }
async function loadUser(user) {
  const version = ++generation
  const bank=deviceBank()
  update({ user:user ? { id:user.id,email:user.email } : null,profile:null,stats:null,history:[],bank,loadout:bank.slots[bank.activeSlot],loading:Boolean(user),error:'' })
  if (!user) return
  try {
    const db = await client()
    let profile = check(await db.from('profiles').select('callsign').eq('user_id',user.id).maybeSingle())
    if (!profile) {
      check(await db.from('profiles').upsert({ user_id:user.id,callsign:'Pilot' },{ onConflict:'user_id',ignoreDuplicates:true }))
      profile = check(await db.from('profiles').select('callsign').eq('user_id',user.id).single())
    }
    const [equipment,stats,presets] = await Promise.all([
      db.from('loadouts').select('active_slot,character_id,primary_weapon,secondary_weapon,melee_weapon,unique_skill,starting_weapon,weapons,abilities').eq('user_id',user.id).maybeSingle(),
      db.from('profile_stats').select('games,wins,losses,kills,deaths,ranked_games,rating').eq('user_id',user.id).maybeSingle(),
      db.from('loadout_slots').select('*').eq('user_id',user.id).order('slot_id'),
    ])
    const row = check(equipment)
    const savedBank=bankFromRows(row,check(presets))
    if (!savedBank) throw new Error('Your saved loadouts are invalid. Save the slots again to repair them.')
    if (version===generation) update({ profile,bank:savedBank,loadout:savedBank.slots[savedBank.activeSlot],stats:check(stats),loading:false })
  } catch (error) { if (version===generation) update({ loading:false,error:error.message || 'Could not load your profile.' }) }
}
async function run(action) {
  if (state.busy) return
  update({ busy:true,error:'',notice:'' })
  try { await action(await client()) }
  catch (error) { update({ error:error.message || 'The account request failed. Try again.' }) }
  finally { update({ busy:false }) }
}
export const accounts = {
  get:() => state,
  init() {
    if (!configured) return Promise.resolve()
    initialized ??= (async () => {
      const db = await client()
      db.auth.onAuthStateChange((event,session) => {
        // Auth callbacks stay synchronous: querying inside one can lock the SDK.
        if (event==='PASSWORD_RECOVERY') update({ recovery:true })
        if (event==='SIGNED_OUT') update({ recovery:false })
        if (event!=='TOKEN_REFRESHED') setTimeout(() => { void loadUser(session?.user || null) },0)
      })
      const { data,error } = await db.auth.getSession()
      if (error) throw error
      await loadUser(data.session?.user || null)
    })().catch(error => { update({ loading:false,error:error.message }) })
    return initialized
  },
  clear() { update({ error:'',notice:'' }) },
  signIn(email,password) { return run(async db => { check(await db.auth.signInWithPassword({ email:email.trim(),password })); update({ notice:'Signed in. Loading your profile…' }) }) },
  signUp(email,password) { return run(async db => {
    const data = check(await db.auth.signUp({ email:email.trim(),password,options:{ emailRedirectTo:location.origin } }))
    update({ notice:data.session ? 'Account created.' : 'Check your email to confirm your account, then sign in.' })
  }) },
  signOut() { return run(async db => { check(await db.auth.signOut()); await loadUser(null); update({ recovery:false,notice:'Signed out.' }) }) },
  resetPassword(email) { return run(async db => { check(await db.auth.resetPasswordForEmail(email.trim(),{ redirectTo:location.origin })); update({ notice:'If this address has an account, a password reset link is on its way.' }) }) },
  updatePassword(password) { return run(async db => { check(await db.auth.updateUser({ password })); update({ recovery:false,notice:'Password updated.' }) }) },
  saveProfile(callsign) { return run(async db => {
    if (!state.user) throw new Error('Sign in first.')
    callsign = callsign.trim().replace(/\s+/g,' ')
    if (!/^[\p{L}\p{N} _-]{2,18}$/u.test(callsign) || callsign.length>18) throw new Error('Use 2–18 letters, numbers, spaces, hyphens or underscores.')
    const userId = state.user.id
    const data = check(await db.from('profiles').update({ callsign }).eq('user_id',userId).select('callsign').single())
    if (state.user?.id===userId) update({ profile:data,notice:'Callsign saved.' })
  }) },
  async saveLoadout(value) {
    const loadout = validateLoadout(value)
    if (!loadout) { update({ error:'Choose a character, one available primary and one unique skill.' }); return }
    const bank={ ...state.bank,slots:state.bank.slots.map((gear,i)=>i===state.bank.activeSlot ? loadout : gear) }
    return accounts.saveBank(bank)
  },
  async saveBank(value) {
    const bank=validateLoadoutBank(value)
    if(!bank) { update({ error:'Save exactly five valid loadout slots.' });return }
    const loadout=bank.slots[bank.activeSlot]
    if (!state.user) {
      try { localStorage.setItem('duel-loadout-bank',JSON.stringify(bank));localStorage.setItem('duel-loadout',JSON.stringify(loadout)); update({ bank,loadout,error:'',notice:'Five loadout slots saved on this device.' }) }
      catch { update({ error:'Browser storage is unavailable. Your loadout could not be saved.' }) }
      return
    }
    return run(async db => {
      const userId = state.user.id
      check(await db.rpc('save_loadout_bank',{ p_slots:bank.slots,p_active_slot:bank.activeSlot }))
      if (state.user?.id===userId) update({ bank,loadout,notice:'Five loadout slots saved to your account.' })
    })
  },
  refresh() { return state.user ? loadUser(state.user) : Promise.resolve() },
  history() { return run(async db => {
    if (!state.user) throw new Error('Sign in to see your match history.')
    const userId=state.user.id
    const data = check(await db.from('duel_matches').select('*').or(`player_one.eq.${userId},player_two.eq.${userId}`).order('ended_at',{ ascending:false }).limit(30))
    if (state.user?.id===userId) update({ history:data })
  }) },
  leaderboard() { return run(async db => {
    const data = check(await db.from('profile_stats').select('user_id,rating,wins,losses,ranked_games,profiles(callsign)').gt('ranked_games',0).order('rating',{ ascending:false }).order('wins',{ ascending:false }).order('user_id').limit(50))
    update({ leaderboard:data })
  }) },
  async joinOptions() {
    await accounts.init()
    if (state.loading) throw new Error('Your profile is still loading. Try again in a moment.')
    if (!state.user) return { loadout:state.loadout,loadoutBank:state.bank }
    if (!state.profile) throw new Error('Open Player Profile and reload your saved profile before joining.')
    const db = await client()
    const data = check(await db.auth.getSession())
    if (!data.session) throw new Error('Your sign-in expired. Sign in again.')
    return { accessToken:data.session.access_token }
  },
}
const identity = value => value
export function useAccount(selector=identity) { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) },() => selector(state)) }
