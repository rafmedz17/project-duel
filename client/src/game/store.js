import { DEFAULT_LOADOUT, validateLoadout } from '../../../shared/loadout.js'
import { useSyncExternalStore } from 'react'
import { WEAPONS, TARGETS, HAZARD, ABILITIES, OPPONENT } from './config.js'
import { damageTargets, pelletDamage } from './combatRules.js'
import { freshOpponent, damageOpponent } from './opponents/opponentRules.js'
import { cleanPreferences } from '../settings/preferences.js'
import { freshAbility } from '../../../shared/abilities.js'
import { equipTime,isMelee,shotOffsets } from '../../../shared/weapons.js'
import { rayBox } from '../../../shared/ballistics.js'
import { TRAINING_SOLIDS,TRAINING_TARGETS,targetPosition } from './training/config.js'
import { freshTarget,freshTraining,targetEnabled,toggleCourse,recordCourseShot,stepCourses } from './training/rules.js'
import { makeLoadoutBank,validateLoadoutBank } from '../../../shared/loadoutBank.js'
import { ultimateModifiers } from '../../../shared/characters.js'
import { resetTrainingAbilities,activateTraining,stepTrainingAbilities } from './abilities/trainingRules.js'
import { runtime } from './runtime.js'
import { awardKill } from '../../../shared/killCombo.js'
import { queueShotTrail } from './effects/shotTrails.js'
import { loadTrainingOptions,trainingNoReload } from './training/options.js'

