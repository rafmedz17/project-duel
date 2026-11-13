import { WEAPONS,PRIMARY_IDS,SECONDARY_IDS,MELEE_IDS } from './weapons.js'
import { UNIQUE_SKILLS } from './abilities.js'
import { CHARACTER_IDS } from './characters.js'

export const PRIMARY_WEAPONS=Object.freeze(Object.fromEntries(PRIMARY_IDS.map(id=>[id,WEAPONS[id]])))
function equipment(character,primary,unique,startingWeapon=primary,secondary='pistol',melee='blade') {
  return { character,primary,secondary,melee,unique,startingWeapon,weapons:[secondary,melee,primary],abilities:['dash','shield',unique,'ultimate'] }
}
export const DEFAULT_LOADOUT=Object.freeze(equipment('vex','rifle','flashbang'))
export function validateLoadout(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null
  if (Object.keys(value).some(key=>!['character','primary','secondary','melee','unique','startingWeapon','weapons','abilities'].includes(key))) return null
  const { character,primary,unique,secondary='pistol',melee='blade' }=value
  if (!CHARACTER_IDS.includes(character) || !PRIMARY_IDS.includes(primary) || !SECONDARY_IDS.includes(secondary) || !MELEE_IDS.includes(melee) || !UNIQUE_SKILLS.includes(unique)) return null
  const startingWeapon=value.startingWeapon ?? primary
  if (![primary,secondary,melee].includes(startingWeapon)) return null
  const result=equipment(character,primary,unique,startingWeapon,secondary,melee)
  for (const key of ['weapons','abilities']) {
    if (!Object.hasOwn(value,key)) continue
    const items=value[key]
    if (!Array.isArray(items) || items.length!==result[key].length || new Set(items).size!==items.length || !items.every(id=>result[key].includes(id))) return null
  }
  return result
}
export function migrateLoadout(value) {
  const current=validateLoadout(value)
  if (current) return current
  if (!value || typeof value!=='object' || Object.hasOwn(value,'character') || !Array.isArray(value.weapons) || !Array.isArray(value.abilities)) return null
  if (!value.weapons.length || value.weapons.length>4 || new Set(value.weapons).size!==value.weapons.length || !value.weapons.every(id=>['rifle','shotgun','pistol','blade'].includes(id))) return null
  if (value.abilities.length>4 || new Set(value.abilities).size!==value.abilities.length || !value.abilities.every(id=>['dash','shield','scanner','emp'].includes(id)) || !value.weapons.includes(value.startingWeapon)) return null
  const primary=['rifle','shotgun'].includes(value.startingWeapon) ? value.startingWeapon : value.weapons.includes('rifle') ? 'rifle' : value.weapons.includes('shotgun') ? 'shotgun' : 'rifle'
  return equipment('vex',primary,value.abilities.includes('scanner') ? 'scanner' : 'flashbang',value.startingWeapon)
}
export const weaponSlots=loadout=>[loadout.primary,loadout.secondary || 'pistol',loadout.melee || 'blade']
export function weaponForBinding(loadout,code) {
  return code==='Digit1' ? loadout.primary : code==='Digit2' ? (loadout.secondary || 'pistol') : code==='Digit3' ? (loadout.melee || 'blade') : null
}
