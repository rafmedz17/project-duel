import { test,expect } from '@playwright/test'
import { state } from './helpers.js'

const cloudOrigin='http://127.0.0.1:5174'
const userId='11111111-1111-4111-8111-111111111111'
const otherId='22222222-2222-4222-8222-222222222222'
const encode=value => btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
const token=`${encode({ alg:'HS256',typ:'JWT' })}.${encode({ sub:userId,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600 })}.fixture_signature`
const user={ id:userId,aud:'authenticated',role:'authenticated',email:'nova@example.test',app_metadata:{ provider:'email' },user_metadata:{},identities:[],created_at:'2026-11-13T00:00:00Z' }
const initial = () => ({ profile:{ callsign:'Nova Cloud' },loadout:{ starting_weapon:'pistol',weapons:['pistol','blade','rifle','shotgun'],abilities:['dash','shield','scanner','emp'] },requests:[] })
async function mockCloud(context,shared=initial()) {
  await context.route('http://127.0.0.1:54329/**',async route => {
    const request=route.request(),url=new URL(request.url()),method=request.method()
    const body=request.postDataJSON()
    shared.requests.push({ path:url.pathname,method,body })
    let response
    if (method==='OPTIONS') { await route.fulfill({ status:204,headers:{ 'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS' } }); return }
    if (url.pathname==='/auth/v1/token') {
      if (body.password==='incorrect') { await route.fulfill({ status:400,contentType:'application/json',body:JSON.stringify({ msg:'Invalid login credentials',error_code:'invalid_credentials' }) }); return }
      response={ access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'fixture-refresh',user:{ ...user,user_metadata:shared.metadata || {} } }
    } else if (url.pathname==='/auth/v1/signup') response={ user,session:null }
    else if (url.pathname==='/auth/v1/recover' || url.pathname==='/auth/v1/logout') response={}
    else if (url.pathname==='/auth/v1/user') {
      if(method==='PUT' && body.data) {
        if(shared.failPreferences) { await route.fulfill({ status:403,contentType:'application/json',body:JSON.stringify({ msg:'Preference sync unavailable',error_code:'fixture_denied' }) });return }
        shared.metadata={ ...shared.metadata,...body.data }
      }
      response={ ...user,user_metadata:shared.metadata || {} }
    }
    else if (url.pathname==='/rest/v1/profiles') {
      if (method==='PATCH' || method==='POST') shared.profile={ callsign:body.callsign }
      response=shared.profile
    } else if (url.pathname==='/rest/v1/loadouts') {
      if (method==='POST') shared.loadout={ ...body }
      response=method==='POST' ? null : shared.loadout
    } else if(url.pathname==='/rest/v1/loadout_slots') response=shared.slots || []
    else if(url.pathname==='/rest/v1/rpc/save_loadout_bank') {
      if(shared.beforeSaveBank) await shared.beforeSaveBank()
      if(shared.failLoadoutBank) {await route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({message:'Loadout save unavailable. Try again.'})});return}
      shared.slots=body.p_slots.map((gear,slot_id)=>({ user_id:userId,slot_id,character_id:gear.character,primary_weapon:gear.primary,secondary_weapon:gear.secondary,melee_weapon:gear.melee,unique_skill:gear.unique,starting_weapon:gear.startingWeapon,weapons:gear.weapons,abilities:gear.abilities }))
      shared.loadout={ ...shared.slots[body.p_active_slot],active_slot:body.p_active_slot };response=null
    } else if (url.pathname==='/rest/v1/profile_stats') response=url.searchParams.has('ranked_games') ? [{ user_id:userId,rating:1064,wins:6,losses:4,ranked_games:4,profiles:shared.profile }] : { games:10,wins:6,losses:4,kills:18,deaths:12,ranked_games:4,rating:1064 }
    else if (url.pathname==='/rest/v1/duel_matches') response=[{ id:'33333333-3333-4333-8333-333333333333',player_one:userId,player_two:otherId,name_one:shared.profile.callsign,name_two:'Echo',score_one:2,score_two:1,winner_slot:0,map_id:'neon',reason:'elimination',ended_at:'2026-11-13T00:02:00Z',ranked:true,rating_delta_one:16,rating_delta_two:-16 }]
    else { await route.fulfill({ status:500,body:`Unexpected fixture request: ${url.pathname}` }); return }
    await route.fulfill({ status:200,contentType:'application/json',headers:{ 'access-control-allow-origin':'*' },body:JSON.stringify(response) })
  })
  return shared
}
async function signIn(page) {
  await page.goto(cloudOrigin)
  await page.getByRole('button',{ name:/^PLAYER PROFILE/ }).click()
  const dialog=page.getByRole('dialog',{ name:'PLAYER PROFILE' })
  await dialog.getByLabel('EMAIL',{ exact:true }).fill('nova@example.test')
  await dialog.getByLabel('PASSWORD',{ exact:true }).fill('correct-password')
  await dialog.getByRole('button',{ name:'SIGN IN',exact:true }).last().click()
  await expect(dialog.getByLabel('CALLSIGN')).toHaveValue('Nova Cloud')
}

