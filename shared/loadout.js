import { WEAPON_IDS } from './weapons.js'
import { ABILITIES } from './abilities.js'

export const DEFAULT_LOADOUT = Object.freeze({ startingWeapon:'pistol',weapons:Object.freeze([...WEAPON_IDS]),abilities:Object.freeze(Object.keys(ABILITIES)) })
export function validateLoadout(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null
  if (Object.keys(value).some(key => !['startingWeapon','weapons','abilities'].includes(key))) return null
  if (typeof value.startingWeapon!=='string' || !Array.isArray(value.weapons) || !Array.isArray(value.abilities)) return null
  if (!value.weapons.length || value.weapons.length>4 || value.abilities.length>4 || !value.weapons.includes(value.startingWeapon)) return null
  if (new Set(value.weapons).size!==value.weapons.length || new Set(value.abilities).size!==value.abilities.length) return null
  if (!value.weapons.every(id => WEAPON_IDS.includes(id)) || !value.abilities.every(id => typeof id==='string' && Object.hasOwn(ABILITIES,id))) return null
  return { startingWeapon:value.startingWeapon,weapons:WEAPON_IDS.filter(id => value.weapons.includes(id)),abilities:Object.keys(ABILITIES).filter(id => value.abilities.includes(id)) }
}
