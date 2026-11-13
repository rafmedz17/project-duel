import { DEFAULT_LOADOUT,validateLoadout,migrateLoadout } from './loadout.js'
export const LOADOUT_SLOT_COUNT=5
export const validSlot=slot=>Number.isInteger(slot) && slot>=0 && slot<LOADOUT_SLOT_COUNT
// Presets always deploy with their primary, including saves made before this rule.
function deployLoadout(value) {
  const gear=validateLoadout(value)
  return gear ? { ...gear,startingWeapon:gear.primary } : null
}
export function makeLoadoutBank(loadout=DEFAULT_LOADOUT,activeSlot=0) {
  const gear=deployLoadout(loadout) || DEFAULT_LOADOUT
  return { activeSlot:validSlot(activeSlot) ? activeSlot : 0,slots:Array.from({ length:LOADOUT_SLOT_COUNT },()=>deployLoadout(gear)) }
}
export function validateLoadoutBank(value) {
  if(!value || Object.keys(value).some(key=>!['activeSlot','slots'].includes(key)) || !validSlot(value.activeSlot) || !Array.isArray(value.slots) || value.slots.length!==LOADOUT_SLOT_COUNT) return null
  const slots=Array.from(value.slots,deployLoadout)
  return slots.every(Boolean) ? { activeSlot:value.activeSlot,slots } : null
}
export function loadoutFromRow(row) {
  return row ? deployLoadout(migrateLoadout({ ...(row.character_id ? { character:row.character_id,primary:row.primary_weapon,secondary:row.secondary_weapon,melee:row.melee_weapon,unique:row.unique_skill } : {}),startingWeapon:row.starting_weapon,weapons:row.weapons,abilities:row.abilities })) : DEFAULT_LOADOUT
}
export function bankFromRows(current,rows=[]) {
  const loadout=loadoutFromRow(current)
  if(!loadout || !Array.isArray(rows)) return null
  const bank=makeLoadoutBank(loadout,current?.active_slot ?? 0)
  for(const row of rows) {
    const gear=loadoutFromRow(row)
    if(!validSlot(row.slot_id) || !gear) return null
    bank.slots[row.slot_id]=gear
  }
  bank.slots[bank.activeSlot]=loadout
  return bank
}