test('training saves the selected preset to the account, retains edits after failure and restores it on another device',async({page,context,browser})=>{
  const shared=await mockCloud(context),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signIn(page)
  await page.getByRole('dialog').getByRole('button',{name:'BACK',exact:true}).click()
  await page.getByRole('button',{name:/ENTER TRAINING/}).click()
  await page.getByRole('button',{name:'RESUME / ENTER ARENA'}).click()
  const before=await state(page)
  await page.keyboard.press('KeyB')
  const dialog=page.getByRole('dialog',{name:'FIELD ARMORY',exact:true})
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Saves to your account.',{exact:false})).toBeVisible()
  await dialog.getByRole('button',{name:'Loadout slot 3',exact:true}).click()
  await dialog.getByRole('button',{name:'Select ION',exact:true}).click()
  await dialog.getByRole('button',{name:'Equip SPECTRAL SMOKE',exact:true}).click()
  shared.failLoadoutBank=true
  await dialog.getByRole('button',{name:/SAVE & RETURN/}).click()
  await expect(dialog.getByRole('alert')).toContainText('Loadout save unavailable')
  await expect(dialog.getByRole('button',{name:'Select ION',exact:true})).toHaveAttribute('aria-pressed','true')
  expect((await state(page)).loadout).toEqual(before.loadout)
  shared.failLoadoutBank=false
  let release
  shared.beforeSaveBank=()=>new Promise(resolve=>{release=resolve})
  await dialog.getByRole('button',{name:/SAVE & RETURN/}).click()
  await expect(dialog.getByRole('button',{name:/SAVING/})).toBeDisabled()
  await expect.poll(()=>Boolean(release)).toBe(true)
  await page.keyboard.press('KeyB');await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button',{name:'CANCEL / RETURN TO TRAINING',exact:true})).toBeDisabled()
  release();delete shared.beforeSaveBank
  await expect(dialog).toHaveCount(0)
  expect((await state(page)).loadout).toMatchObject({character:'ion',unique:'smoke'})
  expect(shared.loadout).toMatchObject({active_slot:2,character_id:'ion',unique_skill:'smoke'})
  expect(shared.slots[0].character_id).toBe(before.loadout.character)
  expect(shared.requests.filter(request=>request.path==='/rest/v1/rpc/save_loadout_bank')).toHaveLength(2)
  const second=await browser.newContext()
  try {
    await mockCloud(second,shared)
    const other=await second.newPage();await signIn(other)
    await other.getByRole('dialog').getByRole('button',{name:'BACK',exact:true}).click()
    await other.getByRole('button',{name:/^CHARACTER & LOADOUT/}).click()
    await expect(other.getByRole('button',{name:'Loadout slot 3',exact:true})).toHaveAttribute('aria-pressed','true')
    await expect(other.getByRole('button',{name:'Select ION',exact:true})).toHaveAttribute('aria-pressed','true')
    await expect(other.getByRole('button',{name:'Equip SPECTRAL SMOKE',exact:true})).toHaveAttribute('aria-pressed','true')
  } finally {await second.close()}
  expect(errors).toEqual([])
})
test('account settings sync through Auth metadata, restore on another device, retry errors and preserve guest preferences',async ({ page,context,browser })=> {
  const shared=await mockCloud(context)
  await page.goto(cloudOrigin);await page.getByRole('button',{ name:/SETTINGS/ }).click();await page.getByRole('tab',{name:'Sensitivity',exact:true}).click();await page.getByLabel('Mouse sensitivity').fill('1.8');await page.getByRole('button',{ name:'BACK' }).click()
  await signIn(page);await page.getByRole('dialog').getByRole('button',{ name:'BACK',exact:true }).click();await page.getByRole('button',{ name:/SETTINGS/ }).click()
  await page.getByLabel('Field of view').fill('99');await page.getByLabel('Scope input').selectOption('tap')
  await page.getByRole('tab',{name:'Sensitivity',exact:true}).click();await page.getByLabel('Mouse sensitivity').fill('1.2');await page.getByLabel('Sniper ADS sensitivity',{exact:true}).fill('0.55');await page.getByLabel('Rifle firing sensitivity',{exact:true}).fill('0.8')
  await page.getByRole('tab',{ name:'Controls',exact:true }).click();await page.getByRole('button',{ name:'Rebind Reload',exact:true }).click();await page.keyboard.press('KeyL')
  shared.failPreferences=true;await page.getByRole('button',{ name:'SAVE TO ACCOUNT',exact:true }).click();await expect(page.getByRole('status')).toContainText('Could not sync')
  expect((await state(page)).settings.bindings.reload).toBe('KeyL');shared.failPreferences=false
  await page.getByRole('button',{ name:'SAVE TO ACCOUNT',exact:true }).click();await expect(page.getByRole('status')).toHaveText('Settings saved to your account.')
  expect(shared.metadata.duel_settings).toMatchObject({ fov:99,sensitivity:1.2,weaponSensitivity:{SNIPER:{ads:.55},RIFLE:{firing:.8}},scopeMode:'tap',bindings:{ reload:'KeyL' } })
  await page.reload();await page.getByRole('button',{ name:/SETTINGS/ }).click();await expect(page.getByLabel('Field of view')).toHaveValue('99')
  await page.getByLabel('Field of view').fill('101');await page.reload();await page.getByRole('button',{ name:/SETTINGS/ }).click();await expect(page.getByLabel('Field of view')).toHaveValue('101')
  await page.getByLabel('Field of view').fill('99');await page.getByRole('button',{ name:'SAVE TO ACCOUNT',exact:true }).click();await expect(page.getByRole('status')).toHaveText('Settings saved to your account.')
  const secondContext=await browser.newContext()
  try {
    await mockCloud(secondContext,shared);const second=await secondContext.newPage();await signIn(second);await second.getByRole('dialog').getByRole('button',{ name:'BACK',exact:true }).click();await second.getByRole('button',{ name:/SETTINGS/ }).click();await expect(second.getByLabel('Field of view')).toHaveValue('99')
    await second.getByRole('tab',{name:'Sensitivity',exact:true}).click();await expect(second.getByLabel('Mouse sensitivity')).toHaveValue('1.2');await expect(second.getByLabel('Sniper ADS sensitivity',{exact:true})).toHaveValue('0.55');await expect(second.getByLabel('Rifle firing sensitivity',{exact:true})).toHaveValue('0.8')
    await second.getByRole('tab',{ name:'Controls',exact:true }).click();await expect(second.getByRole('button',{ name:'Rebind Reload',exact:true })).toHaveText('L')
  } finally { await secondContext.close() }
  await page.getByRole('button',{ name:'BACK' }).click();await page.getByRole('button',{ name:/^PLAYER PROFILE/ }).click();await page.getByRole('button',{ name:'SIGN OUT',exact:true }).click();await expect(page.getByLabel('EMAIL',{ exact:true })).toBeVisible();await page.getByRole('dialog').getByRole('button',{ name:'BACK',exact:true }).click();await page.getByRole('button',{ name:/SETTINGS/ }).click();await expect(page.getByLabel('Field of view')).toHaveValue('70')
  await page.getByRole('tab',{name:'Sensitivity',exact:true}).click();await expect(page.getByLabel('Mouse sensitivity')).toHaveValue('1.8');await expect(page.getByLabel('Sniper ADS sensitivity',{exact:true})).toHaveValue('1')
})

