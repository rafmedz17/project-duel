import { WEAPON_IDS } from './weapons.js'
import { UNIQUE_SKILLS } from './abilities.js'
import { CHARACTER_IDS } from './characters.js'

export const PRIMARY_WEAPONS = Object.freeze({
  rifle:{ name:'PULSE RIFLE',category:'RIFLE',available:true,description:'Precise automatic fire. Reliable at medium range.' },
  shotgun:{ name:'PLASMA SHOTGUN',category:'SHOTGUN',available:true,description:'Heavy close-range pellet bursts.' },
  sniper:{ name:'SNIPER',category:'SNIPER',available:false,description:'Long-range precision · Coming soon.' },
  smg:{ name:'SMG',category:'SMG',available:false,description:'Fast close-range handling · Coming soon.' },
  lmg:{ name:'LMG',category:'LMG',available:false,description:'Sustained suppressive fire · Coming soon.' },
})
function equipment(character,primary,unique,startingWeapon = 'pistol') {
  return { character,primary,unique,startingWeapon,weapons:WEAPON_IDS.filter(id => [primary,'pistol','blade'].includes(id)),abilities:['dash','shield',unique,'ultimate'] }
}
export const DEFAULT_LOADOUT = Object.freeze(equipment('vex','rifle','flashbang'))
export function validateLoadout(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null
  if (Object.keys(value).some(key => !['character','primary','unique','startingWeapon','weapons','abilities'].includes(key))) return null
  const { character,primary,unique } = value
  if (!CHARACTER_IDS.includes(character) || typeof primary!=='string' || !Object.hasOwn(PRIMARY_WEAPONS,primary) || !PRIMARY_WEAPONS[primary].available || !UNIQUE_SKILLS.includes(unique)) return null
  const startingWeapon = value.startingWeapon ?? 'pistol'
  if (![primary,'pistol','blade'].includes(startingWeapon)) return null
  const result = equipment(character,primary,unique,startingWeapon)
  for (const key of ['weapons','abilities']) {
    if (!Object.hasOwn(value,key)) continue
    const items = value[key]
    if (!Array.isArray(items) || items.length!==result[key].length || new Set(items).size!==items.length || !items.every(id => result[key].includes(id))) return null
  }
  return result
}
export function migrateLoadout(value) {
  const current = validateLoadout(value)
  if (current) return current
  if (!value || typeof value!=='object' || Object.hasOwn(value,'character') || !Array.isArray(value.weapons) || !Array.isArray(value.abilities)) return null
  if (!value.weapons.length || value.weapons.length>4 || new Set(value.weapons).size!==value.weapons.length || !value.weapons.every(id => WEAPON_IDS.includes(id))) return null
  if (value.abilities.length>4 || new Set(value.abilities).size!==value.abilities.length || !value.abilities.every(id => ['dash','shield','scanner','emp'].includes(id)) || !value.weapons.includes(value.startingWeapon)) return null
  const primary = ['rifle','shotgun'].includes(value.startingWeapon) ? value.startingWeapon : value.weapons.includes('rifle') ? 'rifle' : value.weapons.includes('shotgun') ? 'shotgun' : 'rifle'
  return equipment('vex',primary,value.abilities.includes('scanner') ? 'scanner' : 'flashbang',[primary,'pistol','blade'].includes(value.startingWeapon) ? value.startingWeapon : 'pistol')
}
export const weaponSlots = loadout => [loadout.primary,'pistol','blade']
export function weaponForBinding(loadout,code) {
  return code==='Digit1' ? loadout.primary : code==='Digit2' ? 'pistol' : code==='Digit3' ? 'blade' : null
}
