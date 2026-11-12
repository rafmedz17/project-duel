import { DEFAULT_LOADOUT, validateLoadout } from '../../../shared/loadout.js'
import { useSyncExternalStore } from 'react'
import { BLADE, WEAPONS, WEAPON_SWITCH, TARGET, TARGETS, HAZARD, ABILITIES, OPPONENT } from './config.js'
import { damageTargets, pelletDamage } from './combatRules.js'
import { freshOpponent, damageOpponent } from './opponents/opponentRules.js'

const defaults = { sensitivity: 1, fps: false, quality: 'Medium' }
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('duel-settings')) || {}
    return { sensitivity: Math.max(0.2, Math.min(3, Number(saved.sensitivity) || 1)), fps: saved.fps === true, quality: ['Low', 'Medium', 'High'].includes(saved.quality) ? saved.quality : 'Medium' }
  } catch { return defaults }
}
const fresh = () => ({
  hp: 100, weapon: 'pistol', loadout:DEFAULT_LOADOUT,
  magazines: Object.fromEntries(Object.entries(WEAPONS).filter(([,w]) => w.magazine).map(([id,w]) => [id,w.magazine])),
  weaponStats: Object.fromEntries(Object.entries(WEAPONS).filter(([,w]) => w.magazine).map(([id]) => [id,{ shots:0,hits:0 }])),
  reloading: false, reloadWeapon: null, reloadStart: 0, reloadEnd: 0, reloadReason: null, attackReadyAt: 0, lastSwitch: -10, lastShot: -10, lastSwing: -10,
  shot: 0, swings: 0, meleeHits: 0, hit: -10, hitId: 0, hitDamage: 0, hitDefeated: 0, hitHeadshot: false, hurt: -10, score: 0, hits: 0, shots: 0, time: 0,
  shieldCharge: 0, shieldHit: -10, empHits: 0,
  abilities: Object.fromEntries(Object.keys(ABILITIES).map(id => [id,{ readyAt:0,activeUntil:0,startedAt:-10,uses:0,origin:[0,0,0],direction:[0,-1],result:0 }])),
  hazards: HAZARD.centers.map(() => ({ disabledUntil:0 })),
  targets: TARGETS.map(() => ({ hp: TARGET.health, hit: -10, resetAt: 0, disabledUntil:0 })),
  opponent: freshOpponent(),
})
let state = { ...fresh(), mode: 'menu', ready: false, error: '', generation: 0, settings: loadSettings(), fps: 0 }
// Attack timing uses the frame clock; React receives time snapshots at 20 Hz.
let clock = 0
const opponentPosition = [...OPPONENT.spawn]
const listeners = new Set()
function canAttack() {
  return state.mode === 'playing' && !state.reloading && clock >= state.attackReadyAt &&
    (WEAPONS[state.weapon].fireMode === 'melee' || state.magazines[state.weapon] > 0)
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
  now: () => clock,
  set: (patch) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()) },
  reset: ({ opponentEnabled = false,loadout = DEFAULT_LOADOUT } = {}) => {
    const equipped = validateLoadout(loadout) || DEFAULT_LOADOUT; clock = 0; opponentPosition.splice(0,3,...OPPONENT.spawn); game.set({ ...fresh(),loadout:equipped,weapon:equipped.startingWeapon,opponent:freshOpponent(opponentEnabled),generation: state.generation + 1 }) },
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
  settings: (patch) => {
    const settings = { ...state.settings, ...patch }
    try { localStorage.setItem('duel-settings', JSON.stringify(settings)) } catch { /* Storage may be disabled. */ }
    game.set({ settings })
  },
  damage: (amount) => {
    if (state.mode !== 'playing' || !Number.isFinite(amount) || amount <= 0) return
    const absorbed = clock < state.abilities.shield.activeUntil ? Math.min(state.shieldCharge,amount) : 0
    const healthDamage = amount-absorbed
    game.set({ hp: Math.max(0, state.hp-healthDamage), shieldCharge:Math.max(0,state.shieldCharge-absorbed), ...(absorbed ? { shieldHit:clock } : {}), ...(healthDamage ? { hurt:clock } : {}), time: clock })
    if (state.hp === 0) { document.exitPointerLock(); game.set({ mode: 'dead' }) }
  },
  activateAbility: (id,{ position = [0,0,0], direction = [0,-1] } = {}) => {
    if (state.mode !== 'playing' || !Object.hasOwn(ABILITIES,id) || !state.loadout.abilities.includes(id) || clock < state.abilities[id].readyAt) return false
    if (position.length !== 3 || !position.every(Number.isFinite) || direction.length !== 2 || !direction.every(Number.isFinite)) return false
    const tuning = ABILITIES[id], previous = state.abilities[id]
    const length = Math.hypot(...direction) || 1
    const ability = { ...previous,readyAt:clock+tuning.cooldown,activeUntil:clock+tuning.duration,startedAt:clock,uses:previous.uses+1,origin:[...position],direction:direction.map(n => n/length),result:0 }
    const patch = { time:clock }
    if (id === 'shield') patch.shieldCharge = tuning.capacity
    if (id === 'emp') {
      const damage = new Map()
      TARGETS.forEach((target,index) => { if (Math.hypot(...target.map((v,axis) => v-position[axis])) <= tuning.radius) damage.set(index,tuning.damage) })
      const disabled = state.targets.map((target,index) => damage.has(index) ? { ...target,disabledUntil:clock+tuning.duration } : target)
      const result = damageTargets(disabled,damage,clock)
      const nearbyOpponent = state.opponent.enabled && state.opponent.hp>0 && Math.hypot(...opponentPosition.map((v,axis) => v-position[axis]))<=tuning.radius
      const enemy = damageOpponent(nearbyOpponent ? { ...state.opponent,disabledUntil:clock+tuning.duration,phase:'jammed' } : state.opponent,nearbyOpponent ? tuning.damage : 0,clock)
      if (nearbyOpponent) patch.opponent = enemy.opponent
      patch.targets = result.targets
      patch.score = state.score+result.defeated*100+enemy.defeated*OPPONENT.score
      patch.empHits = state.empHits+result.affected+(enemy.damage>0 ? 1 : 0)
      patch.hazards = state.hazards.map((hazard,index) => Math.hypot(HAZARD.centers[index]-position[0],position[1],HAZARD.z-position[2]) <= tuning.radius ? { disabledUntil:clock+tuning.duration } : hazard)
      ability.result = result.affected+(nearbyOpponent ? 1 : 0)+patch.hazards.filter((h,i) => h.disabledUntil>state.hazards[i].disabledUntil).length
      if (result.damage+enemy.damage > 0) Object.assign(patch,hitFeedback(result.damage+enemy.damage,result.defeated+enemy.defeated))
    }
    patch.abilities = { ...state.abilities,[id]:ability }
    game.set(patch)
    return true
  },
  reload: () => {
    const tuning = WEAPONS[state.weapon]
    if (state.mode === 'playing' && tuning.magazine && !state.reloading && state.magazines[state.weapon] < tuning.magazine && clock-state.lastSwitch >= WEAPON_SWITCH) {
      game.set({ ...beginReload(state.weapon,'manual'),time:clock })
    }
  },
  switchWeapon: (weapon) => {
    if (state.mode !== 'playing' || !Object.hasOwn(WEAPONS, weapon) || !state.loadout.weapons.includes(weapon) || state.weapon === weapon || clock - state.lastSwitch < WEAPON_SWITCH) return false
    // Complete the visible melee swing before allowing a different weapon.
    if (state.weapon === 'blade' && clock - state.lastSwing < BLADE.swing) return false
    game.set({ weapon,...clearReload,lastSwitch:clock,attackReadyAt:Math.max(state.attackReadyAt,clock+WEAPON_SWITCH),time:clock })
    return true
  },
  canAttack,
  attack: (hitRecords) => {
    if (!canAttack()) return false
    const melee = WEAPONS[state.weapon].fireMode === 'melee', tuning = WEAPONS[state.weapon]
    const patch = { attackReadyAt: clock + tuning.cooldown, time: clock,
      ...(melee ? { lastSwing: clock, swings: state.swings + 1 } : {
        magazines: { ...state.magazines,[state.weapon]:state.magazines[state.weapon]-1 },
        weaponStats: { ...state.weaponStats,[state.weapon]:{ ...state.weaponStats[state.weapon],shots:state.weaponStats[state.weapon].shots+1 } },
        lastShot: clock, shot: state.shot + 1, shots: state.shots + 1,
      }),
    }
    const records = Number.isInteger(hitRecords) ? [{ targetId:hitRecords,distance:0 }] : Array.isArray(hitRecords) ? hitRecords : []
    if (!melee && patch.magazines[state.weapon] === 0) Object.assign(patch,beginReload(state.weapon,'auto'))
    const damage = new Map()
    let headshot = false
    records.slice(0,tuning.pellets || 1).forEach(({ targetId,distance,region = 'body' }) => {
      if ((Number.isInteger(targetId) && state.targets[targetId]) || targetId === OPPONENT.id) {
        const amount = pelletDamage(tuning,distance,region)
        damage.set(targetId,(damage.get(targetId) || 0)+amount)
        if (amount>0 && region==='head' && (targetId===OPPONENT.id ? state.opponent.hp>0 : state.targets[targetId].hp>0)) headshot = true
      }
    })
    const result = damageTargets(state.targets,damage,clock)
    const enemy = damageOpponent(state.opponent,damage.get(OPPONENT.id) || 0,clock)
    if (result.damage+enemy.damage > 0) {
      patch.targets = result.targets
      if (enemy.damage>0) patch.opponent = enemy.opponent
      Object.assign(patch,hitFeedback(result.damage+enemy.damage,result.defeated+enemy.defeated,headshot))
      if (melee) patch.meleeHits = state.meleeHits + 1
      else {
        patch.hits = state.hits + 1
        patch.weaponStats[state.weapon].hits += 1
      }
      patch.score = state.score+result.defeated*100+enemy.defeated*OPPONENT.score
    }
    game.set(patch)
    return true
  },
  tick: (dt, publish = true) => {
    if (state.mode !== 'playing') return
    clock += dt
    if (!publish) return
    const time = clock
    const respawning = state.opponent.enabled && state.opponent.hp === 0 && time>=state.opponent.resetAt && time>=state.opponent.disabledUntil
    if (respawning) opponentPosition.splice(0,3,...OPPONENT.spawn)
    // An empty weapon whose reload was cancelled starts again after it is equipped.
    const autoReload = !state.reloading && WEAPONS[state.weapon].magazine && state.magazines[state.weapon] === 0 && time-state.lastSwitch >= WEAPON_SWITCH
    game.set({ time,
      ...(state.reloading && time >= state.reloadEnd ? {
        magazines: { ...state.magazines,[state.reloadWeapon]:WEAPONS[state.reloadWeapon].magazine },
        ...clearReload,
      } : autoReload ? beginReload(state.weapon,'auto') : {}),
      targets: state.targets.map(t => t.hp === 0 && time >= t.resetAt && time >= t.disabledUntil ? { hp: TARGET.health, hit: -10, resetAt: 0, disabledUntil:0 } : t),
      ...(respawning ? {
        opponent:{ ...freshOpponent(true),defeats:state.opponent.defeats,attacks:state.opponent.attacks,hits:state.opponent.hits,respawns:state.opponent.respawns+1 },
      } : {}),
    })
  },
}
const identity = value => value
export function useGame(selector = identity) { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => selector(game.get())) }

