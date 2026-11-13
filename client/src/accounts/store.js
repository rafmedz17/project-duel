import { useSyncExternalStore } from 'react'
import { DEFAULT_LOADOUT, validateLoadout, migrateLoadout } from '../../../shared/loadout.js'

const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
function deviceLoadout() {
  try { return migrateLoadout(JSON.parse(localStorage.getItem('duel-loadout'))) || DEFAULT_LOADOUT }
  catch { return DEFAULT_LOADOUT }
}
let state = { configured,loading:configured,busy:false,user:null,profile:null,loadout:deviceLoadout(),stats:null,history:[],leaderboard:[],error:'',notice:'',recovery:false }
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
  update({ user:user ? { id:user.id,email:user.email } : null,profile:null,stats:null,history:[],loadout:deviceLoadout(),loading:Boolean(user),error:'' })
  if (!user) return
  try {
    const db = await client()
    let profile = check(await db.from('profiles').select('callsign').eq('user_id',user.id).maybeSingle())
    if (!profile) {
      check(await db.from('profiles').upsert({ user_id:user.id,callsign:'Pilot' },{ onConflict:'user_id',ignoreDuplicates:true }))
      profile = check(await db.from('profiles').select('callsign').eq('user_id',user.id).single())
    }
    const [equipment,stats] = await Promise.all([
      db.from('loadouts').select('character_id,primary_weapon,unique_skill,starting_weapon,weapons,abilities').eq('user_id',user.id).maybeSingle(),
      db.from('profile_stats').select('games,wins,losses,kills,deaths,ranked_games,rating').eq('user_id',user.id).maybeSingle(),
    ])
    const row = check(equipment)
    const loadout = row ? migrateLoadout({ ...(row.character_id ? { character:row.character_id,primary:row.primary_weapon,unique:row.unique_skill } : {}),startingWeapon:row.starting_weapon,weapons:row.weapons,abilities:row.abilities }) : DEFAULT_LOADOUT
    if (!loadout) throw new Error('Your saved loadout is invalid. Save a new loadout to repair it.')
    if (version===generation) update({ profile,loadout,stats:check(stats),loading:false })
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
    if (!state.user) {
      try { localStorage.setItem('duel-loadout',JSON.stringify(loadout)); update({ loadout,error:'',notice:'Loadout saved on this device.' }) }
      catch { update({ error:'Browser storage is unavailable. Your loadout could not be saved.' }) }
      return
    }
    return run(async db => {
      const userId = state.user.id
      check(await db.from('loadouts').upsert({ user_id:userId,character_id:loadout.character,primary_weapon:loadout.primary,unique_skill:loadout.unique,starting_weapon:loadout.startingWeapon,weapons:loadout.weapons,abilities:loadout.abilities },{ onConflict:'user_id' }))
      if (state.user?.id===userId) update({ loadout,notice:'Loadout saved to your account.' })
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
    if (!state.user) return { loadout:state.loadout }
    if (!state.profile) throw new Error('Open Player Profile and reload your saved profile before joining.')
    const db = await client()
    const data = check(await db.auth.getSession())
    if (!data.session) throw new Error('Your sign-in expired. Sign in again.')
    return { accessToken:data.session.access_token }
  },
}
const identity = value => value
export function useAccount(selector=identity) { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) },() => selector(state)) }
