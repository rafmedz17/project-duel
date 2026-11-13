import { WEAPONS,equipTime } from '../../../shared/weapons.js'

export const SENSITIVITY_CATEGORIES=Object.freeze([
  ['RIFLE','Rifle'],['SNIPER','Sniper'],['SMG','SMG'],['LMG','LMG'],['SHOTGUN','Shotgun'],['PISTOL','Pistol'],['MELEE','Melee'],
])
export const DEFAULT_WEAPON_SENSITIVITY=Object.freeze(Object.fromEntries(SENSITIVITY_CATEGORIES.map(([id])=>[id,Object.freeze({look:1,ads:1,firing:1})])))
const bounded=(value,min,max,fallback=1)=>typeof value==='number' && Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : fallback
export function cleanWeaponSensitivity(value) {
  return Object.fromEntries(SENSITIVITY_CATEGORIES.map(([id])=> {
    const v=value && typeof value==='object' && !Array.isArray(value) && Object.hasOwn(value,id) ? value[id] : null
    return [id,Object.fromEntries(['look','ads','firing'].map(mode=>[mode,bounded(v?.[mode],.1,3)]))]
  }))
}

// The same multiplier serves both input controllers. These are separate camera
// profiles: firing overrides ADS instead of multiplying two reductions together.
export function lookMultiplier(settings,state,time,{aiming=false,firing=false}={}) {
  const base=bounded(settings.sensitivity,.2,3),weapon=state && WEAPONS[state.weapon]
  if(!weapon) return base
  const ready=state.hp>0 && !state.reloading && time-(state.lastSwitch ?? -10)>=equipTime(state.weapon)
  const mode=ready && firing ? 'firing' : ready && aiming && weapon.category!=='MELEE' ? 'ads' : 'look'
  return base*bounded(settings.weaponSensitivity?.[weapon.category]?.[mode],.1,3)
}