let preferencesOwner=null
const preferencesKey=()=>preferencesOwner ? `duel-settings:${preferencesOwner}` : 'duel-settings'
function loadSettings() {
  try {
    return cleanPreferences(JSON.parse(localStorage.getItem(preferencesKey())))
  } catch { return cleanPreferences() }
}
const fresh = () => ({
  hp: 100, weapon: DEFAULT_LOADOUT.startingWeapon, loadout:DEFAULT_LOADOUT,
  magazines: Object.fromEntries(Object.entries(WEAPONS).filter(([,w]) => w.magazine).map(([id,w]) => [id,w.magazine])),
  weaponStats: Object.fromEntries(Object.entries(WEAPONS).filter(([,w]) => w.magazine).map(([id]) => [id,{ shots:0,hits:0 }])),
  spinning:false,spinStarted:-10,windupStart:-10,windupEnd:0,aiming:false,inspectAt:-10,
  reloading: false, reloadWeapon: null, reloadStart: 0, reloadEnd: 0, reloadReason: null, attackReadyAt: 0, lastSwitch: -10, lastShot: -10, lastSwing: -10,
  shot: 0, swings: 0, meleeHits: 0, hit: -10, hitId: 0, hitDamage: 0, hitDefeated: 0, hitHeadshot: false, hurt: -10, score: 0, hits: 0, shots: 0, time: 0,
  killCombo:0,killAt:-10,killBadgeId:0,killHeadshot:false,
  shieldCharge: 0, ultimateShield:0,shieldHit: -10, empHits: 0,flashUntil:0,flashStarted:0,rootedUntil:0,
  abilities: Object.fromEntries(Object.keys(ABILITIES).map(id => [id,freshAbility()])),
  hazards: HAZARD.centers.map(() => ({ disabledUntil:0 })),
  targets: TARGETS.map((_,index) => freshTarget(index)),training:freshTraining(),trainingBank:makeLoadoutBank(),
  opponent: freshOpponent(),
})
let state = { ...fresh(),trainingOptions:loadTrainingOptions(),mode: 'menu', ready: false, error: '', generation: 0, settings: loadSettings(), fps: 0 }
// Attack timing uses the frame clock; React receives time snapshots at 20 Hz.
let clock = 0
let pendingAttack=null
const opponentPosition = [...OPPONENT.spawn]
const listeners = new Set()
function canAttack() {
  return state.mode === 'playing' && !state.reloading && clock >= state.attackReadyAt &&
    (WEAPONS[state.weapon].fireMode === 'melee' || trainingNoReload(state,clock) || state.magazines[state.weapon] > 0)
}
const clearReload = { reloading:false,reloadWeapon:null,reloadStart:0,reloadEnd:0,reloadReason:null }
function beginReload(weapon, reason) {
  return { reloading:true,reloadWeapon:weapon,reloadStart:clock,reloadEnd:clock+WEAPONS[weapon].reload,reloadReason:reason }
}
function hitFeedback(damage, defeated, headshot = false) {
  return { hit:clock,hitId:state.hitId+1,hitDamage:damage,hitDefeated:defeated,hitHeadshot:headshot }
}
export const game = {
  get: () => state,
  subscribe:fn => { listeners.add(fn); return () => listeners.delete(fn) },
  now: () => clock,
  set: (patch) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()) },
  reset: ({ opponentEnabled = false,loadout = DEFAULT_LOADOUT,bank } = {}) => {
    const equipped = validateLoadout(loadout) || DEFAULT_LOADOUT; clock = 0; pendingAttack=null; resetTrainingAbilities(); opponentPosition.splice(0,3,...OPPONENT.spawn); game.set({ ...fresh(),loadout:equipped,trainingBank:validateLoadoutBank(bank) || makeLoadoutBank(equipped),weapon:equipped.startingWeapon,opponent:freshOpponent(opponentEnabled),generation: state.generation + 1 }) },
  toggleCourse: () => {
    if(state.mode!=='playing') return false
    const patch=toggleCourse(state,clock,runtime.position)
    if(!patch) return false
    game.cancelAttack();game.set(patch);return true
  },
  applyTrainingBank: value => {
    const bank=validateLoadoutBank(value)
    if(!bank || state.mode!=='loadout' || state.hp<=0) return false
    const loadout=bank.slots[bank.activeSlot],clean=fresh()
    pendingAttack=null;resetTrainingAbilities()
    game.set({ trainingBank:bank,loadout,weapon:loadout.primary,magazines:clean.magazines,abilities:clean.abilities,...clearReload,spinning:false,spinStarted:-10,windupEnd:0,aiming:false,shieldCharge:0,ultimateShield:0,flashUntil:0,rootedUntil:0,lastSwitch:clock,attackReadyAt:clock+equipTime(loadout.primary),lastShot:-10,lastSwing:-10 })
    return true
  },
  opponentPosition: () => [...opponentPosition],
  reportOpponentPosition: (position) => { opponentPosition.splice(0,3,...position) },
  setOpponentEnabled: (enabled) => {
    if (!['playing','paused'].includes(state.mode)) return
    opponentPosition.splice(0,3,...OPPONENT.spawn)
    game.set({ opponent:freshOpponent(enabled === true) })
  },
  opponentPhase: (phase) => {
    if (state.opponent.enabled && state.opponent.phase !== phase) game.set({ opponent:{ ...state.opponent,phase } })
  },
  opponentShot: () => {
    if (state.mode !== 'playing' || !state.opponent.enabled || state.opponent.hp <= 0 || clock<state.opponent.disabledUntil) return false
    game.set({ opponent:{ ...state.opponent,attacks:state.opponent.attacks+1 } })
    return true
  },
  opponentHit: () => {
    if (state.mode !== 'playing' || !state.opponent.enabled || state.opponent.hp <= 0 || clock<state.opponent.disabledUntil) return false
    game.damage(OPPONENT.damage)
    game.set({ opponent:{ ...state.opponent,hits:state.opponent.hits+1 } })
    return true
  },
  settings: (patch,{ dirty=true }={}) => {
    const settings = cleanPreferences({ ...state.settings,...patch })
    try {
      localStorage.setItem(preferencesKey(), JSON.stringify(settings))
      if(preferencesOwner && dirty) localStorage.setItem(`${preferencesKey()}:pending`,'1')
    } catch { /* Storage may be disabled. */ }
    game.set({ settings })
  },
  loadPreferences: (userId,saved) => {
    preferencesOwner=userId || null
    let pending=false
    try { pending=Boolean(preferencesOwner && localStorage.getItem(`${preferencesKey()}:pending`)==='1') } catch { /* Device storage may be disabled. */ }
    const settings=saved && !pending ? cleanPreferences(saved) : loadSettings()
    game.settings(settings,{ dirty:false })
  },
  preferencesSaved: userId => {
    if(preferencesOwner!==userId) return
    try { localStorage.setItem(`${preferencesKey()}:pending`,'0') } catch { /* Cloud save already succeeded. */ }
  },
  setTrainingOptions: value => {
    if(!value || typeof value.noReload!=='boolean') return false
    const trainingOptions={ noReload:value.noReload }
    try { localStorage.setItem('duel-training-options',JSON.stringify(trainingOptions)) } catch { /* Device storage may be disabled. */ }
    game.set({ trainingOptions,...(value.noReload ? { ...clearReload,magazines:fresh().magazines } : {}) })
    return true
  },
  damage: (amount) => {
    if (state.mode !== 'playing' || !Number.isFinite(amount) || amount <= 0) return
    const bonus = ultimateModifiers(state,clock).effect==='shield' ? Math.min(state.ultimateShield,amount) : 0
    const normal = clock < state.abilities.shield.activeUntil ? Math.min(state.shieldCharge,amount-bonus) : 0
    const absorbed = bonus+normal
    const healthDamage = amount-absorbed
    game.set({ hp: Math.max(0, state.hp-healthDamage),ultimateShield:state.ultimateShield-bonus,shieldCharge:state.shieldCharge-normal, ...(absorbed ? { shieldHit:clock } : {}), ...(healthDamage ? { hurt:clock } : {}), time: clock })
    if (state.hp === 0) {
      document.exitPointerLock(); resetTrainingAbilities(); pendingAttack=null
      game.set({ mode:'dead',killCombo:0,killAt:-10,shieldCharge:0,ultimateShield:0,flashUntil:0,rootedUntil:0,abilities:Object.fromEntries(Object.entries(state.abilities).map(([id,a]) => [id,{ ...a,activeUntil:0,flying:false }])) })
    }
  },
  activateAbility: (id,details = {}) => {
    const patch = activateTraining(state,clock,id,details)
    if (!patch) return false
    game.set(patch)
    return true
  },
  reload: () => {
    const tuning = WEAPONS[state.weapon]
    if (state.mode === 'playing' && !trainingNoReload(state,clock) && tuning.magazine && !state.reloading && state.magazines[state.weapon] < tuning.magazine && clock-state.lastSwitch >= equipTime(state.weapon)) {
      game.cancelAttack()
      game.set({ ...beginReload(state.weapon,'manual'),time:clock })
    }
  },
  switchWeapon: (weapon) => {
    if (state.mode !== 'playing' || !Object.hasOwn(WEAPONS, weapon) || !state.loadout.weapons.includes(weapon) || state.weapon === weapon || clock - state.lastSwitch < equipTime(state.weapon)) return false
    // Complete the visible melee swing before allowing a different weapon.
    if (isMelee(state.weapon) && clock - state.lastSwing < WEAPONS[state.weapon].swing) return false
    game.cancelAttack()
    game.set({ weapon,...clearReload,lastSwitch:clock,attackReadyAt:Math.max(state.attackReadyAt,clock+equipTime(weapon)),time:clock })
    return true
  },
  cancelAttack: () => { pendingAttack=null; if (state.spinning || state.windupEnd) game.set({ spinning:false,spinStarted:-10,windupEnd:0 }) },
  trigger: (trace,automatic=false) => {
    if (!canAttack() || pendingAttack) return false
    const weapon=WEAPONS[state.weapon], rate=ultimateModifiers(state,clock).fireRate
    if (weapon.spinUp && !state.spinning) {
      game.set({ spinning:true,spinStarted:clock,windupStart:clock,windupEnd:clock+weapon.spinUp,attackReadyAt:clock+weapon.spinUp,time:clock })
      pendingAttack={ weapon:state.weapon,times:[clock+weapon.spinUp],trace,auto:automatic }
      return true
    }
    const times=shotOffsets(weapon,rate).map(offset=>clock+offset)
    if (weapon.windup) {
      game.set({ lastSwing:clock,windupStart:clock,windupEnd:times[0],attackReadyAt:clock+weapon.cooldown/rate,time:clock })
    } else { times.shift(); game.attack(trace()) }
    if (automatic && !times.length) times.push(state.attackReadyAt)
    if (times.length && !state.reloading) pendingAttack={ weapon:state.weapon,times,trace,auto:automatic }
    return true
  },
  releaseTrigger: () => { if (pendingAttack?.auto || state.spinning) game.cancelAttack() },
  canAttack,
  attack: (hitRecords,queued=false) => {
    if (!queued ? !canAttack() : state.mode!=='playing' || state.reloading || (!isMelee(state.weapon) && !trainingNoReload(state,clock) && state.magazines[state.weapon]<=0)) return false
    const melee = WEAPONS[state.weapon].fireMode === 'melee', tuning = WEAPONS[state.weapon], modifiers = ultimateModifiers(state,clock)
    const patch = { attackReadyAt: queued && !tuning.spinUp ? state.attackReadyAt : clock + tuning.cooldown/modifiers.fireRate,windupEnd:0,time:clock,
      ...(melee ? { lastSwing:queued ? state.lastSwing : clock, swings: state.swings + 1 } : {
        magazines: { ...state.magazines,[state.weapon]:state.magazines[state.weapon]-(trainingNoReload(state,clock) ? 0 : 1) },
        weaponStats: { ...state.weaponStats,[state.weapon]:{ ...state.weaponStats[state.weapon],shots:state.weaponStats[state.weapon].shots+1 } },
        lastShot: clock, shot: state.shot + 1, shots: state.shots + 1,
      }),
    }
    const records = Number.isInteger(hitRecords) ? [{ targetId:hitRecords,distance:0 }] : Array.isArray(hitRecords) ? hitRecords : hitRecords?.hits || []
    if(!melee && hitRecords?.trail) queueShotTrail({ ...hitRecords.trail,scope:`training:${state.generation}`,id:'self',shot:patch.shot,weapon:state.weapon })
    if (!melee && !trainingNoReload(state,clock) && patch.magazines[state.weapon] === 0) Object.assign(patch,beginReload(state.weapon,'auto'))
    const damage = new Map()
    let headshot = false
    records.slice(0,tuning.pellets || 1).forEach(({ targetId,distance,region = 'body',transmission = 1 }) => {
      if ((Number.isInteger(targetId) && state.targets[targetId] && targetEnabled(targetId,state.training)) || targetId === OPPONENT.id) {
        const amount = Math.round(pelletDamage(tuning,distance,region)*modifiers.damage*Math.max(0,Math.min(1,transmission)))
        damage.set(targetId,(damage.get(targetId) || 0)+amount)
        if (amount>0 && region==='head' && (targetId===OPPONENT.id ? state.opponent.hp>0 : state.targets[targetId].hp>0)) headshot = true
      }
    })
    const result = damageTargets(state.targets,damage,clock)
    const courseDefeats={ aim:0,combat:0 }
    result.targets.forEach((target,index)=> { if(state.targets[index].hp>0 && target.hp===0 && Object.hasOwn(courseDefeats,TRAINING_TARGETS[index].course)) courseDefeats[TRAINING_TARGETS[index].course]++ })
    result.defeated-=courseDefeats.aim
    patch.training=recordCourseShot(state.training,tuning,courseDefeats,runtime.position)
    const enemy = damageOpponent(state.opponent,damage.get(OPPONENT.id) || 0,clock)
    Object.assign(patch,awardKill(state,clock,result.defeated+enemy.defeated,headshot))
    if (result.damage+enemy.damage > 0) {
      patch.targets = result.targets
      if (tuning.knockback) patch.targets=patch.targets.map((target,index)=> {
        if (!damage.has(index) || target.hp<=0) return target
        const origin=targetPosition(index,target)
        const direction=[-Math.sin(runtime.yaw),0,-Math.cos(runtime.yaw)]
        let distance=tuning.knockback
        for (const solid of TRAINING_SOLIDS) { const hit=rayBox(origin,direction,solid.position,solid.size.map(n=>n+0.7)); if (hit!==null) distance=Math.min(distance,Math.max(0,hit-0.02)) }
        return { ...target,offsetX:(target.offsetX || 0)+direction[0]*distance,offsetZ:(target.offsetZ || 0)+direction[2]*distance }
      })
      if (enemy.damage>0) patch.opponent = enemy.opponent
      Object.assign(patch,hitFeedback(result.damage+enemy.damage,result.defeated+enemy.defeated,headshot))
      if (melee) patch.meleeHits = state.meleeHits + 1
      else {
        patch.hits = state.hits + 1
        patch.weaponStats[state.weapon].hits += 1
      }
      patch.score = state.score+(result.defeated+courseDefeats.aim)*100+enemy.defeated*OPPONENT.score
      if(courseDefeats.aim) patch.targets=patch.targets.map((target,i)=>TRAINING_TARGETS[i].kind==='orb' && target.hp===0 ? { ...target,resetAt:clock+0.16 } : target)
    }
    game.set(patch)
    return true
  },
  tick: (dt, publish = true) => {
    if (state.mode !== 'playing') return
    clock += dt
    if (pendingAttack) {
      const pending=pendingAttack
      if (pending.weapon!==state.weapon || state.hp<=0 || state.reloading) game.cancelAttack()
      else if (pending.times[0]<=clock+1e-8) {
        const scheduled=pending.times.shift(); game.attack(pending.trace(),true)
        if (pending.auto && !state.reloading) { const next=scheduled+WEAPONS[state.weapon].cooldown/ultimateModifiers(state,clock).fireRate; pending.times.push(next); game.set({ attackReadyAt:next }) }
        if (!pending.times.length || state.reloading) pendingAttack=null
      }
    }
    const tactical = stepTrainingAbilities(state,clock,dt,{ x:runtime.position[0],y:runtime.position[1],z:runtime.position[2],yaw:runtime.yaw,pitch:runtime.pitch,crouched:runtime.crouched },publish)
    if (tactical) game.set(tactical)
    const course=stepCourses(state,clock,dt,runtime.position)
    state={ ...state,training:course.training,targets:course.targets }
    for(const shot of course.shots) {
      queueShotTrail({ ...shot,id:`bot-${state.training.combat.run}-${shot.index}`,scope:`training:${state.generation}`,weapon:'rifle' })
      game.damage(shot.damage)
    }
    if (!publish) return
    const time = clock
    const respawning = state.opponent.enabled && state.opponent.hp === 0 && time>=state.opponent.resetAt && time>=state.opponent.disabledUntil
    if (respawning) opponentPosition.splice(0,3,...OPPONENT.spawn)
    // An empty weapon whose reload was cancelled starts again after it is equipped.
    const autoReload = !trainingNoReload(state,time) && !state.reloading && WEAPONS[state.weapon].magazine && state.magazines[state.weapon] === 0 && time-state.lastSwitch >= equipTime(state.weapon)
    game.set({ time,ultimateShield:ultimateModifiers(state,time).effect==='shield' ? state.ultimateShield : 0,
      ...(state.reloading && time >= state.reloadEnd ? {
        magazines: { ...state.magazines,[state.reloadWeapon]:WEAPONS[state.reloadWeapon].magazine },
        ...clearReload,
      } : autoReload ? beginReload(state.weapon,'auto') : {}),
      ...(respawning ? {
        opponent:{ ...freshOpponent(true),defeats:state.opponent.defeats,attacks:state.opponent.attacks,hits:state.opponent.hits,respawns:state.opponent.respawns+1 },
      } : {}),
    })
  },
}
const identity = value => value
export function useGame(selector = identity) { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => selector(game.get())) }

