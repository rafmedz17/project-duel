export const PISTOL = { magazine:12,damage:20,cooldown:0.22,reload:1.5,range:70 }
export const BLADE = { damage:60,cooldown:0.65,range:2.6,swing:0.32 }
export const RIFLE = { magazine:30,damage:14,cooldown:0.12,reload:2,range:75 }
export const SHOTGUN = { magazine:6,damage:14,pellets:8,spread:0.065,fullDamageRange:6,minDamageMultiplier:0.35,cooldown:0.8,reload:2.3,range:24 }
export const WEAPON_SWITCH = 0.25
export const WEAPONS = {
  pistol:{ ...PISTOL,name:'ENERGY PISTOL',shortName:'PISTOL',slot:'2',binding:'Digit2',fireMode:'semi' },
  blade:{ ...BLADE,name:'ENERGY BLADE',shortName:'BLADE',slot:'3',binding:'Digit3',fireMode:'melee' },
  rifle:{ ...RIFLE,name:'PULSE RIFLE',shortName:'RIFLE',slot:'1',binding:'Digit1',fireMode:'auto' },
  shotgun:{ ...SHOTGUN,name:'PLASMA SHOTGUN',shortName:'SHOTGUN',slot:'1',binding:'Digit1',fireMode:'semi' },
}
export const WEAPON_IDS = Object.keys(WEAPONS)
export const DAMAGE_MULTIPLIERS = Object.freeze({ head:2,body:1,limb:0.75,foot:0.5 })
export function pelletDamage(weapon,distance,region = 'body') {
  if (!Number.isFinite(distance) || distance<0 || distance>weapon.range || !Object.hasOwn(DAMAGE_MULTIPLIERS,region)) return 0
  const falloff = weapon.pellets ? Math.max(0,(distance-weapon.fullDamageRange)/(weapon.range-weapon.fullDamageRange)) : 0
  const base = Math.round(weapon.damage*(1-falloff*(1-(weapon.minDamageMultiplier ?? 1))))
  return Math.round(base*DAMAGE_MULTIPLIERS[region])
}