test('guest loadout saves across reloads and controls training weapons and abilities',async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{ name:/^CHARACTER & LOADOUT/ }).click()
  const dialog=page.getByRole('dialog',{ name:'CHARACTER & LOADOUT' })
  await expect(dialog.getByText(/Saves on this device/)).toBeVisible()
  await dialog.getByRole('button',{ name:'Select AEGIS' }).click()
  await dialog.getByRole('button',{ name:'SHOTGUNS',exact:true }).click()
  await dialog.getByRole('button',{ name:'Equip BREACH-12',exact:true }).click()
  await dialog.getByRole('button',{ name:'Equip SPECTRAL SMOKE',exact:true }).click()
  await dialog.getByRole('button',{ name:/SAVE & EQUIP/ }).click()
  await expect(dialog.getByRole('status')).toContainText('saved on this device')
  await dialog.screenshot({ path:'loadout-preview.png' })
  await page.reload()
  await page.getByRole('button',{ name:/ENTER TRAINING/ }).click()
  await page.getByRole('button',{ name:'RESUME / ENTER ARENA' }).click()
  await expect.poll(async () => (await state(page)).weapon).toBe('shotgun')
  await page.keyboard.press('Digit2'); await page.keyboard.press('KeyE')
  expect((await state(page)).weapon).toBe('pistol')
  expect((await state(page)).loadout).toMatchObject({ character:'aegis',primary:'shotgun',unique:'smoke' })
  expect((await state(page)).abilities.dash.uses).toBe(1)
  await expect(page.getByTestId('ability-smoke')).toBeVisible()

})
test('email sign-in, saved callsign/loadout, restored session, history and leaderboard use provider responses',async ({ page,context,browser }) => {
  const shared=await mockCloud(context),errors=[]
  page.on('pageerror',error => errors.push(error.message))
  await signIn(page)
  const dialog=page.getByRole('dialog')
  await dialog.getByLabel('CALLSIGN').fill('Nova Saved')
  await dialog.getByRole('button',{ name:'SAVE CALLSIGN' }).click()
  await expect(dialog.getByRole('status')).toContainText('Callsign saved')
  await expect(dialog.getByText(/WIN RATE 60%/)).toBeVisible()
  await dialog.getByRole('button',{ name:'CHARACTER & LOADOUT',exact:true }).click()
  await dialog.getByRole('button',{ name:'Select ION' }).click()
  await dialog.getByRole('button',{ name:'Equip SPECTRAL SMOKE',exact:true }).click()
  await dialog.getByRole('button',{ name:/SAVE & EQUIP/ }).click()
  await expect(dialog.getByRole('status')).toContainText('saved to your account')
  await dialog.getByRole('button',{ name:'MATCH HISTORY',exact:true }).click()
  await expect(dialog.getByText('VICTORY',{ exact:true })).toBeVisible()
  await expect(dialog.getByText(/RANKED · \+16 ELO/)).toBeVisible()
  await dialog.getByRole('button',{ name:'LEADERBOARD',exact:true }).click()
  await expect(dialog.getByRole('cell',{ name:'Nova Saved',exact:true })).toBeVisible()
  await expect(dialog.getByRole('cell',{ name:'1064',exact:true })).toBeVisible()
  await dialog.screenshot({ path:'leaderboard-preview.png' })
  await page.reload()
  await page.getByRole('button',{ name:/^PLAYER PROFILE/ }).click()
  await expect(page.getByLabel('CALLSIGN')).toHaveValue('Nova Saved')
  await page.getByRole('dialog').getByRole('button',{ name:'BACK',exact:true }).click()
  await page.getByRole('button',{ name:/^MULTIPLAYER/ }).click()
  await expect(page.getByLabel('YOUR CALLSIGN')).toHaveValue('Nova Saved')
  await expect(page.getByLabel('YOUR CALLSIGN')).toBeDisabled()
  // A fresh browser loads the same saved equipment after signing in.
  const secondContext=await browser.newContext()
  try {
    await mockCloud(secondContext,shared)
    const second=await secondContext.newPage()
    await second.goto(cloudOrigin)
    await second.getByRole('button',{ name:/^PLAYER PROFILE/ }).click()
    await second.getByLabel('EMAIL',{ exact:true }).fill('nova@example.test')
    await second.getByLabel('PASSWORD',{ exact:true }).fill('correct-password')
    await second.getByRole('dialog').getByRole('button',{ name:'SIGN IN',exact:true }).last().click()
    await expect(second.getByLabel('CALLSIGN')).toHaveValue('Nova Saved')
    await second.getByRole('dialog').getByRole('button',{ name:'CHARACTER & LOADOUT',exact:true }).click()
    await expect(second.getByRole('tab',{ name:'PRIMARY slot' })).toContainText('VXR-9 PHANTOM')
    await expect(second.getByRole('button',{ name:'Select ION' })).toHaveAttribute('aria-pressed','true')
    await expect(second.getByRole('button',{ name:'Equip SPECTRAL SMOKE',exact:true })).toHaveAttribute('aria-pressed','true')
    await second.getByRole('dialog').getByRole('button',{ name:'PLAYER PROFILE',exact:true }).click()
    await second.getByRole('button',{ name:'SIGN OUT',exact:true }).click()
    await expect(second.getByLabel('EMAIL',{ exact:true })).toBeVisible()
  } finally { await secondContext.close() }
  expect(errors).toEqual([])
})
test('registration confirmation, invalid credentials and reset email show actionable notices',async ({ page,context }) => {
  const shared=await mockCloud(context)
  await page.goto(cloudOrigin)
  await page.getByRole('button',{ name:/^PLAYER PROFILE/ }).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('button',{ name:'REGISTER',exact:true }).click()
  await dialog.getByLabel('EMAIL',{ exact:true }).fill('nova@example.test')
  await dialog.getByLabel('PASSWORD',{ exact:true }).fill('correct-password')
  await dialog.getByRole('button',{ name:'CREATE ACCOUNT',exact:true }).click()
  await expect(dialog.getByRole('status')).toContainText('Check your email')
  await dialog.getByRole('button',{ name:'SIGN IN',exact:true }).first().click()
  await dialog.getByLabel('PASSWORD',{ exact:true }).fill('incorrect')
  await dialog.getByRole('button',{ name:'SIGN IN',exact:true }).last().click()
  await expect(dialog.getByRole('alert')).toContainText('Invalid login credentials')
  await dialog.getByRole('button',{ name:'RESET PASSWORD',exact:true }).click()
  await dialog.getByRole('button',{ name:'SEND RESET LINK' }).click()
  await expect(dialog.getByRole('status')).toContainText('a password reset link is on its way')
  expect(shared.requests.some(r => r.path==='/auth/v1/recover' && r.body.email==='nova@example.test')).toBe(true)
})

test('a recovery link opens password update and submits the replacement password',async ({ page,context }) => {
  const shared=await mockCloud(context)
  await page.goto(`${cloudOrigin}/#access_token=${token}&refresh_token=fixture-refresh&expires_in=3600&token_type=bearer&type=recovery`)
  const dialog=page.getByRole('dialog',{ name:'PLAYER PROFILE' })
  await dialog.getByLabel('NEW PASSWORD',{ exact:true }).fill('replacement-password')
  await dialog.getByRole('button',{ name:'SAVE NEW PASSWORD',exact:true }).click()
  await expect(dialog.getByText('Password updated.',{ exact:true })).toBeVisible()
  expect(shared.requests.some(r => r.path==='/auth/v1/user' && r.method==='PUT' && r.body.password==='replacement-password')).toBe(true)
})
