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
      response={ access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'fixture-refresh',user }
    } else if (url.pathname==='/auth/v1/signup') response={ user,session:null }
    else if (url.pathname==='/auth/v1/recover' || url.pathname==='/auth/v1/logout') response={}
    else if (url.pathname==='/auth/v1/user') response=user
    else if (url.pathname==='/rest/v1/profiles') {
      if (method==='PATCH' || method==='POST') shared.profile={ callsign:body.callsign }
      response=shared.profile
    } else if (url.pathname==='/rest/v1/loadouts') {
      if (method==='POST') shared.loadout={ ...body }
      response=method==='POST' ? null : shared.loadout
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
test('guest loadout saves across reloads and controls training weapons and abilities',async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{ name:/^CHARACTER & LOADOUT/ }).click()
  const dialog=page.getByRole('dialog',{ name:'CHARACTER & LOADOUT' })
  await expect(dialog.getByText(/Saves on this device/)).toBeVisible()
  await dialog.getByRole('button',{ name:'Select AEGIS' }).click()
  await dialog.getByRole('button',{ name:'SHOTGUNS',exact:true }).click()
  await dialog.getByRole('button',{ name:'Equip BREACH-12',exact:true }).click()
  await dialog.getByRole('button',{ name:'Equip SPECTRAL SMOKE',exact:true }).click()
  await dialog.getByLabel('Starting weapon').selectOption('shotgun')
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
  await dialog.getByLabel('Starting weapon').selectOption('rifle')
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
    await expect(second.getByLabel('Starting weapon')).toHaveValue('rifle')
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
